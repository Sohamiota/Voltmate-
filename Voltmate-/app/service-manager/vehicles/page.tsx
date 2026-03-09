'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Vehicle {
  id: number;
  vehicle_number?: string;
  chassis_number?: string;
  vehicle_type?: string;
  owner_name?: string;
  owner_phone?: string;
  driver_name?: string;
  driver_phone?: string;
  location?: string;
  purchase_date?: string;
  current_km?: number;
  poi?: string;
  remarks?: string;
  next_service_no?: number;
  next_due_km?: number;
  next_due_date?: string;
  urgency?: 'overdue' | 'due_soon' | 'ok';
}

interface VehicleService {
  id: number;
  vehicle_id: number;
  service_no: number;
  due_km?: number;
  due_date?: string;
  actual_km?: number;
  completion_date?: string;
  status?: string;
  remarks?: string;
}

const EMPTY_VEHICLE = {
  vehicle_number: '',
  chassis_number: '',
  vehicle_type: '',
  owner_name: '',
  owner_phone: '',
  driver_name: '',
  driver_phone: '',
  location: '',
  purchase_date: '',
  current_km: 0,
  poi: '',
  remarks: '',
};

const PAGE_STYLES = `
  .sm-root { min-height: 100vh; background: #0a0c12; color: #e8edf5; font-family: 'Outfit', sans-serif; }
  .sm-content { padding: 32px 28px; max-width: 1680px; margin: 0 auto; }
  .sm-header { margin-bottom: 28px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .sm-title { font-size: 28px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 6px; }
  .sm-subtitle { font-size: 13.5px; color: #8e97ad; }
  .sm-table-card { background: #0f1117; border: 1px solid #1e2236; border-radius: 12px; overflow: hidden; }
  .sm-table-header { padding: 16px 20px; border-bottom: 1px solid #1e2236; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
  .sm-table-title { font-size: 14px; font-weight: 700; }
  .sm-table-outer { overflow-x: auto; }
  .sm-table { width: 100%; border-collapse: collapse; min-width: 880px; }
  .sm-table th { padding: 11px 16px; text-align: left; font-size: 10px; font-weight: 700; color: #545968; text-transform: uppercase; letter-spacing: 1px; background: #141720; border-bottom: 1px solid #1e2236; }
  .sm-table td { padding: 13px 16px; border-bottom: 1px solid rgba(30,34,54,.6); font-size: 13px; }
  .sm-table tbody tr:last-child td { border-bottom: none; }
  .sm-badge { display: inline-flex; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .sm-badge.overdue { background: rgba(244,63,94,.15); color: #f43f5e; }
  .sm-badge.due_soon { background: rgba(251,191,36,.12); color: #fbbf24; }
  .sm-badge.ok { background: rgba(16,185,129,.1); color: #10b981; }
  .sm-badge.done { background: rgba(16,185,129,.15); color: #10b981; }
  .sm-btn { font-family: inherit; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 8px; border: 1px solid #1e2236; background: transparent; color: #8e97ad; cursor: pointer; transition: all .15s; }
  .sm-btn:hover { border-color: #272b40; color: #e8edf5; }
  .sm-btn-primary { background: #00d9ff; color: #0a0c12; border-color: #00d9ff; }
  .sm-btn-primary:hover { background: #00b8d9; border-color: #00b8d9; color: #0a0c12; }
  .sm-btn-amber { background: rgba(251,191,36,.1); color: #fbbf24; border-color: rgba(251,191,36,.3); }
  .sm-btn-red { background: rgba(244,63,94,.1); color: #f43f5e; border-color: rgba(244,63,94,.25); }
  .sm-mono { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #8e97ad; }
  .sm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.72); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
  .sm-modal { background: #0f1117; border: 1px solid #1e2236; border-radius: 16px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
  .sm-modal-head { padding: 20px 24px; border-bottom: 1px solid #1e2236; display: flex; justify-content: space-between; align-items: flex-start; }
  .sm-modal-title { font-size: 18px; font-weight: 700; }
  .sm-modal-close { background: transparent; border: 1px solid #1e2236; color: #8e97ad; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; }
  .sm-modal-close:hover { color: #f43f5e; border-color: #f43f5e; }
  .sm-modal-body { padding: 24px; }
  .sm-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .sm-field label { font-size: 11px; font-weight: 600; color: #545968; text-transform: uppercase; letter-spacing: .8px; }
  .sm-field input, .sm-field textarea { font-family: inherit; font-size: 13px; padding: 10px 12px; background: #0a0c12; border: 1px solid #1e2236; border-radius: 8px; color: #e8edf5; }
  .sm-field textarea { min-height: 80px; resize: vertical; }
  .sm-modal-foot { padding: 16px 24px; border-top: 1px solid #1e2236; display: flex; gap: 10px; justify-content: flex-end; }
  .sm-empty { text-align: center; padding: 48px 20px; color: #545968; font-size: 14px; }
  .sm-loading { text-align: center; padding: 48px; color: #8e97ad; }
  .sm-history { margin-top: 12px; padding: 16px; background: #0a0c12; border-radius: 10px; border: 1px solid #1e2236; }
  .sm-history-title { font-size: 12px; font-weight: 700; color: #545968; margin-bottom: 12px; }
  .sm-history-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #1e2236; font-size: 13px; }
  .sm-history-row:last-child { border-bottom: none; }
  .sm-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
`;

export default function ServiceManagerVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>(EMPTY_VEHICLE);
  const [editId, setEditId] = useState<number | null>(null);
  const [historyVehicleId, setHistoryVehicleId] = useState<number | null>(null);
  const [historyServices, setHistoryServices] = useState<VehicleService[]>([]);
  const [markDoneService, setMarkDoneService] = useState<{ vehicleId: number; service: VehicleService } | null>(null);
  const [markDoneForm, setMarkDoneForm] = useState({ actual_km: '', completion_date: '', remarks: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/vehicles`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setVehicles(j.vehicles || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load vehicles');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_VEHICLE);
    setModalOpen('add');
  }

  function openEdit(v: Vehicle) {
    setEditId(v.id);
    setForm({
      vehicle_number: v.vehicle_number ?? '',
      chassis_number: v.chassis_number ?? '',
      vehicle_type: v.vehicle_type ?? '',
      owner_name: v.owner_name ?? '',
      owner_phone: v.owner_phone ?? '',
      driver_name: v.driver_name ?? '',
      driver_phone: v.driver_phone ?? '',
      location: v.location ?? '',
      purchase_date: v.purchase_date ? v.purchase_date.slice(0, 10) : '',
      current_km: v.current_km ?? 0,
      poi: v.poi ?? '',
      remarks: v.remarks ?? '',
    });
    setModalOpen('edit');
  }

  async function submitVehicle(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const body = {
        vehicle_number: form.vehicle_number || null,
        chassis_number: form.chassis_number || null,
        vehicle_type: form.vehicle_type || null,
        owner_name: form.owner_name || null,
        owner_phone: form.owner_phone || null,
        driver_name: form.driver_name || null,
        driver_phone: form.driver_phone || null,
        location: form.location || null,
        purchase_date: form.purchase_date || null,
        current_km: form.current_km ?? 0,
        poi: form.poi || null,
        remarks: form.remarks || null,
      };
      if (editId) {
        const res = await fetch(`${API_BASE}/api/v1/vehicles/${editId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(`${API_BASE}/api/v1/vehicles`, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
      }
      setModalOpen(null);
      await fetchVehicles();
    } catch (err: any) {
      alert(err?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function openHistory(vehicleId: number) {
    if (historyVehicleId === vehicleId) {
      setHistoryVehicleId(null);
      setHistoryServices([]);
      return;
    }
    setHistoryVehicleId(vehicleId);
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/vehicles/${vehicleId}/services`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setHistoryServices(j.services || []);
    } catch {
      setHistoryServices([]);
    }
  }

  function openMarkDone(vehicleId: number, service: VehicleService) {
    setMarkDoneService({ vehicleId, service });
    setMarkDoneForm({
      actual_km: String(service.actual_km ?? ''),
      completion_date: service.completion_date ? service.completion_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      remarks: service.remarks ?? '',
    });
  }

  async function submitMarkDone(e: React.FormEvent) {
    e.preventDefault();
    if (!markDoneService) return;
    const actual_km = parseInt(markDoneForm.actual_km, 10);
    if (isNaN(actual_km) || actual_km < 0) {
      alert('Enter valid actual KM');
      return;
    }
    setSubmitting(true);
    try {
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(
        `${API_BASE}/api/v1/vehicles/${markDoneService.vehicleId}/services/${markDoneService.service.id}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            actual_km,
            completion_date: markDoneForm.completion_date || null,
            status: 'done',
            remarks: markDoneForm.remarks || null,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setMarkDoneService(null);
      if (historyVehicleId === markDoneService.vehicleId) setHistoryServices(j.services || []);
      await fetchVehicles();
    } catch (err: any) {
      alert(err?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteVehicle(id: number) {
    if (!confirm('Delete this vehicle and all its service records?')) return;
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/vehicles/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      setHistoryVehicleId(prev => prev === id ? null : prev);
      await fetchVehicles();
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
    }
  }

  return (
    <div className="sm-root">
      <style>{PAGE_STYLES}</style>
      <div className="sm-content">
        <div className="sm-header">
          <div>
            <Link href="/service-manager" className="sm-btn" style={{ marginBottom: 8, display: 'inline-block' }}>← Dashboard</Link>
            <div className="sm-title">Vehicle Management</div>
            <div className="sm-subtitle">Add and edit vehicles; view service history and mark services done</div>
          </div>
          <button type="button" className="sm-btn sm-btn-primary" onClick={openAdd}>+ Add Vehicle</button>
        </div>

        {error && <div style={{ background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: 16, marginBottom: 24 }}>{error}</div>}

        {loading ? (
          <div className="sm-loading">Loading vehicles…</div>
        ) : (
          <div className="sm-table-card">
            <div className="sm-table-header">
              <div className="sm-table-title">{vehicles.length} Vehicles</div>
            </div>
            <div className="sm-table-outer">
              <table className="sm-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Owner</th>
                    <th>Location</th>
                    <th>Current KM</th>
                    <th>Next Service</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.length === 0 ? (
                    <tr><td colSpan={7} className="sm-empty">No vehicles. Click + Add Vehicle to add one.</td></tr>
                  ) : (
                    vehicles.map(v => (
                      <React.Fragment key={v.id}>
                        <tr>
                          <td>
                            <span style={{ fontWeight: 600 }}>{v.vehicle_number || v.chassis_number || `#${v.id}`}</span>
                            {v.vehicle_type && <span className="sm-mono" style={{ display: 'block', marginTop: 2 }}>{v.vehicle_type}</span>}
                          </td>
                          <td>{v.owner_name || '—'}<br /><span className="sm-mono" style={{ fontSize: 11 }}>{v.owner_phone || ''}</span></td>
                          <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.location || '—'}</td>
                          <td className="sm-mono">{v.current_km ?? '—'}</td>
                          <td className="sm-mono">
                            {v.next_service_no != null ? `#${v.next_service_no} · ${v.next_due_km ?? '—'} km · ${fmtDate(v.next_due_date)}` : '—'}
                          </td>
                          <td>
                            {v.urgency && <span className={`sm-badge ${v.urgency}`}>{v.urgency === 'overdue' ? 'Overdue' : v.urgency === 'due_soon' ? 'Due soon' : 'OK'}</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <button type="button" className="sm-btn sm-btn-amber" onClick={() => openEdit(v)}>Edit</button>
                              <button type="button" className="sm-btn" onClick={() => openHistory(v.id)}>View History</button>
                              <button type="button" className="sm-btn sm-btn-red" onClick={() => deleteVehicle(v.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                        {historyVehicleId === v.id && (
                          <tr>
                            <td colSpan={7} style={{ padding: 0, verticalAlign: 'top' }}>
                              <div className="sm-history">
                                <div className="sm-history-title">Service history</div>
                                {historyServices.length === 0 ? <div className="sm-mono" style={{ fontSize: 12 }}>No services recorded.</div> : (
                                  historyServices.map(svc => (
                                    <div key={svc.id} className="sm-history-row">
                                      <span className={`sm-badge ${svc.status === 'done' ? 'done' : 'due_soon'}`}>{svc.status === 'done' ? 'Done' : 'Pending'}</span>
                                      <span className="sm-mono">Service #{svc.service_no}</span>
                                      {svc.completion_date && <span>{fmtDate(svc.completion_date)}</span>}
                                      {svc.actual_km != null && <span>{svc.actual_km} km</span>}
                                      {svc.status === 'pending' && (
                                        <button type="button" className="sm-btn sm-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => openMarkDone(v.id, svc)}>Mark Done</button>
                                      )}
                                    </div>
                                  ))
                                )}
                                <button type="button" className="sm-btn" style={{ marginTop: 12 }} onClick={() => setHistoryVehicleId(null)}>Close</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(modalOpen === 'add' || modalOpen === 'edit') && (
          <div className="sm-overlay" onClick={() => setModalOpen(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-head">
                <div className="sm-modal-title">{editId ? 'Edit Vehicle' : 'Add Vehicle'}</div>
                <button type="button" className="sm-modal-close" onClick={() => setModalOpen(null)}>✕</button>
              </div>
              <form onSubmit={submitVehicle}>
                <div className="sm-modal-body">
                  <div className="sm-grid2">
                    <div className="sm-field"><label>Vehicle Number</label><input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} /></div>
                    <div className="sm-field"><label>Chassis Number</label><input value={form.chassis_number} onChange={e => setForm(f => ({ ...f, chassis_number: e.target.value }))} /></div>
                  </div>
                  <div className="sm-field"><label>Vehicle Type</label><input value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))} placeholder="e.g. Turbo V+, Hi Load, Storm" /></div>
                  <div className="sm-grid2">
                    <div className="sm-field"><label>Owner Name</label><input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} /></div>
                    <div className="sm-field"><label>Owner Phone</label><input type="tel" value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))} /></div>
                  </div>
                  <div className="sm-grid2">
                    <div className="sm-field"><label>Driver Name</label><input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} /></div>
                    <div className="sm-field"><label>Driver Phone</label><input type="tel" value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} /></div>
                  </div>
                  <div className="sm-field"><label>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                  <div className="sm-grid2">
                    <div className="sm-field"><label>Purchase Date</label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
                    <div className="sm-field"><label>Current KM</label><input type="number" min={0} value={form.current_km} onChange={e => setForm(f => ({ ...f, current_km: parseInt(e.target.value, 10) || 0 }))} /></div>
                  </div>
                  <div className="sm-field"><label>POI</label><input value={form.poi} onChange={e => setForm(f => ({ ...f, poi: e.target.value }))} /></div>
                  <div className="sm-field"><label>Remarks</label><textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </div>
                <div className="sm-modal-foot">
                  <button type="button" className="sm-btn" onClick={() => setModalOpen(null)}>Cancel</button>
                  <button type="submit" className="sm-btn sm-btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {markDoneService && (
          <div className="sm-overlay" onClick={() => setMarkDoneService(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-head">
                <div className="sm-modal-title">Mark Service #{markDoneService.service.service_no} Done</div>
                <button type="button" className="sm-modal-close" onClick={() => setMarkDoneService(null)}>✕</button>
              </div>
              <form onSubmit={submitMarkDone}>
                <div className="sm-modal-body">
                  <div className="sm-field"><label>Actual KM</label><input type="number" min={0} value={markDoneForm.actual_km} onChange={e => setMarkDoneForm(f => ({ ...f, actual_km: e.target.value }))} required /></div>
                  <div className="sm-field"><label>Completion Date</label><input type="date" value={markDoneForm.completion_date} onChange={e => setMarkDoneForm(f => ({ ...f, completion_date: e.target.value }))} /></div>
                  <div className="sm-field"><label>Remarks</label><textarea value={markDoneForm.remarks} onChange={e => setMarkDoneForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </div>
                <div className="sm-modal-foot">
                  <button type="button" className="sm-btn" onClick={() => setMarkDoneService(null)}>Cancel</button>
                  <button type="submit" className="sm-btn sm-btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Mark Done'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
