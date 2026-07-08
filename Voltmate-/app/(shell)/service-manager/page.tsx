'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useEffectiveSearch } from '@/components/SearchContext';
import ServiceManagerShell from '@/components/service-manager/ServiceManagerShell';
import KmUpdateSheet from '@/components/service-manager/KmUpdateSheet';
import MarkServiceDoneSheet from '@/components/service-manager/MarkServiceDoneSheet';
import {
  CustomerGroup,
  CustomerVehicleSummary,
  DashboardData,
  PendingService,
  fetchCustomerGroups,
  fetchDashboard,
  fmtDate,
  markServiceDone,
  patchCurrentKm,
  phoneLink,
  vehicleLabel,
} from '@/lib/serviceManagerApi';
import {
  SM_BTN_GHOST,
  SM_BTN_SECONDARY,
  SM_CARD,
  SM_INPUT,
  getInitials,
  urgencyBadgeCls,
  urgencyLabel,
  urgencyRowBg,
} from '@/lib/serviceManagerUi';

type UrgencyFilter = 'all' | 'overdue' | 'due_soon' | 'ok';

function pendingFromVehicle(v: CustomerVehicleSummary): PendingService | null {
  if (!v.pending_service_id) return null;
  return {
    id: v.id,
    vehicle_number: v.vehicle_number,
    chassis_number: v.chassis_number,
    vehicle_type: v.vehicle_type,
    owner_phone: v.owner_phone,
    location: v.location,
    current_km: v.current_km,
    service_id: v.pending_service_id,
    service_no: v.pending_service_no ?? 0,
    due_km: v.pending_due_km ?? undefined,
    due_date: v.pending_due_date ?? undefined,
    urgency: v.urgency,
    due_today: v.due_today,
    stale_km: v.stale_km,
  };
}

export default function ServiceManagerWorkQueuePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [customers, setCustomers] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const effectiveSearch = useEffectiveSearch(search);

  const [kmModal, setKmModal] = useState<{ id: number; current_km: number } | null>(null);
  const [kmValue, setKmValue] = useState('');
  const [markDoneModal, setMarkDoneModal] = useState<PendingService | null>(null);
  const [markDoneForm, setMarkDoneForm] = useState({ actual_km: '', completion_date: '', cost: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dash, groups] = await Promise.all([fetchDashboard(), fetchCustomerGroups()]);
      setDashboard(dash);
      setCustomers(groups.customers);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load work queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredCustomers = useMemo(() => {
    let rows = customers;
    if (urgencyFilter === 'overdue') rows = rows.filter(c => c.overdue_count > 0);
    else if (urgencyFilter === 'due_soon') rows = rows.filter(c => c.due_soon_count > 0);
    else if (urgencyFilter === 'ok') {
      rows = rows.filter(c => c.overdue_count === 0 && c.due_soon_count === 0);
    }
    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase();
      rows = rows.filter(c => c.customer_name.toLowerCase().includes(q));
    }
    return rows;
  }, [customers, urgencyFilter, effectiveSearch]);

  const selected = selectedName
    ? customers.find(c => c.customer_name === selectedName) ?? null
    : null;

  const selectedVehicles = useMemo(() => {
    if (!selected) return [];
    let vs = selected.vehicles.filter(v => v.pending_service_id);
    if (urgencyFilter !== 'all') vs = vs.filter(v => v.urgency === urgencyFilter);
    return vs.sort((a, b) => {
      const rank = (u: string) => (u === 'overdue' ? 0 : u === 'due_soon' ? 1 : 2);
      return rank(a.urgency) - rank(b.urgency) || (a.pending_service_no ?? 0) - (b.pending_service_no ?? 0);
    });
  }, [selected, urgencyFilter]);

  const activeCustomers = customers.filter(c => c.overdue_count > 0 || c.due_soon_count > 0).length;

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

  return (
    <ServiceManagerShell
      title="Service Manager"
      description={
        selected
          ? `${selected.customer_name} — pending services and fleet status`
          : 'Work queue grouped by customer — overdue and due-soon services at a glance'
      }
      actions={
        <button type="button" className={SM_BTN_GHOST} onClick={load}>
          Refresh
        </button>
      }
    >
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-5 py-4 mb-5 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {dashboard && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 mb-5">
          {[
            { label: 'Customers', value: customers.length, color: 'text-cyan-400' },
            { label: 'Active', value: activeCustomers, color: 'text-violet-400' },
            { label: 'Overdue', value: dashboard.overdue_count, color: 'text-rose-400' },
            { label: 'Due Today', value: dashboard.due_today_count, color: 'text-amber-400' },
            { label: 'This Week', value: dashboard.due_this_week_count, color: 'text-emerald-400' },
            { label: 'Stale KM', value: dashboard.stale_km_count, color: 'text-orange-400' },
          ].map(k => (
            <div key={k.label} className={`${SM_CARD} px-4 py-[14px]`}>
              <div className={`text-[clamp(20px,4vw,26px)] font-bold mb-[2px] ${k.color}`}>{k.value}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-[0.5px]">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {(['all', 'overdue', 'due_soon', 'ok'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setUrgencyFilter(f)}
            className={`border rounded-lg px-[14px] py-[7px] text-[12px] transition-all ${
              urgencyFilter === f
                ? 'bg-[#0e3a42] border-cyan-400/40 text-cyan-400 font-semibold'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-[#444]'
            }`}
          >
            {f === 'all' ? 'All urgency' : f === 'due_soon' ? 'Due soon' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && !customers.length ? (
        <div className="text-center py-12 text-zinc-500 text-[14px]">Loading work queue…</div>
      ) : selectedName === null ? (
        <div>
          <div className="flex items-center justify-between gap-[10px] mb-[14px] flex-wrap">
            <div className="text-[15px] font-semibold text-white">
              All Customers ({filteredCustomers.length})
            </div>
            <input
              className={`${SM_INPUT} min-w-[180px]`}
              placeholder="Search customer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="text-center py-[60px] text-zinc-500">
              <div className="text-[15px] font-semibold mb-1">No customers found</div>
              <div className="text-[13px]">Try a different filter or search term.</div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[14px]">
              {filteredCustomers.map(c => {
                const pendingCount = c.vehicles.filter(v => v.pending_service_id).length;
                const hasOverdue = c.overdue_count > 0;
                const hasDueSoon = c.due_soon_count > 0;

                return (
                  <div
                    key={c.customer_name}
                    role="button"
                    tabIndex={0}
                    className={`${SM_CARD} rounded-[14px] p-[18px] cursor-pointer transition-all duration-200 flex flex-col hover:-translate-y-0.5 ${
                      hasOverdue
                        ? 'border-rose-500/40 hover:border-rose-500/70 hover:shadow-[0_8px_24px_rgba(244,63,94,0.1)]'
                        : hasDueSoon
                          ? 'border-amber-400/40 hover:border-amber-400/70 hover:shadow-[0_8px_24px_rgba(251,191,36,0.1)]'
                          : 'hover:border-cyan-400 hover:shadow-[0_8px_24px_rgba(0,217,255,0.12)]'
                    }`}
                    onClick={() => setSelectedName(c.customer_name)}
                    onKeyDown={e => { if (e.key === 'Enter') setSelectedName(c.customer_name); }}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0891b2] to-[#0e7490] flex items-center justify-center text-[15px] font-bold text-white mb-3">
                      {getInitials(c.customer_name)}
                    </div>
                    <div className="text-[15px] font-semibold text-white mb-1">{c.customer_name}</div>
                    <div className="text-[12px] text-zinc-500 mb-3">
                      {c.vehicle_count} vehicle{c.vehicle_count !== 1 ? 's' : ''}
                    </div>

                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {c.overdue_count > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${urgencyBadgeCls('overdue')}`}>
                          {c.overdue_count} overdue
                        </span>
                      )}
                      {c.due_soon_count > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${urgencyBadgeCls('due_soon')}`}>
                          {c.due_soon_count} due soon
                        </span>
                      )}
                      {c.due_this_week_count > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {c.due_this_week_count} this week
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-[10px] border-t border-zinc-800">
                      {pendingCount === 0 ? (
                        <span className="text-[11px] text-zinc-500">No pending services</span>
                      ) : (
                        <span className="bg-cyan-400/10 text-cyan-400 border border-cyan-400/25 rounded-full text-[11px] font-semibold px-[10px] py-[3px]">
                          {pendingCount} pending
                        </span>
                      )}
                      <span className="text-zinc-600 text-base">›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          <button
            type="button"
            className={`${SM_BTN_GHOST} mb-4`}
            onClick={() => setSelectedName(null)}
          >
            ← All customers
          </button>

          <div className={`${SM_CARD} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-[16px] font-semibold text-white">{selected!.customer_name}</div>
                <div className="text-[12px] text-zinc-500 mt-0.5">
                  {selectedVehicles.length} pending service{selectedVehicles.length !== 1 ? 's' : ''}
                </div>
              </div>
              <Link
                href={`/service-manager/customers?customer=${encodeURIComponent(selected!.customer_name)}`}
                className={SM_BTN_SECONDARY}
              >
                Open in Customers
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px] text-[13px]">
                <thead>
                  <tr>
                    {['Vehicle', 'Service #', 'Due', 'Current KM', 'Status', 'Actions'].map(h => (
                      <th
                        key={h}
                        className="px-4 py-[11px] text-left text-[10px] font-bold text-zinc-500 uppercase tracking-[1px] bg-zinc-900/80 border-b border-zinc-800"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-zinc-500">
                        No pending services match this filter
                      </td>
                    </tr>
                  ) : selectedVehicles.map(v => {
                    const tel = phoneLink(v.owner_phone);
                    const pending = pendingFromVehicle(v)!;
                    return (
                      <tr key={v.id} className={urgencyRowBg(v.urgency)}>
                        <td className="px-4 py-3 border-b border-zinc-800/60">
                          <span className="font-semibold text-white">{vehicleLabel(v)}</span>
                          {v.vehicle_type && (
                            <span className="block text-[11px] text-zinc-500 font-mono">{v.vehicle_type}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-b border-zinc-800/60 font-mono text-[12px]">
                          #{v.pending_service_no}
                        </td>
                        <td className="px-4 py-3 border-b border-zinc-800/60 font-mono text-[12px]">
                          {fmtDate(v.pending_due_date)} · {v.pending_due_km ?? '—'} km
                        </td>
                        <td className="px-4 py-3 border-b border-zinc-800/60 font-mono text-[12px]">
                          {v.current_km ?? 0}
                          {v.stale_km && (
                            <span className="ml-1 text-[10px] text-orange-400">stale</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-b border-zinc-800/60">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${urgencyBadgeCls(v.urgency)}`}>
                            {urgencyLabel(v.urgency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-zinc-800/60">
                          <div className="flex gap-1 flex-wrap">
                            {tel && (
                              <a href={tel} className="text-[10px] font-semibold px-2 py-1 rounded border border-cyan-400/30 text-cyan-400">
                                Call
                              </a>
                            )}
                            <button
                              type="button"
                              className="text-[10px] font-semibold px-2 py-1 rounded border border-zinc-700 text-zinc-400"
                              onClick={() => {
                                setKmModal({ id: v.id, current_km: v.current_km ?? 0 });
                                setKmValue(String(v.current_km ?? 0));
                              }}
                            >
                              KM
                            </button>
                            <button
                              type="button"
                              className="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-500/15 text-emerald-400"
                              onClick={() => {
                                setMarkDoneModal(pending);
                                setMarkDoneForm({
                                  actual_km: String(v.current_km ?? v.pending_due_km ?? ''),
                                  completion_date: new Date().toISOString().slice(0, 10),
                                  cost: '',
                                });
                              }}
                            >
                              Done
                            </button>
                            <Link
                              href={`/service-manager/vehicles/${v.id}`}
                              className="text-[10px] font-semibold px-2 py-1 rounded border border-zinc-700 text-zinc-400"
                            >
                              Dossier
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
        </div>
      )}

      {kmModal && (
        <KmUpdateSheet
          onClose={() => setKmModal(null)}
          value={kmValue}
          onChange={setKmValue}
          onSubmit={submitKm}
          busy={busy}
        />
      )}

      {markDoneModal && (
        <MarkServiceDoneSheet
          serviceNo={markDoneModal.service_no}
          form={markDoneForm}
          onChange={patch => setMarkDoneForm(f => ({ ...f, ...patch }))}
          onClose={() => setMarkDoneModal(null)}
          onSubmit={submitMarkDone}
          busy={busy}
        />
      )}
    </ServiceManagerShell>
  );
}
