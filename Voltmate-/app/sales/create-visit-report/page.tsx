'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string | number;
  cust_code: string;
  cust_name: string;
}

interface Employee {
  id: string | number;
  name: string;
}

interface Visit {
  id?: string | number;
  lead_cust_code?: string;
  cust_name?: string;
  salesperson_name?: string;
  vehicle?: string;
  status?: string;
  visit_date?: string;
  next_action?: string;
  next_action_date?: string;
  note?: string;
}

interface FormState {
  lead_id: string;
  salesperson_id: string;
  vehicle: string;
  status: string;
  visit_date: string;
  next_action: string;
  next_action_date: string;
  phone_no: string;
  phone_no_2: string;
  note: string;
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
  'Follow-Up 1',
  'Follow-Up 2',
  'Negotiation',
  'Loan Processing',
  'Booking Amount Received',
  'Order Confirmed',
  'Delivery Scheduled',
  'Delivered (Closed – Won)',
  'Lost – Price Issue',
  'Lost – Competitor',
  'Lost – No Response',
  'Lost – Not Interested',
];

// Next actions mirror statuses
const NEXT_ACTIONS = [...STATUSES];

const EMPTY_FORM: FormState = {
  lead_id: '',
  salesperson_id: '',
  vehicle: '',
  status: '',
  visit_date: new Date().toISOString().slice(0, 10),
  next_action: '',
  next_action_date: '',
  phone_no: '',
  phone_no_2: '',
  note: '',
};

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://voltmate.onrender.com'
      : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

// ─── Token helper (module-level, not recreated per render) ────────────────────
function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    ''
  );
}

function authHeaders(): Record<string, string> {
  const t = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (t) headers['Authorization'] = `Bearer ${t}`;
  return headers;
}

// ─── Page Styles ──────────────────────────────────────────────────────────────
const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #0b0d14;
    --surface: #131620;
    --surface2: #1a1e2e;
    --border: #222638;
    --border-hover: #2e3450;
    --teal: #00c9b1;
    --teal-dim: rgba(0,201,177,0.10);
    --teal-glow: rgba(0,201,177,0.22);
    --blue: #3b82f6;
    --amber: #f59e0b;
    --red: #ef4444;
    --green: #10b981;
    --text: #e2e8f0;
    --text2: #94a3b8;
    --text3: #64748b;
    --mono: 'JetBrains Mono', monospace;
  }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-size: 13.5px;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Layout ── */
  .vm-root { display: flex; flex-direction: column; min-height: 100vh; }

  /* ── Topbar ── */
  .vm-topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 28px; height: 56px;
    border-bottom: 1px solid var(--border);
    background: rgba(11,13,20,0.92);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 50;
  }
  .vm-logo { display: flex; align-items: center; gap: 10px; }
  .vm-logo-mark {
    width: 30px; height: 30px;
    background: linear-gradient(135deg, #00c9b1 0%, #0891b2 100%);
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px; color: #0b0d14; flex-shrink: 0;
  }
  .vm-logo-name { font-weight: 700; font-size: 14px; line-height: 1; }
  .vm-logo-tag { font-size: 9px; color: var(--text3); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }

  .vm-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 13px; width: 260px;
    transition: border-color .15s;
  }
  .vm-search:focus-within { border-color: var(--teal); }
  .vm-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12.5px; font-family: inherit; width: 100%;
  }
  .vm-search input::placeholder { color: var(--text3); }
  .vm-topbar-right { display: flex; align-items: center; gap: 12px; }
  .vm-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, var(--teal), #0891b2);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 12px; color: #0b0d14; cursor: pointer;
  }

  /* ── Content ── */
  .vm-content { padding: 28px; flex: 1; }
  .vm-page-header { margin-bottom: 24px; }
  .vm-page-title { font-size: 20px; font-weight: 700; }
  .vm-page-sub { color: var(--text2); font-size: 12.5px; margin-top: 4px; }

  /* ── Stat Cards ── */
  .vm-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 24px; }
  @media (max-width: 900px) { .vm-stats { grid-template-columns: repeat(2,1fr); } }
  .vm-stat {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 18px 20px;
    transition: border-color .15s;
  }
  .vm-stat:hover { border-color: var(--border-hover); }
  .vm-stat-label { font-size: 11px; font-weight: 500; color: var(--text3); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 8px; }
  .vm-stat-value { font-size: 26px; font-weight: 700; font-family: var(--mono); }
  .vm-stat-value.teal { color: var(--teal); }
  .vm-stat-value.blue { color: var(--blue); }
  .vm-stat-value.green { color: var(--green); }
  .vm-stat-value.amber { color: var(--amber); }

  /* ── Table Section ── */
  .vm-table-wrap {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .vm-table-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    flex-wrap: wrap; gap: 12px;
  }
  .vm-table-title { font-size: 14px; font-weight: 600; }
  .vm-table-sub { font-size: 12px; color: var(--text3); margin-top: 2px; }
  .vm-table-actions { display: flex; gap: 8px; align-items: center; }
  .vm-table-outer { overflow-x: auto; }

  table { width: 100%; border-collapse: collapse; min-width: 860px; }
  thead tr { border-bottom: 1px solid var(--border); }
  th {
    padding: 11px 16px; text-align: left;
    font-size: 10.5px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: .8px;
    background: var(--surface2); white-space: nowrap;
  }
  td {
    padding: 12px 16px; font-size: 13px; color: var(--text);
    border-bottom: 1px solid var(--border); vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .1s; }
  tbody tr:hover { background: rgba(255,255,255,0.025); }

  .vm-num { font-family: var(--mono); font-size: 11.5px; color: var(--text3); }
  .vm-code { font-family: var(--mono); font-size: 12px; color: var(--teal); }
  .vm-date { font-family: var(--mono); font-size: 12px; color: var(--text2); }

  /* ── Badge ── */
  .vm-badge {
    display: inline-flex; align-items: center;
    padding: 3px 9px; border-radius: 20px;
    font-size: 11px; font-weight: 500; white-space: nowrap;
  }
  .vm-badge.teal   { background: var(--teal-dim);              color: var(--teal); border: 1px solid var(--teal-glow); }
  .vm-badge.green  { background: rgba(16,185,129,.1);  color: var(--green);  border: 1px solid rgba(16,185,129,.25); }
  .vm-badge.amber  { background: rgba(245,158,11,.1);  color: var(--amber);  border: 1px solid rgba(245,158,11,.25); }
  .vm-badge.red    { background: rgba(239,68,68,.1);   color: var(--red);    border: 1px solid rgba(239,68,68,.25); }
  .vm-badge.blue   { background: rgba(59,130,246,.1);  color: var(--blue);   border: 1px solid rgba(59,130,246,.25); }
  .vm-badge.muted  { background: rgba(100,116,139,.1); color: var(--text3);  border: 1px solid rgba(100,116,139,.2); }

  /* ── Buttons ── */
  .vm-btn {
    font-family: 'DM Sans', sans-serif;
    font-size: 12.5px; font-weight: 600;
    padding: 8px 16px; border-radius: 7px;
    border: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: opacity .15s, transform .1s, box-shadow .15s;
    white-space: nowrap;
  }
  .vm-btn:active { transform: scale(0.97); }
  .vm-btn-teal { background: var(--teal); color: #0b0d14; }
  .vm-btn-teal:hover { box-shadow: 0 0 16px var(--teal-glow); }
  .vm-btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
  .vm-btn-ghost:hover { border-color: var(--border-hover); color: var(--text); }
  .vm-btn:disabled { opacity: .5; cursor: not-allowed; }

  /* ── Empty State ── */
  .vm-empty {
    text-align: center; padding: 52px 20px;
    color: var(--text3);
  }
  .vm-empty-icon { font-size: 36px; margin-bottom: 12px; opacity: .5; }
  .vm-empty-text { font-size: 13.5px; }
  .vm-empty-text strong { color: var(--text2); }

  /* ── Loading rows ── */
  .vm-skeleton td { padding: 14px 16px; }
  .vm-skel {
    height: 14px; border-radius: 4px;
    background: linear-gradient(90deg, var(--surface2) 0%, var(--border) 50%, var(--surface2) 100%);
    background-size: 200% 100%;
    animation: skel-shine 1.4s infinite;
  }
  @keyframes skel-shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* ── Modal Overlay ── */
  .vm-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.68);
    backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: fade-in .18s ease;
  }
  @keyframes fade-in { from{opacity:0} to{opacity:1} }

  .vm-modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; width: 100%; max-width: 680px;
    box-shadow: 0 28px 72px rgba(0,0,0,.75);
    animation: slide-up .2s ease;
    max-height: 92vh; overflow-y: auto;
  }
  @keyframes slide-up { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

  .vm-modal-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 22px 24px 18px;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; background: var(--surface); z-index: 1;
  }
  .vm-modal-title { font-size: 16px; font-weight: 700; }
  .vm-modal-sub { font-size: 12px; color: var(--text3); margin-top: 3px; }
  .vm-close {
    background: none; border: none; cursor: pointer;
    color: var(--text3); font-size: 18px; line-height: 1;
    padding: 4px; border-radius: 5px; transition: color .15s;
  }
  .vm-close:hover { color: var(--text); }

  .vm-form-body { padding: 22px 24px; }
  .vm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 540px) { .vm-form-grid { grid-template-columns: 1fr; } }
  .vm-fg { display: flex; flex-direction: column; }
  .vm-fg.full { grid-column: 1 / -1; }

  label.vm-label {
    font-size: 10.5px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: .8px;
    margin-bottom: 6px; display: block;
  }
  .vm-field {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); padding: 9px 12px;
    border-radius: 7px; font-size: 13px; width: 100%;
    transition: border-color .15s;
    appearance: none; -webkit-appearance: none;
  }
  .vm-field:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px var(--teal-dim); }
  .vm-field::placeholder { color: var(--text3); }
  textarea.vm-field { resize: vertical; min-height: 80px; }
  select.vm-field { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
  button.vm-field { border: 1px solid var(--border); }

  .vm-modal-foot {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    position: sticky; bottom: 0;
    background: var(--surface);
  }

  /* ── Toast ── */
  .vm-toast-wrap {
    position: fixed; bottom: 24px; right: 24px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 500; pointer-events: none;
  }
  .vm-toast {
    padding: 11px 18px; border-radius: 9px;
    font-size: 13px; font-weight: 500;
    border: 1px solid; pointer-events: auto;
    animation: toast-in .2s ease;
    max-width: 320px;
  }
  @keyframes toast-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .vm-toast.success { background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.3); color: var(--green); }
  .vm-toast.error   { background: rgba(239,68,68,.12);  border-color: rgba(239,68,68,.3);  color: var(--red); }
  .vm-toast.info    { background: var(--teal-dim);       border-color: var(--teal-glow);     color: var(--teal); }
`;

// ─── Badge colour helper ──────────────────────────────────────────────────────
function badgeClass(status = ''): string {
  const s = status.toLowerCase();
  if (s.includes('delivered') || s.includes('closed')) return 'green';
  if (s.includes('lost')) return 'red';
  if (s.includes('test drive') || s.includes('quotation')) return 'blue';
  if (s.includes('negotiation') || s.includes('follow-up')) return 'amber';
  if (s.includes('new') || s.includes('attempted')) return 'muted';
  return 'teal';
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4].map(n => (
        <tr key={n} className="vm-skeleton">
          {[40, 80, 130, 110, 140, 120, 90, 100].map((w, i) => (
            <td key={i}><div className="vm-skel" style={{ width: w }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CreateVisitReportPage() {
  // ── All hooks declared at the top ──────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);  // FIX: separate source-of-truth
  const [searchQuery, setSearchQuery] = useState('');       // FIX: search as derived state, not mutation
  const [open, setOpen] = useState(false);
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
      const res = await fetch(`${API_BASE}/api/v1/visits`, { headers: authHeaders() });
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
      const res = await fetch(`${API_BASE}/api/v1/leads`, { headers: authHeaders() });
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
    setForm(f => ({ ...f, [key]: value }));
    setHasUnsaved(true);
  }

  // ── Open / close modal ─────────────────────────────────────────────────────
  function openModal() {
    setForm(EMPTY_FORM);
    setHasUnsaved(false);
    setOpen(true);
  }

  function closeModal() {
    if (hasUnsaved) {
      if (!window.confirm('You have unsaved changes. Close anyway?')) return;
    }
    setOpen(false);
    setHasUnsaved(false);
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
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/api/v1/visits`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        showToast(`Failed to save (${res.status}) ${text}`, 'error');
        return;
      }
      setOpen(false);
      setHasUnsaved(false);
      showToast('Visit saved successfully', 'success');
      await fetchVisits();
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
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `visits_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href); // cleanup
      showToast('Export started', 'success');
    } catch {
      showToast('Export failed', 'error');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="vm-root">
      <style>{PAGE_STYLES}</style>

      {/* Topbar */}
      <header className="vm-topbar">
        <div className="vm-logo">
          <div className="vm-logo-mark">V</div>
          <div>
            <div className="vm-logo-name">Voltmate</div>
            <div className="vm-logo-tag">EMS</div>
          </div>
        </div>
        <div className="vm-topbar-right">
          <div className="vm-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text3)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search visits, customers..."
              onChange={handleSearchChange}
              aria-label="Search visits"
            />
          </div>
          <div className="vm-avatar" title="Profile">M</div>
        </div>
      </header>

      {/* Content */}
      <main className="vm-content">
        <div className="vm-page-header">
          <div className="vm-page-title">Visit Management</div>
          <div className="vm-page-sub">Record and track customer visits &amp; actions</div>
        </div>

        {/* Stats */}
        <div className="vm-stats">
          <div className="vm-stat">
            <div className="vm-stat-label">Total Visits</div>
            <div className="vm-stat-value teal">{stats.total}</div>
          </div>
          <div className="vm-stat">
            <div className="vm-stat-label">Demos</div>
            <div className="vm-stat-value blue">{stats.testDrives}</div>
          </div>
          <div className="vm-stat">
            <div className="vm-stat-label">Connected</div>
            <div className="vm-stat-value green">{stats.connected}</div>
          </div>
          <div className="vm-stat">
            <div className="vm-stat-label">This Month</div>
            <div className="vm-stat-value amber">{stats.thisMonth}</div>
          </div>
        </div>

        {/* Table */}
        <div className="vm-table-wrap">
          <div className="vm-table-header">
            <div>
              <div className="vm-table-title">All Visits</div>
              <div className="vm-table-sub">
                {searchQuery ? `Showing ${visits.length} of ${allVisits.length} records` : `${allVisits.length} total records`}
              </div>
            </div>
            <div className="vm-table-actions">
              <button className="vm-btn vm-btn-ghost" onClick={handleExport}>
                ↓ Export CSV
              </button>
              <button className="vm-btn vm-btn-teal" onClick={openModal}>
                + Add Visit
              </button>
            </div>
          </div>

          <div className="vm-table-outer">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cust. Code</th>
                  <th>Customer Name</th>
                  <th>Salesperson</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Visit Date</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : visits.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="vm-empty">
                        <div className="vm-empty-icon">📋</div>
                        <div className="vm-empty-text">
                          {searchQuery
                            ? <>No visits match <strong>"{searchQuery}"</strong></>
                            : <>No visits yet. Click <strong>Add Visit</strong> to get started.</>}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visits.map((v, i) => (
                    <tr key={v.id ?? i}>
                      <td className="vm-num">{String(i + 1).padStart(2, '0')}</td>
                      <td className="vm-code">{v.lead_cust_code || '—'}</td>
                      <td>{v.cust_name || '—'}</td>
                      <td>{v.salesperson_name || '—'}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vehicle || '—'}</td>
                      <td>
                        <span className={`vm-badge ${badgeClass(v.status)}`}>{v.status || '—'}</span>
                      </td>
                      <td className="vm-date">
                        {v.visit_date ? new Date(v.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ color: 'var(--text2)' }}>{v.next_action || '—'}</td>
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
        <div className="vm-overlay" onClick={handleOverlayClick} role="presentation">
          <div className="vm-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="vm-modal-head">
              <div>
                <div className="vm-modal-title" id="modal-title">Add Visit</div>
                <div className="vm-modal-sub">Create a new customer visit record</div>
              </div>
              <button className="vm-close" onClick={closeModal} aria-label="Close modal">✕</button>
            </div>

            <form onSubmit={submitForm}>
              <div className="vm-form-body">
                <div className="vm-form-grid">

                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-lead">Customer</label>
                    <SearchableSelect
                      id="f-lead"
                      fieldClass="vm-field"
                      options={leads.map(l => ({ value: String(l.id), label: `${l.cust_code} — ${l.cust_name}` }))}
                      value={form.lead_id}
                      onChange={v => handleFormChange('lead_id', v)}
                      placeholder="Select lead"
                      accentColor="var(--teal)"
                    />
                  </div>

                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-sp">Salesperson</label>
                    <SearchableSelect
                      id="f-sp"
                      fieldClass="vm-field"
                      options={employees.map(e => ({ value: String(e.id), label: e.name }))}
                      value={form.salesperson_id}
                      onChange={v => handleFormChange('salesperson_id', v)}
                      placeholder="Select salesperson"
                      accentColor="var(--teal)"
                    />
                  </div>

                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-vehicle">Vehicle</label>
                    <SearchableSelect
                      id="f-vehicle"
                      fieldClass="vm-field"
                      options={VEHICLES}
                      value={form.vehicle}
                      onChange={v => handleFormChange('vehicle', v)}
                      placeholder="Select vehicle"
                      emptyLabel="Select vehicle"
                      accentColor="var(--teal)"
                    />
                  </div>

                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-status">Status</label>
                    <SearchableSelect
                      id="f-status"
                      fieldClass="vm-field"
                      options={STATUSES}
                      value={form.status}
                      onChange={v => handleFormChange('status', v)}
                      placeholder="Select status"
                      emptyLabel="Select status"
                      accentColor="var(--teal)"
                    />
                  </div>

                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-vdate">Visit Date</label>
                    <input
                      id="f-vdate"
                      type="date"
                      className="vm-field"
                      value={form.visit_date}
                      onChange={e => handleFormChange('visit_date', e.target.value)}
                    />
                  </div>

                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-na">Next Action</label>
                    <SearchableSelect
                      id="f-na"
                      fieldClass="vm-field"
                      options={NEXT_ACTIONS}
                      value={form.next_action}
                      onChange={v => handleFormChange('next_action', v)}
                      placeholder="Select next action"
                      emptyLabel="Select next action"
                      accentColor="var(--teal)"
                    />
                  </div>

                  {/* FIX: next_action_date field now rendered (was in state but missing from UI) */}
                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-nadate">Next Action Date</label>
                    <input
                      id="f-nadate"
                      type="date"
                      className="vm-field"
                      value={form.next_action_date}
                      onChange={e => handleFormChange('next_action_date', e.target.value)}
                    />
                  </div>

                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-phone">Phone No. 1 <span style={{ color: 'var(--red)', fontWeight: 700 }}>*</span></label>
                    <input
                      id="f-phone"
                      type="tel"
                      className="vm-field"
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      required
                      value={form.phone_no}
                      onChange={e => handleFormChange('phone_no', e.target.value.replace(/\D/g, ''))}
                      style={form.phone_no && !isValidPhone(form.phone_no) ? { borderColor: 'var(--red)' } : {}}
                    />
                    {form.phone_no && !isValidPhone(form.phone_no) && (
                      <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Enter a valid 10-digit number starting with 6–9</span>
                    )}
                  </div>

                  <div className="vm-fg">
                    <label className="vm-label" htmlFor="f-phone2">Phone No. 2 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
                    <input
                      id="f-phone2"
                      type="tel"
                      className="vm-field"
                      placeholder="Alternate 10-digit number"
                      maxLength={10}
                      value={form.phone_no_2}
                      onChange={e => handleFormChange('phone_no_2', e.target.value.replace(/\D/g, ''))}
                      style={form.phone_no_2 && !isValidPhoneOptional(form.phone_no_2) ? { borderColor: 'var(--red)' } : {}}
                    />
                    {form.phone_no_2 && !isValidPhoneOptional(form.phone_no_2) && (
                      <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Enter a valid 10-digit number starting with 6–9</span>
                    )}
                  </div>

                  <div className="vm-fg full">
                    <label className="vm-label" htmlFor="f-note">Note</label>
                    <textarea
                      id="f-note"
                      className="vm-field"
                      rows={3}
                      placeholder="Add any relevant notes..."
                      value={form.note}
                      onChange={e => handleFormChange('note', e.target.value)}
                    />
                  </div>

                </div>
              </div>

              <div className="vm-modal-foot">
                <button type="button" className="vm-btn vm-btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="vm-btn vm-btn-teal" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toasts — replaces alert() */}
      <div className="vm-toast-wrap" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`vm-toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}