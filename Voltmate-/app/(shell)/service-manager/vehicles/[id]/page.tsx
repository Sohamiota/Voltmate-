'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ServiceManagerShell from '@/components/service-manager/ServiceManagerShell';
import ServiceSchedulePanel from '@/components/service-manager/ServiceSchedulePanel';
import KmUpdateSheet from '@/components/service-manager/KmUpdateSheet';
import MarkServiceDoneSheet from '@/components/service-manager/MarkServiceDoneSheet';
import {
  Vehicle,
  VehicleService,
  fetchVehicle,
  fmtDate,
  markServiceDone,
  patchCurrentKm,
  phoneLink,
  vehicleLabel,
} from '@/lib/serviceManagerApi';
import {
  SM_BTN_GHOST,
  SM_CARD,
  urgencyBadgeCls,
  urgencyLabel,
} from '@/lib/serviceManagerUi';

export default function VehicleDossierPage() {
  const params = useParams();
  const id = parseInt(String(params?.id ?? ''), 10);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [services, setServices] = useState<VehicleService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kmModal, setKmModal] = useState(false);
  const [kmValue, setKmValue] = useState('');
  const [markDone, setMarkDone] = useState<VehicleService | null>(null);
  const [markForm, setMarkForm] = useState({ actual_km: '', completion_date: '', cost: '', remarks: '' });

  const load = useCallback(async () => {
    if (isNaN(id)) {
      setError('Invalid vehicle ID');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVehicle(id);
      setVehicle(data.vehicle);
      setServices(data.services);
      setKmValue(String(data.vehicle.current_km ?? 0));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load vehicle');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function submitKm() {
    if (!vehicle) return;
    const val = parseInt(kmValue, 10);
    if (isNaN(val) || val < 0) { alert('Enter valid KM'); return; }
    setBusy(true);
    try {
      await patchCurrentKm(vehicle.id, val);
      setKmModal(false);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitMarkDone(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicle || !markDone) return;
    const actual_km = parseInt(markForm.actual_km, 10);
    if (isNaN(actual_km)) { alert('Enter valid KM'); return; }
    setBusy(true);
    try {
      const cost = markForm.cost.trim() ? parseFloat(markForm.cost) : undefined;
      await markServiceDone(vehicle.id, markDone.id, {
        actual_km,
        completion_date: markForm.completion_date || new Date().toISOString().slice(0, 10),
        remarks: markForm.remarks || undefined,
        cost,
      });
      setMarkDone(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Mark done failed');
    } finally {
      setBusy(false);
    }
  }

  const pending = services.filter(s => s.status === 'pending');
  const done = services.filter(s => s.status === 'done');
  const tel = phoneLink(vehicle?.owner_phone);

  return (
    <ServiceManagerShell
      title={vehicle ? vehicleLabel(vehicle) : 'Vehicle Dossier'}
      description={vehicle?.owner_name ? `${vehicle.owner_name} — service record & schedule` : 'Loading…'}
      actions={
        vehicle && (
          <button type="button" className={SM_BTN_GHOST} onClick={load}>
            Refresh
          </button>
        )
      }
    >
      <ServiceSchedulePanel />

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-5 py-4 mb-5 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Loading vehicle dossier…</div>
      ) : vehicle ? (
        <>
          <div className="grid md:grid-cols-2 gap-5 mb-6">
            <div className={`${SM_CARD} p-5`}>
              <div className="text-[11px] font-bold uppercase text-zinc-500 tracking-wide mb-3">Identity</div>
              <dl className="space-y-2 text-[13px]">
                {[
                  ['Registration', vehicle.vehicle_number || '—'],
                  ['Chassis', vehicle.chassis_number || '—'],
                  ['Type', vehicle.vehicle_type || '—'],
                  ['Location', vehicle.location || '—'],
                  ['Purchase', fmtDate(vehicle.purchase_date)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-zinc-500">{k}</dt>
                    <dd className="text-zinc-200 font-medium text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className={`${SM_CARD} p-5`}>
              <div className="text-[11px] font-bold uppercase text-zinc-500 tracking-wide mb-3">Owner & status</div>
              <dl className="space-y-2 text-[13px]">
                {[
                  ['Owner', vehicle.owner_name || '—'],
                  ['Phone', vehicle.owner_phone || '—'],
                  ['Driver', vehicle.driver_name || '—'],
                  ['Current KM', `${vehicle.current_km ?? 0}${vehicle.stale_km ? ' (stale)' : ''}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-zinc-500">{k}</dt>
                    <dd className="text-zinc-200 font-medium text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              {vehicle.next_service_no && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="text-[12px] text-zinc-400">
                    Next service #{vehicle.next_service_no} · {fmtDate(vehicle.next_due_date)} · {vehicle.next_due_km ?? '—'} km
                  </div>
                  {vehicle.urgency && (
                    <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${urgencyBadgeCls(vehicle.urgency)}`}>
                      {urgencyLabel(vehicle.urgency)}
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-2 mt-4 flex-wrap">
                {tel && (
                  <a href={tel} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-cyan-400/30 text-cyan-400">
                    Call owner
                  </a>
                )}
                <button
                  type="button"
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400"
                  onClick={() => setKmModal(true)}
                >
                  Update KM
                </button>
                {vehicle.owner_name && (
                  <Link
                    href={`/service-manager/customers?customer=${encodeURIComponent(vehicle.owner_name)}`}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400"
                  >
                    Customer hub
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className={`${SM_CARD} overflow-hidden mb-6`}>
            <div className="px-5 py-4 border-b border-zinc-800">
              <div className="text-[14px] font-semibold text-white">Service document log</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Pending and completed services for this vehicle</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[720px] text-[13px]">
                <thead>
                  <tr>
                    {['#', 'Status', 'Due KM', 'Due date', 'Actual KM', 'Completed', 'Cost', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-[11px] text-left text-[10px] font-bold text-zinc-500 uppercase tracking-[1px] bg-zinc-900/80 border-b border-zinc-800">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...pending, ...done].sort((a, b) => a.service_no - b.service_no).map(s => (
                    <tr key={s.id} className="border-b border-zinc-800/50">
                      <td className="px-4 py-3 font-mono font-semibold">{s.service_no}</td>
                      <td className="px-4 py-3">
                        <span className={s.status === 'done' ? 'text-emerald-400' : 'text-amber-400'}>
                          {s.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{s.due_km ?? '—'}</td>
                      <td className="px-4 py-3 font-mono">{fmtDate(s.due_date)}</td>
                      <td className="px-4 py-3 font-mono">{s.actual_km ?? '—'}</td>
                      <td className="px-4 py-3 font-mono">{fmtDate(s.completion_date)}</td>
                      <td className="px-4 py-3 font-mono">{s.cost ?? '—'}</td>
                      <td className="px-4 py-3">
                        {s.status === 'pending' && (
                          <button
                            type="button"
                            className="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-500/15 text-emerald-400"
                            onClick={() => {
                              setMarkDone(s);
                              setMarkForm({
                                actual_km: String(vehicle.current_km ?? s.due_km ?? ''),
                                completion_date: new Date().toISOString().slice(0, 10),
                                cost: '',
                                remarks: '',
                              });
                            }}
                          >
                            Mark done
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {kmModal && (
        <KmUpdateSheet
          onClose={() => setKmModal(false)}
          value={kmValue}
          onChange={setKmValue}
          onSubmit={submitKm}
          busy={busy}
        />
      )}

      {markDone && (
        <MarkServiceDoneSheet
          serviceNo={markDone.service_no}
          form={markForm}
          onChange={patch => setMarkForm(f => ({ ...f, ...patch }))}
          onClose={() => setMarkDone(null)}
          onSubmit={submitMarkDone}
          busy={busy}
          showRemarks
        />
      )}
    </ServiceManagerShell>
  );
}
