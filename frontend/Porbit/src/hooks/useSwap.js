import { useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { ORBITAL_POOL_ABI } from '../abi/orbitalPool.js';

// Lazy import ethers only if fallback needed (avoid bundling weight if backend stays healthy)
let ethersLib = null;
async function getEthers() {
  if (!ethersLib) {
    ethersLib = await import('ethers');
  }
  return ethersLib;
}

// useSwap builds calldata via backend and sends transaction through injected provider
export function useSwap({ provider }) {
  const [txHash, setTxHash] = useState(null);
  const [building, setBuilding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, paymentId, poolAddress, chainId }) => {
    setError(null); setTxHash(null); setBuilding(true);
    let txRequest;
    try {
      try {
        const { to, data, value, chainId: backendChain } = await api.buildSwap({ tokenIn, tokenOut, amountIn, minAmountOut, paymentId });
        txRequest = { to, data, value: value || '0x0', chainId: backendChain || chainId };
      } catch (backendErr) {
        // Backend failed: attempt local encoding fallback
        const { ethers } = await getEthers();
        if (!poolAddress) throw backendErr; // cannot fallback without address
        const iface = new ethers.utils.Interface(ORBITAL_POOL_ABI);
        const data = iface.encodeFunctionData('swap', [tokenIn, tokenOut, amountIn, minAmountOut]);
        txRequest = { to: poolAddress, data, value: '0x0', chainId };
      }
      setBuilding(false); setSending(true);
      if (!provider || !provider.request) throw new Error('No wallet provider');
      const params = [txRequest];
      const hash = await provider.request({ method: 'eth_sendTransaction', params });
      setTxHash(hash);
      return hash;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setBuilding(false); setSending(false);
    }
  }, [provider]);

  return { execute, txHash, building, sending, error };
}
