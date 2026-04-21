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
  pdi?: string;
  speak_with?: string;
  remarks?: string;
  // inline service data
  s1_id?: number; s1_due_km?: number; s1_due_date?: string; s1_actual_km?: number; s1_completion_date?: string; s1_status?: string; s1_cost?: number | string;
  s2_id?: number; s2_due_km?: number; s2_due_date?: string; s2_actual_km?: number; s2_completion_date?: string; s2_status?: string; s2_cost?: number | string;
  s3_id?: number; s3_due_km?: number; s3_due_date?: string; s3_actual_km?: number; s3_completion_date?: string; s3_status?: string; s3_cost?: number | string;
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
  cost?: number | string;
}

const EMPTY_VEHICLE: Record<string, string | number> = {
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
  pdi: '',
  speak_with: '',
  remarks: '',
};

const PAGE_STYLES = `
  .sm-root { min-height: 100vh; background: #0a0c12; color: #e8edf5; font-family: 'Outfit', sans-serif; }
  .sm-content { padding: 32px 28px; max-width: 100%; margin: 0 auto; }
  .sm-header { margin-bottom: 28px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .sm-title { font-size: 28px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 6px; }
  .sm-subtitle { font-size: 13.5px; color: #8e97ad; }
  .sm-table-card { background: #0f1117; border: 1px solid #1e2236; border-radius: 12px; overflow: hidden; }
  .sm-table-header { padding: 16px 20px; border-bottom: 1px solid #1e2236; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
  .sm-table-title { font-size: 14px; font-weight: 700; }
  .sm-table-outer { overflow-x: auto; }
  .sm-table { width: 100%; border-collapse: collapse; min-width: 2200px; }
  .sm-table th { padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 700; color: #545968; text-transform: uppercase; letter-spacing: 1px; background: #141720; border-bottom: 1px solid #1e2236; white-space: nowrap; }
  .sm-table th.svc-group { background: #101420; text-align: center; border-left: 2px solid #1e2236; }
  .sm-table th.svc-sub { background: #0f1117; font-size: 9px; border-left: 1px solid #1a1e30; text-align: center; }
  .sm-table th.sm-th-remarks { min-width: 100px; white-space: normal; word-break: break-word; }
  .sm-table th.sm-th-speak { min-width: 140px; white-space: normal; word-break: break-word; }
  .sm-table th.sm-th-actions { min-width: 100px; white-space: normal; }
  .sm-table th.svc-sub-status { min-width: 100px; }
  .sm-table td { padding: 11px 12px; border-bottom: 1px solid rgba(30,34,54,.6); font-size: 12.5px; vertical-align: middle; }
  .sm-table td.svc-cell { border-left: 1px solid rgba(30,34,54,.8); text-align: center; min-width: 90px; }
  .sm-table td.svc-cell-status { min-width: 100px; }
  .sm-table td.svc-cell-cost { min-width: 72px; max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
  .sm-table td.svc-group-start { border-left: 2px solid #1e2236; }
  .sm-table td.sm-td-remarks { max-width: 160px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; word-break: break-word; vertical-align: middle; }
  .sm-table td.sm-td-speak { min-width: 140px; max-width: 180px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; word-break: break-word; vertical-align: middle; }
  .sm-table td.sm-td-actions { min-width: 100px; }
  .sm-table tbody tr:last-child td { border-bottom: none; }
  .sm-badge { display: inline-flex; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .sm-badge.overdue { background: rgba(244,63,94,.15); color: #f43f5e; }
  .sm-badge.due_soon { background: rgba(251,191,36,.12); color: #fbbf24; }
  .sm-badge.ok { background: rgba(16,185,129,.1); color: #10b981; }
  .sm-badge.done { background: rgba(16,185,129,.15); color: #10b981; }
  .sm-badge.pending { background: rgba(251,191,36,.12); color: #fbbf24; }
  .sm-btn { font-family: inherit; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 7px; border: 1px solid #1e2236; background: transparent; color: #8e97ad; cursor: pointer; transition: all .15s; white-space: nowrap; }
  .sm-btn:hover { border-color: #272b40; color: #e8edf5; }
  .sm-btn-primary { background: #00d9ff; color: #0a0c12; border-color: #00d9ff; font-size: 10px; padding: 4px 8px; }
  .sm-btn-primary:hover { background: #00b8d9; border-color: #00b8d9; color: #0a0c12; }
  .sm-btn-amber { background: rgba(251,191,36,.1); color: #fbbf24; border-color: rgba(251,191,36,.3); }
  .sm-btn-red { background: rgba(244,63,94,.1); color: #f43f5e; border-color: rgba(244,63,94,.25); }
  .sm-mono { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #8e97ad; }
  .sm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.72); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
  .sm-modal { background: #0f1117; border: 1px solid #1e2236; border-radius: 16px; width: 100%; max-width: 620px; max-height: 92vh; overflow-y: auto; }
  .sm-modal-head { padding: 20px 24px; border-bottom: 1px solid #1e2236; display: flex; justify-content: space-between; align-items: flex-start; }
  .sm-modal-title { font-size: 18px; font-weight: 700; }
  .sm-modal-close { background: transparent; border: 1px solid #1e2236; color: #8e97ad; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; }
  .sm-modal-close:hover { color: #f43f5e; border-color: #f43f5e; }
  .sm-modal-body { padding: 24px; }
  .sm-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .sm-field label { font-size: 11px; font-weight: 600; color: #545968; text-transform: uppercase; letter-spacing: .8px; }
  .sm-field input, .sm-field textarea, .sm-field select { font-family: inherit; font-size: 13px; padding: 10px 12px; background: #0a0c12; border: 1px solid #1e2236; border-radius: 8px; color: #e8edf5; }
  .sm-field textarea { min-height: 72px; resize: vertical; }
  .sm-modal-foot { padding: 16px 24px; border-top: 1px solid #1e2236; display: flex; gap: 10px; justify-content: flex-end; }
  .sm-empty { text-align: center; padding: 48px 20px; color: #545968; font-size: 14px; }
  .sm-loading { text-align: center; padding: 48px; color: #8e97ad; }
  .sm-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sm-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .sm-section-title { font-size: 11px; font-weight: 700; color: #545968; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #1e2236; }
  .sm-svc-cell-inner { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 80px; }
  .sm-svc-status-inner { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 100%; }
  .sm-svc-status-inner .sm-btn { align-self: center; }
  .sm-cell-km { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; font-weight: 600; color: #e8edf5; }
  .sm-cell-date { font-size: 10.5px; color: #8e97ad; }
`;

function svcObj(v: Vehicle, n: 1 | 2 | 3): VehicleService | null {
  const id = v[`s${n}_id` as keyof Vehicle] as number | undefined;
  if (!id) return null;
  return {
    id,
    vehicle_id: v.id,
    service_no: n,
    due_km: v[`s${n}_due_km` as keyof Vehicle] as number | undefined,
    due_date: v[`s${n}_due_date` as keyof Vehicle] as string | undefined,
    actual_km: v[`s${n}_actual_km` as keyof Vehicle] as number | undefined,
    completion_date: v[`s${n}_completion_date` as keyof Vehicle] as string | undefined,
    status: v[`s${n}_status` as keyof Vehicle] as string | undefined,
    cost: v[`s${n}_cost` as keyof Vehicle] as number | string | undefined,
  };
}

export default function ServiceManagerVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>(EMPTY_VEHICLE);
  const [editId, setEditId] = useState<number | null>(null);
  const [markDoneService, setMarkDoneService] = useState<{ vehicleId: number; service: VehicleService } | null>(null);
  const [markDoneForm, setMarkDoneForm] = useState({ actual_km: '', completion_date: '', remarks: '' });
  const [editServiceState, setEditServiceState] = useState<{ vehicle: Vehicle; serviceNo: 1 | 2 | 3; service: VehicleService | null } | null>(null);
  const [editServiceForm, setEditServiceForm] = useState({ due_km: '', due_date: '', actual_km: '', completion_date: '', status: 'pending', remarks: '', cost: '' });
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
    setForm({ ...EMPTY_VEHICLE });
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
      pdi: v.pdi ?? '',
      speak_with: v.speak_with ?? '',
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
        pdi: form.pdi || null,
        speak_with: form.speak_with || null,
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
      setMarkDoneService(null);
      await fetchVehicles();
    } catch (err: any) {
      alert(err?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditService(vehicle: Vehicle, serviceNo: 1 | 2 | 3) {
    const svc = svcObj(vehicle, serviceNo);
    setEditServiceState({ vehicle, serviceNo, service: svc });
    setEditServiceForm({
      due_km: svc?.due_km != null ? String(svc.due_km) : '',
      due_date: svc?.due_date ? svc.due_date.slice(0, 10) : '',
      actual_km: svc?.actual_km != null ? String(svc.actual_km) : '',
      completion_date: svc?.completion_date ? svc.completion_date.slice(0, 10) : '',
      status: svc?.status ?? 'pending',
      remarks: svc?.remarks ?? '',
      cost: svc?.cost != null && svc?.cost !== '' ? String(svc.cost) : '',
    });
  }

  async function submitEditService(e: React.FormEvent) {
    e.preventDefault();
    if (!editServiceState) return;
    setSubmitting(true);
    try {
      const { vehicle, serviceNo, service } = editServiceState;
      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const costVal = editServiceForm.cost.trim() ? parseFloat(editServiceForm.cost) : null;
      const body = {
        service_no: service?.service_no ?? serviceNo,
        due_km: editServiceForm.due_km ? parseInt(editServiceForm.due_km, 10) : null,
        due_date: editServiceForm.due_date || null,
        actual_km: editServiceForm.actual_km ? parseInt(editServiceForm.actual_km, 10) : null,
        completion_date: editServiceForm.completion_date || null,
        status: editServiceForm.status || 'pending',
        remarks: editServiceForm.remarks || null,
        cost: costVal != null && !isNaN(costVal) ? costVal : null,
      };
      const svcId = service ? service.id : 'new';
      const res = await fetch(`${API_BASE}/api/v1/vehicles/${vehicle.id}/services/${svcId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditServiceState(null);
      await fetchVehicles();
    } catch (err: any) {
      alert(err?.message || 'Save failed');
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
      await fetchVehicles();
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
    }
  }

  async function handleExportCSV() {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/vehicles/export/csv`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `vehicles-services_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 150);
    } catch (err: any) {
      alert(err?.message || 'Export failed');
    }
  }

  function ServiceCell({ v, n }: { v: Vehicle; n: 1 | 2 | 3 }) {
    const svc = svcObj(v, n);
    if (!svc) return <span style={{ color: '#3a3f52', fontSize: 12 }}>—</span>;
    const done = svc.status === 'done';
    return (
      <div className="sm-svc-cell-inner">
        {done ? (
          <>
            <span className="sm-badge done">Done</span>
            {svc.actual_km != null && <span className="sm-cell-km">{svc.actual_km} km</span>}
            <span className="sm-cell-date">{fmtDate(svc.completion_date)}</span>
          </>
        ) : (
          <>
            <span className="sm-badge pending">Pending</span>
            {svc.due_km != null && <span className="sm-cell-km">{svc.due_km} km</span>}
            <span className="sm-cell-date">{fmtDate(svc.due_date)}</span>
            <button type="button" className="sm-btn sm-btn-primary" style={{ marginTop: 4 }} onClick={() => openMarkDone(v.id, svc)}>
              Mark Done
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="sm-root">
      <style>{PAGE_STYLES}</style>
      <div className="sm-content">
        <div className="sm-header">
          <div>
            <Link href="/service-manager" className="sm-btn" style={{ marginBottom: 8, display: 'inline-block' }}>← Dashboard</Link>
            <div className="sm-title">Vehicle Management</div>
            <div className="sm-subtitle">Full service tracking: 1st, 2nd, and 3rd service status per vehicle</div>
          </div>
          <button type="button" className="sm-btn sm-btn-primary" style={{ fontSize: 13, padding: '8px 16px' }} onClick={openAdd}>+ Add Vehicle</button>
        </div>

        {error && <div style={{ background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: 16, marginBottom: 24 }}>{error}</div>}

        {loading ? (
          <div className="sm-loading">Loading vehicles…</div>
        ) : (
          <div className="sm-table-card">
            <div className="sm-table-header">
              <div className="sm-table-title">{vehicles.length} Vehicles</div>
              <button type="button" className="sm-btn" onClick={handleExportCSV}>↓ Export CSV</button>
            </div>
            <div className="sm-table-outer">
              <table className="sm-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Vehicle No / Chassis</th>
                    <th rowSpan={2}>Vehicle Type</th>
                    <th rowSpan={2}>Owner Name & No.</th>
                    <th rowSpan={2}>Location</th>
                    <th rowSpan={2}>Driver Name & No.</th>
                    <th rowSpan={2}>Purchase Date</th>
                    <th rowSpan={2}>PDI</th>
                    <th className="svc-group" colSpan={4}>1st Service</th>
                    <th className="svc-group" colSpan={4}>2nd Service</th>
                    <th className="svc-group" colSpan={4}>3rd Service</th>
                    <th rowSpan={2} className="sm-th-remarks">Remarks</th>
                    <th rowSpan={2} className="sm-th-speak">Speak With / Notes</th>
                    <th rowSpan={2} className="sm-th-actions">Actions</th>
                  </tr>
                  <tr>
                    <th className="svc-sub">KM</th>
                    <th className="svc-sub">Date</th>
                    <th className="svc-sub svc-sub-status">Status</th>
                    <th className="svc-sub">Cost</th>
                    <th className="svc-sub">KM</th>
                    <th className="svc-sub">Date</th>
                    <th className="svc-sub svc-sub-status">Status</th>
                    <th className="svc-sub">Cost</th>
                    <th className="svc-sub">KM</th>
                    <th className="svc-sub">Date</th>
                    <th className="svc-sub svc-sub-status">Status</th>
                    <th className="svc-sub">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.length === 0 ? (
                    <tr><td colSpan={22} className="sm-empty">No vehicles. Click + Add Vehicle to add one.</td></tr>
                  ) : (
                    vehicles.map(v => {
                      const s1 = svcObj(v, 1);
                      const s2 = svcObj(v, 2);
                      const s3 = svcObj(v, 3);
                      return (
                        <tr key={v.id}>
                          {/* Vehicle */}
                          <td>
                            <span style={{ fontWeight: 700, display: 'block' }}>{v.vehicle_number || '—'}</span>
                            {v.chassis_number && <span className="sm-mono" style={{ display: 'block', marginTop: 2 }}>{v.chassis_number}</span>}
                          </td>
                          {/* Vehicle Type */}
                          <td>{v.vehicle_type || '—'}</td>
                          {/* Owner */}
                          <td>
                            <span style={{ fontWeight: 600 }}>{v.owner_name || '—'}</span>
                            {v.owner_phone && <span className="sm-mono" style={{ display: 'block', marginTop: 2 }}>{v.owner_phone}</span>}
                          </td>
                          {/* Location */}
                          <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.location || '—'}</td>
                          {/* Driver */}
                          <td>
                            <span style={{ fontWeight: 600 }}>{v.driver_name || '—'}</span>
                            {v.driver_phone && <span className="sm-mono" style={{ display: 'block', marginTop: 2 }}>{v.driver_phone}</span>}
                          </td>
                          {/* Purchase Date */}
                          <td className="sm-mono">{fmtDate(v.purchase_date)}</td>
                          {/* PDI */}
                          <td style={{ maxWidth: 100 }}>{v.pdi || '—'}</td>

                          {/* 1st Service: KM | Date | Status | Cost */}
                          <td className="svc-cell svc-group-start">
                            {s1 ? <span className="sm-cell-km">{s1.status === 'done' ? (s1.actual_km ?? '—') : (s1.due_km ?? '—')}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>
                          <td className="svc-cell">
                            {s1 ? <span className="sm-cell-date">{fmtDate(s1.status === 'done' ? s1.completion_date : s1.due_date)}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>
                          <td className="svc-cell svc-cell-status">
                            {s1 ? (
                              <div className="sm-svc-status-inner">
                                <span className={`sm-badge ${s1.status === 'done' ? 'done' : 'pending'}`}>{s1.status === 'done' ? 'Done' : 'Pending'}</span>
                                <button
                                  type="button"
                                  className="sm-btn"
                                  onClick={() => openEditService(v, 1)}
                                >
                                  Edit
                                </button>
                                {s1.status !== 'done' && (
                                  <button
                                    type="button"
                                    className="sm-btn sm-btn-primary"
                                    onClick={() => openMarkDone(v.id, s1)}
                                  >
                                    Mark Done
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="sm-svc-status-inner">
                                <span style={{ color: '#3a3f52' }}>—</span>
                                <button
                                  type="button"
                                  className="sm-btn"
                                  onClick={() => openEditService(v, 1)}
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="svc-cell svc-cell-cost">
                            {s1?.cost != null && s1.cost !== '' ? <span className="sm-mono">₹{Number(s1.cost).toLocaleString('en-IN')}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>

                          {/* 2nd Service */}
                          <td className="svc-cell svc-group-start">
                            {s2 ? <span className="sm-cell-km">{s2.status === 'done' ? (s2.actual_km ?? '—') : (s2.due_km ?? '—')}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>
                          <td className="svc-cell">
                            {s2 ? <span className="sm-cell-date">{fmtDate(s2.status === 'done' ? s2.completion_date : s2.due_date)}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>
                          <td className="svc-cell svc-cell-status">
                            {s2 ? (
                              <div className="sm-svc-status-inner">
                                <span className={`sm-badge ${s2.status === 'done' ? 'done' : 'pending'}`}>{s2.status === 'done' ? 'Done' : 'Pending'}</span>
                                <button
                                  type="button"
                                  className="sm-btn"
                                  onClick={() => openEditService(v, 2)}
                                >
                                  Edit
                                </button>
                                {s2.status !== 'done' && (
                                  <button
                                    type="button"
                                    className="sm-btn sm-btn-primary"
                                    onClick={() => openMarkDone(v.id, s2)}
                                  >
                                    Mark Done
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="sm-svc-status-inner">
                                <span style={{ color: '#3a3f52' }}>—</span>
                                <button
                                  type="button"
                                  className="sm-btn"
                                  onClick={() => openEditService(v, 2)}
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="svc-cell svc-cell-cost">
                            {s2?.cost != null && s2.cost !== '' ? <span className="sm-mono">₹{Number(s2.cost).toLocaleString('en-IN')}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>

                          {/* 3rd Service */}
                          <td className="svc-cell svc-group-start">
                            {s3 ? <span className="sm-cell-km">{s3.status === 'done' ? (s3.actual_km ?? '—') : (s3.due_km ?? '—')}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>
                          <td className="svc-cell">
                            {s3 ? <span className="sm-cell-date">{fmtDate(s3.status === 'done' ? s3.completion_date : s3.due_date)}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>
                          <td className="svc-cell svc-cell-status">
                            {s3 ? (
                              <div className="sm-svc-status-inner">
                                <span className={`sm-badge ${s3.status === 'done' ? 'done' : 'pending'}`}>{s3.status === 'done' ? 'Done' : 'Pending'}</span>
                                <button
                                  type="button"
                                  className="sm-btn"
                                  onClick={() => openEditService(v, 3)}
                                >
                                  Edit
                                </button>
                                {s3.status !== 'done' && (
                                  <button
                                    type="button"
                                    className="sm-btn sm-btn-primary"
                                    onClick={() => openMarkDone(v.id, s3)}
                                  >
                                    Mark Done
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="sm-svc-status-inner">
                                <span style={{ color: '#3a3f52' }}>—</span>
                                <button
                                  type="button"
                                  className="sm-btn"
                                  onClick={() => openEditService(v, 3)}
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="svc-cell svc-cell-cost">
                            {s3?.cost != null && s3.cost !== '' ? <span className="sm-mono">₹{Number(s3.cost).toLocaleString('en-IN')}</span> : <span style={{ color: '#3a3f52' }}>—</span>}
                          </td>

                          {/* Remarks */}
                          <td className="sm-td-remarks" style={{ fontSize: 12, color: '#8e97ad' }}>{v.remarks || '—'}</td>
                          {/* Speak With */}
                          <td className="sm-td-speak" style={{ fontSize: 12, color: '#8e97ad' }}>{v.speak_with || '—'}</td>
                          {/* Actions */}
                          <td className="sm-td-actions">
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'flex-end' }}>
                              <button type="button" className="sm-btn sm-btn-amber" onClick={() => openEdit(v)}>Edit</button>
                              <button type="button" className="sm-btn sm-btn-red" onClick={() => deleteVehicle(v.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add / Edit Vehicle Modal */}
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
                  <div className="sm-field"><label>PDI</label><input value={form.pdi} onChange={e => setForm(f => ({ ...f, pdi: e.target.value }))} /></div>
                  <div className="sm-field"><label>Speak With / Follow-up Notes</label><textarea value={form.speak_with} onChange={e => setForm(f => ({ ...f, speak_with: e.target.value }))} placeholder="e.g. Speak with Amtusa for 1st service follow-up" /></div>
                  <div className="sm-field"><label>Remarks</label><textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </div>
                <div className="sm-modal-foot">
                  <button type="button" className="sm-btn" onClick={() => setModalOpen(null)}>Cancel</button>
                  <button type="submit" className="sm-btn sm-btn-primary" style={{ fontSize: 13, padding: '8px 16px' }} disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Mark Service Done Modal */}
        {markDoneService && (
          <div className="sm-overlay" onClick={() => setMarkDoneService(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-head">
                <div className="sm-modal-title">Mark Service #{markDoneService.service.service_no} Done</div>
                <button type="button" className="sm-modal-close" onClick={() => setMarkDoneService(null)}>✕</button>
              </div>
              <form onSubmit={submitMarkDone}>
                <div className="sm-modal-body">
                  <div className="sm-field"><label>Actual KM at Service</label><input type="number" min={0} value={markDoneForm.actual_km} onChange={e => setMarkDoneForm(f => ({ ...f, actual_km: e.target.value }))} required /></div>
                  <div className="sm-field"><label>Completion Date</label><input type="date" value={markDoneForm.completion_date} onChange={e => setMarkDoneForm(f => ({ ...f, completion_date: e.target.value }))} /></div>
                  <div className="sm-field"><label>Remarks</label><textarea value={markDoneForm.remarks} onChange={e => setMarkDoneForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </div>
                <div className="sm-modal-foot">
                  <button type="button" className="sm-btn" onClick={() => setMarkDoneService(null)}>Cancel</button>
                  <button type="submit" className="sm-btn sm-btn-primary" style={{ fontSize: 13, padding: '8px 16px' }} disabled={submitting}>{submitting ? 'Saving…' : 'Mark Done'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add / Edit Individual Service Modal */}
        {editServiceState && (
          <div className="sm-overlay" onClick={() => setEditServiceState(null)}>
            <div className="sm-modal" onClick={e => e.stopPropagation()}>
              <div className="sm-modal-head">
                <div className="sm-modal-title">
                  {editServiceState.service ? `Edit Service #${editServiceState.service.service_no}` : `Add Service #${editServiceState.serviceNo}`}
                </div>
                <button type="button" className="sm-modal-close" onClick={() => setEditServiceState(null)}>✕</button>
              </div>
              <form onSubmit={submitEditService}>
                <div className="sm-modal-body">
                  <div className="sm-grid2">
                    <div className="sm-field">
                      <label>Due KM</label>
                      <input
                        type="number"
                        min={0}
                        value={editServiceForm.due_km}
                        onChange={e => setEditServiceForm(f => ({ ...f, due_km: e.target.value }))}
                      />
                    </div>
                    <div className="sm-field">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={editServiceForm.due_date}
                        onChange={e => setEditServiceForm(f => ({ ...f, due_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="sm-grid2">
                    <div className="sm-field">
                      <label>Actual KM</label>
                      <input
                        type="number"
                        min={0}
                        value={editServiceForm.actual_km}
                        onChange={e => setEditServiceForm(f => ({ ...f, actual_km: e.target.value }))}
                      />
                    </div>
                    <div className="sm-field">
                      <label>Completion Date</label>
                      <input
                        type="date"
                        value={editServiceForm.completion_date}
                        onChange={e => setEditServiceForm(f => ({ ...f, completion_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="sm-grid2">
                    <div className="sm-field">
                      <label>Status</label>
                      <select
                        value={editServiceForm.status}
                        onChange={e => setEditServiceForm(f => ({ ...f, status: e.target.value }))}
                      >
                        <option value="pending">Pending</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div className="sm-field">
                      <label>Cost (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Service cost"
                        value={editServiceForm.cost}
                        onChange={e => setEditServiceForm(f => ({ ...f, cost: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="sm-field">
                    <label>Remarks</label>
                    <textarea
                      value={editServiceForm.remarks}
                      onChange={e => setEditServiceForm(f => ({ ...f, remarks: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="sm-modal-foot">
                  <button type="button" className="sm-btn" onClick={() => setEditServiceState(null)}>Cancel</button>
                  <button
                    type="submit"
                    className="sm-btn sm-btn-primary"
                    style={{ fontSize: 13, padding: '8px 16px' }}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving…' : 'Save Service'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
