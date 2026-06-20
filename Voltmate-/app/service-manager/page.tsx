'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface DashboardData {
  total_vehicles: number;
  overdue_count: number;
  due_today_count: number;
  due_this_week_count: number;
  pending_services: Array<{
    id: number;
    vehicle_number?: string;
    chassis_number?: string;
    vehicle_type?: string;
    owner_name?: string;
    location?: string;
    current_km?: number;
    service_id: number;
    service_no: number;
    due_km?: number;
    due_date?: string;
    status?: string;
    urgency: 'overdue' | 'due_soon' | 'ok';
    due_today?: boolean;
    due_this_week?: boolean;
  }>;
}

export default function ServiceManagerPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingKmId, setUpdatingKmId] = useState<number | null>(null);
  const [kmModalVehicle, setKmModalVehicle] = useState<{ id: number; current_km: number } | null>(null);
  const [kmModalValue, setKmModalValue] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/vehicles/dashboard`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setData(j);
    } catch (e: any) {
      setError(e?.message || 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  function openKmModal(id: number, currentKm: number) {
    setKmModalVehicle({ id, current_km: currentKm });
    setKmModalValue(String(currentKm));
  }

  async function submitKmUpdate() {
    if (!kmModalVehicle) return;
    const val = parseInt(kmModalValue, 10);
    if (isNaN(val) || val < 0) {
      alert('Enter a valid KM');
      return;
    }
    try {
      setUpdatingKmId(kmModalVehicle.id);
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/vehicles/${kmModalVehicle.id}/current-km`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ current_km: val }),
      });
      if (!res.ok) throw new Error(await res.text());
      setKmModalVehicle(null);
      await fetchDashboard();
    } catch (e: any) {
      alert(e?.message || 'Update failed');
    } finally {
      setUpdatingKmId(null);
    }
  }

  const overdueVehicles = data?.pending_services?.filter(p => p.urgency === 'overdue') ?? [];
  const pending = data?.pending_services ?? [];

  const rowBg = (urgency: string) =>
    urgency === 'overdue' ? 'bg-[#f43f5e]/[0.08]' : urgency === 'due_soon' ? 'bg-[#fbbf24]/[0.06]' : '';

  const badgeCls = (urgency: string) =>
    urgency === 'overdue'
      ? 'bg-[#f43f5e]/[0.15] text-[#f43f5e]'
      : urgency === 'due_soon'
      ? 'bg-[#fbbf24]/[0.12] text-amber-400'
      : 'bg-[#10b981]/[0.10] text-[#10b981]';

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8edf5] font-sans">
      <div className="px-7 py-8 max-w-[1680px] mx-auto">
        <div className="mb-7 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[28px] font-extrabold tracking-tight mb-1.5">Service Manager</div>
            <div className="text-[13.5px] text-[#8e97ad]">Daily overview of vehicles and pending services</div>
          </div>
          <div className="flex gap-2.5">
            <Link
              href="/service-manager/vehicles"
              className="font-sans text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-400 bg-cyan-400 text-[#0a0c12] cursor-pointer transition-all duration-150 hover:bg-[#00b8d9] hover:border-[#00b8d9]"
            >
              Manage Vehicles
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-[#f43f5e]/[0.10] border border-[#f43f5e]/[0.25] rounded-xl px-5 py-4 mb-6">
            <div className="font-bold text-[#f43f5e] mb-2">Error</div>
            <div>{error}</div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-[#8e97ad]">Loading dashboard…</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 mb-6">
              <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-[18px]">
                <div className="text-[10.5px] font-semibold text-[#545968] uppercase tracking-[0.9px] mb-2">Total Vehicles</div>
                <div className="text-[28px] font-extrabold font-mono text-cyan-400">{data.total_vehicles}</div>
              </div>
              <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-[18px]">
                <div className="text-[10.5px] font-semibold text-[#545968] uppercase tracking-[0.9px] mb-2">Overdue</div>
                <div className="text-[28px] font-extrabold font-mono text-[#f43f5e]">{data.overdue_count}</div>
              </div>
              <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-[18px]">
                <div className="text-[10.5px] font-semibold text-[#545968] uppercase tracking-[0.9px] mb-2">Due Today</div>
                <div className="text-[28px] font-extrabold font-mono text-amber-400">{data.due_today_count}</div>
              </div>
              <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-[18px]">
                <div className="text-[10.5px] font-semibold text-[#545968] uppercase tracking-[0.9px] mb-2">Due This Week</div>
                <div className="text-[28px] font-extrabold font-mono text-[#10b981]">{data.due_this_week_count}</div>
              </div>
            </div>

            {overdueVehicles.length > 0 && (
              <div className="bg-[#f43f5e]/[0.10] border border-[#f43f5e]/[0.25] rounded-xl px-5 py-4 mb-6">
                <div className="font-bold text-[#f43f5e] mb-2">Overdue services</div>
                <div className="text-[13px] text-[#e8edf5]">
                  {overdueVehicles.map(p => (
                    <span key={p.service_id}>
                      {p.vehicle_number || p.chassis_number || `Vehicle #${p.id}`} – {p.owner_name || '—'} ({fmtDate(p.due_date)})
                      {' · '}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1e2236] flex justify-between items-center flex-wrap gap-2.5">
                <div className="text-sm font-bold">Pending services (by urgency)</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead>
                    <tr>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Vehicle</th>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Owner</th>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Location</th>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Service #</th>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Due KM</th>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Due Date</th>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Current KM</th>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Status</th>
                      <th className="px-4 py-[11px] text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center px-5 py-12 text-[#545968] text-sm">
                          No pending services. Add vehicles from Manage Vehicles.
                        </td>
                      </tr>
                    ) : (
                      pending.map(p => {
                        const currentKm = p.current_km ?? 0;
                        const dueKm = p.due_km ?? 0;
                        const kmRem = dueKm - currentKm;
                        const dueDate = p.due_date ? new Date(p.due_date) : null;
                        const daysRem = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
                        return (
                          <tr key={p.service_id} className={rowBg(p.urgency)}>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px]">
                              <span className="font-semibold">{p.vehicle_number || p.chassis_number || `#${p.id}`}</span>
                              {p.vehicle_type && (
                                <span className="font-mono text-xs text-[#8e97ad] block mt-0.5">{p.vehicle_type}</span>
                              )}
                            </td>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px]">{p.owner_name || '—'}</td>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px] max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">{p.location || '—'}</td>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px] font-mono text-xs text-[#8e97ad]">{p.service_no}</td>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px] font-mono text-xs text-[#8e97ad]">{p.due_km ?? '—'}</td>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px] font-mono text-xs text-[#8e97ad]">{fmtDate(p.due_date)}</td>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px] font-mono text-xs text-[#8e97ad]">{currentKm}</td>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px]">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeCls(p.urgency)}`}>
                                {p.urgency === 'overdue' ? 'Overdue' : p.urgency === 'due_soon' ? 'Due soon' : 'OK'}
                              </span>
                              {(daysRem != null || (dueKm > 0 && kmRem > 0)) && (
                                <div className="text-[11px] text-[#545968] mt-0.5">
                                  {daysRem != null && daysRem <= 365 && `${daysRem}d `}
                                  {dueKm > 0 && kmRem > 0 && `${kmRem} km`}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-[13px] border-b border-[#1e2236]/60 text-[13px]">
                              <button
                                type="button"
                                className="font-sans text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#1e2236] bg-transparent text-[#8e97ad] cursor-pointer transition-all duration-150 hover:border-[#272b40] hover:text-[#e8edf5]"
                                onClick={() => openKmModal(p.id, currentKm)}
                                disabled={updatingKmId === p.id}
                              >
                                {updatingKmId === p.id ? 'Updating…' : 'Update KM'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {kmModalVehicle && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
            onClick={() => setKmModalVehicle(null)}
          >
            <div
              className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-6 min-w-[280px]"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-3 font-bold">Update current KM</div>
              <input
                type="number"
                min={0}
                value={kmModalValue}
                onChange={e => setKmModalValue(e.target.value)}
                className="font-mono text-xs text-[#8e97ad] w-full px-3 py-2.5 bg-[#0a0c12] border border-[#1e2236] rounded-lg text-[#e8edf5] mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="font-sans text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#1e2236] bg-transparent text-[#8e97ad] cursor-pointer transition-all duration-150 hover:border-[#272b40] hover:text-[#e8edf5]"
                  onClick={() => setKmModalVehicle(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="font-sans text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-400 bg-cyan-400 text-[#0a0c12] cursor-pointer transition-all duration-150 hover:bg-[#00b8d9] hover:border-[#00b8d9]"
                  onClick={submitKmUpdate}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
