import React from 'react';
import { usePrices } from '../hooks/usePrices.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, RefreshCw } from 'lucide-react';

export const OraclePrices = () => {
  const { prices, lastUpdate, loading, error, refresh } = usePrices({ intervalMs: 30000 });

  const formatPrice = (priceData) => {
    if (!priceData) return 'N/A';
    // Handle both direct price values and price objects
    const price = typeof priceData === 'object' ? priceData.price : priceData;
    if (price === undefined || price === null) return 'N/A';
    return `$${Number(price).toFixed(4)}`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6" />
          Oracle Prices
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Last: {formatTime(lastUpdate)}</span>
          <Button 
            onClick={refresh} 
            disabled={loading} 
            size="sm"
            className="bg-white/10 border border-white/20 hover:bg-white/20"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded p-3">
          Failed to load prices: {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {prices && Object.entries(prices).map(([asset, priceData]) => (
          <Card key={asset} className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold uppercase tracking-wide">
                {priceData?.symbol || asset}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">
                {loading ? '...' : formatPrice(priceData)}
              </div>
              <div className="text-xs text-gray-400">
                {priceData?.stale ? 'Stale data' : 'Real-time feed'}
              </div>
              {priceData?.confidence && (
                <div className="text-xs text-gray-500 mt-1">
                  ±${Number(priceData.confidence).toFixed(6)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!prices && !loading && (
        <div className="text-center text-gray-400 py-8">
          No price data available
        </div>
      )}
    </div>
  );
};