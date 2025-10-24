import { useState, useCallback } from 'react';
import { api } from '../api/client.js';

// Risk-oriented endpoints aggregation (spot price, tick efficiency, tick info, user ticks)
export function useRisk() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [spotPrice, setSpotPrice] = useState(null);
  const [tickEfficiency, setTickEfficiency] = useState(null);
  const [tickInfo, setTickInfo] = useState(null);
  const [userTicks, setUserTicks] = useState(null);

  const wrap = (fn) => async (...args) => {
    setLoading(true); setError(null);
    try { return await fn(...args); } catch(e){ setError(e); throw e; } finally { setLoading(false); }
  };

  const fetchSpotPrice = wrap(async ({ tokenIn, tokenOut }) => {
    const res = await fetch(`${api.DEFAULT_BASE || ''}/pool/spot-price?tokenIn=${tokenIn}&tokenOut=${tokenOut}`);
    const json = await res.json();
    if(!res.ok) throw json;
    setSpotPrice(json);
    return json;
  });

  const fetchTickEfficiency = wrap( async ({ idx }) => {
    const res = await fetch(`${api.DEFAULT_BASE || ''}/pool/tick-efficiency?idx=${idx}`);
    const json = await res.json();
    if(!res.ok) throw json;
    setTickEfficiency(json);
    return json;
  });

  const fetchTickInfo = wrap( async ({ idx }) => {
    const res = await fetch(`${api.DEFAULT_BASE || ''}/pool/tick-info?idx=${idx}`);
    const json = await res.json();
    if(!res.ok) throw json;
    setTickInfo(json);
    return json;
  });

  const fetchUserTicks = wrap( async ({ user }) => {
    const res = await fetch(`${api.DEFAULT_BASE || ''}/pool/user-ticks?user=${user}`);
    const json = await res.json();
    if(!res.ok) throw json;
    setUserTicks(json.ticks || []);
    return json;
  });

  return { loading, error, spotPrice, tickEfficiency, tickInfo, userTicks, fetchSpotPrice, fetchTickEfficiency, fetchTickInfo, fetchUserTicks };
}
