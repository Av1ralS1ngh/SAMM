import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

export function usePool() {
  const [info, setInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [reserves, setReserves] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [i, s, r] = await Promise.all([
        api.getPoolInfo().catch(e => { throw { where: 'info', e }; }),
        api.getPoolStats().catch(e => { throw { where: 'stats', e }; }),
        api.getReserves().catch(e => { throw { where: 'reserves', e }; }),
      ]);
      setInfo(i);
      setStats(s);
      setReserves(r.reserves || s?.reserves || []);
    } catch (err) {
      setError(err.e || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { info, stats, reserves, loading, error, refresh };
}
