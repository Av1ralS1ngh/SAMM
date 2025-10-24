import React from 'react';
import { usePool } from '../hooks/usePool.js';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, BarChart3, Activity, CircuitBoard } from 'lucide-react';

export const ProtocolStats = () => {
  const { info, stats, reserves, loading, error, refresh } = usePool();

  const formatNumber = (n, opts={}) => {
    if (n === undefined || n === null) return '-';
    const num = Number(n);
    if (Number.isNaN(num)) return '-';
    return num.toLocaleString(undefined, { maximumFractionDigits: opts.maxFrac ?? 2, minimumFractionDigits: opts.minFrac ?? 0 });
  };
  const formatWei = (wei) => { try { return Number(BigInt(wei))/1e18; } catch { return 0; } };

  const tokenSymbols = info?.tokens?.map(t=> t.symbol || t.address.slice(0,6)) || stats?.tokenSymbols || [];
  const totalReserves = stats?.totalReserves || reserves || [];
  const totalLiquidity = stats?.totalLiquidity;
  const tvlApprox = totalReserves.reduce((acc,r)=> acc + formatWei(r), 0);

  const items = [
    { label: 'Approx TVL (sum)', value: `$${formatNumber(tvlApprox)}`, icon: TrendingUp },
    { label: 'Total Liquidity Raw', value: formatNumber(formatWei(totalLiquidity)), icon: BarChart3 },
    { label: 'Tick Count', value: stats ? `${stats.totalTicks}` : '-', icon: Activity },
    { label: 'Interior/Boundary', value: stats ? `${stats.interiorTicks}/${stats.boundaryTicks}` : '-', icon: CircuitBoard },
  ];

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Protocol Stats</h3>
        <button onClick={refresh} disabled={loading} className="text-xs px-3 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-50">{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>
      {error && <div className="text-red-400 text-sm mb-4">Failed to load stats</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {items.map((stat, idx)=>(
          <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-sm relative">
            <CardContent className="p-6 text-center">
              <stat.icon className="w-8 h-8 mx-auto mb-3 text-white" />
              <div className="text-2xl font-bold mb-1 text-white">{loading ? '...' : stat.value}</div>
              <div className="text-gray-300 text-sm">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-10">
        <h4 className="text-lg font-semibold mb-4 text-white">Reserves</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-white/10">
                <th className="py-2 font-medium">Token</th>
                <th className="py-2 font-medium">Reserve (raw)</th>
                <th className="py-2 font-medium">Reserve (formatted)</th>
              </tr>
            </thead>
            <tbody>
              {loading && (!totalReserves || totalReserves.length===0) && <tr><td colSpan={3} className="py-4 text-center text-gray-400">Loading reserves...</td></tr>}
              {!loading && totalReserves && totalReserves.length===0 && <tr><td colSpan={3} className="py-4 text-center text-gray-500">No reserves</td></tr>}
              {totalReserves?.map((r,i)=>(
                <tr key={i} className="border-b border-white/5 hover:bg-white/5/50">
                  <td className="py-2 text-white">{tokenSymbols[i] || `Token ${i}`}</td>
                  <td className="py-2 text-gray-400 font-mono text-xs break-all">{r}</td>
                  <td className="py-2 text-gray-300">{formatNumber(formatWei(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
