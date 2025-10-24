import React, { useState } from 'react';
import { useRisk } from '../hooks/useRisk.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Activity, Target } from 'lucide-react';

export const RiskMetrics = ({ userAddress }) => {
  const { loading, error, spotPrice, tickEfficiency, tickInfo, userTicks, fetchSpotPrice, fetchTickEfficiency, fetchTickInfo, fetchUserTicks } = useRisk();
  const [tokenIn, setTokenIn] = useState('0');
  const [tokenOut, setTokenOut] = useState('1');
  const [tickIdx, setTickIdx] = useState('0');

  const handleSpotPrice = () => fetchSpotPrice({ tokenIn, tokenOut });
  const handleTickEfficiency = () => fetchTickEfficiency({ idx: tickIdx });
  const handleTickInfo = () => fetchTickInfo({ idx: tickIdx });
  const handleUserTicks = () => userAddress && fetchUserTicks({ user: userAddress });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Risk Metrics</h3>
        {error && <div className="text-red-400 text-sm">Error: {error.message}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Spot Price */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Spot Price
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input 
                value={tokenIn} 
                onChange={e => setTokenIn(e.target.value)} 
                placeholder="Token In Index"
                className="flex-1 p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
              />
              <input 
                value={tokenOut} 
                onChange={e => setTokenOut(e.target.value)} 
                placeholder="Token Out Index"
                className="flex-1 p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
              />
            </div>
            <Button onClick={handleSpotPrice} disabled={loading} className="w-full bg-white/10 border border-white/20">
              Get Spot Price
            </Button>
            {spotPrice && (
              <div className="text-sm text-gray-300">
                <div>Price: {spotPrice.spotPrice}</div>
                <div>Tokens: {spotPrice.tokenIn} → {spotPrice.tokenOut}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tick Efficiency */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Tick Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input 
              value={tickIdx} 
              onChange={e => setTickIdx(e.target.value)} 
              placeholder="Tick Index"
              className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
            />
            <Button onClick={handleTickEfficiency} disabled={loading} className="w-full bg-white/10 border border-white/20">
              Get Efficiency
            </Button>
            {tickEfficiency && (
              <div className="text-sm text-gray-300">
                <div>Efficiency: {tickEfficiency.tickEfficiency}</div>
                <div>Index: {tickEfficiency.idx}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tick Info */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="w-5 h-5" />
              Tick Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleTickInfo} disabled={loading} className="w-full bg-white/10 border border-white/20">
              Get Tick Info (idx: {tickIdx})
            </Button>
            {tickInfo && (
              <div className="text-sm text-gray-300 space-y-1">
                {Object.entries(tickInfo).map(([key, value]) => (
                  <div key={key}>{key}: {String(value)}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Ticks */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">User Positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleUserTicks} disabled={loading || !userAddress} className="w-full bg-white/10 border border-white/20">
              Get My Ticks
            </Button>
            {!userAddress && <div className="text-yellow-400 text-xs">Connect wallet to view positions</div>}
            {userTicks && (
              <div className="text-sm text-gray-300">
                <div>Positions: {userTicks.length}</div>
                {userTicks.slice(0, 3).map((tick, i) => (
                  <div key={i} className="text-xs font-mono">{JSON.stringify(tick)}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};