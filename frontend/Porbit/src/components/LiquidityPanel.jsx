import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { usePool } from '../hooks/usePool.js';
import { useLiquidity } from '../hooks/useLiquidity.js';

export const LiquidityPanel = ({ provider, isConnected }) => {
  const { info } = usePool();
  const { buildAdd, buildRemove, sendTx, addCalldata, removeCalldata, loading, error, txHash } = useLiquidity({ provider });
  const [amounts, setAmounts] = useState([]); // raw decimal input strings
  const [planeConstant, setPlaneConstant] = useState('0');
  const [removeIdx, setRemoveIdx] = useState('0');
  const [removeFraction, setRemoveFraction] = useState('0');
  const [mode, setMode] = useState('add'); // 'add' | 'remove'
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (info?.tokens?.length) {
      setAmounts(prev => {
        if (prev.length === info.tokens.length) return prev;
        return Array(info.tokens.length).fill('').map((_,i)=> prev[i] || '');
      });
    }
  }, [info]);

  const updateAmount = (i, v) => {
    setAmounts(a => a.map((x, idx) => idx === i ? v : x));
  };

  const toWei = (val, decimals=18) => {
    if (!val) return '0';
    try {
      const [whole, frac=''] = val.split('.');
      const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
      return (BigInt(whole || '0') * BigInt(10)**BigInt(decimals) + BigInt(padded || '0')).toString();
    } catch { return '0'; }
  };

  const buildAddTx = async () => {
    setLocalError(null);
    if (!isConnected) { setLocalError('Connect wallet'); return; }
    if (!info?.tokens?.length) { setLocalError('Pool not ready'); return; }
    try {
      const weiAmounts = amounts.map((v,i)=> toWei(v, info.tokens[i].decimals || 18));
      await buildAdd({ amounts: weiAmounts, planeConstant });
    } catch (e) { setLocalError(e.message); }
  };

  const buildRemoveTx = async () => {
    setLocalError(null);
    if (!isConnected) { setLocalError('Connect wallet'); return; }
    try {
      await buildRemove({ idx: Number(removeIdx), fraction: removeFraction });
    } catch (e) { setLocalError(e.message); }
  };

  const send = async (type) => {
    setLocalError(null);
    try {
      const calldata = type === 'add' ? addCalldata : removeCalldata;
      if (!calldata) { setLocalError('Build first'); return; }
      await sendTx(calldata);
    } catch (e) { setLocalError(e.message); }
  };

  const tokenSymbols = info?.tokens?.map(t => t.symbol || t.address.slice(0,6)) || [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-xs">
        <button onClick={()=>setMode('add')} className={`px-3 py-1 rounded ${mode==='add'?'bg-white text-black':'bg-white/10 text-white'}`}>Add</button>
        <button onClick={()=>setMode('remove')} className={`px-3 py-1 rounded ${mode==='remove'?'bg-white text-black':'bg-white/10 text-white'}`}>Remove</button>
      </div>

      {mode === 'add' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {amounts.map((val,i)=>(
              <div key={i} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded">
                <div className="w-24 text-xs text-gray-400">{tokenSymbols[i] || 'Token'} Amount</div>
                <input value={val} onChange={e=>updateAmount(i,e.target.value)} placeholder="0.0" type="number" min="0" className="flex-1 bg-transparent text-white outline-none" />
              </div>
            ))}
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded">
              <div className="w-24 text-xs text-gray-400">Plane Const</div>
              <input value={planeConstant} onChange={e=>setPlaneConstant(e.target.value)} placeholder="0" className="flex-1 bg-transparent text-white outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button disabled={loading} onClick={buildAddTx} className="flex-1 bg-white/10 border border-white/20">Build</Button>
            <Button disabled={loading || !addCalldata} onClick={()=>send('add')} className="flex-1 bg-gradient-to-r from-white to-gray-100 text-black">Send</Button>
          </div>
          {addCalldata && <div className="text-xs text-gray-400 break-all">Calldata: {addCalldata.data.slice(0,42)}...</div>}
        </div>
      )}

      {mode === 'remove' && (
        <div className="space-y-4">
          <div className="p-3 bg-white/5 border border-white/10 rounded space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-24 text-xs text-gray-400">Position Idx</div>
              <input value={removeIdx} onChange={e=>setRemoveIdx(e.target.value)} type="number" min="0" className="flex-1 bg-transparent text-white outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 text-xs text-gray-400">Fraction</div>
              <input value={removeFraction} onChange={e=>setRemoveFraction(e.target.value)} placeholder="0" className="flex-1 bg-transparent text-white outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button disabled={loading} onClick={buildRemoveTx} className="flex-1 bg-white/10 border border-white/20">Build</Button>
            <Button disabled={loading || !removeCalldata} onClick={()=>send('remove')} className="flex-1 bg-gradient-to-r from-white to-gray-100 text-black">Send</Button>
          </div>
          {removeCalldata && <div className="text-xs text-gray-400 break-all">Calldata: {removeCalldata.data.slice(0,42)}...</div>}
        </div>
      )}

      {txHash && <div className="text-xs text-green-400 break-all">Tx: {txHash}</div>}
      {(error || localError) && <div className="text-xs text-red-400">{(error?.message)|| localError}</div>}
      {!isConnected && <div className="text-xs text-yellow-400">Connect wallet to interact</div>}
    </div>
  );
};
