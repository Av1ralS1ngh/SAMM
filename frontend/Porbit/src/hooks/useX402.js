import { useState, useCallback } from 'react';
import { api } from '../api/client.js';

export function useX402() {
  const [paymentId, setPaymentId] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState(null);

  const authorize = useCallback(async ({ maxUnits } = {}) => {
    setAuthorizing(true); setError(null);
    try {
      const res = await api.x402Authorize({ maxUnits });
      setPaymentId(res.paymentId);
      setRemaining(res.remaining);
      return res;
    } catch (e) { setError(e); throw e; } finally { setAuthorizing(false); }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!paymentId) return;
    try {
      const res = await api.x402Status({ paymentId });
      if (typeof res.remaining !== 'undefined') setRemaining(res.remaining);
      return res;
    } catch (e) { setError(e); }
  }, [paymentId]);

  return { paymentId, remaining, authorize, refreshStatus, authorizing, error };
}
