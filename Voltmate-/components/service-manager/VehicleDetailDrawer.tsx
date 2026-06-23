'use client';

import React, { useState } from 'react';
import {
  PdiItem,
  Vehicle,
  VehicleService,
  fmtDate,
  markServiceDone,
  patchCurrentKm,
  phoneLink,
  updatePdi,
  vehicleLabel,
} from '@/lib/serviceManagerApi';
import PdiChecklist from '@/components/service-manager/PdiChecklist';

interface Props {
  vehicle: Vehicle;
  services: VehicleService[];
  onClose: () => void;
  onUpdated: () => void;
  canWrite?: boolean;
}

export default function VehicleDetailDrawer({ vehicle, services, onClose, onUpdated, canWrite = true }: Props) {
  const [tab, setTab] = useState<'services' | 'pdi'>('services');
  const [markDone, setMarkDone] = useState<VehicleService | null>(null);
  const [form, setForm] = useState({ actual_km: '', completion_date: '', remarks: '', cost: '' });
  const [kmValue, setKmValue] = useState(String(vehicle.current_km ?? 0));
  const [busy, setBusy] = useState(false);

  const pending = services.filter(s => s.status === 'pending');
  const done = services.filter(s => s.status === 'done');

  async function submitMarkDone(e: React.FormEvent) {
    e.preventDefault();
    if (!markDone) return;
    const actual_km = parseInt(form.actual_km, 10);
    if (isNaN(actual_km) || actual_km < 0) {
      alert('Enter valid actual KM');
      return;
    }
    setBusy(true);
    try {
      const cost = form.cost.trim() ? parseFloat(form.cost) : undefined;
      await markServiceDone(vehicle.id, markDone.id, {
        actual_km,
        completion_date: form.completion_date || new Date().toISOString().slice(0, 10),
        remarks: form.remarks || undefined,
        cost,
      });
      setMarkDone(null);
      onUpdated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitKm() {
    const val = parseInt(kmValue, 10);
    if (isNaN(val) || val < 0) {
      alert('Enter valid KM');
      return;
    }
    setBusy(true);
    try {
      await patchCurrentKm(vehicle.id, val);
      onUpdated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function savePdi(status: string, checklist: PdiItem[]) {
    setBusy(true);
    try {
      await updatePdi(vehicle.id, { pdi_status: status, pdi_checklist: checklist });
      onUpdated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'PDI update failed');
    } finally {
      setBusy(false);
    }
  }

  const ownerTel = phoneLink(vehicle.owner_phone);
  const driverTel = phoneLink(vehicle.driver_phone);

  return (
    <div className="fixed inset-0 bg-black/70 z-[1000] flex justify-end" onClick={onClose}>
      <div
        className="bg-[#0f1117] border-l border-[#1e2236] w-full max-w-[520px] h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[#1e2236] flex justify-between items-start sticky top-0 bg-[#0f1117] z-10">
          <div>
            <div className="text-lg font-bold">{vehicleLabel(vehicle)}</div>
            <div className="text-sm text-[#8e97ad]">{vehicle.owner_name || '—'} · {vehicle.location || '—'}</div>
          </div>
          <button type="button" className="text-[#8e97ad] hover:text-white" onClick={onClose}>✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {ownerTel && (
              <a href={ownerTel} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-400">
                Call owner
              </a>
            )}
            {driverTel && (
              <a href={driverTel} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#1e2236] text-[#8e97ad]">
                Call driver
              </a>
            )}
          </div>

          {canWrite && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] uppercase text-[#545968] font-bold">Current KM</label>
                <input
                  type="number"
                  min={0}
                  value={kmValue}
                  onChange={e => setKmValue(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg text-sm font-mono"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={submitKm}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-cyan-400 text-[#0a0c12]"
              >
                Update
              </button>
            </div>
          )}

          <div className="flex gap-1 border-b border-[#1e2236]">
            {(['services', 'pdi'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-semibold capitalize ${tab === t ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-[#8e97ad]'}`}
              >
                {t === 'pdi' ? 'PDI' : 'All services'}
              </button>
            ))}
          </div>

          {tab === 'services' ? (
            <div className="space-y-4">
              {pending.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase text-[#545968] mb-2">Pending</div>
                  {pending.map(svc => (
                    <div key={svc.id} className="border border-[#1e2236] rounded-lg p-3 mb-2">
                      <div className="font-semibold">Service #{svc.service_no}</div>
                      <div className="text-xs text-[#8e97ad] font-mono mt-1">
                        Due {fmtDate(svc.due_date)} · {svc.due_km ?? '—'} km
                      </div>
                      {canWrite && (
                        <button
                          type="button"
                          className="mt-2 text-xs font-semibold px-2 py-1 rounded bg-[rgba(16,185,129,0.15)] text-[#10b981]"
                          onClick={() => {
                            setMarkDone(svc);
                            setForm({
                              actual_km: String(vehicle.current_km ?? svc.due_km ?? ''),
                              completion_date: new Date().toISOString().slice(0, 10),
                              remarks: '',
                              cost: '',
                            });
                          }}
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {done.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase text-[#545968] mb-2">Completed</div>
                  {done.map(svc => (
                    <div key={svc.id} className="border border-[#1e2236]/60 rounded-lg p-3 mb-2 opacity-80">
                      <div className="font-semibold text-sm">Service #{svc.service_no}</div>
                      <div className="text-xs text-[#8e97ad] font-mono">
                        {fmtDate(svc.completion_date)} · {svc.actual_km ?? '—'} km
                        {svc.cost != null && svc.cost !== '' ? ` · ₹${svc.cost}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <PdiChecklist
              vehicle={vehicle}
              canWrite={canWrite}
              busy={busy}
              onSave={savePdi}
            />
          )}
        </div>

        {markDone && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1100] p-4">
            <form onSubmit={submitMarkDone} className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-5 w-full max-w-sm">
              <div className="font-bold mb-3">Mark Service #{markDone.service_no} done</div>
              <div className="space-y-3">
                <input required type="number" placeholder="Actual KM" value={form.actual_km} onChange={e => setForm(f => ({ ...f, actual_km: e.target.value }))} className="w-full px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg text-sm" />
                <input required type="date" value={form.completion_date} onChange={e => setForm(f => ({ ...f, completion_date: e.target.value }))} className="w-full px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg text-sm" />
                <input type="number" step="0.01" placeholder="Cost (optional)" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} className="w-full px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg text-sm" />
                <input placeholder="Remarks" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className="w-full px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg text-sm" />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setMarkDone(null)} className="text-xs px-3 py-1.5 border border-[#1e2236] rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="text-xs px-3 py-1.5 bg-cyan-400 text-[#0a0c12] rounded-lg font-semibold">Save</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
