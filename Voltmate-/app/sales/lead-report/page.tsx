'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: number;
  cust_code?: string;
  cust_name?: string;
  business?: string;
  phone_no?: string;
  phone_no_2?: string;
  lead_type?: string;
  connect_date?: string;
  location?: string;
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

type SortField = 'cust_name' | 'business' | 'lead_type' | 'connect_date';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

const LEAD_TYPES = ['Digital Lead', 'Non Digital Lead'];

const BUSINESS_CATEGORIES = [
  'Distribution & Logistics',
  'Water & Beverages',
  'FMCG & Grocery',
  'Passenger & Vehicles',
  'Construction & Hardware',
  'Specialty & Others',
];

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Courier+Prime:wght@400;700&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #09090b;
    --surface: #0d0e13;
    --surface2: #131419;
    --surface3: #18191f;
    --border: #1f2028;
    --border2: #28293a;
    --primary: #7c3aed;
    --primary-dim: rgba(124,58,237,0.08);
    --primary-glow: rgba(124,58,237,0.18);
    --emerald: #10b981;
    --sky: #0ea5e9;
    --amber: #f59e0b;
    --rose: #f43f5e;
    --text: #e4e6eb;
    --text2: #8b92a8;
    --text3: #4f5463;
    --mono: 'Courier Prime', monospace;
  }

  body {
    font-family: 'Plus Jakarta Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Layout ── */
  .lr-root { display: flex; flex-direction: column; min-height: 100vh; }
  .lr-content { padding: 32px 28px; flex: 1; max-width: 1680px; margin: 0 auto; width: 100%; }

  /* ── Header ── */
  .lr-header { margin-bottom: 28px; }
  .lr-title { font-size: 28px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 6px; }
  .lr-subtitle { font-size: 13.5px; color: var(--text2); }

  /* ── Filters Card ── */
  .lr-filters {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px 22px; margin-bottom: 20px;
  }
  .lr-filters-label {
    font-size: 11px; font-weight: 700; color: var(--text3);
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;
    display: flex; align-items: center; gap: 8px;
  }
  .lr-filters-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
    align-items: end;
  }
  .lr-fg { display: flex; flex-direction: column; }
  .lr-label {
    font-size: 10.5px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: .9px; margin-bottom: 6px;
  }
  .lr-field {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px;
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); padding: 8px 12px; border-radius: 7px; width: 100%;
    transition: border-color .15s, box-shadow .15s;
    appearance: none; -webkit-appearance: none;
  }
  .lr-field:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-dim); }
  .lr-field::placeholder { color: var(--text3); }
  select.lr-field {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 12 12'%3E%3Cpath fill='%234f5463' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
  }
  button.lr-field { border: 1px solid var(--border); }
  .lr-btn-clear {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12.5px; font-weight: 600;
    padding: 8px 16px; border-radius: 7px;
    border: 1px solid var(--border); background: transparent; color: var(--text2);
    cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  .lr-btn-clear:hover { border-color: var(--border2); color: var(--text); }

  /* ── Stats ── */
  .lr-stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .lr-stat {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 18px; flex: 1; min-width: 140px;
    transition: border-color .15s;
  }
  .lr-stat:hover { border-color: var(--border2); }
  .lr-stat-label {
    font-size: 10.5px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: .9px; margin-bottom: 7px;
  }
  .lr-stat-val { font-size: 24px; font-weight: 800; font-family: var(--mono); }
  .lr-stat-val.primary { color: var(--primary); }
  .lr-stat-val.emerald { color: var(--emerald); }
  .lr-stat-val.sky     { color: var(--sky); }
  .lr-stat-val.amber   { color: var(--amber); }

  /* ── Table Card ── */
  .lr-table-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .lr-table-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    flex-wrap: wrap; gap: 10px;
  }
  .lr-table-title { font-size: 14px; font-weight: 700; }
  .lr-table-sub { font-size: 11.5px; color: var(--text3); margin-top: 2px; }
  .lr-table-actions { display: flex; gap: 8px; }
  .lr-btn {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12.5px; font-weight: 600;
    padding: 7px 14px; border-radius: 7px; border: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: opacity .15s, box-shadow .15s, transform .1s; white-space: nowrap;
  }
  .lr-btn:active { transform: scale(0.97); }
  .lr-btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border); }
  .lr-btn-ghost:hover { border-color: var(--border2); color: var(--text); }
  .lr-btn-preview { background: rgba(14,165,233,.08); color: var(--sky); border: 1px solid rgba(14,165,233,.22); font-size: 12px; padding: 5px 12px; }
  .lr-btn-preview:hover { background: rgba(14,165,233,.14); }

  .lr-table-outer { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 900px; }
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
  th.sorted::after { opacity: 1; color: var(--primary); }
  th.sorted.asc::after { content: '↑'; }
  th.sorted.desc::after { content: '↓'; }

  td {
    padding: 13px 16px; color: var(--text); font-size: 13px;
    border-bottom: 1px solid rgba(31,32,40,0.6); vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .1s; }
  tbody tr:hover { background: rgba(255,255,255,0.02); }

  .lr-num { font-family: var(--mono); font-size: 11px; color: var(--text3); }
  .lr-code { font-family: var(--mono); font-size: 12px; font-weight: 700; color: var(--primary); }
  .lr-date { font-family: var(--mono); font-size: 11.5px; color: var(--text2); }

  /* ── Badge ── */
  .lr-badge {
    display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 600; white-space: nowrap;
  }
  .lr-badge.digital    { background: var(--primary-dim); color: var(--primary); border: 1px solid var(--primary-glow); }
  .lr-badge.nondigital { background: rgba(14,165,233,.08); color: var(--sky); border: 1px solid rgba(14,165,233,.2); }
  .lr-badge.default    { background: rgba(139,146,168,.08); color: var(--text2); border: 1px solid rgba(139,146,168,.18); }

  /* ── Empty & Loading ── */
  .lr-empty { text-align: center; padding: 64px 20px; color: var(--text3); }
  .lr-empty-icon { font-size: 40px; margin-bottom: 14px; opacity: .4; }
  .lr-empty-msg { font-size: 14px; }
  .lr-empty-msg strong { color: var(--text2); }

  .lr-skel-row td { padding: 14px 16px; }
  .lr-skel {
    height: 13px; border-radius: 4px;
    background: linear-gradient(90deg, var(--surface2) 0%, var(--border) 50%, var(--surface2) 100%);
    background-size: 200% 100%;
    animation: skel 1.6s infinite;
  }
  @keyframes skel { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  .lr-error {
    background: rgba(244,63,94,.08); border: 1px solid rgba(244,63,94,.22);
    color: var(--rose); padding: 14px 18px; border-radius: 10px; margin-bottom: 20px;
    font-size: 13px; font-weight: 500;
  }

  /* ── Preview Modal ── */
  .lr-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.72); backdrop-filter: blur(4px);
    z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeIn .15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .lr-preview-modal {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 16px; width: 100%; max-width: 740px; max-height: 88vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,.6);
    animation: slideUp .18s ease;
  }
  @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .lr-pv-head {
    padding: 22px 24px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    flex-shrink: 0;
  }
  .lr-pv-name { font-size: 20px; font-weight: 800; letter-spacing: -.3px; }
  .lr-pv-code { font-family: var(--mono); font-size: 12px; color: var(--primary); margin-top: 4px; }
  .lr-pv-close {
    background: transparent; border: 1px solid var(--border); color: var(--text2);
    width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: all .15s;
  }
  .lr-pv-close:hover { background: rgba(244,63,94,.1); border-color: var(--rose); color: var(--rose); }

  .lr-pv-body { overflow-y: auto; padding: 22px 24px; flex: 1; display: flex; flex-direction: column; gap: 24px; }

  .lr-pv-section-title {
    font-size: 10px; font-weight: 700; color: var(--text3);
    text-transform: uppercase; letter-spacing: 1.2px;
    margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
  }
  .lr-pv-section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  .lr-pv-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
  }
  .lr-pv-field { display: flex; flex-direction: column; gap: 4px; }
  .lr-pv-field.full { grid-column: 1 / -1; }
  .lr-pv-field-label {
    font-size: 10px; font-weight: 600; color: var(--text3);
    text-transform: uppercase; letter-spacing: .8px;
  }
  .lr-pv-field-val {
    font-size: 13.5px; color: var(--text); background: var(--surface2);
    border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px;
    min-height: 38px; word-break: break-word; line-height: 1.5;
  }
  .lr-pv-field-val.mono { font-family: var(--mono); font-size: 12.5px; }
  .lr-pv-field-val.muted { color: var(--text3); font-style: italic; }

  /* ── Audit row inside preview ── */
  .lr-pv-audit { display: flex; flex-wrap: wrap; gap: 10px; }
  .lr-pv-audit-pill {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 12px; font-size: 12px;
  }
  .lr-pv-audit-pill .icon { font-size: 13px; }
  .lr-pv-audit-pill .name { color: var(--text); font-weight: 600; }
  .lr-pv-audit-pill .time { color: var(--text3); font-size: 11px; }
  .lr-pv-audit-pill.create .icon { color: #4ade80; }
  .lr-pv-audit-pill.edit   .icon { color: #fbbf24; }

  /* ── History timeline ── */
  .lr-pv-timeline { display: flex; flex-direction: column; gap: 0; }
  .lr-pv-tl-item {
    display: flex; gap: 14px; position: relative; padding-bottom: 18px;
  }
  .lr-pv-tl-item:last-child { padding-bottom: 0; }
  .lr-pv-tl-left { display: flex; flex-direction: column; align-items: center; width: 28px; flex-shrink: 0; }
  .lr-pv-tl-dot {
    width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border);
    display: flex; align-items: center; justify-content: center; font-size: 12px;
    flex-shrink: 0; background: var(--surface2);
  }
  .lr-pv-tl-dot.create { border-color: #4ade80; color: #4ade80; background: rgba(74,222,128,.08); }
  .lr-pv-tl-dot.update { border-color: #fbbf24; color: #fbbf24; background: rgba(251,191,36,.08); }
  .lr-pv-tl-dot.delete { border-color: var(--rose); color: var(--rose); background: rgba(244,63,94,.08); }
  .lr-pv-tl-line {
    flex: 1; width: 1px; background: var(--border); margin-top: 4px;
  }
  .lr-pv-tl-right { flex: 1; padding-top: 4px; }
  .lr-pv-tl-action { font-size: 13px; font-weight: 600; color: var(--text); }
  .lr-pv-tl-who { font-size: 12px; color: var(--text2); margin-top: 2px; }
  .lr-pv-tl-when { font-size: 11px; color: var(--text3); font-family: var(--mono); margin-top: 3px; }
  .lr-pv-tl-details { font-size: 11.5px; color: var(--text3); margin-top: 4px; font-style: italic; }
  .lr-pv-no-history { color: var(--text3); font-size: 13px; text-align: center; padding: 24px 0; }
  .lr-pv-hist-loading { color: var(--text3); font-size: 13px; text-align: center; padding: 18px 0; }
`;

// ─── Badge helpers ─────────────────────────────────────────────────────────────
function leadBadgeClass(type = ''): string {
  if (type === 'Digital Lead') return 'digital';
  if (type === 'Non Digital Lead') return 'nondigital';
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
  if (action === 'create') return 'Lead Created';
  if (action === 'update') return 'Lead Updated';
  if (action === 'delete') return 'Lead Deleted';
  return action;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map(n => (
        <tr key={n} className="lr-skel-row">
          {[26, 88, 130, 150, 100, 110, 100, 90, 60].map((w, i) => (
            <td key={i}><div className="lr-skel" style={{ width: w }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LeadReportPage() {
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBusiness, setFilterBusiness] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('connect_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Preview
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/v1/leads`, { headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}${txt ? ': ' + txt : ''}`);
      }
      const j = await res.json();
      setAllLeads(j.leads || []);
      setConnected(true);
    } catch (e: any) {
      console.error('fetch leads error:', e);
      setError(e?.message || 'Failed to load leads');
      setConnected(false);
      setAllLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
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
  async function openPreview(lead: Lead) {
    setPreviewLead(lead);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(
        `${API_BASE}/api/v1/activity-log?entity_type=lead&entity_id=${lead.id}`,
        { headers },
      );
      if (res.ok) {
        const j = await res.json();
        setHistory(j.logs || []);
      }
    } catch { /* silently ignore */ }
    finally { setHistoryLoading(false); }
  }

  function closePreview() { setPreviewLead(null); setHistory([]); }

  // ── Debounced search ───────────────────────────────────────────────────────
  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(val), 200);
  }

  // ── Clear filters ──────────────────────────────────────────────────────────
  function clearFilters() {
    setSearchQuery('');
    setFilterType('');
    setFilterBusiness('');
    setFilterDateFrom('');
    setFilterDateTo('');
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.lr-field');
    inputs.forEach(inp => { inp.value = ''; });
  }

  // ── Filtered & sorted leads ───────────────────────────────────────────────
  const leads = useMemo(() => {
    let filtered = [...allLeads];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        (l.cust_name || '').toLowerCase().includes(q) ||
        (l.cust_code || '').toLowerCase().includes(q) ||
        (l.business || '').toLowerCase().includes(q) ||
        (l.phone_no || '').toLowerCase().includes(q)
      );
    }
    if (filterType)     filtered = filtered.filter(l => l.lead_type === filterType);
    if (filterBusiness) filtered = filtered.filter(l => (l.business || '').toLowerCase().includes(filterBusiness.toLowerCase()));
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      filtered = filtered.filter(l => l.connect_date && new Date(l.connect_date).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime();
      filtered = filtered.filter(l => l.connect_date && new Date(l.connect_date).getTime() <= to);
    }

    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === 'connect_date') {
        aVal = a.connect_date ? new Date(a.connect_date).getTime() : 0;
        bVal = b.connect_date ? new Date(b.connect_date).getTime() : 0;
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [allLeads, searchQuery, filterType, filterBusiness, filterDateFrom, filterDateTo, sortField, sortDir]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: leads.length,
      digital: leads.filter(l => l.lead_type === 'Digital Lead').length,
      nonDigital: leads.filter(l => l.lead_type === 'Non Digital Lead').length,
      thisMonth: leads.filter(l => {
        if (!l.connect_date) return false;
        const d = new Date(l.connect_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    };
  }, [leads]);

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  async function exportCSV() {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/v1/leads/export/csv`, { headers });
      if (!res.ok) { alert('Export failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lead-report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('export error:', err); alert('Export failed'); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="lr-root">
      <style>{PAGE_STYLES}</style>

      <div className="lr-content">
        {/* Header */}
        <div className="lr-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="lr-title">Lead Report</div>
            <div className="lr-subtitle">Complete overview of all leads recorded in the system</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {connected === null ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Checking backend...</div>
            ) : connected ? (
              <div style={{ color: 'var(--emerald)', fontSize: 13 }}>Backend: Connected</div>
            ) : (
              <div style={{ color: 'var(--rose)', fontSize: 13 }}>Backend: Disconnected</div>
            )}
            <button
              type="button"
              className="lr-btn lr-btn-ghost"
              onClick={() => { fetchLeads(); (async () => { try { const r = await fetch(`${API_BASE}/api/v1/health`); setConnected(r.ok); } catch { setConnected(false); } })(); }}
            >
              Retry
            </button>
          </div>
        </div>

        {error && <div className="lr-error">⚠️ {error}</div>}

        {/* Filters */}
        <div className="lr-filters">
          <div className="lr-filters-label"><span>🔍</span> Filters</div>
          <div className="lr-filters-grid">
            <div className="lr-fg">
              <label className="lr-label">Search</label>
              <input className="lr-field" placeholder="Name, code, business, phone..." onChange={handleSearch} />
            </div>
            <div className="lr-fg">
              <label className="lr-label">Lead Type</label>
              <select className="lr-field" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All types</option>
                {LEAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="lr-fg">
              <label className="lr-label">Business Category</label>
              <SearchableSelect fieldClass="lr-field" options={BUSINESS_CATEGORIES} value={filterBusiness} onChange={v => setFilterBusiness(v)} emptyLabel="All categories" accentColor="var(--primary)" />
            </div>
            <div className="lr-fg">
              <label className="lr-label">Date From</label>
              <input type="date" className="lr-field" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="lr-fg">
              <label className="lr-label">Date To</label>
              <input type="date" className="lr-field" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <button className="lr-btn-clear" onClick={clearFilters}>Clear All</button>
          </div>
        </div>

        {/* Stats */}
        <div className="lr-stats">
          <div className="lr-stat"><div className="lr-stat-label">Total Leads</div><div className="lr-stat-val primary">{stats.total}</div></div>
          <div className="lr-stat"><div className="lr-stat-label">Digital Leads</div><div className="lr-stat-val emerald">{stats.digital}</div></div>
          <div className="lr-stat"><div className="lr-stat-label">Non-Digital</div><div className="lr-stat-val sky">{stats.nonDigital}</div></div>
          <div className="lr-stat"><div className="lr-stat-label">This Month</div><div className="lr-stat-val amber">{stats.thisMonth}</div></div>
        </div>

        {/* Table */}
        <div className="lr-table-card">
          <div className="lr-table-header">
            <div>
              <div className="lr-table-title">
                {leads.length === allLeads.length ? `${allLeads.length} Total Leads` : `${leads.length} of ${allLeads.length} Leads`}
              </div>
              <div className="lr-table-sub">
                {searchQuery || filterType || filterBusiness || filterDateFrom || filterDateTo ? 'Filtered results' : 'Complete lead pipeline'}
              </div>
            </div>
            <div className="lr-table-actions">
              <button className="lr-btn lr-btn-ghost" onClick={exportCSV}>↓ Export CSV</button>
            </div>
          </div>

          <div className="lr-table-outer">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cust Code</th>
                  <th className={`sortable ${sortField === 'cust_name' ? `sorted ${sortDir}` : ''}`} onClick={() => handleSort('cust_name')}>Customer Name</th>
                  <th className={`sortable ${sortField === 'business' ? `sorted ${sortDir}` : ''}`} onClick={() => handleSort('business')}>Business</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th className={`sortable ${sortField === 'lead_type' ? `sorted ${sortDir}` : ''}`} onClick={() => handleSort('lead_type')}>Lead Type</th>
                  <th className={`sortable ${sortField === 'connect_date' ? `sorted ${sortDir}` : ''}`} onClick={() => handleSort('connect_date')}>Connect Date</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : leads.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="lr-empty">
                      <div className="lr-empty-icon">📋</div>
                      <div className="lr-empty-msg">
                        {searchQuery || filterType || filterBusiness || filterDateFrom || filterDateTo
                          ? <>No leads match your filters</>
                          : <>No leads recorded yet</>}
                      </div>
                    </div>
                  </td></tr>
                ) : (
                  leads.map((l, i) => (
                    <tr key={l.id ?? i}>
                      <td className="lr-num">{String(i + 1).padStart(2, '0')}</td>
                      <td className="lr-code">{l.cust_code || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{l.cust_name || '—'}</td>
                      <td style={{ color: 'var(--text2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.business || '—'}</td>
                      <td>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', color: 'var(--text2)' }}>{l.phone_no || '—'}</div>
                        {l.phone_no_2 && <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)', marginTop: 2 }}>{l.phone_no_2}</div>}
                      </td>
                      <td style={{ color: 'var(--text2)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.location || '—'}</td>
                      <td><span className={`lr-badge ${leadBadgeClass(l.lead_type)}`}>{l.lead_type || '—'}</span></td>
                      <td className="lr-date">{fmtDate(l.connect_date)}</td>
                      <td>
                        <button className="lr-btn lr-btn-preview" onClick={() => openPreview(l)}>
                          👁 View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {previewLead && (
        <div className="lr-overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) closePreview(); }}>
          <div className="lr-preview-modal" role="dialog" aria-modal="true">

            {/* Head */}
            <div className="lr-pv-head">
              <div>
                <div className="lr-pv-name">{previewLead.cust_name || 'Unnamed Customer'}</div>
                <div className="lr-pv-code">{previewLead.cust_code || '—'}</div>
              </div>
              <button className="lr-pv-close" onClick={closePreview} aria-label="Close">✕</button>
            </div>

            {/* Body */}
            <div className="lr-pv-body">

              {/* ── Details ── */}
              <div>
                <div className="lr-pv-section-title">Lead Details</div>
                <div className="lr-pv-grid">
                  <div className="lr-pv-field">
                    <div className="lr-pv-field-label">Connect Date</div>
                    <div className="lr-pv-field-val mono">{fmtDate(previewLead.connect_date)}</div>
                  </div>
                  <div className="lr-pv-field">
                    <div className="lr-pv-field-label">Lead Type</div>
                    <div className="lr-pv-field-val">
                      <span className={`lr-badge ${leadBadgeClass(previewLead.lead_type)}`}>{previewLead.lead_type || '—'}</span>
                    </div>
                  </div>
                  <div className="lr-pv-field full">
                    <div className="lr-pv-field-label">Business</div>
                    <div className="lr-pv-field-val">{previewLead.business || <span className="muted">—</span>}</div>
                  </div>
                  <div className="lr-pv-field">
                    <div className="lr-pv-field-label">Phone No. 1</div>
                    <div className="lr-pv-field-val mono">{previewLead.phone_no || '—'}</div>
                  </div>
                  <div className="lr-pv-field">
                    <div className="lr-pv-field-label">Phone No. 2</div>
                    <div className="lr-pv-field-val mono">{previewLead.phone_no_2 || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>—</span>}</div>
                  </div>
                  <div className="lr-pv-field full">
                    <div className="lr-pv-field-label">Location</div>
                    <div className="lr-pv-field-val">{previewLead.location || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>—</span>}</div>
                  </div>
                  {previewLead.note && (
                    <div className="lr-pv-field full">
                      <div className="lr-pv-field-label">Note</div>
                      <div className="lr-pv-field-val">{previewLead.note}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Audit ── */}
              <div>
                <div className="lr-pv-section-title">Record Audit</div>
                <div className="lr-pv-audit">
                  {previewLead.created_by_name ? (
                    <div className="lr-pv-audit-pill create">
                      <span className="icon">＋</span>
                      <span className="name">Added by {previewLead.created_by_name}</span>
                      <span className="time">{fmtDateTime(previewLead.created_at)}</span>
                    </div>
                  ) : (
                    <div className="lr-pv-audit-pill create">
                      <span className="icon">＋</span>
                      <span className="name" style={{ color: 'var(--text3)' }}>Added by unknown</span>
                      <span className="time">{fmtDateTime(previewLead.created_at)}</span>
                    </div>
                  )}
                  {previewLead.updated_by_name && (
                    <div className="lr-pv-audit-pill edit">
                      <span className="icon">✎</span>
                      <span className="name">Last edited by {previewLead.updated_by_name}</span>
                      <span className="time">{fmtDateTime(previewLead.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── History ── */}
              <div>
                <div className="lr-pv-section-title">Activity History</div>
                {historyLoading ? (
                  <div className="lr-pv-hist-loading">Loading history…</div>
                ) : history.length === 0 ? (
                  <div className="lr-pv-no-history">No activity history recorded for this lead.</div>
                ) : (
                  <div className="lr-pv-timeline">
                    {history.map((log, idx) => (
                      <div key={log.id} className="lr-pv-tl-item">
                        <div className="lr-pv-tl-left">
                          <div className={`lr-pv-tl-dot ${tlDotClass(log.action)}`}>{tlIcon(log.action)}</div>
                          {idx < history.length - 1 && <div className="lr-pv-tl-line" />}
                        </div>
                        <div className="lr-pv-tl-right">
                          <div className="lr-pv-tl-action">{tlLabel(log.action)}</div>
                          {log.performed_by_name && <div className="lr-pv-tl-who">by {log.performed_by_name}</div>}
                          <div className="lr-pv-tl-when">{fmtDateTime(log.performed_at)}</div>
                          {log.details && <div className="lr-pv-tl-details">{log.details}</div>}
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
