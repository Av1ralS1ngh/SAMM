import { ethers } from 'ethers';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadAbi(name) {
  const p = path.resolve(__dirname, `../../abi/${name}.json`);
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed; // pure ABI array
    if (parsed.abi) return parsed.abi; // standard foundry artifact shape
    throw new Error('Unrecognized ABI shape');
  } catch (e) {
    console.error(`[BlockchainService] Failed to load ABI for ${name}:`, e.message);
    return [];
  }
}

const ABIS = {
  OrbitalPool: loadAbi('OrbitalPool'),
  X402SessionManager: loadAbi('X402SessionManager'),
  X402PaymentAdapter: loadAbi('X402PaymentAdapter'),
  MockERC20: loadAbi('MockERC20'),
};

class BlockchainService {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.addresses = {
      pool: config.blockchain.poolAddress,
      sessionManager: config.blockchain.sessionManager,
      paymentAdapter: config.blockchain.paymentAdapter,
      tokens: config.blockchain.tokenAddresses || {},
    };

    if (this.addresses.pool && ABIS.OrbitalPool.length) {
      this.orbitalPool = new ethers.Contract(this.addresses.pool, ABIS.OrbitalPool, this.provider);
    } else {
      console.warn('[BlockchainService] OrbitalPool not initialized (missing address or ABI).');
    }
    if (this.addresses.sessionManager && ABIS.X402SessionManager.length) {
      this.sessionManager = new ethers.Contract(this.addresses.sessionManager, ABIS.X402SessionManager, this.provider);
    }
    if (this.addresses.paymentAdapter && ABIS.X402PaymentAdapter.length) {
      this.paymentAdapter = new ethers.Contract(this.addresses.paymentAdapter, ABIS.X402PaymentAdapter, this.provider);
    }
  }

  _assertContract() {
    if (!this.orbitalPool) throw new Error('OrbitalPool contract not initialized');
  }

  async getPoolInfo() {
    // Fallback: if contract not initialized yet, attempt to synthesize token list
    if (!this.orbitalPool) {
      const configured = Object.entries(this.addresses.tokens || {}).filter(([,addr]) => !!addr);
      const tokens = [];
      for (const [symbolHint, addr] of configured) {
        try {
          const erc = new ethers.Contract(addr, ['function symbol() view returns (string)','function decimals() view returns (uint8)'], this.provider);
          let symbol = symbolHint;
            try { symbol = await erc.symbol(); } catch (_) {}
          let decimals = 18; try { decimals = await erc.decimals(); } catch (_) {}
          tokens.push({ address: addr, symbol, decimals });
        } catch (e) {
          tokens.push({ address: addr, symbol: symbolHint || 'TOKEN', decimals: 18 });
        }
      }
      return { tokens, pool: this.addresses.pool || null, fallback: true, note: 'Returned from config fallback (contract not initialized)' };
    }
    try {
      const tokenCount = await this.orbitalPool.tokenCount();
      const tokens = [];
      for (let i = 0; i < tokenCount; i++) {
        const tokenAddress = await this.orbitalPool.tokens(i);
        const erc = new ethers.Contract(tokenAddress, ['function symbol() view returns (string)','function decimals() view returns (uint8)'], this.provider);
        let symbol = 'UNKNOWN'; let decimals = null;
        try { symbol = await erc.symbol(); } catch (_) {}
        try { decimals = await erc.decimals(); } catch (_) {}
        tokens.push({ address: tokenAddress, symbol, decimals });
      }
      return { tokens, pool: this.addresses.pool };
    } catch (error) {
      console.error('Error getting pool info:', error);
      throw error;
    }
  }

  async getReserves() {
    this._assertContract();
    // Try totalReserves() array first, fallback to getReserves() legacy
    try {
      if (typeof this.orbitalPool.totalReserves === 'function') {
        const r = await this.orbitalPool.totalReserves();
        return Array.isArray(r) ? r.map(x => x.toString()) : [];
      }
    } catch (_) {}
    try {
      if (typeof this.orbitalPool.getReserves === 'function') {
        const r = await this.orbitalPool.getReserves();
        return Array.isArray(r) ? r.map(x => x.toString()) : [];
      }
    } catch (e) {
      console.error('Error fetching reserves:', e.message);
      throw e;
    }
    return [];
  }

  async getQuote(tokenIn, tokenOut, amountIn) {
    this._assertContract();
    const amt = ethers.BigNumber.from(amountIn);
    // Prefer on-chain view if exists
    if (typeof this.orbitalPool.getAmountOut === 'function') {
      try {
        const quote = await this.orbitalPool.getAmountOut(tokenIn, tokenOut, amt);
        return quote.toString();
      } catch (error) {
        console.warn('getAmountOut failed, falling back to constant product approximation:', error.message);
      }
    }
    // Fallback approximation using first two reserves (demo only)
    const reserves = await this.getReserves();
    if (reserves.length < 2) return '0';
    const reserveIn = ethers.BigNumber.from(reserves[0]);
    const reserveOut = ethers.BigNumber.from(reserves[1]);
    if (reserveIn.isZero() || reserveOut.isZero()) return '0';
    const amountInWithFee = amt; // fee omitted in demo
    const newReserveIn = reserveIn.add(amountInWithFee);
    const k = reserveIn.mul(reserveOut);
    const newReserveOut = k.div(newReserveIn);
    const amountOut = reserveOut.sub(newReserveOut);
    return amountOut.toString();
  }

  async getPoolStats() {
    this._assertContract();
    try {
      const reserves = await this.getReserves();
      const response = {
        reserves,
        totalVolume: null,
        notes: 'totalVolume omitted: function not present or reverted'
      };
      if (typeof this.orbitalPool.totalVolume === 'function') {
        try {
          const vol = await this.orbitalPool.totalVolume();
            response.totalVolume = vol.toString();
            response.notes = undefined;
        } catch (_) { /* ignore */ }
      }
      return response;
    } catch (error) {
      console.error('Error getting pool stats:', error);
      throw error;
    }
  }

  async getSpotPrice(tokenAIndex, tokenBIndex) {
    this._assertContract();
    if (typeof this.orbitalPool.getSpotPrice !== 'function') throw new Error('getSpotPrice not available');
    const price = await this.orbitalPool.getSpotPrice(tokenAIndex, tokenBIndex);
    return price.toString();
  }

  async getTickEfficiency(idx) {
    this._assertContract();
    if (typeof this.orbitalPool.getTickEfficiency !== 'function') throw new Error('getTickEfficiency not available');
    const eff = await this.orbitalPool.getTickEfficiency(idx);
    return eff.toString();
  }

  async getUserTicks(user) {
    this._assertContract();
    if (typeof this.orbitalPool.getUserTicks !== 'function') throw new Error('getUserTicks not available');
    const ticks = await this.orbitalPool.getUserTicks(user);
    return ticks.map(x => x.toString());
  }

  async getTickInfo(idx) {
    this._assertContract();
    if (typeof this.orbitalPool.getTickInfo !== 'function') throw new Error('getTickInfo not available');
    const info = await this.orbitalPool.getTickInfo(idx);
    return {
      radius: info[0].toString(),
      planeConstant: info[1].toString(),
      isInterior: info[2],
      owner: info[3],
      reserves: info[4].map(r => r.toString()),
    };
  }

  async getSessionRemaining(sessionId) {
    if (!this.sessionManager) throw new Error('SessionManager not initialized');
    if (typeof this.sessionManager.remaining !== 'function') throw new Error('remaining() not available');
    const rem = await this.sessionManager.remaining(sessionId);
    return rem.toString();
  }

  buildAddLiquidityCalldata({ amounts, planeConstant }) {
    this._assertContract();
    if (!Array.isArray(amounts)) throw new Error('amounts must be array');
    const data = this.orbitalPool.interface.encodeFunctionData('addLiquidity', [amounts, planeConstant]);
    return { to: this.orbitalPool.address, data, value: '0x0' };
  }

  buildRemoveLiquidityCalldata({ idx, fraction }) {
    this._assertContract();
    const data = this.orbitalPool.interface.encodeFunctionData('removeLiquidity', [idx, fraction]);
    return { to: this.orbitalPool.address, data, value: '0x0' };
  }

  buildSwapCalldata({ tokenIn, tokenOut, amountIn, minAmountOut }) {
    this._assertContract();
    if (typeof this.orbitalPool.interface.encodeFunctionData !== 'function') {
      throw new Error('Contract interface encodeFunctionData unavailable');
    }
    const data = this.orbitalPool.interface.encodeFunctionData('swap', [
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
    ]);
    return { to: this.orbitalPool.address, data, value: '0x0' };
  }
}

export const blockchainService = new BlockchainService();