'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import {
  DashboardData,
  PendingService,
  ServiceAlert,
  acknowledgeAlert,
  fetchAlerts,
  fetchDashboard,
  fmtDate,
  markServiceDone,
  patchCurrentKm,
  phoneLink,
  vehicleLabel,
} from '@/lib/serviceManagerApi';

type UrgencyFilter = 'all' | 'overdue' | 'due_soon' | 'ok';
type AlertFilter = 'all' | 'overdue' | 'due_soon' | 'pdi_pending';

export default function ServiceManagerPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [kmModal, setKmModal] = useState<{ id: number; current_km: number } | null>(null);
  const [kmValue, setKmValue] = useState('');
  const [markDoneModal, setMarkDoneModal] = useState<PendingService | null>(null);
  const [markDoneForm, setMarkDoneForm] = useState({ actual_km: '', completion_date: '', cost: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dash, alertData] = await Promise.all([
        fetchDashboard(),
        fetchAlerts('open', alertFilter === 'all' ? undefined : alertFilter),
      ]);
      setData(dash);
      setAlerts(alertData.alerts);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [alertFilter]);

  useEffect(() => { load(); }, [load]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    data?.pending_services?.forEach(p => { if (p.location) set.add(p.location); });
    return Array.from(set).sort();
  }, [data]);

  const filteredPending = useMemo(() => {
    let rows = data?.pending_services ?? [];
    if (urgencyFilter !== 'all') rows = rows.filter(r => r.urgency === urgencyFilter);
    if (locationFilter) rows = rows.filter(r => (r.location || '') === locationFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r => {
        const hay = [r.vehicle_number, r.chassis_number, r.owner_name, r.owner_phone, r.location]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [data, urgencyFilter, locationFilter, search]);

  async function submitKm() {
    if (!kmModal) return;
    const val = parseInt(kmValue, 10);
    if (isNaN(val) || val < 0) { alert('Enter valid KM'); return; }
    setBusy(true);
    try {
      await patchCurrentKm(kmModal.id, val);
      setKmModal(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitMarkDone(e: React.FormEvent) {
    e.preventDefault();
    if (!markDoneModal) return;
    const actual_km = parseInt(markDoneForm.actual_km, 10);
    if (isNaN(actual_km)) { alert('Enter valid KM'); return; }
    setBusy(true);
    try {
      const cost = markDoneForm.cost.trim() ? parseFloat(markDoneForm.cost) : undefined;
      await markServiceDone(markDoneModal.id, markDoneModal.service_id, {
        actual_km,
        completion_date: markDoneForm.completion_date || new Date().toISOString().slice(0, 10),
        cost,
      });
      setMarkDoneModal(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Mark done failed');
    } finally {
      setBusy(false);
    }
  }

  async function ackAlert(id: number) {
    try {
      await acknowledgeAlert(id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  }

  const rowBg = (u: string) =>
    u === 'overdue' ? 'bg-[#f43f5e]/[0.08]' : u === 'due_soon' ? 'bg-[#fbbf24]/[0.06]' : '';

  const badgeCls = (u: string) =>
    u === 'overdue' ? 'bg-[#f43f5e]/[0.15] text-[#f43f5e]'
    : u === 'due_soon' ? 'bg-[#fbbf24]/[0.12] text-amber-400'
    : 'bg-[#10b981]/[0.10] text-[#10b981]';

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8edf5] font-sans">
      <div className="px-7 py-8 max-w-[1680px] mx-auto">
        <div className="mb-7 flex items-start justify-between flex-wrap gap-3">
          <PageHeader
            title="Service Manager"
            description="Daily operations cockpit — briefing, alerts, and pending services"
            variant="dark"
            className="mb-0"
          />
          <div className="flex gap-2 flex-wrap pt-1">
              <button type="button" onClick={load} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#1e2236] text-[#8e97ad] hover:text-white">
                Refresh
              </button>
              <Link href="/service-manager/vehicles" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-cyan-400 text-[#0a0c12]">
                Manage Vehicles
              </Link>
              <Link href="/service-manager/analytics" className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-400">
                Analytics
              </Link>
          </div>
        </div>

        {error && (
          <div className="bg-[#f43f5e]/10 border border-[#f43f5e]/25 rounded-xl px-5 py-4 mb-6 text-[#f43f5e]">{error}</div>
        )}

        {loading && !data ? (
          <div className="text-center py-12 text-[#8e97ad]">Loading dashboard…</div>
        ) : data ? (
          <>
            {data.briefing && (
              <div className="bg-gradient-to-r from-[#0f1117] to-[#141720] border border-[#1e2236] rounded-xl p-5 mb-6">
                <div className="text-xs font-bold uppercase text-cyan-400 tracking-wider mb-1">Today&apos;s briefing</div>
                <div className="text-sm text-[#8e97ad] mb-3">
                  Snapshot for {fmtDate(data.briefing.snapshot_date)}
                  {data.last_updated && ` · Updated ${new Date(data.last_updated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                </div>
                {(data.briefing.top_overdue?.length ?? 0) > 0 ? (
                  <div className="text-sm">
                    <span className="text-[#f43f5e] font-semibold">Top overdue: </span>
                    {data.briefing.top_overdue.map((t, i) => (
                      <span key={t.vehicle_id}>
                        {t.label} ({t.owner_name || '—'})
                        {i < data.briefing!.top_overdue.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[#10b981]">No overdue vehicles in today&apos;s digest.</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3 mb-6">
              {[
                { label: 'Total', value: data.total_vehicles, color: 'text-cyan-400' },
                { label: 'Overdue', value: data.overdue_count, color: 'text-[#f43f5e]' },
                { label: 'Due Today', value: data.due_today_count, color: 'text-amber-400' },
                { label: 'This Week', value: data.due_this_week_count, color: 'text-[#10b981]' },
                { label: 'Due Soon', value: data.due_soon_count, color: 'text-amber-300' },
                { label: 'Stale KM', value: data.stale_km_count, color: 'text-orange-400' },
                { label: 'Open Alerts', value: data.open_alerts_count, color: 'text-purple-400' },
              ].map(k => (
                <div key={k.label} className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-4">
                  <div className="text-[10px] font-semibold text-[#545968] uppercase tracking-wide mb-1">{k.label}</div>
                  <div className={`text-2xl font-extrabold font-mono ${k.color}`}>{k.value}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-[340px_1fr] gap-6 mb-6">
              <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e2236] flex justify-between items-center">
                  <div className="text-sm font-bold">Alert feed</div>
                  <select
                    value={alertFilter}
                    onChange={e => setAlertFilter(e.target.value as AlertFilter)}
                    className="text-xs bg-[#0a0c12] border border-[#1e2236] rounded px-2 py-1"
                  >
                    <option value="all">All</option>
                    <option value="overdue">Overdue</option>
                    <option value="due_soon">Due soon</option>
                    <option value="pdi_pending">PDI pending</option>
                  </select>
                </div>
                <div className="max-h-[320px] overflow-y-auto divide-y divide-[#1e2236]">
                  {alerts.length === 0 ? (
                    <div className="p-4 text-sm text-[#545968]">No open alerts</div>
                  ) : alerts.map(a => (
                    <div key={a.id} className="p-3">
                      <div className="text-xs font-semibold text-cyan-400">{a.title}</div>
                      <div className="text-xs text-[#8e97ad] mt-0.5">{a.message}</div>
                      <button type="button" onClick={() => ackAlert(a.id)} className="mt-2 text-[10px] font-semibold text-[#10b981]">
                        Mark handled
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-4">
                <div className="text-sm font-bold mb-3">Filters</div>
                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="Search vehicle, owner, phone…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 min-w-[180px] px-3 py-2 text-sm bg-[#0a0c12] border border-[#1e2236] rounded-lg"
                  />
                  <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value as UrgencyFilter)} className="text-sm bg-[#0a0c12] border border-[#1e2236] rounded-lg px-3 py-2">
                    <option value="all">All urgency</option>
                    <option value="overdue">Overdue</option>
                    <option value="due_soon">Due soon</option>
                    <option value="ok">OK</option>
                  </select>
                  <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="text-sm bg-[#0a0c12] border border-[#1e2236] rounded-lg px-3 py-2">
                    <option value="">All locations</option>
                    {locations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1e2236]">
                <div className="text-sm font-bold">Pending services ({filteredPending.length})</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[1000px]">
                  <thead>
                    <tr>
                      {['Vehicle', 'Owner', 'Service #', 'Due', 'Current KM', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-[#545968] text-sm">No matching pending services</td></tr>
                    ) : filteredPending.map(p => {
                      const tel = phoneLink(p.owner_phone);
                      return (
                        <tr key={p.service_id} className={rowBg(p.urgency)}>
                          <td className="px-4 py-3 border-b border-[#1e2236]/60 text-sm font-semibold">
                            {vehicleLabel(p)}
                            {p.vehicle_type && <span className="block text-xs text-[#8e97ad] font-mono">{p.vehicle_type}</span>}
                          </td>
                          <td className="px-4 py-3 border-b border-[#1e2236]/60 text-sm">{p.owner_name || '—'}</td>
                          <td className="px-4 py-3 border-b border-[#1e2236]/60 font-mono text-xs">#{p.service_no}</td>
                          <td className="px-4 py-3 border-b border-[#1e2236]/60 font-mono text-xs">
                            {fmtDate(p.due_date)} · {p.due_km ?? '—'} km
                          </td>
                          <td className="px-4 py-3 border-b border-[#1e2236]/60 font-mono text-xs">{p.current_km ?? 0}</td>
                          <td className="px-4 py-3 border-b border-[#1e2236]/60">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeCls(p.urgency)}`}>
                              {p.urgency === 'overdue' ? 'Overdue' : p.urgency === 'due_soon' ? 'Due soon' : 'OK'}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-[#1e2236]/60">
                            <div className="flex gap-1 flex-wrap">
                              {tel && (
                                <a href={tel} className="text-[10px] font-semibold px-2 py-1 rounded border border-cyan-400/30 text-cyan-400">Call</a>
                              )}
                              <button type="button" className="text-[10px] font-semibold px-2 py-1 rounded border border-[#1e2236] text-[#8e97ad]" onClick={() => { setKmModal({ id: p.id, current_km: p.current_km ?? 0 }); setKmValue(String(p.current_km ?? 0)); }}>
                                KM
                              </button>
                              <button type="button" className="text-[10px] font-semibold px-2 py-1 rounded bg-[#10b981]/15 text-[#10b981]" onClick={() => { setMarkDoneModal(p); setMarkDoneForm({ actual_km: String(p.current_km ?? p.due_km ?? ''), completion_date: new Date().toISOString().slice(0, 10), cost: '' }); }}>
                                Done
                              </button>
                              <Link href={`/service-manager/vehicles?open=${p.id}`} className="text-[10px] font-semibold px-2 py-1 rounded border border-[#1e2236] text-[#8e97ad]">
                                Open
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {kmModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]" onClick={() => setKmModal(null)}>
            <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-6 min-w-[280px]" onClick={e => e.stopPropagation()}>
              <div className="mb-3 font-bold">Update current KM</div>
              <input type="number" min={0} value={kmValue} onChange={e => setKmValue(e.target.value)} className="w-full px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg mb-4 font-mono" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setKmModal(null)} className="text-xs px-3 py-1.5 border border-[#1e2236] rounded-lg">Cancel</button>
                <button type="button" disabled={busy} onClick={submitKm} className="text-xs px-3 py-1.5 bg-cyan-400 text-[#0a0c12] rounded-lg font-semibold">Save</button>
              </div>
            </div>
          </div>
        )}

        {markDoneModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]" onClick={() => setMarkDoneModal(null)}>
            <form onSubmit={submitMarkDone} className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-6 min-w-[300px]" onClick={e => e.stopPropagation()}>
              <div className="mb-3 font-bold">Mark Service #{markDoneModal.service_no} done</div>
              <div className="space-y-3">
                <input required type="number" placeholder="Actual KM" value={markDoneForm.actual_km} onChange={e => setMarkDoneForm(f => ({ ...f, actual_km: e.target.value }))} className="w-full px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg" />
                <input required type="date" value={markDoneForm.completion_date} onChange={e => setMarkDoneForm(f => ({ ...f, completion_date: e.target.value }))} className="w-full px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg" />
                <input type="number" step="0.01" placeholder="Cost (optional)" value={markDoneForm.cost} onChange={e => setMarkDoneForm(f => ({ ...f, cost: e.target.value }))} className="w-full px-3 py-2 bg-[#0a0c12] border border-[#1e2236] rounded-lg" />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setMarkDoneModal(null)} className="text-xs px-3 py-1.5 border border-[#1e2236] rounded-lg">Cancel</button>
                <button type="submit" disabled={busy} className="text-xs px-3 py-1.5 bg-cyan-400 text-[#0a0c12] rounded-lg font-semibold">Save</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
