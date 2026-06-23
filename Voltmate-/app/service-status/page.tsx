'use client';

import React, { useState } from 'react';
import {
  fetchOwnerStatus,
  fmtDate,
  requestOwnerOtp,
  setOwnerToken,
  verifyOwnerOtp,
  vehicleLabel,
} from '@/lib/serviceManagerApi';

type Step = 'phone' | 'otp' | 'status';

export default function ServiceStatusPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<any>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestOwnerOtp(phone);
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await verifyOwnerOtp(phone, otp);
      setOwnerToken(token);
      const data = await fetchOwnerStatus();
      setStatusData(data);
      setStep('status');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8edf5] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#0f1117] border border-[#1e2236] rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold">Vehicle Service Status</div>
          <div className="text-sm text-[#8e97ad] mt-1">Check your next service date with OTP verification</div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-[#f43f5e] bg-[#f43f5e]/10 border border-[#f43f5e]/25 rounded-lg px-3 py-2">{error}</div>
        )}

        {step === 'phone' && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-[#545968]">Registered owner phone</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-[#0a0c12] border border-[#1e2236] rounded-lg"
                placeholder="10-digit mobile number"
              />
            </div>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-cyan-400 text-[#0a0c12] font-semibold">
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-[#545968]">Enter 6-digit OTP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full mt-1 px-3 py-2.5 bg-[#0a0c12] border border-[#1e2236] rounded-lg font-mono tracking-widest text-center"
              />
            </div>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-cyan-400 text-[#0a0c12] font-semibold">
              {busy ? 'Verifying…' : 'View status'}
            </button>
            <button type="button" onClick={() => setStep('phone')} className="w-full text-sm text-[#8e97ad]">Change phone</button>
          </form>
        )}

        {step === 'status' && statusData && (
          <div className="space-y-4">
            {(statusData.vehicles || []).map((v: any) => (
              <div key={v.id} className="border border-[#1e2236] rounded-xl p-4">
                <div className="font-bold">{vehicleLabel(v)}</div>
                <div className="text-sm text-[#8e97ad]">{v.vehicle_type || '—'}</div>
                {v.service_no ? (
                  <div className="mt-3 text-sm">
                    <div className="text-cyan-400 font-semibold">Next: Service #{v.service_no}</div>
                    <div className="font-mono text-xs mt-1">Due {fmtDate(v.due_date)} · {v.due_km ?? '—'} km</div>
                    <div className="text-xs text-[#8e97ad] mt-1">Current KM: {v.current_km ?? 0}</div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-[#10b981]">No pending service scheduled</div>
                )}
                {v.last_done_no && (
                  <div className="mt-2 text-xs text-[#8e97ad]">
                    Last done: Service #{v.last_done_no} on {fmtDate(v.last_done_date)} ({v.last_done_km} km)
                  </div>
                )}
              </div>
            ))}
            <div className="text-xs text-[#545968] text-center pt-2">
              Questions? Call {statusData.dealership_contact?.phone || 'your CRE'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
