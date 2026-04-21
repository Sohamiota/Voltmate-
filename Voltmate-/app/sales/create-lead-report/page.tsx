'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SearchableSelect from '@/components/SearchableSelect';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: number;
  cust_code?: string;
  connect_date?: string;
  cust_name?: string;
  business?: string;
  phone_no?: string;
  lead_type?: string;
  note?: string;
  // audit fields
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface FormState {
  connect_date: string;
  cust_name: string;
  phone_no: string;
  phone_no_2: string;
  lead_type: string;
  location: string;
  note: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: { city?: string; town?: string; village?: string; suburb?: string; district?: string; state?: string; };
  type: string;
}

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

// ─── Constants (outside component — never recreated) ──────────────────────────
// Default to backend dev server port 8081 (local)
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

const BUSINESS_OPTIONS: Record<string, string[]> = {
  'Distribution & Logistics': [
    'Market Load',
    'Super Stockist',
    'Transport Business',
    'Delivery Service',
    'Multipurpose Transport (Fruit / Veg / Ice Cream)',
    'Neo Hi-Range (1.5–1.8 MT, Asansol–Kolkata)',
  ],
  'Water & Beverages': [
    'Mineral Water Distribution',
    'Packaged Water Distribution',
    'Water Distribution – FMCG',
    'Market Load – Water',
  ],
  'FMCG & Grocery': [
    'Chemical Distribution – FMCG',
    'Flipkart Grocery',
    'Dairy Products',
    'Egg Distributor / Poultry',
    'Bakery',
  ],
  'Passenger & Vehicles': [
    'Passenger Auto',
    'Hi Capacity Passenger',
    'Passenger Vehicles',
  ],
  'Construction & Hardware': ['Construction', 'Hardware'],
  'Specialty & Others': ['Foreign Liquor', 'Neo Hi-Range'],
};

const EMPTY_FORM: FormState = {
  connect_date: '',          // set to today at runtime (openModal) to avoid SSR hydration mismatch
  cust_name: '',
  phone_no: '',
  phone_no_2: '',
  lead_type: '',
  location: '',
  note: '',
};

function isValidPhone(v: string)         { return /^[6-9]\d{9}$/.test(v.trim()); }
function isValidPhoneOptional(v: string) { return v.trim() === '' || isValidPhone(v); }

// ─── Auth helper (module-level, not recreated per render) ─────────────────────
function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

function buildHeaders(withJson = false): Record<string, string> {
  const t = getToken(); // called once
  const h: Record<string, string> = {};
  if (withJson) h['Content-Type'] = 'application/json';
  if (t) h['Authorization'] = `Bearer ${t}`; // FIX: only added when token exists
  return h;
}

// ─── Styles (outside component — never re-injected on render) ─────────────────
const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg:        #080a10;
    --surface:   #0e1118;
    --surface2:  #141720;
    --border:    #1e2236;
    --border2:   #272b40;
    --teal:      #00c9b1;
    --teal-dim:  rgba(0,201,177,0.09);
    --teal-glow: rgba(0,201,177,0.20);
    --red:       #f43f5e;
    --red-dim:   rgba(244,63,94,0.09);
    --amber:     #f59e0b;
    --blue:      #60a5fa;
    --text:      #dde3f0;
    --text2:     #8b93a8;
    --text3:     #4b5268;
    --mono:      'DM Mono', monospace;
  }

  html, body { height: 100%; }
  body {
    font-family: 'Syne', sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    font-size: 13.5px;
  }

  /* ── Root layout ── */
  .lm-root { display: flex; flex-direction: column; min-height: 100vh; }

  /* ── Topbar ── */
  .lm-topbar {
    position: sticky; top: 0; z-index: 40;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 28px; height: 54px;
    background: rgba(8,10,16,0.9);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
  }
  .lm-logo { display: flex; align-items: center; gap: 10px; }
  .lm-logo-mark {
    width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
    background: linear-gradient(135deg, #00c9b1, #0891b2);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 12px; color: #080a10;
  }
  .lm-logo-label { font-size: 13px; font-weight: 700; letter-spacing: .3px; }
  .lm-logo-sub { font-size: 9px; color: var(--text3); letter-spacing: 1.6px; text-transform: uppercase; margin-top: 1px; }

  .lm-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 13px; width: 256px;
    transition: border-color .15s;
  }
  .lm-search:focus-within { border-color: var(--teal); box-shadow: 0 0 0 3px var(--teal-dim); }
  .lm-search svg { flex-shrink: 0; color: var(--text3); }
  .lm-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12.5px; font-family: inherit; width: 100%;
  }
  .lm-search input::placeholder { color: var(--text3); }
  .lm-topbar-right { display: flex; align-items: center; gap: 10px; }
  .lm-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: linear-gradient(135deg, var(--teal), #0891b2);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 11px; color: #080a10; cursor: pointer;
    flex-shrink: 0;
  }

  /* ── Content ── */
  .lm-content { padding: 28px; flex: 1; }
  .lm-page-header { margin-bottom: 22px; }
  .lm-page-title { font-size: 21px; font-weight: 800; letter-spacing: -.3px; }
  .lm-page-sub { color: var(--text2); font-size: 12.5px; margin-top: 4px; }

  /* ── Stat grid ── */
  .lm-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 22px; }
  @media(max-width:860px){ .lm-stats { grid-template-columns: repeat(2,1fr); } }

  .lm-stat {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 18px 20px;
    transition: border-color .15s, transform .15s;
  }
  .lm-stat:hover { border-color: var(--border2); transform: translateY(-1px); }
  .lm-stat-label { font-size: 10.5px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: .9px; margin-bottom: 8px; }
  .lm-stat-val { font-size: 28px; font-weight: 800; font-family: var(--mono); }
  .lm-stat-val.teal  { color: var(--teal); }
  .lm-stat-val.blue  { color: var(--blue); }
  .lm-stat-val.amber { color: var(--amber); }
  .lm-stat-val.text  { color: var(--text); }

  /* ── Table card ── */
  .lm-table-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .lm-table-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 15px 20px; border-bottom: 1px solid var(--border);
    flex-wrap: wrap; gap: 10px;
  }
  .lm-table-title { font-size: 14px; font-weight: 700; }
  .lm-table-sub { font-size: 11.5px; color: var(--text3); margin-top: 2px; }
  .lm-table-actions { display: flex; gap: 8px; }
  .lm-table-outer { overflow-x: auto; }

  table { width: 100%; border-collapse: collapse; min-width: 820px; }
  thead tr { background: var(--surface2); border-bottom: 1px solid var(--border); }
  th {
    padding: 10px 16px; text-align: left;
    font-size: 10px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: 1px; white-space: nowrap;
  }
  td {
    padding: 13px 16px; color: var(--text);
    border-bottom: 1px solid var(--border); vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .1s; }
  tbody tr:hover { background: rgba(255,255,255,0.02); }

  .lm-num { font-family: var(--mono); font-size: 11px; color: var(--text3); }
  .lm-code { font-family: var(--mono); font-size: 12px; font-weight: 500; color: var(--teal); }
  .lm-date { font-family: var(--mono); font-size: 11.5px; color: var(--text2); }

  /* ── Badge ── */
  .lm-badge {
    display: inline-flex; align-items: center;
    padding: 3px 9px; border-radius: 20px; white-space: nowrap;
    font-size: 11px; font-weight: 600;
  }
  .lm-badge.digital    { background: var(--teal-dim); color: var(--teal); border: 1px solid var(--teal-glow); }
  .lm-badge.nondigital { background: rgba(96,165,250,.09); color: var(--blue); border: 1px solid rgba(96,165,250,.22); }
  .lm-badge.default    { background: rgba(139,147,168,.08); color: var(--text2); border: 1px solid rgba(139,147,168,.18); }

  /* ── Buttons ── */
  .lm-btn {
    font-family: 'Syne', sans-serif; font-weight: 600; font-size: 12.5px;
    padding: 8px 16px; border-radius: 7px; border: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: opacity .15s, box-shadow .15s, transform .1s;
    white-space: nowrap;
  }
  .lm-btn:active { transform: scale(0.97); }
  .lm-btn:disabled { opacity: .45; cursor: not-allowed; pointer-events: none; }
  .lm-btn-teal  { background: var(--teal); color: #080a10; }
  .lm-btn-teal:hover { box-shadow: 0 0 18px var(--teal-glow); }
  .lm-btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
  .lm-btn-ghost:hover { border-color: var(--border2); color: var(--text); }
  .lm-btn-red   { background: var(--red-dim); color: var(--red); border: 1px solid rgba(244,63,94,.22); }
  .lm-btn-red:hover { background: rgba(244,63,94,.16); }
  .lm-btn-amber { background: rgba(251,191,36,.08); color: #fbbf24; border: 1px solid rgba(251,191,36,.22); }
  .lm-btn-amber:hover { background: rgba(251,191,36,.16); }
  /* ── Audit / Logged-By cell ── */
  .lm-audit-cell { display: flex; flex-direction: column; gap: 3px; min-width: 130px; }
  .lm-audit-row  { display: flex; align-items: center; gap: 4px; font-size: 11px; line-height: 1.3; white-space: nowrap; }
  .lm-audit-icon { font-size: 10px; opacity: .7; }
  .lm-audit-create { color: #4ade80; }
  .lm-audit-edit   { color: #fbbf24; }
  .lm-audit-time   { opacity: .55; font-size: 10px; }

  /* ── Empty & skeleton ── */
  .lm-empty { text-align: center; padding: 56px 20px; color: var(--text3); }
  .lm-empty-icon { font-size: 34px; margin-bottom: 12px; opacity: .45; }
  .lm-empty-msg { font-size: 13.5px; }
  .lm-empty-msg strong { color: var(--text2); }

  .lm-skel-row td { padding: 14px 16px; }
  .lm-skel {
    height: 13px; border-radius: 4px;
    background: linear-gradient(90deg, var(--surface2) 0%, var(--border) 50%, var(--surface2) 100%);
    background-size: 200% 100%;
    animation: skel 1.5s infinite linear;
  }
  @keyframes skel { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* ── Delete confirm modal ── */
  .lm-confirm-overlay {
    position: fixed; inset: 0; z-index: 300;
    background: rgba(0,0,0,.72); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: fade-in .15s ease;
  }
  .lm-confirm-box {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 24px 26px; max-width: 380px; width: 100%;
    box-shadow: 0 24px 60px rgba(0,0,0,.75);
    animation: slide-up .18s ease;
  }
  .lm-confirm-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
  .lm-confirm-msg { font-size: 13px; color: var(--text2); margin-bottom: 20px; line-height: 1.6; }
  .lm-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }

  /* ── Modal ── */
  .lm-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,.70); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fade-in .18s ease;
  }
  @keyframes fade-in { from{opacity:0} to{opacity:1} }

  .lm-modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; width: 100%; max-width: 580px;
    box-shadow: 0 30px 80px rgba(0,0,0,.8);
    animation: slide-up .2s ease;
    max-height: 92vh; overflow-y: auto;
  }
  @keyframes slide-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

  .lm-modal-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 22px 24px 16px;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; background: var(--surface); z-index: 1;
  }
  .lm-modal-title { font-size: 16px; font-weight: 800; }
  .lm-modal-sub { font-size: 12px; color: var(--text3); margin-top: 3px; }
  .lm-close {
    background: none; border: none; cursor: pointer; color: var(--text3);
    font-size: 17px; padding: 4px 6px; border-radius: 5px; line-height: 1;
    transition: color .15s;
  }
  .lm-close:hover { color: var(--text); }

  .lm-form-body { padding: 20px 24px; }
  .lm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media(max-width:500px){ .lm-form-grid { grid-template-columns: 1fr; } }
  .lm-fg { display: flex; flex-direction: column; }
  .lm-fg.full { grid-column: 1 / -1; }

  label.lm-label {
    display: block; font-size: 10.5px; font-weight: 700;
    color: var(--text3); text-transform: uppercase; letter-spacing: .9px;
    margin-bottom: 6px;
  }
  .lm-field {
    font-family: 'Syne', sans-serif; font-size: 13px;
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); padding: 9px 12px; border-radius: 7px; width: 100%;
    transition: border-color .15s, box-shadow .15s;
    appearance: none; -webkit-appearance: none;
  }
  .lm-field:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px var(--teal-dim); }
  .lm-field::placeholder { color: var(--text3); }
  textarea.lm-field { resize: vertical; min-height: 82px; line-height: 1.55; }
  button.lm-field { border: 1px solid var(--border); }
  select.lm-field {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 12 12'%3E%3Cpath fill='%234b5268' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
  }

  .lm-modal-foot {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 14px 24px; border-top: 1px solid var(--border);
    position: sticky; bottom: 0; background: var(--surface);
  }

  /* ── Location autocomplete ── */
  .lm-loc-wrap { position: relative; }
  .lm-loc-drop {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
    background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 8px; max-height: 220px; overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0,0,0,.55);
  }
  .lm-loc-item {
    padding: 9px 12px; cursor: pointer; font-size: 12.5px;
    border-bottom: 1px solid var(--border); transition: background .1s;
    display: flex; flex-direction: column; gap: 2px;
  }
  .lm-loc-item:last-child { border-bottom: none; }
  .lm-loc-item:hover, .lm-loc-item.active { background: var(--teal-dim); }
  .lm-loc-name { color: var(--text); font-weight: 600; }
  .lm-loc-sub  { color: var(--text3); font-size: 11px; }
  .lm-loc-loading { padding: 12px; text-align: center; color: var(--text3); font-size: 12px; }

  /* ── Toasts ── */
  .lm-toasts {
    position: fixed; bottom: 22px; right: 22px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 500; pointer-events: none;
  }
  .lm-toast {
    padding: 11px 18px; border-radius: 9px;
    font-size: 13px; font-weight: 600; pointer-events: auto;
    animation: toast-in .2s ease; max-width: 320px; border: 1px solid;
  }
  @keyframes toast-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .lm-toast.success { background: rgba(0,201,177,.1);  border-color: rgba(0,201,177,.28); color: var(--teal); }
  .lm-toast.error   { background: rgba(244,63,94,.1);  border-color: rgba(244,63,94,.28); color: var(--red); }
  .lm-toast.info    { background: rgba(96,165,250,.1); border-color: rgba(96,165,250,.28); color: var(--blue); }
`;

// ─── Badge class helper ───────────────────────────────────────────────────────
function leadBadgeClass(type = '') {
  if (type === 'Digital Lead') return 'digital';
  if (type === 'Non Digital Lead') return 'nondigital';
  return 'default';
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map(n => (
        <tr key={n} className="lm-skel-row">
          {[28, 72, 80, 130, 140, 90, 110, 100, 60].map((w, i) => (
            <td key={i}><div className="lm-skel" style={{ width: w }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CreateLeadReportPage() {
  const router = useRouter();
  const [roleChecked, setRoleChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // ── Role guard: only admin and sales_admin may access this page ───────────
  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/login'); return; }
    fetch(`${API_BASE}/api/v1/auth/me`, { headers: buildHeaders() })
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

  // FIX: all hooks at top, proper types
  const [allLeads, setAllLeads] = useState<Lead[]>([]);       // FIX: source-of-truth, never mutated by search
  const [searchQuery, setSearchQuery] = useState('');          // FIX: search as string, not state mutation
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [businessCategory, setBusinessCategory] = useState('');
  const [businessSub, setBusinessSub] = useState('');
  const [editTarget, setEditTarget] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [locResults, setLocResults] = useState<NominatimResult[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [showLocDrop, setShowLocDrop] = useState(false);
  const [locHighlight, setLocHighlight] = useState(-1);
  const locTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3800);
  }, []);

  // ── Location autocomplete (Nominatim, West Bengal only) ──────────────────
  const searchLocation = useCallback((val: string) => {
    setForm(f => ({ ...f, location: val }));
    setLocHighlight(-1);
    if (locTimer.current) clearTimeout(locTimer.current);
    if (!val.trim() || val.length < 2) { setLocResults([]); setShowLocDrop(false); return; }
    locTimer.current = setTimeout(async () => {
      setLocLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val + ', West Bengal')}&countrycodes=in&format=json&addressdetails=1&limit=10`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data: NominatimResult[] = await res.json();
        const wb = data.filter(d => d.address?.state === 'West Bengal');
        setLocResults(wb.slice(0, 8));
        setShowLocDrop(wb.length > 0);
      } catch { setLocResults([]); setShowLocDrop(false); }
      finally { setLocLoading(false); }
    }, 320);
  }, []);

  function pickLocation(item: NominatimResult) {
    const parts = item.display_name.split(',');
    const short = parts.slice(0, 3).join(',').trim();
    setForm(f => ({ ...f, location: short }));
    setShowLocDrop(false);
    setLocResults([]);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (locRef.current && !locRef.current.contains(e.target as Node)) setShowLocDrop(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Derived: filtered leads via useMemo — never mutates allLeads ──────────
  // FIX #1: search is derived, not a state mutation
  const leads = useMemo(() => {
    if (!searchQuery.trim()) return allLeads;
    const q = searchQuery.toLowerCase();
    return allLeads.filter(l =>
      (l.cust_name || '').toLowerCase().includes(q) ||
      (l.cust_code || '').toLowerCase().includes(q) ||
      (l.business || '').toLowerCase().includes(q) ||
      (l.phone_no || '').toLowerCase().includes(q) ||
      ((l as any).location || '').toLowerCase().includes(q)
    );
  }, [allLeads, searchQuery]);

  // ── Stats (derived, memo) ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: allLeads.length,
      digital: allLeads.filter(l => l.lead_type === 'Digital Lead').length,
      nonDigital: allLeads.filter(l => l.lead_type === 'Non Digital Lead').length,
      thisMonth: allLeads.filter(l => {
        if (!l.connect_date) return false;
        const d = new Date(l.connect_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [allLeads]);

  // ── fetchList (stable reference with useCallback) ─────────────────────────
  // FIX #3: uses API_BASE consistently
  // FIX #5: useCallback so useEffect dep array is accurate
  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/leads?limit=100000`, { headers: buildHeaders() });
      if (!res.ok) { setAllLeads([]); return; }
      const j = await res.json();
      setAllLeads(j.leads || []);
    } catch (e) {
      console.error('fetchList error:', e);
      setAllLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // FIX #5: fetchList is now a stable dep
  useEffect(() => { fetchList(); }, [fetchList]);

  // ── Search with debounce (no instant-filter lag) ──────────────────────────
  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(val), 180);
  }

  // ── Open / close modal — resets ALL form state ────────────────────────────
  // FIX #9: full form reset, not just connect_date
  // FIX #8: businessCategory and businessSub also reset
  // Helper: reverse-map a stored business value → { category, sub }
  function findBusinessParts(business: string): { cat: string; sub: string } {
    if (!business) return { cat: '', sub: '' };
    for (const [cat, subs] of Object.entries(BUSINESS_OPTIONS)) {
      if (subs.includes(business)) return { cat, sub: business };
    }
    // might be a category itself
    if (BUSINESS_OPTIONS[business]) return { cat: business, sub: '' };
    return { cat: '', sub: '' };
  }

  function openModal() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, connect_date: new Date().toISOString().slice(0, 10) });
    setBusinessCategory('');
    setBusinessSub('');
    setOpen(true);
  }

  function openEditModal(lead: Lead) {
    setEditTarget(lead);
    const l = lead as any;
    const { cat, sub } = findBusinessParts(l.business || '');
    setBusinessCategory(cat);
    setBusinessSub(sub);
    setForm({
      connect_date: l.connect_date ? l.connect_date.slice(0, 10) : '',
      cust_name:  l.cust_name  || '',
      phone_no:   l.phone_no   || '',
      phone_no_2: l.phone_no_2 || '',
      lead_type:  l.lead_type  || '',
      location:   l.location   || '',
      note:       l.note       || '',
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditTarget(null);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      showToast('You must be logged in to create a lead', 'error');
      return;
    }

    const business = businessSub || businessCategory;
    if (!business) {
      showToast('Please select a Business Category', 'error');
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

    const payload = { ...form, business, location: form.location || null };

    try {
      setSubmitting(true);
      const isEdit = editTarget !== null;
      const url = isEdit
        ? `${API_BASE}/api/v1/leads/${editTarget!.id}`
        : `${API_BASE}/api/v1/leads`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        showToast(`Failed to ${isEdit ? 'update' : 'save'} (${res.status})${txt ? ' – ' + txt : ''}`, 'error');
        return;
      }

      showToast(isEdit ? 'Lead updated successfully' : 'Lead saved successfully', 'success');
      closeModal();
      await fetchList();
    } catch (err) {
      console.error('submitForm error:', err);
      showToast('Network error — could not save lead', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete (with inline confirm modal, not browser confirm()) ─────────────
  // FIX #4 & FIX #11: proper error handling + no browser confirm()
  // FIX #6: fetchList is awaited after delete
  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/leads/${deleteTarget.id}`, { // FIX #3
        method: 'DELETE',
        headers: buildHeaders(), // FIX #2
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        showToast(`Delete failed (${res.status})${txt ? ' – ' + txt : ''}`, 'error');
        return;
      }
      showToast(`"${deleteTarget.cust_name || 'Lead'}" deleted`, 'success');
      await fetchList(); // FIX #6: awaited
    } catch (err) {
      console.error('delete error:', err);
      showToast('Network error — could not delete lead', 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  // FIX #4: full error handling + try/catch
  // FIX #16: blob URL revoked after use
  async function exportCSV() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/leads/export/csv`, { // FIX #3
        headers: buildHeaders(), // FIX #2
      });
      if (!res.ok) {
        showToast('Export failed', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url); // FIX #16: no memory leak
      showToast('Export started', 'success');
    } catch (err) {
      console.error('export error:', err);
      showToast('Network error — export failed', 'error');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!roleChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#080a10', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: 'system-ui, sans-serif' }}>
        Checking access…
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ minHeight: '100vh', background: '#080a10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 32 }}>🚫</div>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>Access Denied</div>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Only Admin and Sales Admin can access this page.</div>
        <button onClick={() => router.back()} style={{ marginTop: 16, padding: '8px 20px', background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5', cursor: 'pointer', fontSize: 13 }}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="lm-root">
      {/* FIX #14: style tag is a stable constant outside component, not re-injected */}
      <style>{PAGE_STYLES}</style>

      {/* ── Topbar ── */}
      <header className="lm-topbar">
        <div className="lm-logo">
          <div className="lm-logo-mark">V</div>
          <div>
            {/* FIX #10: title only appears once — topbar OR page-header, not both */}
            <div className="lm-logo-label">Voltmate EMS</div>
            <div className="lm-logo-sub">Lead Management</div>
          </div>
        </div>
        <div className="lm-topbar-right">
          <div className="lm-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            {/* FIX #1: onChange sets searchQuery string, never mutates allLeads */}
            <input placeholder="Search leads, customers..." onChange={handleSearch} aria-label="Search leads" />
          </div>
          <div className="lm-avatar">M</div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="lm-content">
        {/* FIX #10: single page header, not duplicated */}
        <div className="lm-page-header">
          <div className="lm-page-title">Lead Management</div>
          <div className="lm-page-sub">Track and manage your dealership leads</div>
        </div>

        {/* ── Stats ── */}
        <div className="lm-stats">
          <div className="lm-stat">
            <div className="lm-stat-label">Total Leads</div>
            <div className="lm-stat-val teal">{stats.total}</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-label">Digital Leads</div>
            <div className="lm-stat-val blue">{stats.digital}</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-label">Non-Digital</div>
            <div className="lm-stat-val amber">{stats.nonDigital}</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-label">This Month</div>
            <div className="lm-stat-val text">{stats.thisMonth}</div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="lm-table-card">
          <div className="lm-table-header">
            <div>
              <div className="lm-table-title">All Leads</div>
              <div className="lm-table-sub">
                {searchQuery
                  ? `Showing ${leads.length} of ${allLeads.length} leads`
                  : `${allLeads.length} leads total`}
              </div>
            </div>
            <div className="lm-table-actions">
              <button className="lm-btn lm-btn-ghost" onClick={exportCSV}>↓ Export CSV</button>
              <button className="lm-btn lm-btn-teal" onClick={openModal}>+ Add Lead</button>
            </div>
          </div>

          <div className="lm-table-outer">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cust. Code</th>
                  <th>Connect Date</th>
                  <th>Customer Name</th>
                  <th>Business</th>
                  <th>Phone No.</th>
                  <th>Location</th>
                  <th>Lead Type</th>
                  <th>Logged By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="lm-empty">
                        <div className="lm-empty-icon">📋</div>
                        <div className="lm-empty-msg">
                          {searchQuery
                            ? <>No leads match <strong>"{searchQuery}"</strong></>
                            : <>No leads yet. Click <strong>+ Add Lead</strong> to get started.</>}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  leads.map((l, i) => (
                    // FIX #15: safe key fallback
                    <tr key={l.id ?? i}>
                      <td className="lm-num">{String(i + 1).padStart(2, '0')}</td>
                      <td className="lm-code">{l.cust_code || '—'}</td>
                      <td className="lm-date">
                        {l.connect_date
                          ? new Date(l.connect_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{l.cust_name || '—'}</td>
                      <td style={{ color: 'var(--text2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.business || '—'}
                      </td>
                      <td className="lm-date">{l.phone_no || '—'}</td>
                      <td style={{ color: 'var(--text2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(l as any).location || '—'}
                      </td>
                      <td>
                        <span className={`lm-badge ${leadBadgeClass(l.lead_type)}`}>
                          {l.lead_type || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="lm-audit-cell">
                          {l.created_by_name && (
                            <span className="lm-audit-row lm-audit-create">
                              <span className="lm-audit-icon">＋</span>
                              <span>{l.created_by_name}</span>
                              {l.created_at && (
                                <span className="lm-audit-time">
                                  {new Date(l.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                                </span>
                              )}
                            </span>
                          )}
                          {l.updated_by_name && (
                            <span className="lm-audit-row lm-audit-edit">
                              <span className="lm-audit-icon">✎</span>
                              <span>{l.updated_by_name}</span>
                              {l.updated_at && (
                                <span className="lm-audit-time">
                                  {new Date(l.updated_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                                </span>
                              )}
                            </span>
                          )}
                          {!l.created_by_name && !l.updated_by_name && <span style={{ color: 'var(--text3)' }}>—</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="lm-btn lm-btn-amber"
                            style={{ fontSize: 12, padding: '5px 12px' }}
                            onClick={() => openEditModal(l)}
                          >
                            Edit
                          </button>
                          <button
                            className="lm-btn lm-btn-red"
                            style={{ fontSize: 12, padding: '5px 12px' }}
                            onClick={() => setDeleteTarget(l)}
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

      {/* ── Add Lead Modal ── */}
      {open && (
        <div
          className="lm-overlay"
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          role="presentation"
        >
          <div className="lm-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="lm-modal-head">
              <div>
                <div className="lm-modal-title" id="modal-title">{editTarget ? 'Edit Lead' : 'Add New Lead'}</div>
                <div className="lm-modal-sub">
                  {editTarget ? (
                    <span>
                      Editing: <strong>{(editTarget as any).cust_name || ''}</strong>
                      {editTarget.created_by_name && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#4ade80' }}>
                          ＋ Added by {editTarget.created_by_name}
                          {editTarget.created_at && ` on ${new Date(editTarget.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </span>
                      )}
                      {editTarget.updated_by_name && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#fbbf24' }}>
                          · ✎ Last edited by {editTarget.updated_by_name}
                          {editTarget.updated_at && ` on ${new Date(editTarget.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </span>
                      )}
                    </span>
                  ) : 'Fill in the lead details below'}
                </div>
              </div>
              <button className="lm-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <form onSubmit={submitForm}>
              <div className="lm-form-body">
                <div className="lm-form-grid">

                  <div className="lm-fg">
                    <label className="lm-label" htmlFor="f-date">Connect Date</label>
                    <input
                      id="f-date"
                      type="date"
                      className="lm-field"
                      value={form.connect_date}
                      onChange={e => setForm(f => ({ ...f, connect_date: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="lm-fg">
                    <label className="lm-label" htmlFor="f-name">Cust. Name</label>
                    <input
                      id="f-name"
                      className="lm-field"
                      placeholder="Full name"
                      value={form.cust_name}
                      onChange={e => setForm(f => ({ ...f, cust_name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="lm-fg">
                    <label className="lm-label" htmlFor="f-cat">Business Category</label>
                    <SearchableSelect
                      id="f-cat"
                      fieldClass="lm-field"
                      options={Object.keys(BUSINESS_OPTIONS)}
                      value={businessCategory}
                      onChange={v => { setBusinessCategory(v); setBusinessSub(''); }}
                      placeholder="Select category"
                      emptyLabel="Select category"
                      accentColor="#00c9b1"
                    />
                  </div>

                  <div className="lm-fg">
                    <label className="lm-label" htmlFor="f-sub">Business Type</label>
                    <SearchableSelect
                      id="f-sub"
                      fieldClass="lm-field"
                      options={BUSINESS_OPTIONS[businessCategory] || []}
                      value={businessSub}
                      onChange={v => setBusinessSub(v)}
                      placeholder="Select specific type"
                      emptyLabel="Select specific type"
                      disabled={!businessCategory}
                      accentColor="#00c9b1"
                    />
                  </div>

                  <div className="lm-fg">
                    <label className="lm-label" htmlFor="f-phone">Phone No. 1 <span style={{ color: 'var(--red)', fontWeight: 700 }}>*</span></label>
                    <input
                      id="f-phone"
                      type="tel"
                      className="lm-field"
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      required
                      value={form.phone_no}
                      onChange={e => setForm(f => ({ ...f, phone_no: e.target.value.replace(/\D/g, '') }))}
                      style={form.phone_no && !isValidPhone(form.phone_no) ? { borderColor: 'var(--red)' } : {}}
                    />
                    {form.phone_no && !isValidPhone(form.phone_no) && (
                      <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Enter a valid 10-digit number starting with 6–9</span>
                    )}
                  </div>

                  <div className="lm-fg">
                    <label className="lm-label" htmlFor="f-phone2">Phone No. 2 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
                    <input
                      id="f-phone2"
                      type="tel"
                      className="lm-field"
                      placeholder="Alternate 10-digit number"
                      maxLength={10}
                      value={form.phone_no_2}
                      onChange={e => setForm(f => ({ ...f, phone_no_2: e.target.value.replace(/\D/g, '') }))}
                      style={form.phone_no_2 && !isValidPhoneOptional(form.phone_no_2) ? { borderColor: 'var(--red)' } : {}}
                    />
                    {form.phone_no_2 && !isValidPhoneOptional(form.phone_no_2) && (
                      <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Enter a valid 10-digit number starting with 6–9</span>
                    )}
                  </div>

                  <div className="lm-fg">
                    <label className="lm-label" htmlFor="f-type">Lead Type</label>
                    <select
                      id="f-type"
                      className="lm-field"
                      value={form.lead_type}
                      onChange={e => setForm(f => ({ ...f, lead_type: e.target.value }))}
                      required
                    >
                      <option value="">Select type</option>
                      <option value="Digital Lead">Digital Lead</option>
                      <option value="Non Digital Lead">Non Digital Lead</option>
                    </select>
                  </div>

                  <div className="lm-fg full" ref={locRef}>
                    <label className="lm-label" htmlFor="f-loc">Location (West Bengal)</label>
                    <div className="lm-loc-wrap">
                      <input
                        id="f-loc"
                        className="lm-field"
                        autoComplete="off"
                        placeholder="Type a city, town or area in West Bengal…"
                        value={form.location}
                        onChange={e => searchLocation(e.target.value)}
                        onFocus={() => { if (locResults.length > 0) setShowLocDrop(true); }}
                        onKeyDown={e => {
                          if (!showLocDrop) return;
                          if (e.key === 'ArrowDown') { e.preventDefault(); setLocHighlight(h => Math.min(h + 1, locResults.length - 1)); }
                          if (e.key === 'ArrowUp')   { e.preventDefault(); setLocHighlight(h => Math.max(h - 1, 0)); }
                          if (e.key === 'Enter' && locHighlight >= 0) { e.preventDefault(); pickLocation(locResults[locHighlight]); }
                          if (e.key === 'Escape') setShowLocDrop(false);
                        }}
                      />
                      {(showLocDrop || locLoading) && (
                        <div className="lm-loc-drop">
                          {locLoading && <div className="lm-loc-loading">Searching…</div>}
                          {!locLoading && locResults.map((item, idx) => {
                            const parts = item.display_name.split(',');
                            const name = parts.slice(0, 2).join(',').trim();
                            const sub  = parts.slice(2, 5).join(',').trim();
                            return (
                              <div
                                key={item.place_id}
                                className={`lm-loc-item${locHighlight === idx ? ' active' : ''}`}
                                onMouseDown={() => pickLocation(item)}
                                onMouseEnter={() => setLocHighlight(idx)}
                              >
                                <span className="lm-loc-name">{name}</span>
                                {sub && <span className="lm-loc-sub">{sub}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lm-fg full">
                    <label className="lm-label" htmlFor="f-note">Note</label>
                    <textarea
                      id="f-note"
                      className="lm-field"
                      rows={3}
                      placeholder="Any additional notes..."
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    />
                  </div>

                </div>
              </div>

              <div className="lm-modal-foot">
                <button type="button" className="lm-btn lm-btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="lm-btn lm-btn-teal" disabled={submitting}>
                  {submitting ? (editTarget ? 'Updating…' : 'Saving…') : (editTarget ? 'Update Lead' : 'Save Lead')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal (replaces browser confirm()) ── */}
      {/* FIX #11: proper inline confirmation UI */}
      {deleteTarget && (
        <div className="lm-confirm-overlay" role="presentation">
          <div className="lm-confirm-box" role="alertdialog" aria-modal="true">
            <div className="lm-confirm-title">Delete Lead</div>
            <div className="lm-confirm-msg">
              Are you sure you want to delete{' '}
              <strong style={{ color: 'var(--text)' }}>
                {deleteTarget.cust_name || `Lead #${deleteTarget.id}`}
              </strong>?
              <br />This action cannot be undone.
            </div>
            <div className="lm-confirm-actions">
              <button
                className="lm-btn lm-btn-ghost"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="lm-btn lm-btn-red"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts (replaces all alert() calls) ── */}
      {/* FIX #11: toast notifications instead of alert() */}
      <div className="lm-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={`lm-toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}