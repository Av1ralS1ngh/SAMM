#!/usr/bin/env node
import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

/*
 * Seed liquidity script
 * - Approves pool for both tokens
 * - Calls addLiquidity on OrbitalPool with provided amounts
 * Env vars (required):
 *   PRIVATE_KEY
 *   CHAIN_RPC_URL
 *   ORBITALPOOL_ADDRESS (or CONTRACT_ADDRESS)
 *   USDC, PYUSD (token addresses)
 * Optional:
 *   SEED_AMOUNT_USDC (default 1000000 = 1.0 USDC if 6 decimals)
 *   SEED_AMOUNT_PYUSD (default 1000000)
 *   PLANE_CONSTANT (default 0)
 */

function loadAbi(name) {
  const local = path.resolve('abi', `${name}.json`);
  const raw = fs.readFileSync(local, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.abi;
}

const REQUIRED = ['PRIVATE_KEY','CHAIN_RPC_URL'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[seed-liquidity] Missing env var ${key}`);
    process.exit(1);
  }
}

const rpcUrl = process.env.CHAIN_RPC_URL;
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const poolAddress = process.env.ORBITALPOOL_ADDRESS || process.env.CONTRACT_ADDRESS;
if (!poolAddress) {
  console.error('[seed-liquidity] Missing ORBITALPOOL_ADDRESS/CONTRACT_ADDRESS');
  process.exit(1);
}

const tokenA = process.env.USDC;
const tokenB = process.env.PYUSD;
if (!tokenA || !tokenB) {
  console.error('[seed-liquidity] Missing token env addresses USDC / PYUSD');
  process.exit(1);
}

const amountA = ethers.BigNumber.from(process.env.SEED_AMOUNT_USDC || '1000000');
const amountB = ethers.BigNumber.from(process.env.SEED_AMOUNT_PYUSD || '1000000');
const planeConstant = ethers.BigNumber.from(process.env.PLANE_CONSTANT || '0');

const erc20Abi = [
  'function approve(address spender,uint256 amount) external returns(bool)',
  'function allowance(address owner,address spender) view returns(uint256)',
  'function decimals() view returns(uint8)',
  'function symbol() view returns(string)',
  'function balanceOf(address) view returns(uint256)'
];

const poolAbi = loadAbi('OrbitalPool');

async function main() {
  console.log('[seed] Using wallet', wallet.address);
  const tokenAContract = new ethers.Contract(tokenA, erc20Abi, wallet);
  const tokenBContract = new ethers.Contract(tokenB, erc20Abi, wallet);
  const pool = new ethers.Contract(poolAddress, poolAbi, wallet);

  // Resolve symbols & decimals
  const [symA, symB, decA, decB, balA, balB] = await Promise.all([
    tokenAContract.symbol().catch(()=> 'TOKA'),
    tokenBContract.symbol().catch(()=> 'TOKB'),
    tokenAContract.decimals().catch(()=> 18),
    tokenBContract.decimals().catch(()=> 18),
    tokenAContract.balanceOf(wallet.address).catch(()=> ethers.BigNumber.from(0)),
    tokenBContract.balanceOf(wallet.address).catch(()=> ethers.BigNumber.from(0)),
  ]);

  if (balA.lt(amountA) || balB.lt(amountB)) {
    console.warn(`[seed] Insufficient balances. ${symA}: ${balA.toString()} needed ${amountA.toString()}, ${symB}: ${balB.toString()} needed ${amountB.toString()}`);
  }

  // Approvals if needed
  for (const [sym, contract, amt] of [[symA, tokenAContract, amountA],[symB, tokenBContract, amountB]]) {
    const current = await contract.allowance(wallet.address, poolAddress);
    if (current.lt(amt)) {
      console.log(`[seed] Approving ${sym} for amount ${amt.toString()}`);
      try {
        const tx = await contract.approve(poolAddress, amt, {
          gasLimit: ethers.utils.parseUnits('100000', 'wei'),
          gasPrice: await provider.getGasPrice()
        });
        console.log(`[seed] ${sym} approval tx submitted: ${tx.hash}`);
        
        // Wait with timeout
        const receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction timeout')), 60000)
          )
        ]);
        console.log(`[seed] ${sym} approval confirmed in block ${receipt.blockNumber}`);
      } catch (error) {
        console.error(`[seed] ${sym} approval failed:`, error.message);
        throw error;
      }
    } else {
      console.log(`[seed] Existing allowance for ${sym} sufficient (${current.toString()})`);
    }
  }

  console.log('[seed] Calling addLiquidity');
  try {
    const tx = await pool.addLiquidity([amountA, amountB], planeConstant, {
      gasLimit: ethers.utils.parseUnits('300000', 'wei'),
      gasPrice: await provider.getGasPrice()
    });
    console.log('[seed] Submitted tx:', tx.hash);
    
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction timeout')), 120000)
      )
    ]);
    console.log('[seed] Mined in block', receipt.blockNumber);
  } catch (error) {
    console.error('[seed] AddLiquidity failed:', error.message);
    throw error;
  }

  const reserves = await pool.getReserves();
  console.log('[seed] New reserves:', reserves.map(r=> r.toString()));
  console.log('[seed] DONE');
}

main().catch(e => { console.error('[seed] Error', e); process.exit(1); });
