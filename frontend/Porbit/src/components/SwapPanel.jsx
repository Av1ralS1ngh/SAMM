import React, { useState, useEffect } from 'react';
import { usePool } from '../hooks/usePool.js';
import { useQuote } from '../hooks/useQuote.js';
import { useSwap } from '../hooks/useSwap.js';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { toWei, fromWei } from '../lib/decimals.js';

export function SwapPanel({ provider, isConnected, onSuccess }) {
  const { info, loading: poolLoading } = usePool();
  const [tokenInAddr, setTokenInAddr] = useState('');
  const [tokenOutAddr, setTokenOutAddr] = useState('');
  const [amountInDisplay, setAmountInDisplay] = useState('');
  const [slippageBps, setSlippageBps] = useState(50); // 0.50%
  const [txStatus, setTxStatus] = useState(null);
  const [uiError, setUiError] = useState(null);
  const [chainId, setChainId] = useState(null);

  const tokens = info?.tokens || [];
  const tokenInMeta = tokens.find(t => t.address === tokenInAddr);
  const tokenOutMeta = tokens.find(t => t.address === tokenOutAddr);
  const amountInWei = amountInDisplay ? toWei(amountInDisplay, tokenInMeta?.decimals || 18) : '0';

  useEffect(() => {
    if (info?.tokens?.length && (!tokenInAddr || !tokenOutAddr)) {
      const [first, second] = info.tokens;
      if (first) setTokenInAddr(first.address);
      if (second) setTokenOutAddr(second.address);
    }
  }, [info, tokenInAddr, tokenOutAddr]);

  useEffect(() => {
    if (provider?.request) {
      provider.request({ method: 'eth_chainId' }).then(h => setChainId(parseInt(h,16))).catch(()=>{});
    } else if (provider?.chainId) setChainId(provider.chainId);
  }, [provider]);

  const { quote, loading: quoteLoading } = useQuote({ tokenIn: tokenInAddr, tokenOut: tokenOutAddr, amountIn: amountInWei && amountInWei !== '0' ? amountInWei : null });
  const { execute, txHash, building, sending, error: swapError } = useSwap({ provider });

  const onFlip = () => {
    setTokenInAddr(tokenOutAddr);
    setTokenOutAddr(tokenInAddr);
  };

  const disabled = !isConnected || !tokenInAddr || !tokenOutAddr || amountInWei === '0' || tokenInAddr === tokenOutAddr;

  const computeMinOut = () => {
    if (!quote) return null;
    try {
      const q = BigInt(quote);
      return (q * (10000n - BigInt(slippageBps))) / 10000n;
    } catch { return null; }
  };
  const minAmountOut = computeMinOut();

  const handleSwap = async () => {
    setUiError(null); setTxStatus(null);
    if (disabled) return;
    if (!quote || !minAmountOut) { setUiError('No quote available'); return; }
    try {
      setTxStatus('Building transaction');
      const hash = await execute({
        tokenIn: tokenInAddr,
        tokenOut: tokenOutAddr,
        amountIn: amountInWei,
        minAmountOut: minAmountOut.toString(),
        poolAddress: info?.pool,
        chainId,
      });
      setTxStatus('Submitted');
      onSuccess && onSuccess(hash);
    } catch (e) {
      setUiError(e.message || 'Swap failed');
    }
  };

  const formatOut = (valRaw, decimals = tokenOutMeta?.decimals || 18) => fromWei(valRaw, decimals, 6);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <label className="text-gray-400 text-sm mb-2 block">From</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              value={amountInDisplay}
              onChange={e => setAmountInDisplay(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-white text-2xl font-bold outline-none flex-1"
            />
            <select
              value={tokenInAddr}
              onChange={e => setTokenInAddr(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-md px-3 py-2 text-white text-sm"
            >
              {tokens.map(t => (
                <option key={t.address} value={t.address} className="bg-black">{t.symbol || t.address.slice(0,6)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-center">
          <Button size="sm" variant="ghost" className="rounded-full w-10 h-10 p-0" onClick={onFlip} disabled={tokens.length < 2}>
            <ArrowRight className="w-4 h-4 rotate-90" />
          </Button>
        </div>
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <label className="text-gray-400 text-sm mb-2 block">To</label>
          <div className="flex items-center gap-3">
            <input
              disabled
              value={quote ? formatOut(quote) : ''}
              placeholder={quoteLoading ? 'Loading...' : '0.0'}
              className="bg-transparent text-white text-2xl font-bold outline-none flex-1 disabled:opacity-70"
            />
            <select
              value={tokenOutAddr}
              onChange={e => setTokenOutAddr(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-md px-3 py-2 text-white text-sm"
            >
              {tokens.filter(t => t.address !== tokenInAddr).map(t => (
                <option key={t.address} value={t.address} className="bg-black">{t.symbol || t.address.slice(0,6)}</option>
              ))}
            </select>
          </div>
          <div className="text-gray-400 text-xs mt-1">
            {quote && minAmountOut ? `Min after slippage: ${formatOut(minAmountOut.toString())}` : ''}
          </div>
        </div>
      </div>
      <div className="space-y-2 text-sm text-gray-300">
        <div className="flex justify-between"><span>Quote</span><span>{quote ? formatOut(quote) : (quoteLoading ? '...' : '-')}</span></div>
        <div className="flex justify-between"><span>Slippage</span><span>{(slippageBps/100).toFixed(2)}%</span></div>
        <div className="flex justify-between"><span>Route</span><span>Direct</span></div>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>Slippage (bps)</span>
        <input type="number" min="1" max="500" value={slippageBps} onChange={e => setSlippageBps(Number(e.target.value)||50)} className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white" />
      </div>
      <Button disabled={disabled || building || sending || poolLoading} onClick={handleSwap} className="w-full bg-gradient-to-r from-white to-gray-100 text-black hover:from-gray-100 hover:to-white py-3 text-lg font-semibold disabled:opacity-60">
        {!isConnected ? 'Connect Wallet to Swap' : (building ? 'Building...' : sending ? 'Sending...' : 'Swap')}
      </Button>
      {txStatus && (
        <div className="text-xs text-green-400 break-all">
          {txStatus}{txHash && ' '} {txHash && <a href={`https://amoy.polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">View Tx</a>}
        </div>
      )}
      {swapError && <div className="text-xs text-red-400">{swapError.message || 'Swap error'}</div>}
      {uiError && <div className="text-xs text-red-400">{uiError}</div>}
      {!isConnected && <div className="text-xs text-yellow-400">Connect wallet to interact</div>}
      {tokenInAddr === tokenOutAddr && tokenInAddr && <div className="text-xs text-yellow-500">Choose different tokens</div>}
      {tokenInAddr !== tokenOutAddr && amountInWei !== '0' && !quoteLoading && (!quote || quote === '0') && <div className="text-xs text-orange-400">No liquidity available for this trade</div>}
    </div>
  );
}
