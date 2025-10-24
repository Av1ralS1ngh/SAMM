import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client.js';

// Debounced quote fetching hook.
export function useQuote({ tokenIn, tokenOut, amountIn, debounceMs = 500 }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const lastParamsRef = useRef({});

  const fetchQuote = useCallback(async () => {
    if (!tokenIn || !tokenOut || !amountIn || amountIn === '0') {
      setQuote(null);
      return;
    }
    const paramsKey = `${tokenIn}-${tokenOut}-${amountIn}`;
    if (lastParamsRef.current.key === paramsKey && quote) return; // avoid duplicate
    lastParamsRef.current.key = paramsKey;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getQuote({ tokenIn, tokenOut, amountIn });
      setQuote(res.amountOut);
    } catch (e) {
      setError(e);
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [tokenIn, tokenOut, amountIn, quote]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!tokenIn || !tokenOut || !amountIn) return;
    timerRef.current = setTimeout(fetchQuote, debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [tokenIn, tokenOut, amountIn, debounceMs, fetchQuote]);

  return { quote, loading, error, refetch: fetchQuote };
}
