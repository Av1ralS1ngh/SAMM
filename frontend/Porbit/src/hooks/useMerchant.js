import { useState } from 'react';
import { api } from '../api/client.js';

export function useMerchant() {
  const [auth, setAuth] = useState(null); // {paymentId, remaining, maxUnits}
  const [requirements, setRequirements] = useState(null);
  const [status, setStatus] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [settleResult, setSettleResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = (fn) => async (...args) => {
    setLoading(true); setError(null);
    try { return await fn(...args); } catch(e){ setError(e); throw e; } finally { setLoading(false); }
  };

  const authorize = run(async ({ maxUnits } = {}) => {
    const res = await api.x402Authorize({ maxUnits });
    setAuth(res);
    return res;
  });

  const getStatus = run(async (paymentId) => {
    const res = await api.x402Status({ paymentId });
    setStatus(res);
    return res;
  });

  const getRequirements = run(async () => {
    const res = await api.paymentRequirements();
    setRequirements(res);
    return res;
  });

  const verify = run(async ({ paymentHeader }) => {
    const res = await api.paymentVerify({ paymentHeader });
    setVerifyResult(res);
    return res;
  });

  const settle = run(async ({ paymentId }) => {
    const res = await api.paymentSettle({ paymentId });
    setSettleResult(res);
    return res;
  });

  return { auth, requirements, status, verifyResult, settleResult, loading, error, authorize, getStatus, getRequirements, verify, settle };
}
