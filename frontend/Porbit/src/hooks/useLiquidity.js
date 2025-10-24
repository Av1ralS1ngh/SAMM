import { useState, useCallback } from 'react';
import { api } from '../api/client.js';

export function useLiquidity({ provider }) {
  const [addCalldata, setAddCalldata] = useState(null);
  const [removeCalldata, setRemoveCalldata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const buildAdd = useCallback(async ({ amounts, planeConstant }) => {
    setLoading(true); setError(null); setAddCalldata(null);
    try {
      const res = await api.addLiquidity({ amounts, planeConstant });
      setAddCalldata(res.calldata);
      return res.calldata;
    } catch (e) { setError(e); throw e; } finally { setLoading(false); }
  }, []);

  const buildRemove = useCallback(async ({ idx, fraction }) => {
    setLoading(true); setError(null); setRemoveCalldata(null);
    try {
      const res = await api.removeLiquidity({ idx, fraction });
      setRemoveCalldata(res.calldata);
      return res.calldata;
    } catch (e) { setError(e); throw e; } finally { setLoading(false); }
  }, []);

  const sendTx = useCallback(async (calldata) => {
    if (!provider || !provider.request) throw new Error('No wallet provider');
    setError(null); setTxHash(null);
    try {
      const params = [{ to: calldata.to, data: calldata.data, value: calldata.value || '0x0' }];
      const hash = await provider.request({ method: 'eth_sendTransaction', params });
      setTxHash(hash);
      return hash;
    } catch (e) { setError(e); throw e; }
  }, [provider]);

  return { buildAdd, buildRemove, sendTx, addCalldata, removeCalldata, loading, error, txHash };
}
