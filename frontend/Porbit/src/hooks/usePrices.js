import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api/client.js';

export function usePrices({ intervalMs = 15000 } = {}) {
  const [prices, setPrices] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.prices();
      setPrices(res.data || {});
      setLastUpdate(res.lastUpdate || null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnce();
    if (intervalMs > 0) {
      timerRef.current = setInterval(fetchOnce, intervalMs);
      return () => clearInterval(timerRef.current);
    }
  }, [fetchOnce, intervalMs]);

  return { prices, lastUpdate, loading, error, refresh: fetchOnce };
}
