'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffectiveSearch } from '@/components/SearchContext';
import ServiceManagerShell from '@/components/service-manager/ServiceManagerShell';
import {
  CustomerDetail,
  CustomerGroup,
  fetchCustomerDetail,
  fetchCustomerGroups,
  fmtDate,
  phoneLink,
  vehicleLabel,
} from '@/lib/serviceManagerApi';
import {
  SM_BTN_GHOST,
  SM_CARD,
  SM_INPUT,
  customerKey,
  getInitials,
  urgencyBadgeCls,
  urgencyLabel,
} from '@/lib/serviceManagerUi';

export default function ServiceManagerCustomersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-sans text-sm">Loading customers…</div>}>
      <ServiceManagerCustomersPageInner />
    </Suspense>
  );
}

function ServiceManagerCustomersPageInner() {
  const searchParams = useSearchParams();
  const initialCustomer = searchParams?.get('customer') ?? null;

  const [customers, setCustomers] = useState<CustomerGroup[]>([]);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(initialCustomer);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const effectiveSearch = useEffectiveSearch(search);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { customers: groups } = await fetchCustomerGroups();
      setCustomers(groups);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (name: string) => {
    try {
      setDetailLoading(true);
      const d = await fetchCustomerDetail(customerKey(name));
      setDetail(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load customer detail');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  useEffect(() => {
    if (selectedName) loadDetail(selectedName);
    else setDetail(null);
  }, [selectedName, loadDetail]);

  useEffect(() => {
    if (initialCustomer && !selectedName) setSelectedName(initialCustomer);
  }, [initialCustomer, selectedName]);

  const filtered = useMemo(() => {
    if (!effectiveSearch) return customers;
    const q = effectiveSearch.toLowerCase();
    return customers.filter(c => c.customer_name.toLowerCase().includes(q));
  }, [customers, effectiveSearch]);

  const selected = selectedName
    ? customers.find(c => c.customer_name === selectedName) ?? null
    : null;

  return (
    <ServiceManagerShell
      title="Customer Hub"
      description="Fleet owners grouped by name — vehicles, service history, and activity"
      actions={
        <button type="button" className={SM_BTN_GHOST} onClick={() => { loadGroups(); if (selectedName) loadDetail(selectedName); }}>
          Refresh
        </button>
      }
    >
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl px-5 py-4 mb-5 text-rose-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-5 min-h-[520px]">
        {/* Left rail — customer list */}
        <div className={`${SM_CARD} overflow-hidden flex flex-col`}>
          <div className="p-3 border-b border-zinc-800">
            <input
              className={`${SM_INPUT} w-full`}
              placeholder="Search customer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto flex-1 max-h-[calc(100vh-280px)]">
            {loading ? (
              <div className="p-4 text-sm text-zinc-500">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500">No customers</div>
            ) : filtered.map(c => {
              const active = selectedName === c.customer_name;
              return (
                <button
                  key={c.customer_name}
                  type="button"
                  onClick={() => setSelectedName(c.customer_name)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-800/60 transition-colors ${
                    active ? 'bg-cyan-400/[0.08] border-l-2 border-l-cyan-400' : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0891b2] to-[#0e7490] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                      {getInitials(c.customer_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-white truncate">{c.customer_name}</div>
                      <div className="text-[11px] text-zinc-500">{c.vehicle_count} vehicles</div>
                    </div>
                    {c.overdue_count > 0 && (
                      <span className="text-[10px] font-bold text-rose-400">{c.overdue_count}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel — detail */}
        <div className={`${SM_CARD} overflow-hidden`}>
          {!selectedName ? (
            <div className="flex items-center justify-center h-full min-h-[400px] text-zinc-500 text-sm">
              Select a customer from the list
            </div>
          ) : detailLoading && !detail ? (
            <div className="p-8 text-zinc-500 text-sm">Loading customer detail…</div>
          ) : detail ? (
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
                <div>
                  <div className="text-[18px] font-semibold text-white">{detail.customer_name}</div>
                  <div className="text-[12px] text-zinc-500 mt-1">
                    {detail.vehicles.length} vehicle{detail.vehicles.length !== 1 ? 's' : ''} in fleet
                  </div>
                </div>
                {selected && (selected.overdue_count > 0 || selected.due_soon_count > 0) && (
                  <div className="flex gap-2">
                    {selected.overdue_count > 0 && (
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${urgencyBadgeCls('overdue')}`}>
                        {selected.overdue_count} overdue
                      </span>
                    )}
                    {selected.due_soon_count > 0 && (
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${urgencyBadgeCls('due_soon')}`}>
                        {selected.due_soon_count} due soon
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <div className="text-[12px] font-bold uppercase text-zinc-500 tracking-wide mb-3">Fleet</div>
                <div className="space-y-2">
                  {detail.vehicles.map(v => {
                    const tel = phoneLink(v.owner_phone);
                    return (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-950/50 flex-wrap"
                      >
                        <div>
                          <Link
                            href={`/service-manager/vehicles/${v.id}`}
                            className="text-[14px] font-semibold text-cyan-400 hover:underline"
                          >
                            {vehicleLabel(v)}
                          </Link>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {v.vehicle_type || '—'} · {v.location || 'No location'} · {v.current_km ?? 0} km
                          </div>
                          {v.next_service_no && (
                            <div className="text-[11px] text-zinc-400 mt-1">
                              Next: #{v.next_service_no} · {fmtDate(v.next_due_date)} · {v.next_due_km ?? '—'} km
                              {v.urgency && (
                                <span className={`ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${urgencyBadgeCls(v.urgency)}`}>
                                  {urgencyLabel(v.urgency)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          {tel && (
                            <a href={tel} className="text-[10px] font-semibold px-2 py-1 rounded border border-cyan-400/30 text-cyan-400">
                              Call
                            </a>
                          )}
                          <Link
                            href={`/service-manager/vehicles/${v.id}`}
                            className="text-[10px] font-semibold px-2 py-1 rounded border border-zinc-700 text-zinc-400"
                          >
                            Dossier
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <div className="text-[12px] font-bold uppercase text-zinc-500 tracking-wide mb-3">Service history</div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[12px] min-w-[560px]">
                    <thead>
                      <tr>
                        {['Vehicle', 'Svc #', 'Status', 'Due', 'Completed', 'KM'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase border-b border-zinc-800">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.services.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-zinc-500">No service records</td>
                        </tr>
                      ) : detail.services.slice(0, 30).map(s => (
                        <tr key={s.id} className="border-b border-zinc-800/50">
                          <td className="px-3 py-2 font-mono">{s.vehicle_number || s.vehicle_id}</td>
                          <td className="px-3 py-2">#{s.service_no}</td>
                          <td className="px-3 py-2">
                            <span className={s.status === 'done' ? 'text-emerald-400' : 'text-amber-400'}>
                              {s.status || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">{fmtDate(s.due_date)}</td>
                          <td className="px-3 py-2 font-mono">{fmtDate(s.completion_date)}</td>
                          <td className="px-3 py-2 font-mono">{s.actual_km ?? s.due_km ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {detail.activity_log.length > 0 && (
                <div>
                  <div className="text-[12px] font-bold uppercase text-zinc-500 tracking-wide mb-3">Activity log</div>
                  <div className="space-y-2 max-h-[240px] overflow-y-auto">
                    {detail.activity_log.map(log => (
                      <div key={log.id} className="text-[12px] px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950/40">
                        <div className="flex justify-between gap-2">
                          <span className="text-zinc-300 font-medium">{log.action}</span>
                          <span className="text-zinc-600 text-[11px] shrink-0">
                            {new Date(log.performed_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {log.performed_by_name && (
                          <div className="text-[11px] text-zinc-500 mt-0.5">by {log.performed_by_name}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </ServiceManagerShell>
  );
}
