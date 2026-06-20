'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Visit } from '@/types/api';
import SearchableSelect from '@/components/SearchableSelect';
import {
  CRM_CONTACT_OPTIONS,
  CRM_DEFERRAL_OPTIONS,
  crmPayloadFromForm,
  isoToDatetimeLocal,
  labelForContact,
  labelForDeferral,
} from '@/lib/crmDeferral';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string | number;
  cust_code: string;
  cust_name: string;
  phone_no?: string;
  phone_no_2?: string;
  lead_type?: string;
  connect_date?: string;
  is_hot_lead?: boolean;
}

interface Employee {
  id: string | number;
  name: string;
}

interface FormState {
  lead_id: string;
  connect_date: string;
  salesperson_id: string;
  vehicle: string;
  status: string;
  visit_date: string;
  next_action: string;
  next_action_date: string;
  phone_no: string;
  phone_no_2: string;
  note: string;
  lost_not_interested_reason: string;
  lost_reason_notes: string;
  is_hot_lead: boolean;
  /** Optional CRM-linked GPS ping tied to this visit after save (same permission model as attendance). */
  capture_visit_gps: boolean;
  deferral_bucket: string;
  deferral_notes: string;
  follow_up_after_date: string;
  earliest_purchase_intent_date: string;
  contact_disposition: string;
  callback_requested_at: string;
  customer_promised_callback: boolean;
}

function isValidPhone(v: string)         { return /^[6-9]\d{9}$/.test(v.trim()); }
function isValidPhoneOptional(v: string) { return v.trim() === '' || isValidPhone(v); }

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const VEHICLES = [
  // ── Storm T1500 TR ──
  'Storm T1500 TR DV260',
  'Storm T1500 TR DV220',
  'Storm T1500 TR PV',
  'Storm T1500 TR HD',
  'Storm T1500 TR FB',
  // ── Storm T1500 TR+ ──
  'Storm T1500 TR+ DV260',
  'Storm T1500 TR+ DV220',
  'Storm T1500 TR+ PV',
  'Storm T1500 TR+ HD',
  'Storm T1500 TR+ FB',
  // ── Storm T1500 TR+32 ──
  'Storm T1500 TR+32 DV260',
  'Storm T1500 TR+32 DV220',
  'Storm T1500 TR+32 PV',
  'Storm T1500 TR+32 HD',
  'Storm T1500 TR+32 FB',
  // ── Storm T1500 ATR ──
  'Storm T1500 ATR DV260',
  'Storm T1500 ATR DV220',
  'Storm T1500 ATR PV',
  'Storm T1500 ATR HD',
  'Storm T1500 ATR FB',
  // ── Storm T1500 ATR+ ──
  'Storm T1500 ATR+ DV260',
  'Storm T1500 ATR+ DV220',
  'Storm T1500 ATR+ PV',
  'Storm T1500 ATR+ HD',
  'Storm T1500 ATR+ FB',
  // ── Storm T1500 ATR+32 ──
  'Storm T1500 ATR+32 DV260',
  'Storm T1500 ATR+32 DV220',
  'Storm T1500 ATR+32 PV',
  'Storm T1500 ATR+32 HD',
  'Storm T1500 ATR+32 FB',
  // ── Storm T1500 TR 32 ──
  'Storm T1500 TR 32 DV220',
  'Storm T1500 TR 32 DV260',
  'Storm T1500 TR 32 PV',
  // ── LR ──
  'LR PV',
  'LR HD',
  'LR FB',
  'LR DV330',
  // ── LR+ ──
  'LR+ PV',
  'LR+ HD',
  'LR+ FB',
  'LR+ DV330',
  // ── HiLoad ──
  'HiLoad XR',
  'HiLoad TR NC',
  'HiLoad TR GBT',
  // ── City ──
  'City FB',
  'City PV',
  'City DV200',
  'City HD',
  // ── Maxx ──
  'Maxx FB',
  'Maxx PV',
  'Maxx DV220',
  'Maxx HD',
  // ── FastCharge ──
  'FastCharge FB',
  'FastCharge PV',
  'FastCharge DV220',
  // ── Legacy / Previous Models ──
  'Euler HiLoad EV',
  'Euler Turbo EV 1000 City',
  'Euler Turbo EV 1000 Fast Charge',
  'Euler Turbo EV 1000 Maxx',
  'Euler Storm EV T1250',
  'Euler Storm EV LongRange 200',
  'Euler NEO HiRANGE MAXX',
  'Euler NEO HiRANGE PLUS',
  'Euler NEO HiRANGE (standard)',
];

const STATUSES = [
  'New Lead',
  'Demo Scheduled',
  'Demo Completed',
  'Quotation Shared',
  'Catalogue Shared',
  'Demo Follow Up',
  'Follow-Up 2',
  'Negotiation',
  'Booking Date Confirmed',
  'Loan Processing',
  'Booking Amount Received',
  'Order Confirmed',
  'Delivery Scheduled',
  'Delivered (Closed \u2013 Won)',
  'Lost \u2013 Price Issue',
  'Lost \u2013 Competitor',
  'Lost \u2013 No Response',
  'Lost \u2013 Not Interested',
];

/** Matches backend `LOST_NOT_INTERESTED_STATUS` (en dash U+2013) */
const LOST_NOT_INTERESTED_STATUS = 'Lost \u2013 Not Interested';

const LOST_NOT_INTEREST_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'budget', label: 'Budget / affordability' },
  { value: 'timing', label: 'Timing — not ready to buy' },
  { value: 'product_fit', label: 'Product fit / specs mismatch' },
  { value: 'range_anxiety', label: 'Range / charging concerns' },
  { value: 'prefers_ice', label: 'Prefers ICE / not convinced on EV' },
  { value: 'chose_competitor', label: 'Chose a competitor' },
  { value: 'family_decision', label: 'Family / stakeholder decision' },
  { value: 'other', label: 'Other (explain below)' },
];

function formatLostNiSummary(v: Visit): string {
  if (!v.lost_not_interested_reason) return '—';
  const opt = LOST_NOT_INTEREST_REASON_OPTIONS.find(o => o.value === v.lost_not_interested_reason);
  let s = opt?.label ?? v.lost_not_interested_reason;
  if (v.lost_not_interested_reason === 'other' && v.lost_reason_notes?.trim()) {
    const t = v.lost_reason_notes.trim();
    s = `${s}: ${t.slice(0, 48)}${t.length > 48 ? '…' : ''}`;
  }
  return s;
}

// Next actions mirror statuses
const NEXT_ACTIONS = [...STATUSES];

const EMPTY_FORM: FormState = {
  lead_id: '',
  connect_date: '',
  salesperson_id: '',
  vehicle: '',
  status: '',
  visit_date: '',          // set to today at runtime (openModal) to avoid SSR hydration mismatch
  next_action: '',
  next_action_date: '',
  phone_no: '',
  phone_no_2: '',
  note: '',
  lost_not_interested_reason: '',
  lost_reason_notes: '',
  is_hot_lead: false,
  capture_visit_gps: false,
  deferral_bucket: '',
  deferral_notes: '',
  follow_up_after_date: '',
  earliest_purchase_intent_date: '',
  contact_disposition: '',
  callback_requested_at: '',
  customer_promised_callback: false,
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

// ─── Token helper (module-level, not recreated per render) ────────────────────
function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

function authHeaders(): Record<string, string> {
  const t = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (t) headers['Authorization'] = `Bearer ${t}`;
  return headers;
}

/** Records one manual ping linked to the saved visit (browser GPS permission required). */
async function captureVisitGpsPing(visitId: number): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
      }),
    );
    const res = await fetch(`${API_BASE}/api/v1/location/ping`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? null,
        type: 'manual',
        context: 'visit',
        visit_id: visitId,
        note: `Visit #${visitId}`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Tailwind class constants ─────────────────────────────────────────────────
const BTN_BASE = 'font-sans text-[12.5px] font-semibold py-2 px-4 rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_TEAL   = `${BTN_BASE} bg-[#00c9b1] text-[#0b0d14] border-0 hover:shadow-[0_0_16px_rgba(0,201,177,0.22)]`;
const BTN_GHOST  = `${BTN_BASE} bg-transparent text-[#94a3b8] border border-[#222638] hover:border-[#2e3450] hover:text-[#e2e8f0]`;
const BTN_AMBER  = `${BTN_BASE} bg-[rgba(245,158,11,.08)] text-[#f59e0b] border border-[rgba(245,158,11,.22)] hover:bg-[rgba(245,158,11,.16)]`;
const BTN_RED    = `${BTN_BASE} bg-[rgba(239,68,68,.08)] text-red-500 border border-[rgba(239,68,68,.22)] hover:bg-[rgba(239,68,68,.16)]`;
const FIELD      = 'font-sans bg-[#0b0d14] border border-[#222638] text-[#e2e8f0] py-[9px] px-3 rounded-[7px] text-[13px] w-full transition-colors focus:outline-none focus:border-[#00c9b1] focus:ring-[3px] focus:ring-[rgba(0,201,177,0.10)] placeholder:text-zinc-500 appearance-none';
const LABEL      = 'text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[.8px] mb-1.5 block';
const BADGE_BASE = 'inline-flex items-center px-[9px] py-[3px] rounded-full text-[11px] font-medium whitespace-nowrap border';

// ─── Badge colour helper ──────────────────────────────────────────────────────
function badgeVariant(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (s.includes('delivered') || s.includes('closed'))
    return 'bg-[rgba(16,185,129,.1)] text-[#10b981] border-[rgba(16,185,129,.25)]';
  if (s.includes('lost'))
    return 'bg-[rgba(239,68,68,.1)] text-red-500 border-[rgba(239,68,68,.25)]';
  if (s.includes('test drive') || s.includes('quotation') || s.includes('catalogue') || s.includes('demo'))
    return 'bg-[rgba(59,130,246,.1)] text-blue-500 border-[rgba(59,130,246,.25)]';
  if (s.includes('negotiation') || s.includes('follow-up'))
    return 'bg-[rgba(245,158,11,.1)] text-[#f59e0b] border-[rgba(245,158,11,.25)]';
  if (s.includes('new') || s.includes('attempted'))
    return 'bg-[rgba(100,116,139,.1)] text-zinc-500 border-[rgba(100,116,139,.2)]';
  return 'bg-[rgba(0,201,177,0.10)] text-[#00c9b1] border-[rgba(0,201,177,0.22)]';
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4].map(n => (
        <tr key={n}>
          {[40, 80, 130, 110, 140, 120, 52, 130, 90, 100, 95, 110, 110, 72].map((w, i) => (
            <td key={i} className="py-3.5 px-4">
              <div
                className="h-[14px] rounded animate-skel-shine bg-gradient-to-r from-[#1a1e2e] via-[#222638] to-[#1a1e2e] bg-[length:200%_100%]"
                style={{ width: w }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CreateVisitReportPage() {
  const router = useRouter();
  const [roleChecked, setRoleChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // ── Role guard: only admin and sales_admin may access this page ───────────
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { router.replace('/login'); return; }
    fetch(`${API_BASE}/api/v1/auth/me`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const role = j?.user?.role;
        if (role !== 'admin' && role !== 'sales_admin') {
          setAccessDenied(true);
        }
        setRoleChecked(true);
      })
      .catch(() => setRoleChecked(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── All hooks declared at the top ──────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);  // FIX: separate source-of-truth
  const [searchQuery, setSearchQuery] = useState('');       // FIX: search as derived state, not mutation
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Visit | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const toastCounter = useRef(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Derived: filtered visits (no mutation of source state) ─────────────────
  const visits = useMemo(() => {
    if (!searchQuery.trim()) return allVisits;
    const q = searchQuery.toLowerCase();
    return allVisits.filter(v =>
      (v.lead_cust_code || '').toLowerCase().includes(q) ||
      (v.cust_name || '').toLowerCase().includes(q) ||
      (v.salesperson_name || '').toLowerCase().includes(q) ||
      (v.status || '').toLowerCase().includes(q)
    );
  }, [allVisits, searchQuery]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: allVisits.length,
      testDrives: allVisits.filter(v => (v.status || '').toLowerCase().includes('demo')).length,
      connected: allVisits.filter(v => v.status === 'Connected').length,
      thisMonth: allVisits.filter(v => {
        if (!v.visit_date) return false;
        const d = new Date(v.visit_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [allVisits]);

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/visits?limit=100000`, { headers: authHeaders() });
      if (!res.ok) { setAllVisits([]); return; }
      const j = await res.json();
      setAllVisits(j.visits || []);
    } catch (e) {
      console.error(e);
      setAllVisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/leads?limit=100000`, { headers: authHeaders() });
      if (!res.ok) { setLeads([]); return; }
      const j = await res.json();
      setLeads(j.leads || []);
    } catch (e) {
      console.error(e);
      setLeads([]);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/employees`, { headers: authHeaders() });
      if (!res.ok) { setEmployees([]); return; }
      const j = await res.json();
      setEmployees(j.employees || []);
    } catch (e) {
      console.error(e);
      setEmployees([]);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchEmployees();
    fetchVisits();
  }, [fetchLeads, fetchEmployees, fetchVisits]);

  // ── Search with debounce ───────────────────────────────────────────────────
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearchQuery(val), 200);
  }

  // ── Form change ────────────────────────────────────────────────────────────
  function handleFormChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === 'lead_id') {
      // Pull phone numbers and connect_date from the selected lead
      const selected = leads.find(l => String(l.id) === String(value));
      setForm(f => ({
        ...f,
        lead_id:      value as string,
        phone_no:     selected?.phone_no     || '',
        phone_no_2:   selected?.phone_no_2   || '',
        connect_date: selected?.connect_date ? selected.connect_date.slice(0, 10) : '',
        is_hot_lead:  !!selected?.is_hot_lead,
      }));
    } else if (key === 'status') {
      const nextStatus = value as string;
      setForm(f => ({
        ...f,
        status: nextStatus,
        ...(nextStatus !== LOST_NOT_INTERESTED_STATUS
          ? { lost_not_interested_reason: '', lost_reason_notes: '' }
          : {}),
      }));
    } else {
      setForm(f => ({ ...f, [key]: value }));
    }
    setHasUnsaved(true);
  }

  // ── Open / close modal ─────────────────────────────────────────────────────
  function openModal() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, visit_date: new Date().toISOString().slice(0, 10), capture_visit_gps: false });
    setHasUnsaved(false);
    setOpen(true);
  }

  async function handleDeleteVisit(visit: Visit) {
    const id = visit.id;
    if (id == null) return;
    if (!confirm(`Delete this visit for ${visit.cust_name || visit.lead_cust_code || 'this customer'}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/visits/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast((err as { error?: string }).error || 'Failed to delete visit', 'error');
        return;
      }
      if (editTarget && String(editTarget.id) === String(id)) {
        setEditTarget(null);
        setOpen(false);
      }
      showToast('Visit deleted', 'success');
      await fetchVisits();
    } catch (e) {
      console.error(e);
      showToast('Failed to delete visit', 'error');
    }
  }

  function openEditModal(visit: Visit) {
    setEditTarget(visit);
    setForm({
      lead_id:          String(visit.lead_id || ''),
      connect_date:     visit.connect_date      ? visit.connect_date.slice(0, 10) : '',
      salesperson_id:   String(visit.salesperson_id || ''),
      vehicle:          visit.vehicle          || '',
      status:           visit.status           || '',
      visit_date:       visit.visit_date       ? visit.visit_date.slice(0, 10) : '',
      next_action:      visit.next_action      || '',
      next_action_date: visit.next_action_date ? visit.next_action_date.slice(0, 10) : '',
      phone_no:         visit.phone_no         || '',
      phone_no_2:       visit.phone_no_2       || '',
      note:             visit.note             || '',
      lost_not_interested_reason: visit.lost_not_interested_reason || '',
      lost_reason_notes: visit.lost_reason_notes || '',
      is_hot_lead:      !!visit.is_hot_lead,
      capture_visit_gps: false,
      deferral_bucket:           visit.deferral_bucket ?? '',
      deferral_notes:            visit.deferral_notes ?? '',
      follow_up_after_date:      visit.follow_up_after_date ? String(visit.follow_up_after_date).slice(0, 10) : '',
      earliest_purchase_intent_date: visit.earliest_purchase_intent_date
        ? String(visit.earliest_purchase_intent_date).slice(0, 10)
        : '',
      contact_disposition:       visit.contact_disposition ?? '',
      callback_requested_at:     isoToDatetimeLocal(visit.callback_requested_at),
      customer_promised_callback: !!visit.customer_promised_callback,
    });
    setHasUnsaved(false);
    setOpen(true);
  }

  function closeModal() {
    if (hasUnsaved) {
      if (!window.confirm('You have unsaved changes. Close anyway?')) return;
    }
    setOpen(false);
    setHasUnsaved(false);
    setEditTarget(null);
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) closeModal();
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const token = getAuthToken();
    if (!token) {
      showToast('Please log in first', 'error');
      return;
    }
    if (!form.phone_no.trim()) {
      showToast('Phone No. 1 is required', 'error');
      return;
    }
    if (!isValidPhone(form.phone_no)) {
      showToast('Phone No. 1 must be a valid 10-digit mobile number (starts with 6–9)', 'error');
      return;
    }
    if (!isValidPhoneOptional(form.phone_no_2)) {
      showToast('Phone No. 2 must be a valid 10-digit mobile number (starts with 6–9)', 'error');
      return;
    }
    if (form.status === LOST_NOT_INTERESTED_STATUS) {
      if (!form.lost_not_interested_reason.trim()) {
        showToast('Select a reason for Lost – Not Interested', 'error');
        return;
      }
      if (form.lost_not_interested_reason === 'other' && !form.lost_reason_notes.trim()) {
        showToast('Please explain when reason is Other', 'error');
        return;
      }
    }
    try {
      setSubmitting(true);
      const isEdit = editTarget !== null;
      const url = isEdit
        ? `${API_BASE}/api/v1/visits/${editTarget!.id}`
        : `${API_BASE}/api/v1/visits`;
      const payload: Record<string, unknown> = {
        connect_date: form.connect_date || null,
        salesperson_id: form.salesperson_id ? Number(form.salesperson_id) : null,
        vehicle: form.vehicle || null,
        status: form.status || null,
        visit_date: form.visit_date || null,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        phone_no: form.phone_no,
        phone_no_2: form.phone_no_2 || null,
        note: form.note || null,
        is_hot_lead: form.is_hot_lead,
      };
      if (!isEdit) payload.lead_id = Number(form.lead_id);
      if (form.status === LOST_NOT_INTERESTED_STATUS) {
        payload.lost_not_interested_reason = form.lost_not_interested_reason;
        payload.lost_reason_notes = form.lost_reason_notes.trim() ? form.lost_reason_notes : null;
      }
      Object.assign(payload, crmPayloadFromForm(form));
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        showToast(`Failed to save (${res.status}) ${text}`, 'error');
        return;
      }
      const saved = (await res.json()) as { id?: number };
      const visitId = Number(saved?.id ?? (isEdit ? editTarget?.id : undefined));
      const wantGps = form.capture_visit_gps;

      setOpen(false);
      setHasUnsaved(false);
      showToast(editTarget ? 'Visit updated successfully' : 'Visit saved successfully', 'success');
      await fetchVisits();

      if (wantGps && Number.isFinite(visitId)) {
        const ok = await captureVisitGpsPing(visitId);
        if (!ok) {
          showToast('Visit saved, but location was not recorded (permission, GPS, or network).', 'info');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Network error — could not save visit', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── CSV export ─────────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/visits/export/csv`, { headers: authHeaders() });
      if (!res.ok) { showToast('Export failed', 'error'); return; }
      const text = await res.text();
      const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `visits_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 150);
      showToast('Export started', 'success');
    } catch {
      showToast('Export failed', 'error');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!roleChecked) {
    return (
      <div className="min-h-screen bg-[#0b0d14] flex items-center justify-center text-zinc-400 font-sans">
        Checking access…
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#0b0d14] flex flex-col items-center justify-center gap-3 font-sans">
        <div className="text-red-500 font-bold text-lg">Access Denied</div>
        <div className="text-zinc-400 text-sm">Only Admin and Sales Admin can access this page.</div>
        <button
          onClick={() => router.back()}
          className="mt-4 py-2 px-5 bg-[#131620] border border-[#333] rounded-lg text-zinc-200 cursor-pointer text-[13px]"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0d14] text-[#e2e8f0] text-[13.5px] antialiased">

      {/* Topbar */}
      <header className="flex items-center justify-between px-7 h-14 border-b border-[#222638] bg-[rgba(11,13,20,0.92)] backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] bg-gradient-to-br from-[#00c9b1] to-[#0891b2] rounded-[7px] flex items-center justify-center font-bold text-[13px] text-[#0b0d14] shrink-0">
            V
          </div>
          <div>
            <div className="font-bold text-sm leading-none">Voltmate</div>
            <div className="text-[9px] text-zinc-500 tracking-[1.5px] uppercase mt-0.5">EMS</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#131620] border border-[#222638] rounded-lg py-[7px] px-3.5 w-[260px] transition-colors focus-within:border-[#00c9b1]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-500 shrink-0">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="bg-transparent border-none outline-none text-[#e2e8f0] text-[12.5px] font-sans w-full placeholder:text-zinc-500"
              placeholder="Search visits, customers..."
              onChange={handleSearchChange}
              aria-label="Search visits"
            />
          </div>
          <div
            className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#00c9b1] to-[#0891b2] flex items-center justify-center font-bold text-xs text-[#0b0d14] cursor-pointer"
            title="Profile"
          >
            M
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-7 flex-1">
        <div className="mb-6">
          <div className="text-xl font-bold">Visit Management</div>
          <div className="text-[#94a3b8] text-[12.5px] mt-1">Record and track customer visits &amp; actions</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 max-[900px]:grid-cols-2 gap-3.5 mb-6">
          <div className="bg-[#131620] border border-[#222638] rounded-[10px] p-[18px_20px] transition-colors hover:border-[#2e3450]">
            <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-[.8px] mb-2">Total Visits</div>
            <div className="text-[26px] font-bold font-mono text-[#00c9b1]">{stats.total}</div>
          </div>
          <div className="bg-[#131620] border border-[#222638] rounded-[10px] p-[18px_20px] transition-colors hover:border-[#2e3450]">
            <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-[.8px] mb-2">Demos</div>
            <div className="text-[26px] font-bold font-mono text-blue-500">{stats.testDrives}</div>
          </div>
          <div className="bg-[#131620] border border-[#222638] rounded-[10px] p-[18px_20px] transition-colors hover:border-[#2e3450]">
            <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-[.8px] mb-2">Connected</div>
            <div className="text-[26px] font-bold font-mono text-[#10b981]">{stats.connected}</div>
          </div>
          <div className="bg-[#131620] border border-[#222638] rounded-[10px] p-[18px_20px] transition-colors hover:border-[#2e3450]">
            <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-[.8px] mb-2">This Month</div>
            <div className="text-[26px] font-bold font-mono text-[#f59e0b]">{stats.thisMonth}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#131620] border border-[#222638] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#222638] flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold">All Visits</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {searchQuery ? `Showing ${visits.length} of ${allVisits.length} records` : `${allVisits.length} total records`}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button className={BTN_GHOST} onClick={handleExport}>
                ↓ Export CSV
              </button>
              <button className={BTN_TEAL} onClick={openModal}>
                + Add Visit
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-[#222638]">
                  {['#', 'Cust. Code', 'Customer Name', 'Salesperson', 'Vehicle', 'Status', 'Hot', 'Lost – NI', 'Visit Date', 'Next Action', 'Buy window', 'Callback', 'Logged By', 'Action'].map((h, i) => (
                    <th
                      key={i}
                      className="py-[11px] px-4 text-left text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[.8px] bg-[#1a1e2e] whitespace-nowrap"
                      title={h === 'Buy window' ? 'Buying timeframe' : h === 'Callback' ? 'Call outcome / stall' : undefined}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : visits.length === 0 ? (
                  <tr>
                    <td colSpan={14}>
                      <div className="text-center py-[52px] px-5 text-zinc-500">
                        <div className="text-[36px] mb-3 opacity-50"></div>
                        <div className="text-[13.5px]">
                          {searchQuery
                            ? <>No visits match <strong className="text-[#94a3b8]">&ldquo;{searchQuery}&rdquo;</strong></>
                            : <>No visits yet. Click <strong className="text-[#94a3b8]">Add Visit</strong> to get started.</>}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visits.map((v, i) => (
                    <tr key={v.id ?? i} className="border-b border-[#222638] last:border-b-0 hover:bg-white/[.025] transition-colors">
                      <td className="py-3 px-4 font-mono text-[11.5px] text-zinc-500">{String(i + 1).padStart(2, '0')}</td>
                      <td className="py-3 px-4 font-mono text-xs text-[#00c9b1]">{v.lead_cust_code || '—'}</td>
                      <td className="py-3 px-4 text-[13px] text-[#e2e8f0]">{v.cust_name || '—'}</td>
                      <td className="py-3 px-4 text-[13px] text-[#e2e8f0]">{v.salesperson_name || '—'}</td>
                      <td className="py-3 px-4 text-[13px] text-[#e2e8f0] max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">{v.vehicle || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`${BADGE_BASE} ${badgeVariant(v.status)}`}>{v.status || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {v.is_hot_lead
                          ? <span className={`${BADGE_BASE} bg-[rgba(245,158,11,.15)] text-[#f59e0b] border-[rgba(245,158,11,.35)]`}>Hot</span>
                          : '—'}
                      </td>
                      <td
                        className="py-3 px-4 max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#94a3b8]"
                        title={formatLostNiSummary(v)}
                      >
                        {formatLostNiSummary(v)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#94a3b8]">
                        {v.visit_date ? new Date(v.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-[13px] text-[#94a3b8]">{v.next_action || '—'}</td>
                      <td
                        className="py-3 px-4 text-[11px] text-[#94a3b8] max-w-[96px] overflow-hidden text-ellipsis whitespace-nowrap"
                        title={labelForDeferral(v.deferral_bucket ?? undefined)}
                      >
                        {labelForDeferral(v.deferral_bucket ?? undefined)}
                      </td>
                      <td
                        className="py-3 px-4 text-[11px] text-[#94a3b8] max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap"
                        title={labelForContact(v.contact_disposition ?? undefined)}
                      >
                        {labelForContact(v.contact_disposition ?? undefined)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-[3px] min-w-[130px]">
                          {v.created_by_name && (
                            <span className="flex items-center gap-1 text-[11px] leading-[1.3] whitespace-nowrap text-green-400">
                              <span className="text-[10px] opacity-70">＋</span>
                              <span>{v.created_by_name}</span>
                              {v.created_at && (
                                <span className="opacity-[.55] text-[10px]">
                                  {new Date(v.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                                </span>
                              )}
                            </span>
                          )}
                          {v.updated_by_name && (
                            <span className="flex items-center gap-1 text-[11px] leading-[1.3] whitespace-nowrap text-amber-400">
                              <span className="text-[10px] opacity-70">Edit</span>
                              <span>{v.updated_by_name}</span>
                              {v.updated_at && (
                                <span className="opacity-[.55] text-[10px]">
                                  {new Date(v.updated_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                                </span>
                              )}
                            </span>
                          )}
                          {!v.created_by_name && !v.updated_by_name && <span className="text-zinc-500">—</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            className={`${BTN_AMBER} text-xs py-[5px] px-3`}
                            onClick={() => openEditModal(v)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${BTN_RED} text-xs py-[5px] px-3`}
                            onClick={() => handleDeleteVisit(v)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/[.68] backdrop-blur-[5px] flex items-center justify-center p-5 animate-fade-in"
          onClick={handleOverlayClick}
          role="presentation"
        >
          <div
            className="bg-[#131620] border border-[#222638] rounded-2xl w-full max-w-[680px] shadow-[0_28px_72px_rgba(0,0,0,.75)] animate-slide-up max-h-[92vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-start justify-between px-6 pt-[22px] pb-[18px] border-b border-[#222638] sticky top-0 bg-[#131620] z-[1]">
              <div>
                <div className="text-base font-bold" id="modal-title">{editTarget ? 'Edit Visit' : 'Add Visit'}</div>
                <div className="text-xs text-zinc-500 mt-[3px]">
                  {editTarget ? (
                    <span>
                      Editing visit <strong>#{editTarget.id}</strong>
                      {editTarget.created_by_name && (
                        <span className="ml-2 text-[11px] text-green-400">
                          ＋ Added by {editTarget.created_by_name}
                          {editTarget.created_at && ` on ${new Date(editTarget.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </span>
                      )}
                      {editTarget.updated_by_name && (
                        <span className="ml-2 text-[11px] text-amber-400">
                          · Last edited by {editTarget.updated_by_name}
                          {editTarget.updated_at && ` on ${new Date(editTarget.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </span>
                      )}
                    </span>
                  ) : 'Create a new customer visit record'}
                </div>
              </div>
              <button
                className="bg-transparent border-0 cursor-pointer text-zinc-500 text-lg leading-none p-1 rounded-[5px] transition-colors hover:text-[#e2e8f0]"
                onClick={closeModal}
                aria-label="Close modal"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitForm}>
              <div className="px-6 py-[22px]">
                <div className="grid grid-cols-2 max-[540px]:grid-cols-1 gap-3.5">

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-lead">Customer</label>
                    <SearchableSelect
                      id="f-lead"
                      fieldClass={FIELD}
                      options={leads.map(l => ({ value: String(l.id), label: `${l.cust_code} — ${l.cust_name}` }))}
                      value={form.lead_id}
                      onChange={v => handleFormChange('lead_id', v)}
                      placeholder="Select lead"
                      accentColor="var(--teal)"
                      disabled={editTarget !== null}
                    />
                    {form.lead_id && (() => {
                      const selected = leads.find(l => String(l.id) === form.lead_id);
                      if (!selected?.lead_type) return null;
                      return (
                        <div className="mt-1.5 text-xs text-[#94a3b8]">
                          Lead type:{' '}
                          <span
                            className="font-semibold"
                            style={{ color: selected.lead_type === 'Digital Lead' ? 'var(--accent)' : '#00c9b1' }}
                          >
                            {selected.lead_type}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-connect-date">Connect Date</label>
                    <input
                      id="f-connect-date"
                      type="date"
                      className={`${FIELD}${!!form.lead_id && editTarget === null ? ' opacity-90 cursor-default' : ''}`}
                      value={form.connect_date}
                      onChange={e => handleFormChange('connect_date', e.target.value)}
                      readOnly={!!form.lead_id && editTarget === null}
                      title={form.lead_id && editTarget === null ? 'Fetched from lead — change lead to update' : undefined}
                    />
                    {form.lead_id && !form.connect_date && (
                      <div className="mt-1 text-[11px] text-zinc-500">No connect date on lead</div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-sp">Salesperson</label>
                    <SearchableSelect
                      id="f-sp"
                      fieldClass={FIELD}
                      options={employees.map(e => ({ value: String(e.id), label: e.name }))}
                      value={form.salesperson_id}
                      onChange={v => handleFormChange('salesperson_id', v)}
                      placeholder="Select salesperson"
                      accentColor="var(--teal)"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-vehicle">Vehicle</label>
                    <SearchableSelect
                      id="f-vehicle"
                      fieldClass={FIELD}
                      options={VEHICLES}
                      value={form.vehicle}
                      onChange={v => handleFormChange('vehicle', v)}
                      placeholder="Select vehicle"
                      emptyLabel="Select vehicle"
                      accentColor="var(--teal)"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-status">Status</label>
                    <SearchableSelect
                      id="f-status"
                      fieldClass={FIELD}
                      options={STATUSES}
                      value={form.status}
                      onChange={v => handleFormChange('status', v)}
                      placeholder="Select status"
                      emptyLabel="Select status"
                      accentColor="var(--teal)"
                    />
                  </div>

                  {form.status === LOST_NOT_INTERESTED_STATUS && (
                    <>
                      <div className="col-span-2 flex flex-col">
                        <label className={LABEL} htmlFor="f-lost-reason">Lost – Not interested: reason</label>
                        <SearchableSelect
                          id="f-lost-reason"
                          fieldClass={FIELD}
                          options={LOST_NOT_INTEREST_REASON_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                          value={form.lost_not_interested_reason}
                          onChange={v => handleFormChange('lost_not_interested_reason', v)}
                          placeholder="Select reason"
                          emptyLabel="Select reason"
                          accentColor="var(--red)"
                        />
                      </div>
                      <div className="col-span-2 flex flex-col">
                        <label className={LABEL} htmlFor="f-lost-notes">
                          Details {form.lost_not_interested_reason === 'other' ? '(required)' : '(optional)'}
                        </label>
                        <textarea
                          id="f-lost-notes"
                          className={`${FIELD} resize-y min-h-[80px]`}
                          rows={2}
                          placeholder={form.lost_not_interested_reason === 'other' ? 'Explain why (required for Other)…' : 'Optional context…'}
                          value={form.lost_reason_notes}
                          onChange={e => handleFormChange('lost_reason_notes', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-2 flex items-center gap-2.5 mt-1">
                    <input
                      id="f-hot"
                      type="checkbox"
                      checked={form.is_hot_lead}
                      onChange={e => handleFormChange('is_hot_lead', e.target.checked)}
                      className="w-[18px] h-[18px] accent-[#f59e0b] cursor-pointer"
                    />
                    <label htmlFor="f-hot" className="cursor-pointer text-[13px] text-[#e2e8f0] select-none">
                      Mark as <strong className="text-[#f59e0b]">hot lead</strong> (saved on this customer&apos;s record)
                    </label>
                  </div>

                  <div className="col-span-2 flex items-center gap-2.5 mt-1">
                    <input
                      id="f-visit-gps"
                      type="checkbox"
                      checked={form.capture_visit_gps}
                      onChange={e => handleFormChange('capture_visit_gps', e.target.checked)}
                      className="w-[18px] h-[18px] accent-[#00c9b1] cursor-pointer"
                    />
                    <label htmlFor="f-visit-gps" className="cursor-pointer text-[13px] text-[#e2e8f0] select-none">
                      After save, <strong className="text-[#00c9b1]">capture my GPS</strong> for this visit (browser will ask for location)
                    </label>
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-vdate">Visit Date</label>
                    <input
                      id="f-vdate"
                      type="date"
                      className={FIELD}
                      value={form.visit_date}
                      onChange={e => handleFormChange('visit_date', e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-na">Next Action</label>
                    <SearchableSelect
                      id="f-na"
                      fieldClass={FIELD}
                      options={NEXT_ACTIONS}
                      value={form.next_action}
                      onChange={v => handleFormChange('next_action', v)}
                      placeholder="Select next action"
                      emptyLabel="Select next action"
                      accentColor="var(--teal)"
                    />
                  </div>

                  {/* FIX: next_action_date field now rendered (was in state but missing from UI) */}
                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-nadate">Next Action Date</label>
                    <input
                      id="f-nadate"
                      type="date"
                      className={FIELD}
                      value={form.next_action_date}
                      onChange={e => handleFormChange('next_action_date', e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-phone">
                      Phone No. 1 <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      id="f-phone"
                      type="tel"
                      className={`${FIELD}${form.phone_no && !isValidPhone(form.phone_no) ? ' border-red-500' : ''}`}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      required
                      value={form.phone_no}
                      onChange={e => handleFormChange('phone_no', e.target.value.replace(/\D/g, ''))}
                    />
                    {form.phone_no && !isValidPhone(form.phone_no) && (
                      <span className="text-[11px] text-red-500 mt-1">Enter a valid 10-digit number starting with 6–9</span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-phone2">
                      Phone No. 2 <span className="text-zinc-500 font-normal">(optional)</span>
                    </label>
                    <input
                      id="f-phone2"
                      type="tel"
                      className={`${FIELD}${form.phone_no_2 && !isValidPhoneOptional(form.phone_no_2) ? ' border-red-500' : ''}`}
                      placeholder="Alternate 10-digit number"
                      maxLength={10}
                      value={form.phone_no_2}
                      onChange={e => handleFormChange('phone_no_2', e.target.value.replace(/\D/g, ''))}
                    />
                    {form.phone_no_2 && !isValidPhoneOptional(form.phone_no_2) && (
                      <span className="text-[11px] text-red-500 mt-1">Enter a valid 10-digit number starting with 6–9</span>
                    )}
                  </div>

                  <div className="col-span-2 flex flex-col mt-2 pt-3.5 border-t border-[#222638]">
                    <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-[.06em] mb-3">
                      Buying timeframe &amp; call outcome
                    </div>
                    <div className="text-[11px] text-zinc-500 mb-3 leading-[1.45]">
                      If you set a buying window (except &quot;Unknown&quot;) or choose a busy/callback outcome, provide either <strong>Follow-up from</strong> date or <strong>Callback time</strong>.
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-deferral">Buying timeframe</label>
                    <SearchableSelect
                      id="f-deferral"
                      fieldClass={FIELD}
                      options={CRM_DEFERRAL_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                      value={form.deferral_bucket}
                      onChange={v => handleFormChange('deferral_bucket', v)}
                      placeholder="Optional"
                      emptyLabel="Not specified"
                      accentColor="var(--teal)"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-contact-dispo">Call outcome / stall</label>
                    <SearchableSelect
                      id="f-contact-dispo"
                      fieldClass={FIELD}
                      options={CRM_CONTACT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                      value={form.contact_disposition}
                      onChange={v => handleFormChange('contact_disposition', v)}
                      placeholder="Optional"
                      emptyLabel="Not specified"
                      accentColor="var(--blue)"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-followup-after">Follow-up from (CRM)</label>
                    <input
                      id="f-followup-after"
                      type="date"
                      className={FIELD}
                      value={form.follow_up_after_date}
                      onChange={e => handleFormChange('follow_up_after_date', e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-earliest-buy">Earliest likely purchase date</label>
                    <input
                      id="f-earliest-buy"
                      type="date"
                      className={FIELD}
                      value={form.earliest_purchase_intent_date}
                      onChange={e => handleFormChange('earliest_purchase_intent_date', e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL} htmlFor="f-callback-at">They asked to call after</label>
                    <input
                      id="f-callback-at"
                      type="datetime-local"
                      className={FIELD}
                      value={form.callback_requested_at}
                      onChange={e => handleFormChange('callback_requested_at', e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 flex items-center gap-2.5">
                    <input
                      id="f-promised-cb"
                      type="checkbox"
                      checked={form.customer_promised_callback}
                      onChange={e => handleFormChange('customer_promised_callback', e.target.checked)}
                      className="w-[18px] h-[18px] accent-blue-500 cursor-pointer"
                    />
                    <label htmlFor="f-promised-cb" className="cursor-pointer text-[13px] text-[#e2e8f0] select-none">
                      Customer promised they will call back
                    </label>
                  </div>

                  <div className="col-span-2 flex flex-col">
                    <label className={LABEL} htmlFor="f-deferral-notes">Notes on timing / callback</label>
                    <textarea
                      id="f-deferral-notes"
                      className={`${FIELD} resize-y min-h-[80px]`}
                      rows={2}
                      placeholder="e.g. After Diwali, EMI ends March…"
                      value={form.deferral_notes}
                      onChange={e => handleFormChange('deferral_notes', e.target.value)}
                    />
                  </div>

                  <div className="col-span-2 flex flex-col">
                    <label className={LABEL} htmlFor="f-note">Note</label>
                    <textarea
                      id="f-note"
                      className={`${FIELD} resize-y min-h-[80px]`}
                      rows={3}
                      placeholder="Add any relevant notes..."
                      value={form.note}
                      onChange={e => handleFormChange('note', e.target.value)}
                    />
                  </div>

                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#222638] sticky bottom-0 bg-[#131620]">
                <button type="button" className={BTN_GHOST} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className={BTN_TEAL} disabled={submitting}>
                  {submitting ? (editTarget ? 'Updating…' : 'Saving…') : (editTarget ? 'Update Visit' : 'Save Visit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toasts — replaces alert() */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[500] pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`py-[11px] px-[18px] rounded-[9px] text-[13px] font-medium border pointer-events-auto animate-toast-in max-w-[320px] ${
              t.type === 'success' ? 'bg-[rgba(16,185,129,.12)] border-[rgba(16,185,129,.3)] text-[#10b981]'
              : t.type === 'error' ? 'bg-[rgba(239,68,68,.12)] border-[rgba(239,68,68,.3)] text-red-500'
              : 'bg-[rgba(0,201,177,0.10)] border-[rgba(0,201,177,0.22)] text-[#00c9b1]'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
