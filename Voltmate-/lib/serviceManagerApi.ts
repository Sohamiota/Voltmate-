import { API_BASE, getStoredToken } from '@/src/api/client';

function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
}

export type Urgency = 'overdue' | 'due_soon' | 'ok';

export interface PendingService {
  id: number;
  vehicle_number?: string;
  chassis_number?: string;
  vehicle_type?: string;
  owner_name?: string;
  owner_phone?: string;
  driver_phone?: string;
  location?: string;
  current_km?: number;
  service_id: number;
  service_no: number;
  due_km?: number;
  due_date?: string;
  status?: string;
  urgency: Urgency;
  due_today?: boolean;
  due_this_week?: boolean;
  stale_km?: boolean;
}

export interface DashboardData {
  total_vehicles: number;
  overdue_count: number;
  due_today_count: number;
  due_this_week_count: number;
  due_soon_count: number;
  stale_km_count: number;
  open_alerts_count: number;
  last_updated?: string;
  briefing?: {
    snapshot_date: string;
    top_overdue: Array<{ vehicle_id: number; label: string; owner_name?: string; due_date?: string }>;
    generated_at?: string;
  } | null;
  pending_services: PendingService[];
}

export interface ServiceAlert {
  id: number;
  vehicle_id: number;
  service_id?: number;
  alert_type: string;
  title: string;
  message?: string;
  status: string;
  created_at: string;
  vehicle_number?: string;
  chassis_number?: string;
  owner_name?: string;
  owner_phone?: string;
  location?: string;
  service_no?: number;
  due_km?: number;
  due_date?: string;
}

export interface Vehicle {
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
  pdi_status?: string;
  pdi_due_date?: string;
  pdi_completed_at?: string;
  pdi_checklist?: PdiItem[];
  speak_with?: string;
  remarks?: string;
  next_service_id?: number;
  next_service_no?: number;
  next_due_km?: number;
  next_due_date?: string;
  urgency?: Urgency;
  stale_km?: boolean;
  s1_id?: number; s1_due_km?: number; s1_due_date?: string; s1_actual_km?: number;
  s1_completion_date?: string; s1_status?: string; s1_remarks?: string; s1_cost?: number | string;
  s2_id?: number; s2_due_km?: number; s2_due_date?: string; s2_actual_km?: number;
  s2_completion_date?: string; s2_status?: string; s2_remarks?: string; s2_cost?: number | string;
  s3_id?: number; s3_due_km?: number; s3_due_date?: string; s3_actual_km?: number;
  s3_completion_date?: string; s3_status?: string; s3_remarks?: string; s3_cost?: number | string;
}

export interface VehicleService {
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

export interface PdiItem {
  id: string;
  label: string;
  status: 'pending' | 'pass' | 'fail' | 'na';
}

export interface AnalyticsData {
  range: { from: string; to: string };
  completions: { count: number; total_cost: number; avg_cost: number };
  by_month: Array<{ month: string; completions: number; total_cost: string }>;
  by_location: Array<{ location: string; completions: number; total_cost: string }>;
  by_vehicle_type: Array<{ location?: string; vehicle_type?: string; completions: number; total_cost: string }>;
  fleet_health: { total_vehicles: number; overdue_vehicles: number; no_pending_service: number; overdue_pct: number };
  alerts_workload: { open: number; acknowledged: number };
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/vehicles/dashboard`, { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchMonitoringSummary() {
  const res = await fetch(`${API_BASE}/vehicles/monitoring/summary`, { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchAlerts(status = 'open', type?: string): Promise<{ alerts: ServiceAlert[] }> {
  const params = new URLSearchParams({ status });
  if (type && type !== 'all') params.set('type', type);
  const res = await fetch(`${API_BASE}/vehicles/alerts?${params}`, { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchOpenAlertCount(): Promise<number> {
  const res = await fetch(`${API_BASE}/vehicles/alerts/count`, { headers: authHeaders() });
  const j = await parseJson<{ count: number }>(res);
  return j.count;
}

export async function acknowledgeAlert(id: number) {
  const res = await fetch(`${API_BASE}/vehicles/alerts/${id}/ack`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function fetchVehicles(params?: Record<string, string>): Promise<{ vehicles: Vehicle[] }> {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  const res = await fetch(`${API_BASE}/vehicles${qs}`, { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchVehicle(id: number): Promise<{ vehicle: Vehicle; services: VehicleService[] }> {
  const res = await fetch(`${API_BASE}/vehicles/${id}`, { headers: authHeaders() });
  return parseJson(res);
}

export async function fetchFilterOptions(): Promise<{ locations: string[]; vehicle_types: string[] }> {
  const res = await fetch(`${API_BASE}/vehicles/filters`, { headers: authHeaders() });
  return parseJson(res);
}

export async function patchCurrentKm(vehicleId: number, current_km: number) {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/current-km`, {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify({ current_km }),
  });
  return parseJson(res);
}

export async function markServiceDone(
  vehicleId: number,
  serviceId: number,
  data: { actual_km: number; completion_date: string; remarks?: string; cost?: number },
) {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/services/${serviceId}`, {
    method: 'PUT',
    headers: authHeaders(true),
    body: JSON.stringify({ ...data, status: 'done' }),
  });
  return parseJson(res);
}

export async function updatePdi(vehicleId: number, data: { pdi_status?: string; pdi_checklist?: PdiItem[]; pdi_due_date?: string }) {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/pdi`, {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(data),
  });
  return parseJson(res);
}

export async function importVehicles(vehicles: unknown[]) {
  const res = await fetch(`${API_BASE}/vehicles/import`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ vehicles }),
  });
  return parseJson(res);
}

export async function fetchAnalytics(from?: string, to?: string): Promise<AnalyticsData> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const res = await fetch(`${API_BASE}/vehicles/analytics?${params}`, { headers: authHeaders() });
  return parseJson(res);
}

export async function exportVehiclesCsv(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/vehicles/export/csv`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

const OWNER_TOKEN_KEY = 'service_owner_token';

export function getOwnerToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(OWNER_TOKEN_KEY) || '';
}

export function setOwnerToken(token: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(OWNER_TOKEN_KEY, token);
}

export async function requestOwnerOtp(phone: string) {
  const res = await fetch(`${API_BASE}/service-status/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  return parseJson(res);
}

export async function verifyOwnerOtp(phone: string, otp: string) {
  const res = await fetch(`${API_BASE}/service-status/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  });
  return parseJson<{ token: string }>(res);
}

export async function fetchOwnerStatus() {
  const token = getOwnerToken();
  const res = await fetch(`${API_BASE}/service-status/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(res);
}

export function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function vehicleLabel(v: { vehicle_number?: string; chassis_number?: string; id?: number }) {
  return v.vehicle_number || v.chassis_number || (v.id ? `#${v.id}` : '—');
}

export function phoneLink(phone?: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits ? `tel:${digits}` : null;
}
