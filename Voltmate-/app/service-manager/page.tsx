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

const PAGE_STYLES = `
  .sm-root { min-height: 100vh; background: #0a0c12; color: #e8edf5; font-family: 'Outfit', sans-serif; }
  .sm-content { padding: 32px 28px; max-width: 1680px; margin: 0 auto; }
  .sm-header { margin-bottom: 28px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .sm-title { font-size: 28px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 6px; }
  .sm-subtitle { font-size: 13.5px; color: #8e97ad; }
  .sm-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .sm-stat { background: #0f1117; border: 1px solid #1e2236; border-radius: 12px; padding: 18px; }
  .sm-stat-label { font-size: 10.5px; font-weight: 600; color: #545968; text-transform: uppercase; letter-spacing: .9px; margin-bottom: 8px; }
  .sm-stat-val { font-size: 28px; font-weight: 800; font-family: 'IBM Plex Mono', monospace; }
  .sm-stat-val.primary { color: #00d9ff; }
  .sm-stat-val.red { color: #f43f5e; }
  .sm-stat-val.amber { color: #fbbf24; }
  .sm-stat-val.green { color: #10b981; }
  .sm-alert { background: rgba(244,63,94,.1); border: 1px solid rgba(244,63,94,.25); border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
  .sm-alert-title { font-weight: 700; color: #f43f5e; margin-bottom: 8px; }
  .sm-alert-list { font-size: 13px; color: #e8edf5; }
  .sm-table-card { background: #0f1117; border: 1px solid #1e2236; border-radius: 12px; overflow: hidden; }
  .sm-table-header { padding: 16px 20px; border-bottom: 1px solid #1e2236; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
  .sm-table-title { font-size: 14px; font-weight: 700; }
  .sm-table-outer { overflow-x: auto; }
  .sm-table { width: 100%; border-collapse: collapse; min-width: 900px; }
  .sm-table th { padding: 11px 16px; text-align: left; font-size: 10px; font-weight: 700; color: #545968; text-transform: uppercase; letter-spacing: 1px; background: #141720; border-bottom: 1px solid #1e2236; }
  .sm-table td { padding: 13px 16px; border-bottom: 1px solid rgba(30,34,54,.6); font-size: 13px; }
  .sm-table tbody tr:last-child td { border-bottom: none; }
  .sm-table tbody tr.overdue { background: rgba(244,63,94,.08); }
  .sm-table tbody tr.due_soon { background: rgba(251,191,36,.06); }
  .sm-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .sm-badge.overdue { background: rgba(244,63,94,.15); color: #f43f5e; }
  .sm-badge.due_soon { background: rgba(251,191,36,.12); color: #fbbf24; }
  .sm-badge.ok { background: rgba(16,185,129,.1); color: #10b981; }
  .sm-btn { font-family: inherit; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 8px; border: 1px solid #1e2236; background: transparent; color: #8e97ad; cursor: pointer; transition: all .15s; }
  .sm-btn:hover { border-color: #272b40; color: #e8edf5; }
  .sm-btn-primary { background: #00d9ff; color: #0a0c12; border-color: #00d9ff; }
  .sm-btn-primary:hover { background: #00b8d9; border-color: #00b8d9; color: #0a0c12; }
  .sm-link { color: #00d9ff; text-decoration: none; font-weight: 600; }
  .sm-link:hover { text-decoration: underline; }
  .sm-mono { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #8e97ad; }
  .sm-empty { text-align: center; padding: 48px 20px; color: #545968; font-size: 14px; }
  .sm-loading { text-align: center; padding: 48px; color: #8e97ad; }
`;

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

  return (
    <div className="sm-root">
      <style>{PAGE_STYLES}</style>
      <div className="sm-content">
        <div className="sm-header">
          <div>
            <div className="sm-title">Service Manager</div>
            <div className="sm-subtitle">Daily overview of vehicles and pending services</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/service-manager/vehicles" className="sm-btn sm-btn-primary">
              Manage Vehicles
            </Link>
          </div>
        </div>

        {error && <div className="sm-alert"><div className="sm-alert-title">Error</div><div>{error}</div></div>}

        {loading ? (
          <div className="sm-loading">Loading dashboard…</div>
        ) : data ? (
          <>
            <div className="sm-stats">
              <div className="sm-stat">
                <div className="sm-stat-label">Total Vehicles</div>
                <div className="sm-stat-val primary">{data.total_vehicles}</div>
              </div>
              <div className="sm-stat">
                <div className="sm-stat-label">Overdue</div>
                <div className="sm-stat-val red">{data.overdue_count}</div>
              </div>
              <div className="sm-stat">
                <div className="sm-stat-label">Due Today</div>
                <div className="sm-stat-val amber">{data.due_today_count}</div>
              </div>
              <div className="sm-stat">
                <div className="sm-stat-label">Due This Week</div>
                <div className="sm-stat-val green">{data.due_this_week_count}</div>
              </div>
            </div>

            {overdueVehicles.length > 0 && (
              <div className="sm-alert">
                <div className="sm-alert-title">Overdue services</div>
                <div className="sm-alert-list">
                  {overdueVehicles.map(p => (
                    <span key={p.service_id}>
                      {p.vehicle_number || p.chassis_number || `Vehicle #${p.id}`} – {p.owner_name || '—'} ({fmtDate(p.due_date)})
                      {' · '}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="sm-table-card">
              <div className="sm-table-header">
                <div className="sm-table-title">Pending services (by urgency)</div>
              </div>
              <div className="sm-table-outer">
                <table className="sm-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Owner</th>
                      <th>Location</th>
                      <th>Service #</th>
                      <th>Due KM</th>
                      <th>Due Date</th>
                      <th>Current KM</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.length === 0 ? (
                      <tr><td colSpan={9} className="sm-empty">No pending services. Add vehicles from Manage Vehicles.</td></tr>
                    ) : (
                      pending.map(p => {
                        const currentKm = p.current_km ?? 0;
                        const dueKm = p.due_km ?? 0;
                        const kmRem = dueKm - currentKm;
                        const dueDate = p.due_date ? new Date(p.due_date) : null;
                        const daysRem = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
                        return (
                          <tr key={p.service_id} className={p.urgency}>
                            <td>
                              <span style={{ fontWeight: 600 }}>{p.vehicle_number || p.chassis_number || `#${p.id}`}</span>
                              {p.vehicle_type && <span className="sm-mono" style={{ display: 'block', marginTop: 2 }}>{p.vehicle_type}</span>}
                            </td>
                            <td>{p.owner_name || '—'}</td>
                            <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.location || '—'}</td>
                            <td className="sm-mono">{p.service_no}</td>
                            <td className="sm-mono">{p.due_km ?? '—'}</td>
                            <td className="sm-mono">{fmtDate(p.due_date)}</td>
                            <td className="sm-mono">{currentKm}</td>
                            <td>
                              <span className={`sm-badge ${p.urgency}`}>
                                {p.urgency === 'overdue' ? 'Overdue' : p.urgency === 'due_soon' ? 'Due soon' : 'OK'}
                              </span>
                              {(daysRem != null || (dueKm > 0 && kmRem > 0)) && (
                                <div style={{ fontSize: 11, color: '#545968', marginTop: 2 }}>
                                  {daysRem != null && daysRem <= 365 && `${daysRem}d `}
                                  {dueKm > 0 && kmRem > 0 && `${kmRem} km`}
                                </div>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="sm-btn"
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
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setKmModalVehicle(null)}
          >
            <div
              style={{
                background: '#0f1117',
                border: '1px solid #1e2236',
                borderRadius: 12,
                padding: 24,
                minWidth: 280,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ marginBottom: 12, fontWeight: 700 }}>Update current KM</div>
              <input
                type="number"
                min={0}
                value={kmModalValue}
                onChange={e => setKmModalValue(e.target.value)}
                className="sm-mono"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0a0c12',
                  border: '1px solid #1e2236',
                  borderRadius: 8,
                  color: '#e8edf5',
                  marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="sm-btn" onClick={() => setKmModalVehicle(null)}>Cancel</button>
                <button type="button" className="sm-btn sm-btn-primary" onClick={submitKmUpdate}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
