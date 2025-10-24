import React, { useState } from 'react';
import { useMerchant } from '../hooks/useMerchant.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Shield, CheckCircle } from 'lucide-react';

export const MerchantStatus = () => {
  const { auth, requirements, status, verifyResult, settleResult, loading, error, authorize, getStatus, getRequirements, verify, settle } = useMerchant();
  const [paymentHeader, setPaymentHeader] = useState('');
  const [maxUnits, setMaxUnits] = useState('5');

  const handleAuthorize = () => authorize({ maxUnits: parseInt(maxUnits) });
  const handleGetRequirements = () => getRequirements();
  const handleGetStatus = () => auth?.paymentId && getStatus(auth.paymentId);
  const handleVerify = () => paymentHeader && verify({ paymentHeader });
  const handleSettle = () => verifyResult?.paymentId && settle({ paymentId: verifyResult.paymentId });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6" />
          x402 Payment & Compliance
        </h3>
        {error && <div className="text-red-400 text-sm">Error: {error.message}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Authorization */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Authorization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input 
                value={maxUnits} 
                onChange={e => setMaxUnits(e.target.value)} 
                placeholder="Max Units"
                type="number"
                className="flex-1 p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
              />
              <Button onClick={handleAuthorize} disabled={loading} className="bg-white/10 border border-white/20">
                Authorize
              </Button>
            </div>
            {auth && (
              <div className="text-sm text-gray-300 space-y-1">
                <div>Payment ID: {auth.paymentId}</div>
                <div>Remaining: {auth.remaining}</div>
                <div>Max Units: {auth.maxUnits}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Requirements */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Payment Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleGetRequirements} disabled={loading} className="w-full bg-white/10 border border-white/20">
              Get Requirements
            </Button>
            {requirements && (
              <div className="text-sm text-gray-300 space-y-1">
                <div>Network: {requirements.requirements?.network}</div>
                <div>Max Amount: {requirements.requirements?.maxAmountRequired}</div>
                <div>Pay To: {requirements.requirements?.payTo?.slice(0,10)}...</div>
                <div>Asset: {requirements.requirements?.asset?.slice(0,10)}...</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleGetStatus} disabled={loading || !auth?.paymentId} className="w-full bg-white/10 border border-white/20">
              Check Status
            </Button>
            {status && (
              <div className="text-sm text-gray-300 space-y-1">
                <div>Payment ID: {status.paymentId}</div>
                <div>Remaining: {status.remaining}</div>
                <div>Max Units: {status.maxUnits}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Verification & Settlement */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Verify & Settle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input 
              value={paymentHeader} 
              onChange={e => setPaymentHeader(e.target.value)} 
              placeholder="Payment Header"
              className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleVerify} disabled={loading || !paymentHeader} className="flex-1 bg-white/10 border border-white/20">
                Verify
              </Button>
              <Button onClick={handleSettle} disabled={loading || !verifyResult?.paymentId} className="flex-1 bg-white/10 border border-white/20">
                Settle
              </Button>
            </div>
            {verifyResult && (
              <div className="text-sm text-gray-300">
                Valid: {verifyResult.isValid ? 'Yes' : 'No'} | Settlement: {verifyResult.settlementRequired ? 'Required' : 'Not needed'}
              </div>
            )}
            {settleResult && (
              <div className="text-sm text-green-400">
                Settlement successful! Tx: {settleResult.txHash?.slice(0,12)}...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};