'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Visit {
  id: number;
  lead_id?: number;
  lead_cust_code?: string;
  cust_name?: string;
  connect_date?: string;
  lead_type?: string;
  salesperson_name?: string;
  vehicle?: string;
  status?: string;
  visit_date?: string;
  next_action?: string;
  next_action_date?: string;
  phone_no?: string;
  phone_no_2?: string;
  note?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface ActivityLog {
  id: number;
  action: string;
  performed_by_name?: string;
  performed_at?: string;
  details?: string;
}

type SortField = 'visit_date' | 'status' | 'cust_name' | 'salesperson_name';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

const STATUSES = [
  // Restricted statuses (Lost*, Loan Processing, Booking Amount Received,
  // and everything after booking) are intentionally hidden in this page.
  'New Lead',
  'Attempted Contact',
  'Connected',
  'Requirement Identified',
  'Qualified Lead',
  'Demo Scheduled',
  'Demo Completed',
  'Quotation Shared',
  'Demo Follow Up',
  'Follow-Up 2',
  'Negotiation',
  'Booking Date Confirmed',
];

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Returns the number of calendar days the follow-up is past due (positive = overdue, 0 or negative = fine). */
function daysOverdue(dateStr?: string): number {
  if (!dateStr) return 0;
  const due  = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
}
function fmtDateTime(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #0a0c12;
    --surface: #0f1117;
    --surface2: #141720;
    --surface3: #1a1d2e;
    --border: #1e2236;
    --border2: #272b40;
    --accent: #00d9ff;
    --accent-dim: rgba(0,217,255,0.08);
    --accent-glow: rgba(0,217,255,0.18);
    --teal: #00c9b1;
    --amber: #fbbf24;
    --red: #f43f5e;
    --green: #10b981;
    --text: #e8edf5;
    --text2: #8e97ad;
    --text3: #545968;
    --mono: 'IBM Plex Mono', monospace;
  }

  body {
    font-family: 'Outfit', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Layout ── */
  .vr-root { display: flex; flex-direction: column; min-height: 100vh; }
  .vr-content { padding: 32px 28px; flex: 1; max-width: 1680px; margin: 0 auto; width: 100%; }

  /* ── Header ── */
  .vr-header { margin-bottom: 28px; }
  .vr-title { font-size: 28px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 6px; }
  .vr-subtitle { font-size: 13.5px; color: var(--text2); }

  /* ── Filters Card ── */
  .vr-filters {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px 22px; margin-bottom: 20px;
  }
  .vr-filters-label {
    font-size: 11px; font-weight: 700; color: var(--text3);
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;
    display: flex; align-items: center; gap: 8px;
  }
  .vr-filters-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
    align-items: end;
  }
  .vr-fg { display: flex; flex-direction: column; }
  .vr-label {
    font-size: 10.5px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: .9px; margin-bottom: 6px;
  }
  .vr-field {
    font-family: 'Outfit', sans-serif; font-size: 13px;
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); padding: 8px 12px; border-radius: 7px; width: 100%;
    transition: border-color .15s, box-shadow .15s;
    appearance: none; -webkit-appearance: none;
  }
  .vr-field:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .vr-field::placeholder { color: var(--text3); }
  select.vr-field {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 12 12'%3E%3Cpath fill='%23545968' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
  }
  .vr-btn-clear {
    font-family: 'Outfit', sans-serif; font-size: 12.5px; font-weight: 600;
    padding: 8px 16px; border-radius: 7px;
    border: 1px solid var(--border); background: transparent; color: var(--text2);
    cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  .vr-btn-clear:hover { border-color: var(--border2); color: var(--text); }

  /* ── Stats ── */
  .vr-stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .vr-stat {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 18px; flex: 1; min-width: 140px;
    transition: border-color .15s;
  }
  .vr-stat:hover { border-color: var(--border2); }
  .vr-stat-label {
    font-size: 10.5px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: .9px; margin-bottom: 7px;
  }
  .vr-stat-val { font-size: 24px; font-weight: 800; font-family: var(--mono); }
  .vr-stat-val.accent { color: var(--accent); }
  .vr-stat-val.teal   { color: var(--teal); }
  .vr-stat-val.amber  { color: var(--amber); }
  .vr-stat-val.green  { color: var(--green); }

  /* ── Table Card ── */
  .vr-table-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .vr-table-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    flex-wrap: wrap; gap: 10px;
  }
  .vr-table-title { font-size: 14px; font-weight: 700; }
  .vr-table-sub { font-size: 11.5px; color: var(--text3); margin-top: 2px; }
  .vr-table-actions { display: flex; gap: 8px; }
  .vr-btn {
    font-family: 'Outfit', sans-serif; font-size: 12.5px; font-weight: 600;
    padding: 7px 14px; border-radius: 7px; border: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: opacity .15s, box-shadow .15s, transform .1s; white-space: nowrap;
  }
  .vr-btn:active { transform: scale(0.97); }
  .vr-btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
  .vr-btn-ghost:hover { border-color: var(--border2); color: var(--text); }
  .vr-btn-preview { background: rgba(0,217,255,.06); color: var(--accent); border: 1px solid rgba(0,217,255,.22); font-size: 12px; padding: 5px 12px; }
  .vr-btn-preview:hover { background: rgba(0,217,255,.12); }

  .vr-table-outer { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 960px; }
  thead tr { background: var(--surface2); }
  th {
    padding: 11px 16px; text-align: left;
    font-size: 10px; font-weight: 700; color: var(--text3);
    text-transform: uppercase; letter-spacing: 1px; white-space: nowrap;
    border-bottom: 1px solid var(--border);
    cursor: pointer; user-select: none; position: relative;
    transition: color .15s;
  }
  th:hover { color: var(--text2); }
  th.sortable::after {
    content: '⇅'; position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
    font-size: 11px; color: var(--text3); opacity: 0; transition: opacity .15s;
  }
  th.sortable:hover::after { opacity: 1; }
  th.sorted::after { opacity: 1; color: var(--accent); }
  th.sorted.asc::after { content: '↑'; }
  th.sorted.desc::after { content: '↓'; }

  td {
    padding: 13px 16px; color: var(--text); font-size: 13px;
    border-bottom: 1px solid rgba(30,34,54,0.6); vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .1s; }
  tbody tr:hover { background: rgba(255,255,255,0.02); }
  tbody tr.vr-row-amber { background: rgba(251,191,36,0.06); }
  tbody tr.vr-row-red   { background: rgba(244,63,94,0.08); }
  tbody tr.vr-row-amber:hover { background: rgba(251,191,36,0.11); }
  tbody tr.vr-row-red:hover   { background: rgba(244,63,94,0.13); }

  .vr-overdue-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 700;
    white-space: nowrap; margin-left: 6px; vertical-align: middle;
  }
  .vr-overdue-badge.amber { background: rgba(251,191,36,0.12); color: var(--amber); border: 1px solid rgba(251,191,36,0.3); }
  .vr-overdue-badge.red   { background: rgba(244,63,94,0.12);  color: var(--red);   border: 1px solid rgba(244,63,94,0.3); }

  .vr-num { font-family: var(--mono); font-size: 11px; color: var(--text3); }
  .vr-code { font-family: var(--mono); font-size: 12px; font-weight: 500; color: var(--accent); }
  .vr-date { font-family: var(--mono); font-size: 11.5px; color: var(--text2); }

  /* ── Badge ── */
  .vr-badge {
    display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 600; white-space: nowrap;
  }
  .vr-badge.new        { background: rgba(100,116,139,.1); color: var(--text3); border: 1px solid rgba(100,116,139,.22); }
  .vr-badge.connected  { background: rgba(16,185,129,.1); color: var(--green); border: 1px solid rgba(16,185,129,.25); }
  .vr-badge.testdrive  { background: rgba(0,217,255,.08); color: var(--accent); border: 1px solid rgba(0,217,255,.2); }
  .vr-badge.quotation  { background: rgba(251,191,36,.08); color: var(--amber); border: 1px solid rgba(251,191,36,.22); }
  .vr-badge.won        { background: rgba(16,185,129,.12); color: var(--green); border: 1px solid rgba(16,185,129,.3); }
  .vr-badge.lost       { background: rgba(244,63,94,.1); color: var(--red); border: 1px solid rgba(244,63,94,.25); }
  .vr-badge.default    { background: rgba(0,201,177,.08); color: var(--teal); border: 1px solid rgba(0,201,177,.2); }

  /* ── Empty & Loading ── */
  .vr-empty { text-align: center; padding: 64px 20px; color: var(--text3); }
  .vr-empty-icon { font-size: 40px; margin-bottom: 14px; opacity: .4; }
  .vr-empty-msg { font-size: 14px; }
  .vr-empty-msg strong { color: var(--text2); }

  .vr-skel-row td { padding: 14px 16px; }
  .vr-skel {
    height: 13px; border-radius: 4px;
    background: linear-gradient(90deg, var(--surface2) 0%, var(--border) 50%, var(--surface2) 100%);
    background-size: 200% 100%;
    animation: skel 1.6s infinite;
  }
  @keyframes skel { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  .vr-error {
    background: rgba(244,63,94,.08); border: 1px solid rgba(244,63,94,.22);
    color: var(--red); padding: 14px 18px; border-radius: 10px; margin-bottom: 20px;
    font-size: 13px; font-weight: 500;
  }

  /* ── Preview Modal ── */
  .vr-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.72); backdrop-filter: blur(4px);
    z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeIn .15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .vr-preview-modal {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 16px; width: 100%; max-width: 740px; max-height: 88vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,.6);
    animation: slideUp .18s ease;
  }
  @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .vr-pv-head {
    padding: 22px 24px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    flex-shrink: 0;
  }
  .vr-pv-name { font-size: 20px; font-weight: 800; letter-spacing: -.3px; }
  .vr-pv-code { font-family: var(--mono); font-size: 12px; color: var(--accent); margin-top: 4px; }
  .vr-pv-close {
    background: transparent; border: 1px solid var(--border); color: var(--text2);
    width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: all .15s;
  }
  .vr-pv-close:hover { background: rgba(244,63,94,.1); border-color: var(--red); color: var(--red); }

  .vr-pv-body { overflow-y: auto; padding: 22px 24px; flex: 1; display: flex; flex-direction: column; gap: 24px; }

  .vr-pv-section-title {
    font-size: 10px; font-weight: 700; color: var(--text3);
    text-transform: uppercase; letter-spacing: 1.2px;
    margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
  }
  .vr-pv-section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  .vr-pv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .vr-pv-field { display: flex; flex-direction: column; gap: 4px; }
  .vr-pv-field.full { grid-column: 1 / -1; }
  .vr-pv-field-label {
    font-size: 10px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: .8px;
  }
  .vr-pv-field-val {
    font-size: 13.5px; color: var(--text); background: var(--surface2);
    border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px;
    min-height: 38px; word-break: break-word; line-height: 1.5;
  }
  .vr-pv-field-val.mono { font-family: var(--mono); font-size: 12.5px; }

  /* ── Audit row inside preview ── */
  .vr-pv-audit { display: flex; flex-wrap: wrap; gap: 10px; }
  .vr-pv-audit-pill {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 12px; font-size: 12px;
  }
  .vr-pv-audit-pill .icon { font-size: 13px; }
  .vr-pv-audit-pill .name { color: var(--text); font-weight: 600; }
  .vr-pv-audit-pill .time { color: var(--text3); font-size: 11px; }
  .vr-pv-audit-pill.create .icon { color: #4ade80; }
  .vr-pv-audit-pill.edit   .icon { color: #fbbf24; }

  /* ── History timeline ── */
  .vr-pv-timeline { display: flex; flex-direction: column; gap: 0; }
  .vr-pv-tl-item { display: flex; gap: 14px; position: relative; padding-bottom: 18px; }
  .vr-pv-tl-item:last-child { padding-bottom: 0; }
  .vr-pv-tl-left { display: flex; flex-direction: column; align-items: center; width: 28px; flex-shrink: 0; }
  .vr-pv-tl-dot {
    width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center; font-size: 12px;
    flex-shrink: 0; background: var(--surface2);
  }
  .vr-pv-tl-dot.create { border-color: #4ade80; color: #4ade80; background: rgba(74,222,128,.08); }
  .vr-pv-tl-dot.update { border-color: #fbbf24; color: #fbbf24; background: rgba(251,191,36,.08); }
  .vr-pv-tl-dot.delete { border-color: var(--red); color: var(--red); background: rgba(244,63,94,.08); }
  .vr-pv-tl-line { flex: 1; width: 1px; background: var(--border); margin-top: 4px; }
  .vr-pv-tl-right { flex: 1; padding-top: 4px; }
  .vr-pv-tl-action { font-size: 13px; font-weight: 600; color: var(--text); }
  .vr-pv-tl-who { font-size: 12px; color: var(--text2); margin-top: 2px; }
  .vr-pv-tl-when { font-size: 11px; color: var(--text3); font-family: var(--mono); margin-top: 3px; }
  .vr-pv-tl-details { font-size: 11.5px; color: var(--text3); margin-top: 4px; font-style: italic; }
  .vr-pv-no-history { color: var(--text3); font-size: 13px; text-align: center; padding: 24px 0; }
  .vr-pv-hist-loading { color: var(--text3); font-size: 13px; text-align: center; padding: 18px 0; }
`;

// ─── Badge helpers ─────────────────────────────────────────────────────────────
function badgeClass(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (s.includes('new') || s.includes('attempted')) return 'new';
  if (s.includes('connected')) return 'connected';
  if (s.includes('test drive') || s.includes('demo')) return 'testdrive';
  if (s.includes('quotation')) return 'quotation';
  if (s.includes('delivered') || s.includes('won')) return 'won';
  if (s.includes('lost')) return 'lost';
  return 'default';
}
function tlDotClass(action: string) {
  if (action === 'create') return 'create';
  if (action === 'update') return 'update';
  if (action === 'delete') return 'delete';
  return '';
}
function tlIcon(action: string) {
  if (action === 'create') return '＋';
  if (action === 'update') return '✎';
  if (action === 'delete') return '✕';
  return '·';
}
function tlLabel(action: string) {
  if (action === 'create') return 'Visit Created';
  if (action === 'update') return 'Visit Updated';
  if (action === 'delete') return 'Visit Deleted';
  return action;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map(n => (
        <tr key={n} className="vr-skel-row">
          {[26, 88, 120, 110, 90, 160, 110, 90, 100, 60].map((w, i) => (
            <td key={i}><div className="vr-skel" style={{ width: w }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VisitReportPage() {
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('visit_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Preview
  const [previewVisit, setPreviewVisit] = useState<Visit | null>(null);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/v1/visits/report`, { headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}${txt ? ': ' + txt : ''}`);
      }
      const j = await res.json();
      setAllVisits(j.visits || []);
      setConnected(true);
    } catch (e: any) {
      console.error('fetch visits error:', e);
      setError(e?.message || 'Failed to load visits');
      setConnected(false);
      setAllVisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/health`);
        if (!mounted) return;
        setConnected(res.ok);
      } catch { if (!mounted) return; setConnected(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Preview & history ──────────────────────────────────────────────────────
  async function openPreview(visit: Visit) {
    setPreviewVisit(visit);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(
        `${API_BASE}/api/v1/activity-log?entity_type=visit&entity_id=${visit.id}`,
        { headers },
      );
      if (res.ok) {
        const j = await res.json();
        setHistory(j.logs || []);
      }
    } catch { /* silently ignore */ }
    finally { setHistoryLoading(false); }
  }

  function closePreview() { setPreviewVisit(null); setHistory([]); }

  // ── Debounced search ───────────────────────────────────────────────────────
  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(val), 200);
  }

  // ── Clear filters ──────────────────────────────────────────────────────────
  function clearFilters() {
    if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; }
    setSearchQuery('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    const searchInput = document.querySelector<HTMLInputElement>('input.vr-field[placeholder]');
    if (searchInput) searchInput.value = '';
  }

  // ── Filtered & sorted visits ──────────────────────────────────────────────
  const visits = useMemo(() => {
    let filtered = [...allVisits];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        (v.cust_name || '').toLowerCase().includes(q) ||
        (v.lead_cust_code || '').toLowerCase().includes(q) ||
        (v.salesperson_name || '').toLowerCase().includes(q) ||
        (v.vehicle || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus) filtered = filtered.filter(v => v.status === filterStatus);
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      filtered = filtered.filter(v => v.visit_date && new Date(v.visit_date).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime();
      filtered = filtered.filter(v => v.visit_date && new Date(v.visit_date).getTime() <= to);
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === 'visit_date') {
        aVal = a.visit_date ? new Date(a.visit_date).getTime() : 0;
        bVal = b.visit_date ? new Date(b.visit_date).getTime() : 0;
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [allVisits, searchQuery, filterStatus, filterDateFrom, filterDateTo, sortField, sortDir]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: visits.length,
    connected: visits.filter(v => (v.status || '').toLowerCase().includes('connected')).length,
    testDrive: visits.filter(v => (v.status || '').toLowerCase().includes('demo')).length,
    won: visits.filter(v => (v.status || '').toLowerCase().includes('won')).length,
  }), [visits]);

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  async function exportCSV() {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/visits/report/export/csv`, { headers });
      if (!res.ok) { alert('Export failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visit-report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('export error:', err); alert('Export failed'); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="vr-root">
      <style>{PAGE_STYLES}</style>

      <div className="vr-content">
        {/* Header */}
        <div className="vr-header">
          <div>
            <div className="vr-title">Visit Report</div>
            <div className="vr-subtitle">Track and analyze customer visits recorded via Create Visit Report</div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
            {connected === null ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Checking backend...</div>
            ) : connected ? (
              <div style={{ color: 'var(--teal)', fontSize: 13 }}>Backend: Connected</div>
            ) : (
              <div style={{ color: 'var(--red)', fontSize: 13 }}>Backend: Disconnected</div>
            )}
            <button type="button" className="vr-btn vr-btn-ghost"
              onClick={() => { fetchVisits(); (async () => { try { const r = await fetch(`${API_BASE}/api/v1/health`); setConnected(r.ok); } catch { setConnected(false); } })(); }}>
              Retry
            </button>
          </div>
        </div>

        {error && <div className="vr-error">⚠️ {error}</div>}

        {/* Filters */}
        <div className="vr-filters">
          <div className="vr-filters-label"><span>🔍</span> Filters</div>
          <div className="vr-filters-grid">
            <div className="vr-fg">
              <label className="vr-label">Search</label>
              <input className="vr-field" placeholder="Customer, code, salesperson..." onChange={handleSearch} />
            </div>
            <div className="vr-fg">
              <label className="vr-label">Status</label>
              <SearchableSelect fieldClass="vr-field" options={STATUSES} value={filterStatus} onChange={v => setFilterStatus(v)} emptyLabel="All statuses" accentColor="var(--accent)" />
            </div>
            <div className="vr-fg">
              <label className="vr-label">Date From</label>
              <input type="date" className="vr-field" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="vr-fg">
              <label className="vr-label">Date To</label>
              <input type="date" className="vr-field" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <button className="vr-btn-clear" onClick={clearFilters}>Clear All</button>
          </div>
        </div>

        {/* Stats */}
        <div className="vr-stats">
          <div className="vr-stat"><div className="vr-stat-label">Total Visits</div><div className="vr-stat-val accent">{stats.total}</div></div>
          <div className="vr-stat"><div className="vr-stat-label">Connected</div><div className="vr-stat-val green">{stats.connected}</div></div>
          <div className="vr-stat"><div className="vr-stat-label">Demos</div><div className="vr-stat-val teal">{stats.testDrive}</div></div>
          <div className="vr-stat"><div className="vr-stat-label">Won</div><div className="vr-stat-val amber">{stats.won}</div></div>
        </div>

        {/* Table */}
        <div className="vr-table-card">
          <div className="vr-table-header">
            <div>
              <div className="vr-table-title">
                {visits.length === allVisits.length ? `${allVisits.length} Total Visits` : `${visits.length} of ${allVisits.length} Visits`}
              </div>
              <div className="vr-table-sub">
                {filterStatus || searchQuery || filterDateFrom || filterDateTo ? 'Filtered results' : 'Complete visit records'}
              </div>
            </div>
            <div className="vr-table-actions">
              <button className="vr-btn vr-btn-ghost" onClick={exportCSV}>↓ Export CSV</button>
            </div>
          </div>

          <div className="vr-table-outer">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cust Code</th>
                  <th className={`sortable ${sortField === 'cust_name' ? `sorted ${sortDir}` : ''}`} onClick={() => handleSort('cust_name')}>Customer</th>
                  <th>Lead Type</th>
                  <th>Connect Date</th>
                  <th className={`sortable ${sortField === 'salesperson_name' ? `sorted ${sortDir}` : ''}`} onClick={() => handleSort('salesperson_name')}>Salesperson</th>
                  <th>Phone</th>
                  <th>Vehicle</th>
                  <th className={`sortable ${sortField === 'status' ? `sorted ${sortDir}` : ''}`} onClick={() => handleSort('status')}>Status</th>
                  <th className={`sortable ${sortField === 'visit_date' ? `sorted ${sortDir}` : ''}`} onClick={() => handleSort('visit_date')}>Visit Date</th>
                  <th>Next Action</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : visits.length === 0 ? (
                  <tr><td colSpan={11}>
                    <div className="vr-empty">
                      <div className="vr-empty-icon">📋</div>
                      <div className="vr-empty-msg">
                        {searchQuery || filterStatus || filterDateFrom || filterDateTo
                          ? <>No visits match your filters</>
                          : <>No visits recorded yet</>}
                      </div>
                    </div>
                  </td></tr>
                ) : (
                  visits.map((v, i) => {
                    const overdueDays = daysOverdue(v.next_action_date);
                    const rowCls = overdueDays >= 7 ? 'vr-row-red' : overdueDays > 0 ? 'vr-row-amber' : '';
                    const badgeCls = overdueDays >= 7 ? 'red' : 'amber';
                    return (
                      <tr key={v.id ?? i} className={rowCls}>
                        <td className="vr-num">{String(i + 1).padStart(2, '0')}</td>
                        <td className="vr-code">{v.lead_cust_code || '—'}</td>
                        <td style={{ fontWeight: 500 }}>{v.cust_name || '—'}</td>
                        <td>
                          {v.lead_type ? (
                            <span className={`vr-badge ${v.lead_type === 'Digital Lead' ? 'testdrive' : 'default'}`}>{v.lead_type}</span>
                          ) : '—'}
                        </td>
                        <td className="vr-date">{fmtDate(v.connect_date)}</td>
                        <td style={{ color: 'var(--text2)' }}>{v.salesperson_name || '—'}</td>
                        <td>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', color: 'var(--text2)' }}>{v.phone_no || '—'}</div>
                          {v.phone_no_2 && <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)', marginTop: 2 }}>{v.phone_no_2}</div>}
                        </td>
                        <td style={{ color: 'var(--text2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vehicle || '—'}</td>
                        <td><span className={`vr-badge ${badgeClass(v.status)}`}>{v.status || '—'}</span></td>
                        <td className="vr-date">{fmtDate(v.visit_date)}</td>
                        <td style={{ color: 'var(--text2)' }}>
                          {v.next_action || '—'}
                          {v.next_action_date && (
                            <span style={{ display: 'block', marginTop: 2, fontFamily: 'var(--mono)', fontSize: '11px', color: overdueDays > 0 ? (overdueDays >= 7 ? 'var(--red)' : 'var(--amber)') : 'var(--text3)' }}>
                              {fmtDate(v.next_action_date)}
                              {overdueDays > 0 && (
                                <span className={`vr-overdue-badge ${badgeCls}`}>
                                  {overdueDays}d overdue
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          <button className="vr-btn vr-btn-preview" onClick={() => openPreview(v)}>
                            👁 View
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
      </div>

      {/* ── Preview Modal ── */}
      {previewVisit && (
        <div className="vr-overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) closePreview(); }}>
          <div className="vr-preview-modal" role="dialog" aria-modal="true">

            {/* Head */}
            <div className="vr-pv-head">
              <div>
                <div className="vr-pv-name">{previewVisit.cust_name || 'Unknown Customer'}</div>
                <div className="vr-pv-code">{previewVisit.lead_cust_code || '—'} · Visit #{previewVisit.id}</div>
              </div>
              <button className="vr-pv-close" onClick={closePreview} aria-label="Close">✕</button>
            </div>

            {/* Body */}
            <div className="vr-pv-body">

              {/* ── Details ── */}
              <div>
                <div className="vr-pv-section-title">Visit Details</div>
                <div className="vr-pv-grid">
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Connect Date</div>
                    <div className="vr-pv-field-val mono">{fmtDate(previewVisit.connect_date)}</div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Visit Date</div>
                    <div className="vr-pv-field-val mono">{fmtDate(previewVisit.visit_date)}</div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Status</div>
                    <div className="vr-pv-field-val">
                      <span className={`vr-badge ${badgeClass(previewVisit.status)}`}>{previewVisit.status || '—'}</span>
                    </div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Lead Type</div>
                    <div className="vr-pv-field-val">
                      {previewVisit.lead_type ? (
                        <span className={`vr-badge ${previewVisit.lead_type === 'Digital Lead' ? 'testdrive' : 'default'}`}>{previewVisit.lead_type}</span>
                      ) : '—'}
                    </div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Salesperson</div>
                    <div className="vr-pv-field-val">{previewVisit.salesperson_name || '—'}</div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Vehicle</div>
                    <div className="vr-pv-field-val">{previewVisit.vehicle || '—'}</div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Phone No. 1</div>
                    <div className="vr-pv-field-val mono">{previewVisit.phone_no || '—'}</div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Phone No. 2</div>
                    <div className="vr-pv-field-val mono">{previewVisit.phone_no_2 || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>—</span>}</div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Next Action</div>
                    <div className="vr-pv-field-val">{previewVisit.next_action || '—'}</div>
                  </div>
                  <div className="vr-pv-field">
                    <div className="vr-pv-field-label">Next Action Date</div>
                    <div className="vr-pv-field-val mono">{fmtDate(previewVisit.next_action_date)}</div>
                  </div>
                  {previewVisit.note && (
                    <div className="vr-pv-field full">
                      <div className="vr-pv-field-label">Note</div>
                      <div className="vr-pv-field-val">{previewVisit.note}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Audit ── */}
              <div>
                <div className="vr-pv-section-title">Record Audit</div>
                <div className="vr-pv-audit">
                  <div className="vr-pv-audit-pill create">
                    <span className="icon">＋</span>
                    <span className="name">Added by {previewVisit.created_by_name || 'unknown'}</span>
                    <span className="time">{fmtDateTime(previewVisit.created_at)}</span>
                  </div>
                  {previewVisit.updated_by_name && (
                    <div className="vr-pv-audit-pill edit">
                      <span className="icon">✎</span>
                      <span className="name">Last edited by {previewVisit.updated_by_name}</span>
                      <span className="time">{fmtDateTime(previewVisit.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── History ── */}
              <div>
                <div className="vr-pv-section-title">Activity History</div>
                {historyLoading ? (
                  <div className="vr-pv-hist-loading">Loading history…</div>
                ) : history.length === 0 ? (
                  <div className="vr-pv-no-history">No activity history recorded for this visit.</div>
                ) : (
                  <div className="vr-pv-timeline">
                    {history.map((log, idx) => (
                      <div key={log.id} className="vr-pv-tl-item">
                        <div className="vr-pv-tl-left">
                          <div className={`vr-pv-tl-dot ${tlDotClass(log.action)}`}>{tlIcon(log.action)}</div>
                          {idx < history.length - 1 && <div className="vr-pv-tl-line" />}
                        </div>
                        <div className="vr-pv-tl-right">
                          <div className="vr-pv-tl-action">{tlLabel(log.action)}</div>
                          {log.performed_by_name && <div className="vr-pv-tl-who">by {log.performed_by_name}</div>}
                          <div className="vr-pv-tl-when">{fmtDateTime(log.performed_at)}</div>
                          {log.details && <div className="vr-pv-tl-details">{log.details}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
