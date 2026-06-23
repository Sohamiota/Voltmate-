'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import VehicleDetailDrawer from '@/components/service-manager/VehicleDetailDrawer';
import { getBackNavigation, getBreadcrumbsForPath } from '@/lib/navigation';
import { downloadXlsx, xlsDate } from '@/lib/exportXlsx';
import {
  Vehicle,
  VehicleService,
  exportVehiclesCsv,
  fetchFilterOptions,
  fetchVehicle,
  fetchVehicles,
  fmtDate,
  importVehicles,
  phoneLink,
} from '@/lib/serviceManagerApi';
import { API_BASE, getStoredToken } from '@/src/api/client';

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

// ─── Tailwind class constants ──────────────────────────────────────────────────

const baseTh =
  'px-3 py-2.5 text-left text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#141720] border-b border-[#1e2236] whitespace-nowrap';

const svcGroupTh =
  'px-3 py-2.5 text-[10px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#101420] border-b border-[#1e2236] text-center border-l-2 [border-left-color:#1e2236]';

const svcSubTh =
  'px-3 py-2.5 text-[9px] font-bold text-[#545968] uppercase tracking-[1px] bg-[#0f1117] border-b border-[#1e2236] text-center border-l [border-left-color:#1a1e30]';

const baseTd =
  'px-3 py-[11px] border-b border-[rgba(30,34,54,0.6)] text-[12.5px] align-middle';

const svcCell =
  'px-3 py-[11px] border-b border-[rgba(30,34,54,0.6)] text-[12.5px] align-middle border-l [border-left-color:rgba(30,34,54,0.8)] text-center min-w-[90px]';

const svcCellGroupStart =
  'px-3 py-[11px] border-b border-[rgba(30,34,54,0.6)] text-[12.5px] align-middle border-l-2 [border-left-color:#1e2236] text-center min-w-[90px]';

const baseBtn =
  'font-sans text-[11px] font-semibold py-[5px] px-2.5 rounded-[7px] border border-[#1e2236] bg-transparent text-[#8e97ad] cursor-pointer transition-all duration-150 whitespace-nowrap hover:border-[#272b40] hover:text-[#e8edf5]';

const primaryBtn =
  'font-sans text-[10px] font-semibold py-1 px-2 rounded-[7px] border bg-cyan-400 text-[#0a0c12] border-cyan-400 cursor-pointer transition-all duration-150 whitespace-nowrap hover:bg-[#00b8d9] hover:border-[#00b8d9] hover:text-[#0a0c12]';

const primaryBtnLg =
  'font-sans text-[13px] font-semibold py-2 px-4 rounded-[7px] border bg-cyan-400 text-[#0a0c12] border-cyan-400 cursor-pointer transition-all duration-150 whitespace-nowrap hover:bg-[#00b8d9] hover:border-[#00b8d9] hover:text-[#0a0c12]';

const amberBtn =
  'font-sans text-[11px] font-semibold py-[5px] px-2.5 rounded-[7px] border bg-[rgba(251,191,36,0.1)] text-amber-400 border-[rgba(251,191,36,0.3)] cursor-pointer transition-all duration-150 whitespace-nowrap';

const redBtn =
  'font-sans text-[11px] font-semibold py-[5px] px-2.5 rounded-[7px] border bg-[rgba(244,63,94,0.1)] text-[#f43f5e] border-[rgba(244,63,94,0.25)] cursor-pointer transition-all duration-150 whitespace-nowrap';

const monoClass = 'font-mono text-[11px] text-[#8e97ad]';

const badgeDone =
  'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(16,185,129,0.15)] text-[#10b981]';

const badgePending =
  'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(251,191,36,0.12)] text-amber-400';

const fieldLabel =
  'text-[11px] font-semibold text-[#545968] uppercase tracking-[0.8px]';

const fieldInput =
  'font-sans text-[13px] py-2.5 px-3 bg-[#0a0c12] border border-[#1e2236] rounded-lg text-[#e8edf5]';

const modalOverlay =
  'fixed inset-0 bg-black/[0.72] z-[1000] flex items-center justify-center p-5 overflow-y-auto';

const modalBox =
  'bg-[#0f1117] border border-[#1e2236] rounded-2xl w-full max-w-[620px] max-h-[92vh] overflow-y-auto';

const modalHead =
  'px-6 py-5 border-b border-[#1e2236] flex justify-between items-start';

const modalClose =
  'bg-transparent border border-[#1e2236] text-[#8e97ad] w-8 h-8 rounded-lg cursor-pointer text-base hover:text-[#f43f5e] hover:border-[#f43f5e]';

const modalFoot =
  'px-6 py-4 border-t border-[#1e2236] flex gap-2.5 justify-end';

const svcStatusInner =
  'flex flex-col items-center justify-center gap-1.5 w-full';

// ──────────────────────────────────────────────────────────────────────────────

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
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState<{ locations: string[]; vehicle_types: string[] }>({ locations: [], vehicle_types: [] });
  const [drawerVehicle, setDrawerVehicle] = useState<Vehicle | null>(null);
  const [drawerServices, setDrawerServices] = useState<VehicleService[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>(EMPTY_VEHICLE);
  const [editId, setEditId] = useState<number | null>(null);
  const [markDoneService, setMarkDoneService] = useState<{ vehicleId: number; service: VehicleService } | null>(null);
  const [markDoneForm, setMarkDoneForm] = useState({ actual_km: '', completion_date: '', remarks: '' });
  const [editServiceState, setEditServiceState] = useState<{ vehicle: Vehicle; serviceNo: 1 | 2 | 3; service: VehicleService | null } | null>(null);
  const [editServiceForm, setEditServiceForm] = useState({ due_km: '', due_date: '', actual_km: '', completion_date: '', status: 'pending', remarks: '', cost: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchVehicleList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (urgencyFilter !== 'all') params.urgency = urgencyFilter;
      if (locationFilter) params.location = locationFilter;
      if (typeFilter) params.vehicle_type = typeFilter;
      const j = await fetchVehicles(Object.keys(params).length ? params : undefined);
      setVehicles(j.vehicles || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load vehicles');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [search, urgencyFilter, locationFilter, typeFilter]);

  useEffect(() => { fetchVehicleList(); }, [fetchVehicleList]);

  useEffect(() => {
    fetchFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);

  async function openDrawer(vehicleId: number) {
    try {
      const data = await fetchVehicle(vehicleId);
      setDrawerVehicle(data.vehicle);
      setDrawerServices(data.services);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to load vehicle');
    }
  }

  useEffect(() => {
    const openId = searchParams?.get('open');
    if (openId) openDrawer(parseInt(openId, 10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredCount = vehicles.length;

  function getToken(): string {
    return getStoredToken();
  }

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
        const res = await fetch(`${API_BASE}/vehicles/${editId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(`${API_BASE}/vehicles`, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
      }
      setModalOpen(null);
      await fetchVehicleList();
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
        `${API_BASE}/vehicles/${markDoneService.vehicleId}/services/${markDoneService.service.id}`,
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
      await fetchVehicleList();
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
      const res = await fetch(`${API_BASE}/vehicles/${vehicle.id}/services/${svcId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditServiceState(null);
      await fetchVehicleList();
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
      const res = await fetch(`${API_BASE}/vehicles/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      await fetchVehicleList();
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
    }
  }

  async function handleServerExport() {
    try {
      const blob = await exportVehiclesCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vehicles-services_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Export failed');
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImportBusy(true);
    try {
      const rows = JSON.parse(importText);
      if (!Array.isArray(rows)) throw new Error('JSON must be an array of vehicles');
      await importVehicles(rows);
      setImportOpen(false);
      setImportText('');
      await fetchVehicleList();
      alert(`Imported ${rows.length} vehicle(s)`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportBusy(false);
    }
  }

  const rowUrgencyBg = (u?: string) =>
    u === 'overdue' ? 'bg-[#f43f5e]/[0.06]' : u === 'due_soon' ? 'bg-[#fbbf24]/[0.04]' : '';

  function handleExportCSV() {
    if (vehicles.length === 0) { alert('No vehicles to export.'); return; }
    const rows = vehicles.map(v => ({
      'Vehicle Number':   v.vehicle_number ?? '',
      'Chassis Number':   v.chassis_number ?? '',
      'Vehicle Type':     v.vehicle_type ?? '',
      'Owner Name':       v.owner_name ?? '',
      'Owner Phone':      v.owner_phone ?? '',
      'Driver Name':      v.driver_name ?? '',
      'Driver Phone':     v.driver_phone ?? '',
      'Location':         v.location ?? '',
      'Purchase Date':    xlsDate(v.purchase_date),
      'Current KM':       v.current_km ?? '',
      'PDI':              v.pdi ?? '',
      '1st Svc Due KM':   v.s1_due_km ?? '',
      '1st Svc Due Date': xlsDate(v.s1_due_date),
      '1st Svc Done KM':  v.s1_actual_km ?? '',
      '1st Svc Done Date':xlsDate(v.s1_completion_date),
      '1st Svc Status':   v.s1_status ?? '',
      '1st Svc Cost':     v.s1_cost ?? '',
      '2nd Svc Due KM':   v.s2_due_km ?? '',
      '2nd Svc Due Date': xlsDate(v.s2_due_date),
      '2nd Svc Done KM':  v.s2_actual_km ?? '',
      '2nd Svc Done Date':xlsDate(v.s2_completion_date),
      '2nd Svc Status':   v.s2_status ?? '',
      '2nd Svc Cost':     v.s2_cost ?? '',
      '3rd Svc Due KM':   v.s3_due_km ?? '',
      '3rd Svc Due Date': xlsDate(v.s3_due_date),
      '3rd Svc Done KM':  v.s3_actual_km ?? '',
      '3rd Svc Done Date':xlsDate(v.s3_completion_date),
      '3rd Svc Status':   v.s3_status ?? '',
      '3rd Svc Cost':     v.s3_cost ?? '',
      'Next Svc No':      v.next_service_no ?? '',
      'Next Due KM':      v.next_due_km ?? '',
      'Next Due Date':    xlsDate(v.next_due_date),
      'Urgency':          v.urgency ?? '',
    }));
    downloadXlsx(rows, `vehicles-services_${new Date().toISOString().slice(0, 10)}`, 'Vehicles');
  }

  function ServiceCell({ v, n }: { v: Vehicle; n: 1 | 2 | 3 }) {
    const svc = svcObj(v, n);
    if (!svc) return <span className="text-[#3a3f52] text-xs">—</span>;
    const done = svc.status === 'done';
    return (
      <div className="flex flex-col items-center gap-1 min-w-[80px]">
        {done ? (
          <>
            <span className={badgeDone}>Done</span>
            {svc.actual_km != null && <span className="font-mono text-[11.5px] font-semibold text-[#e8edf5]">{svc.actual_km} km</span>}
            <span className="text-[10.5px] text-[#8e97ad]">{fmtDate(svc.completion_date)}</span>
          </>
        ) : (
          <>
            <span className={badgePending}>Pending</span>
            {svc.due_km != null && <span className="font-mono text-[11.5px] font-semibold text-[#e8edf5]">{svc.due_km} km</span>}
            <span className="text-[10.5px] text-[#8e97ad]">{fmtDate(svc.due_date)}</span>
            <button type="button" className={`${primaryBtn} mt-1`} onClick={() => openMarkDone(v.id, svc)}>
              Mark Done
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8edf5] font-sans">
      <div className="px-7 py-8 max-w-full mx-auto">
        <div className="mb-7 flex items-center justify-between flex-wrap gap-3">
          <PageHeader
            variant="dark"
            className="mb-0"
            title="Vehicle Management"
            description="Full service tracking: 1st, 2nd, and 3rd service status per vehicle"
            backHref={getBackNavigation('/service-manager/vehicles')?.href}
            backLabel={`Back to ${getBackNavigation('/service-manager/vehicles')?.label ?? 'Service Manager'}`}
            breadcrumbs={getBreadcrumbsForPath('/service-manager/vehicles')}
          />
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={baseBtn} onClick={() => setImportOpen(true)}>↑ Import JSON</button>
            <button type="button" className={primaryBtnLg} onClick={openAdd}>+ Add Vehicle</button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            placeholder="Search vehicle, owner, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-[#0f1117] border border-[#1e2236] rounded-lg"
          />
          <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} className="text-sm bg-[#0f1117] border border-[#1e2236] rounded-lg px-3 py-2">
            <option value="all">All urgency</option>
            <option value="overdue">Overdue</option>
            <option value="due_soon">Due soon</option>
            <option value="ok">OK</option>
          </select>
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="text-sm bg-[#0f1117] border border-[#1e2236] rounded-lg px-3 py-2">
            <option value="">All locations</option>
            {filterOptions.locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="text-sm bg-[#0f1117] border border-[#1e2236] rounded-lg px-3 py-2">
            <option value="">All types</option>
            {filterOptions.vehicle_types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {error && (
          <div className="bg-[rgba(244,63,94,0.1)] border border-[rgba(244,63,94,0.25)] rounded-xl p-4 mb-6">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12 text-[#8e97ad]">Loading vehicles…</div>
        ) : (
          <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e2236] flex justify-between items-center flex-wrap gap-2.5">
              <div className="text-sm font-bold">{filteredCount} Vehicles</div>
              <div className="flex gap-2">
                <button type="button" className={baseBtn} onClick={handleServerExport}>↓ Export CSV</button>
                <button type="button" className={baseBtn} onClick={handleExportCSV}>↓ Export XLSX</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[2200px]">
                <thead>
                  <tr>
                    <th rowSpan={2} className={baseTh}>Vehicle No / Chassis</th>
                    <th rowSpan={2} className={baseTh}>Vehicle Type</th>
                    <th rowSpan={2} className={baseTh}>Owner Name & No.</th>
                    <th rowSpan={2} className={baseTh}>Location</th>
                    <th rowSpan={2} className={baseTh}>Driver Name & No.</th>
                    <th rowSpan={2} className={baseTh}>Purchase Date</th>
                    <th rowSpan={2} className={baseTh}>PDI</th>
                    <th className={svcGroupTh} colSpan={4}>1st Service</th>
                    <th className={svcGroupTh} colSpan={4}>2nd Service</th>
                    <th className={svcGroupTh} colSpan={4}>3rd Service</th>
                    <th rowSpan={2} className={`${baseTh} min-w-[120px]`}>Next Pending</th>
                    <th rowSpan={2} className={`${baseTh} min-w-[100px] whitespace-normal break-words`}>Remarks</th>
                    <th rowSpan={2} className={`${baseTh} min-w-[140px] whitespace-normal break-words`}>Speak With / Notes</th>
                    <th rowSpan={2} className={`${baseTh} min-w-[100px] whitespace-normal`}>Actions</th>
                  </tr>
                  <tr>
                    <th className={svcSubTh}>KM</th>
                    <th className={svcSubTh}>Date</th>
                    <th className={`${svcSubTh} min-w-[100px]`}>Status</th>
                    <th className={svcSubTh}>Cost</th>
                    <th className={svcSubTh}>KM</th>
                    <th className={svcSubTh}>Date</th>
                    <th className={`${svcSubTh} min-w-[100px]`}>Status</th>
                    <th className={svcSubTh}>Cost</th>
                    <th className={svcSubTh}>KM</th>
                    <th className={svcSubTh}>Date</th>
                    <th className={`${svcSubTh} min-w-[100px]`}>Status</th>
                    <th className={svcSubTh}>Cost</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {vehicles.length === 0 ? (
                    <tr><td colSpan={22} className="text-center py-12 px-5 text-[#545968] text-sm">No vehicles. Click + Add Vehicle to add one.</td></tr>
                  ) : (
                    vehicles.map(v => {
                      const s1 = svcObj(v, 1);
                      const s2 = svcObj(v, 2);
                      const s3 = svcObj(v, 3);
                      return (
                        <tr key={v.id} className={rowUrgencyBg(v.urgency)}>
                          {/* Vehicle */}
                          <td className={baseTd}>
                            <span className="font-bold block">{v.vehicle_number || '—'}</span>
                            {v.chassis_number && <span className={`${monoClass} block mt-0.5`}>{v.chassis_number}</span>}
                          </td>
                          {/* Vehicle Type */}
                          <td className={baseTd}>{v.vehicle_type || '—'}</td>
                          {/* Owner */}
                          <td className={baseTd}>
                            <span className="font-semibold">{v.owner_name || '—'}</span>
                            {v.owner_phone && <span className={`${monoClass} block mt-0.5`}>{v.owner_phone}</span>}
                          </td>
                          {/* Location */}
                          <td className={`${baseTd} max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap`}>{v.location || '—'}</td>
                          {/* Driver */}
                          <td className={baseTd}>
                            <span className="font-semibold">{v.driver_name || '—'}</span>
                            {v.driver_phone && <span className={`${monoClass} block mt-0.5`}>{v.driver_phone}</span>}
                          </td>
                          {/* Purchase Date */}
                          <td className={`${baseTd} ${monoClass}`}>{fmtDate(v.purchase_date)}</td>
                          {/* PDI */}
                          <td className={`${baseTd} max-w-[100px]`}>
                            {v.pdi_status ? (
                              <span className="text-xs capitalize">{v.pdi_status.replace('_', ' ')}</span>
                            ) : (v.pdi || '—')}
                          </td>

                          {/* 1st Service: KM | Date | Status | Cost */}
                          <td className={svcCellGroupStart}>
                            {s1 ? <span className="font-mono text-[11.5px] font-semibold text-[#e8edf5]">{s1.status === 'done' ? (s1.actual_km ?? '—') : (s1.due_km ?? '—')}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>
                          <td className={svcCell}>
                            {s1 ? <span className="text-[10.5px] text-[#8e97ad]">{fmtDate(s1.status === 'done' ? s1.completion_date : s1.due_date)}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>
                          <td className={`${svcCell} min-w-[100px]`}>
                            {s1 ? (
                              <div className={svcStatusInner}>
                                <span className={s1.status === 'done' ? badgeDone : badgePending}>{s1.status === 'done' ? 'Done' : 'Pending'}</span>
                                <button
                                  type="button"
                                  className={`${baseBtn} self-center`}
                                  onClick={() => openEditService(v, 1)}
                                >
                                  Edit
                                </button>
                                {s1.status !== 'done' && (
                                  <button
                                    type="button"
                                    className={`${primaryBtn} self-center`}
                                    onClick={() => openMarkDone(v.id, s1)}
                                  >
                                    Mark Done
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className={svcStatusInner}>
                                <span className="text-[#3a3f52]">—</span>
                                <button
                                  type="button"
                                  className={`${baseBtn} self-center`}
                                  onClick={() => openEditService(v, 1)}
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </td>
                          <td className={`${svcCell} min-w-[72px] max-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis`}>
                            {s1?.cost != null && s1.cost !== '' ? <span className={monoClass}>₹{Number(s1.cost).toLocaleString('en-IN')}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>

                          {/* 2nd Service */}
                          <td className={svcCellGroupStart}>
                            {s2 ? <span className="font-mono text-[11.5px] font-semibold text-[#e8edf5]">{s2.status === 'done' ? (s2.actual_km ?? '—') : (s2.due_km ?? '—')}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>
                          <td className={svcCell}>
                            {s2 ? <span className="text-[10.5px] text-[#8e97ad]">{fmtDate(s2.status === 'done' ? s2.completion_date : s2.due_date)}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>
                          <td className={`${svcCell} min-w-[100px]`}>
                            {s2 ? (
                              <div className={svcStatusInner}>
                                <span className={s2.status === 'done' ? badgeDone : badgePending}>{s2.status === 'done' ? 'Done' : 'Pending'}</span>
                                <button
                                  type="button"
                                  className={`${baseBtn} self-center`}
                                  onClick={() => openEditService(v, 2)}
                                >
                                  Edit
                                </button>
                                {s2.status !== 'done' && (
                                  <button
                                    type="button"
                                    className={`${primaryBtn} self-center`}
                                    onClick={() => openMarkDone(v.id, s2)}
                                  >
                                    Mark Done
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className={svcStatusInner}>
                                <span className="text-[#3a3f52]">—</span>
                                <button
                                  type="button"
                                  className={`${baseBtn} self-center`}
                                  onClick={() => openEditService(v, 2)}
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </td>
                          <td className={`${svcCell} min-w-[72px] max-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis`}>
                            {s2?.cost != null && s2.cost !== '' ? <span className={monoClass}>₹{Number(s2.cost).toLocaleString('en-IN')}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>

                          {/* 3rd Service */}
                          <td className={svcCellGroupStart}>
                            {s3 ? <span className="font-mono text-[11.5px] font-semibold text-[#e8edf5]">{s3.status === 'done' ? (s3.actual_km ?? '—') : (s3.due_km ?? '—')}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>
                          <td className={svcCell}>
                            {s3 ? <span className="text-[10.5px] text-[#8e97ad]">{fmtDate(s3.status === 'done' ? s3.completion_date : s3.due_date)}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>
                          <td className={`${svcCell} min-w-[100px]`}>
                            {s3 ? (
                              <div className={svcStatusInner}>
                                <span className={s3.status === 'done' ? badgeDone : badgePending}>{s3.status === 'done' ? 'Done' : 'Pending'}</span>
                                <button
                                  type="button"
                                  className={`${baseBtn} self-center`}
                                  onClick={() => openEditService(v, 3)}
                                >
                                  Edit
                                </button>
                                {s3.status !== 'done' && (
                                  <button
                                    type="button"
                                    className={`${primaryBtn} self-center`}
                                    onClick={() => openMarkDone(v.id, s3)}
                                  >
                                    Mark Done
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className={svcStatusInner}>
                                <span className="text-[#3a3f52]">—</span>
                                <button
                                  type="button"
                                  className={`${baseBtn} self-center`}
                                  onClick={() => openEditService(v, 3)}
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </td>
                          <td className={`${svcCell} min-w-[72px] max-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis`}>
                            {s3?.cost != null && s3.cost !== '' ? <span className={monoClass}>₹{Number(s3.cost).toLocaleString('en-IN')}</span> : <span className="text-[#3a3f52]">—</span>}
                          </td>

                          <td className={baseTd}>
                            {v.next_service_no ? (
                              <div className="text-xs">
                                <div className="font-semibold">#{v.next_service_no}</div>
                                <div className={`${monoClass} mt-0.5`}>{v.next_due_km ?? '—'} km</div>
                                <div className="text-[10.5px] text-[#8e97ad]">{fmtDate(v.next_due_date)}</div>
                                {v.urgency && v.urgency !== 'ok' && (
                                  <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${v.urgency === 'overdue' ? 'bg-[#f43f5e]/15 text-[#f43f5e]' : 'bg-amber-400/10 text-amber-400'}`}>
                                    {v.urgency === 'overdue' ? 'Overdue' : 'Due soon'}
                                  </span>
                                )}
                              </div>
                            ) : '—'}
                          </td>

                          {/* Remarks */}
                          <td className={`${baseTd} max-w-[160px] line-clamp-3 break-words text-xs text-[#8e97ad]`}>{v.remarks || '—'}</td>
                          {/* Speak With */}
                          <td className={`${baseTd} min-w-[140px] max-w-[180px] line-clamp-3 break-words text-xs text-[#8e97ad]`}>{v.speak_with || '—'}</td>
                          {/* Actions */}
                          <td className={`${baseTd} min-w-[100px]`}>
                            <div className="flex flex-wrap gap-1.5 justify-end">
                              {phoneLink(v.owner_phone) && (
                                <a href={phoneLink(v.owner_phone)!} className={`${baseBtn} no-underline`}>Call</a>
                              )}
                              <button type="button" className={primaryBtn} onClick={() => openDrawer(v.id)}>Details</button>
                              <button type="button" className={amberBtn} onClick={() => openEdit(v)}>Edit</button>
                              <button type="button" className={redBtn} onClick={() => deleteVehicle(v.id)}>Delete</button>
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
          <div className={modalOverlay} onClick={() => setModalOpen(null)}>
            <div className={modalBox} onClick={e => e.stopPropagation()}>
              <div className={modalHead}>
                <div className="text-lg font-bold">{editId ? 'Edit Vehicle' : 'Add Vehicle'}</div>
                <button type="button" className={modalClose} onClick={() => setModalOpen(null)}>Close</button>
              </div>
              <form onSubmit={submitVehicle}>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Vehicle Number</label><input className={fieldInput} value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} /></div>
                    <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Chassis Number</label><input className={fieldInput} value={form.chassis_number} onChange={e => setForm(f => ({ ...f, chassis_number: e.target.value }))} /></div>
                  </div>
                  <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Vehicle Type</label><input className={fieldInput} value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))} placeholder="e.g. Turbo V+, Hi Load, Storm" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Owner Name</label><input className={fieldInput} value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} /></div>
                    <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Owner Phone</label><input className={fieldInput} type="tel" value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Driver Name</label><input className={fieldInput} value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} /></div>
                    <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Driver Phone</label><input className={fieldInput} type="tel" value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} /></div>
                  </div>
                  <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Location</label><input className={fieldInput} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Purchase Date</label><input className={fieldInput} type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
                    <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Current KM</label><input className={fieldInput} type="number" min={0} value={form.current_km} onChange={e => setForm(f => ({ ...f, current_km: parseInt(e.target.value, 10) || 0 }))} /></div>
                  </div>
                  <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>PDI</label><input className={fieldInput} value={form.pdi} onChange={e => setForm(f => ({ ...f, pdi: e.target.value }))} /></div>
                  <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Speak With / Follow-up Notes</label><textarea className={`${fieldInput} min-h-[72px] resize-y`} value={form.speak_with} onChange={e => setForm(f => ({ ...f, speak_with: e.target.value }))} placeholder="e.g. Speak with Amtusa for 1st service follow-up" /></div>
                  <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Remarks</label><textarea className={`${fieldInput} min-h-[72px] resize-y`} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </div>
                <div className={modalFoot}>
                  <button type="button" className={baseBtn} onClick={() => setModalOpen(null)}>Cancel</button>
                  <button type="submit" className={primaryBtnLg} disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Mark Service Done Modal */}
        {markDoneService && (
          <div className={modalOverlay} onClick={() => setMarkDoneService(null)}>
            <div className={modalBox} onClick={e => e.stopPropagation()}>
              <div className={modalHead}>
                <div className="text-lg font-bold">Mark Service #{markDoneService.service.service_no} Done</div>
                <button type="button" className={modalClose} onClick={() => setMarkDoneService(null)}>Close</button>
              </div>
              <form onSubmit={submitMarkDone}>
                <div className="p-6">
                  <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Actual KM at Service</label><input className={fieldInput} type="number" min={0} value={markDoneForm.actual_km} onChange={e => setMarkDoneForm(f => ({ ...f, actual_km: e.target.value }))} required /></div>
                  <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Completion Date</label><input className={fieldInput} type="date" value={markDoneForm.completion_date} onChange={e => setMarkDoneForm(f => ({ ...f, completion_date: e.target.value }))} /></div>
                  <div className="flex flex-col gap-1.5 mb-4"><label className={fieldLabel}>Remarks</label><textarea className={`${fieldInput} min-h-[72px] resize-y`} value={markDoneForm.remarks} onChange={e => setMarkDoneForm(f => ({ ...f, remarks: e.target.value }))} /></div>
                </div>
                <div className={modalFoot}>
                  <button type="button" className={baseBtn} onClick={() => setMarkDoneService(null)}>Cancel</button>
                  <button type="submit" className={primaryBtnLg} disabled={submitting}>{submitting ? 'Saving…' : 'Mark Done'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add / Edit Individual Service Modal */}
        {editServiceState && (
          <div className={modalOverlay} onClick={() => setEditServiceState(null)}>
            <div className={modalBox} onClick={e => e.stopPropagation()}>
              <div className={modalHead}>
                <div className="text-lg font-bold">
                  {editServiceState.service ? `Edit Service #${editServiceState.service.service_no}` : `Add Service #${editServiceState.serviceNo}`}
                </div>
                <button type="button" className={modalClose} onClick={() => setEditServiceState(null)}>Close</button>
              </div>
              <form onSubmit={submitEditService}>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className={fieldLabel}>Due KM</label>
                      <input
                        className={fieldInput}
                        type="number"
                        min={0}
                        value={editServiceForm.due_km}
                        onChange={e => setEditServiceForm(f => ({ ...f, due_km: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className={fieldLabel}>Due Date</label>
                      <input
                        className={fieldInput}
                        type="date"
                        value={editServiceForm.due_date}
                        onChange={e => setEditServiceForm(f => ({ ...f, due_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className={fieldLabel}>Actual KM</label>
                      <input
                        className={fieldInput}
                        type="number"
                        min={0}
                        value={editServiceForm.actual_km}
                        onChange={e => setEditServiceForm(f => ({ ...f, actual_km: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className={fieldLabel}>Completion Date</label>
                      <input
                        className={fieldInput}
                        type="date"
                        value={editServiceForm.completion_date}
                        onChange={e => setEditServiceForm(f => ({ ...f, completion_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className={fieldLabel}>Status</label>
                      <select
                        className={fieldInput}
                        value={editServiceForm.status}
                        onChange={e => setEditServiceForm(f => ({ ...f, status: e.target.value }))}
                      >
                        <option value="pending">Pending</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className={fieldLabel}>Cost (₹)</label>
                      <input
                        className={fieldInput}
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Service cost"
                        value={editServiceForm.cost}
                        onChange={e => setEditServiceForm(f => ({ ...f, cost: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 mb-4">
                    <label className={fieldLabel}>Remarks</label>
                    <textarea
                      className={`${fieldInput} min-h-[72px] resize-y`}
                      value={editServiceForm.remarks}
                      onChange={e => setEditServiceForm(f => ({ ...f, remarks: e.target.value }))}
                    />
                  </div>
                </div>
                <div className={modalFoot}>
                  <button type="button" className={baseBtn} onClick={() => setEditServiceState(null)}>Cancel</button>
                  <button
                    type="submit"
                    className={primaryBtnLg}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving…' : 'Save Service'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {drawerVehicle && (
          <VehicleDetailDrawer
            vehicle={drawerVehicle}
            services={drawerServices}
            onClose={() => setDrawerVehicle(null)}
            onUpdated={async () => {
              await fetchVehicleList();
              if (drawerVehicle) {
                const data = await fetchVehicle(drawerVehicle.id);
                setDrawerVehicle(data.vehicle);
                setDrawerServices(data.services);
              }
            }}
          />
        )}

        {importOpen && (
          <div className={modalOverlay} onClick={() => setImportOpen(false)}>
            <form onSubmit={handleImport} className={`${modalBox} max-w-[640px]`} onClick={e => e.stopPropagation()}>
              <div className={modalHead}>
                <div>
                  <div className="text-lg font-bold">Bulk import vehicles</div>
                  <div className="text-xs text-[#8e97ad] mt-1">Paste JSON array matching POST /vehicles/import body</div>
                </div>
                <button type="button" className={modalClose} onClick={() => setImportOpen(false)}>Close</button>
              </div>
              <div className="p-6">
                <textarea
                  className={`${fieldInput} min-h-[200px] font-mono text-xs w-full`}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder='[{"vehicle_number":"...","owner_name":"...","purchase_date":"01-01-2024"}]'
                />
              </div>
              <div className={modalFoot}>
                <button type="button" className={baseBtn} onClick={() => setImportOpen(false)}>Cancel</button>
                <button type="submit" className={primaryBtnLg} disabled={importBusy}>{importBusy ? 'Importing…' : 'Import'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
