'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import { labelForContact, labelForDeferral } from '@/lib/crmDeferral';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Visit {
  id: number;
  lead_id?: number;
  lead_cust_code?: string;
  cust_name?: string;
  /** Lead address/location from `leads.location` (joined on report API). */
  lead_location?: string | null;
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
  lost_not_interested_reason?: string | null;
  lost_reason_notes?: string | null;
  is_hot_lead?: boolean;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
  /** Latest linked location ping timestamp for this visit (CRM GPS). */
  visit_location_captured_at?: string | null;
  deferral_bucket?: string | null;
  deferral_notes?: string | null;
  follow_up_after_date?: string | null;
  earliest_purchase_intent_date?: string | null;
  contact_disposition?: string | null;
  callback_requested_at?: string | null;
  customer_promised_callback?: boolean;
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

const VISIT_PIPELINE_STATUSES = [
  // Restricted statuses (Lost*, Loan Processing, ...) are hidden unless "Show lost / closed" is on.
  'New Lead',
  'Attempted Contact',
  'Connected',
  'Requirement Identified',
  'Qualified Lead',
  'Demo Scheduled',
  'Demo Completed',
  'Quotation Shared',
  'Catalogue Shared',
  'Demo Follow Up',
  'Follow-Up 2',
  'Negotiation',
  'Booking Date Confirmed',
];

const VISIT_LOST_CLOSED_EXTRA = [
  'Lost \u2013 Price Issue',
  'Lost \u2013 Competitor',
  'Lost \u2013 No Response',
  'Lost \u2013 Not Interested',
  'Loan Processing',
  'Booking Amount Received',
  'Order Confirmed',
  'Delivery Scheduled',
  'Delivered (Closed \u2013 Won)',
] as const;

const VISIT_EXTENDED_STATUSES = [...VISIT_PIPELINE_STATUSES, ...VISIT_LOST_CLOSED_EXTRA];

/** Matches backend `exportVisibleVisitsCSV` column order */
const VISIT_REPORT_CSV_COLUMNS = [
  'id',
  'lead_cust_code',
  'lead_type',
  'connect_date',
  'cust_name',
  'lead_location',
  'phone_no',
  'phone_no_2',
  'salesperson_name',
  'vehicle',
  'status',
  'visit_date',
  'next_action',
  'next_action_date',
  'note',
  'lost_not_interested_reason',
  'lost_reason_notes',
  'deferral_bucket',
  'deferral_notes',
  'follow_up_after_date',
  'earliest_purchase_intent_date',
  'contact_disposition',
  'callback_requested_at',
  'customer_promised_callback',
  'is_hot_lead',
  'visit_location_captured_at',
  'created_by_name',
  'created_at',
  'updated_by_name',
  'updated_at',
] as const;

const LOST_NI_REASON_LABELS: Record<string, string> = {
  budget: 'Budget / affordability',
  timing: 'Timing — not ready to buy',
  product_fit: 'Product fit / specs mismatch',
  range_anxiety: 'Range / charging concerns',
  prefers_ice: 'Prefers ICE / not convinced on EV',
  chose_competitor: 'Chose a competitor',
  family_decision: 'Family / stakeholder decision',
  other: 'Other',
};

function formatLostNiSummary(v: Visit): string {
  if (!v.lost_not_interested_reason) return '—';
  const label = LOST_NI_REASON_LABELS[v.lost_not_interested_reason] ?? v.lost_not_interested_reason;
  if (v.lost_not_interested_reason === 'other' && v.lost_reason_notes?.trim()) {
    const t = v.lost_reason_notes.trim();
    return `${label}: ${t.slice(0, 56)}${t.length > 56 ? '…' : ''}`;
  }
  return label;
}

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}


function fmtDateTime(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────
const BADGE_BASE = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap border';

function badgeClasses(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (s.includes('new') || s.includes('attempted'))
    return `${BADGE_BASE} bg-slate-500/10 text-zinc-500 border-slate-500/20`;
  if (s.includes('connected'))
    return `${BADGE_BASE} bg-emerald-500/10 text-green-500 border-emerald-500/25`;
  if (s.includes('test drive') || s.includes('demo'))
    return `${BADGE_BASE} bg-cyan-400/[0.08] text-cyan-400 border-cyan-400/20`;
  if (s.includes('quotation') || s.includes('catalogue'))
    return `${BADGE_BASE} bg-amber-400/[0.08] text-amber-400 border-amber-400/[0.22]`;
  if (s.includes('delivered') || s.includes('won'))
    return `${BADGE_BASE} bg-emerald-500/[0.12] text-green-500 border-emerald-500/30`;
  if (s.includes('lost'))
    return `${BADGE_BASE} bg-rose-500/10 text-rose-500 border-rose-500/25`;
  return `${BADGE_BASE} bg-teal-400/[0.08] text-teal-400 border-teal-400/20`;
}

const QUOTATION_BADGE = `${BADGE_BASE} bg-amber-400/[0.08] text-amber-400 border-amber-400/[0.22]`;

function tlDotClasses(action: string): string {
  const base = 'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0';
  if (action === 'create') return `${base} border-green-400 text-green-400 bg-green-400/[0.08]`;
  if (action === 'update') return `${base} border-amber-400 text-amber-400 bg-amber-400/[0.08]`;
  if (action === 'delete') return `${base} border-rose-500 text-rose-500 bg-rose-500/[0.08]`;
  return `${base} border-zinc-700 text-zinc-500 bg-zinc-800`;
}

function tlIcon(action: string) {
  if (action === 'create') return '＋';
  if (action === 'update') return 'Edit';
  if (action === 'delete') return 'Del';
  return '·';
}
function tlLabel(action: string) {
  if (action === 'create') return 'Visit Created';
  if (action === 'update') return 'Visit Updated';
  if (action === 'delete') return 'Visit Deleted';
  return action;
}

// ─── Shared class constants ────────────────────────────────────────────────────
const FIELD_CLS =
  'font-sans text-[13px] bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-[7px] w-full transition-[border-color,box-shadow] duration-150 appearance-none focus:outline-none focus:border-cyan-400 focus:ring-[3px] focus:ring-cyan-400/10 placeholder:text-zinc-500';

const TH_BASE =
  'px-4 py-[11px] text-left text-[10px] font-bold uppercase tracking-[1px] whitespace-nowrap border-b border-zinc-800 select-none';
const TH_SORT = `${TH_BASE} cursor-pointer transition-colors duration-150 hover:text-zinc-400`;

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map(n => (
        <tr key={n}>
          {[26, 88, 120, 110, 140, 90, 160, 52, 120, 110, 90, 100, 95, 88, 100, 85, 70, 60].map((w, i) => (
            <td key={i} className="px-4 py-3.5">
              <div className="h-[13px] rounded animate-pulse bg-zinc-800" style={{ width: w }} />
            </td>
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
  const [includeLost, setIncludeLost] = useState(false);
  const [filterHot, setFilterHot] = useState<'all' | 'hot' | 'not_hot'>('all');

  const statusFilterOptions = useMemo(
    () => (includeLost ? VISIT_EXTENDED_STATUSES : VISIT_PIPELINE_STATUSES),
    [includeLost],
  );

  // Sorting
  const [sortField, setSortField] = useState<SortField>('visit_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Preview
  const [previewVisit, setPreviewVisit] = useState<Visit | null>(null);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchVisits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const qs = new URLSearchParams({ limit: '100000' });
      if (includeLost) qs.set('include_lost', '1');

      const res = await fetch(`${API_BASE}/api/v1/visits/report?${qs}`, { headers });
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
  }, [includeLost]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);
  useEffect(() => {
    const opts = includeLost ? VISIT_EXTENDED_STATUSES : VISIT_PIPELINE_STATUSES;
    if (filterStatus && !opts.includes(filterStatus)) setFilterStatus('');
  }, [includeLost, filterStatus]);
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
    setFilterHot('all');
    if (searchInputRef.current) searchInputRef.current.value = '';
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
        (v.vehicle || '').toLowerCase().includes(q) ||
        (v.lead_location || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus) filtered = filtered.filter(v => v.status === filterStatus);
    if (filterHot === 'hot') filtered = filtered.filter(v => !!v.is_hot_lead);
    if (filterHot === 'not_hot') filtered = filtered.filter(v => !v.is_hot_lead);
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
  }, [allVisits, searchQuery, filterStatus, filterHot, filterDateFrom, filterDateTo, sortField, sortDir]);

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

  function csvVisitReportCell(val: unknown): string {
    const s = val === null || val === undefined ? '' : String(val);
    return `"${s.replace(/"/g, '""')}"`;
  }

  function exportCSV() {
    if (visits.length === 0) {
      alert('No rows to export for the current filters.');
      return;
    }

    const headerLine = VISIT_REPORT_CSV_COLUMNS.join(',');
    const bodyLines = visits.map(v =>
      VISIT_REPORT_CSV_COLUMNS.map(col =>
        csvVisitReportCell((v as unknown as Record<string, unknown>)[col]),
      ).join(','),
    );
    const out = [headerLine, ...bodyLines].join('\n');

    const hasActiveFilters =
      !!searchQuery.trim() ||
      !!filterStatus ||
      filterHot !== 'all' ||
      !!filterDateFrom ||
      !!filterDateTo;

    const blob = new Blob(['\uFEFF' + out], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const suffix = hasActiveFilters ? '_filtered' : '';
    a.download = `visit-report_${new Date().toISOString().slice(0, 10)}${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 150);
  }

  // ── Sort th helper ─────────────────────────────────────────────────────────
  function thCls(field: SortField): string {
    return sortField === field ? `${TH_SORT} text-zinc-300` : `${TH_SORT} text-zinc-500`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">

      <div className="px-7 py-8 flex-1 max-w-[1680px] mx-auto w-full">
        {/* Header */}
        <div className="mb-7">
          <div>
            <div className="text-[28px] font-extrabold tracking-tight mb-1.5 text-zinc-100">Visit Report</div>
            <div className="text-[13.5px] text-zinc-400">Track and analyze customer visits recorded via Create Visit Report</div>
          </div>
          <div className="mt-2 flex gap-3 items-center">
            {connected === null ? (
              <div className="text-zinc-500 text-[13px]">Checking backend...</div>
            ) : connected ? (
              <div className="text-teal-400 text-[13px]">Backend: Connected</div>
            ) : (
              <div className="text-rose-500 text-[13px]">Backend: Disconnected</div>
            )}
            <button
              type="button"
              className="font-sans text-[12.5px] font-semibold py-[7px] px-3.5 rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform] duration-150 whitespace-nowrap active:scale-[0.97] bg-transparent text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
              onClick={() => { fetchVisits(); (async () => { try { const r = await fetch(`${API_BASE}/api/v1/health`); setConnected(r.ok); } catch { setConnected(false); } })(); }}>
              Retry
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/[0.08] border border-rose-500/[0.22] text-rose-500 px-[18px] py-[14px] rounded-[10px] mb-5 text-[13px] font-medium">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-[22px] py-5 mb-5">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-[1px] mb-3.5 flex items-center gap-2">Filters</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-1.5">Search</label>
              <input
                ref={searchInputRef}
                className={FIELD_CLS}
                placeholder="Customer, code, location, salesperson..."
                onChange={handleSearch}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-1.5">Status</label>
              <SearchableSelect
                fieldClass={FIELD_CLS}
                options={statusFilterOptions}
                value={filterStatus}
                onChange={v => setFilterStatus(v)}
                emptyLabel="All statuses"
                accentColor="#00d9ff"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-1.5">Date From</label>
              <input type="date" className={FIELD_CLS} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-1.5">Date To</label>
              <input type="date" className={FIELD_CLS} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-1.5">Hot lead</label>
              <select className={FIELD_CLS} value={filterHot} onChange={e => setFilterHot(e.target.value as 'all' | 'hot' | 'not_hot')}>
                <option value="all">All</option>
                <option value="hot">Hot only</option>
                <option value="not_hot">Not hot</option>
              </select>
            </div>
            <div className="flex flex-col justify-end min-w-[200px]">
              <label className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-1.5">Report scope</label>
              <label className="flex items-center gap-2.5 text-[13px] text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeLost}
                  onChange={e => setIncludeLost(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-cyan-400"
                />
                Include lost &amp; closed
              </label>
            </div>
            <button
              className="font-sans text-[12.5px] font-semibold px-4 py-2 rounded-[7px] border border-zinc-800 bg-transparent text-zinc-400 cursor-pointer transition-all duration-150 whitespace-nowrap hover:border-zinc-700 hover:text-zinc-200"
              onClick={clearFilters}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[10px] px-[18px] py-[14px] flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-zinc-700">
            <div className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-[7px]">Total Visits</div>
            <div className="text-2xl font-extrabold font-mono text-cyan-400">{stats.total}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[10px] px-[18px] py-[14px] flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-zinc-700">
            <div className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-[7px]">Connected</div>
            <div className="text-2xl font-extrabold font-mono text-green-500">{stats.connected}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[10px] px-[18px] py-[14px] flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-zinc-700">
            <div className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-[7px]">Demos</div>
            <div className="text-2xl font-extrabold font-mono text-teal-400">{stats.testDrive}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[10px] px-[18px] py-[14px] flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-zinc-700">
            <div className="text-[10.5px] font-semibold text-zinc-500 uppercase tracking-[0.9px] mb-[7px]">Won</div>
            <div className="text-2xl font-extrabold font-mono text-amber-400">{stats.won}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-wrap gap-2.5">
            <div>
              <div className="text-sm font-bold text-zinc-100">
                {visits.length === allVisits.length ? `${allVisits.length} Total Visits` : `${visits.length} of ${allVisits.length} Visits`}
              </div>
              <div className="text-[11.5px] text-zinc-500 mt-0.5">
                {filterStatus || searchQuery || filterDateFrom || filterDateTo || filterHot !== 'all' ? 'Filtered results' : 'Complete visit records'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="font-sans text-[12.5px] font-semibold py-[7px] px-3.5 rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform] duration-150 whitespace-nowrap active:scale-[0.97] bg-transparent text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                onClick={exportCSV}
              >
                ↓ Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1280px]">
              <thead>
                <tr className="bg-zinc-800/40">
                  <th className={`${TH_BASE} text-zinc-500`}>#</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Cust Code</th>
                  <th className={thCls('cust_name')} onClick={() => handleSort('cust_name')}>
                    Customer {sortField === 'cust_name' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className={`${TH_BASE} text-zinc-500`}>Lead Type</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Location</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Connect Date</th>
                  <th className={thCls('salesperson_name')} onClick={() => handleSort('salesperson_name')}>
                    Salesperson {sortField === 'salesperson_name' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className={`${TH_BASE} text-zinc-500`}>Phone</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Vehicle</th>
                  <th className={thCls('status')} onClick={() => handleSort('status')}>
                    Status {sortField === 'status' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className={`${TH_BASE} text-zinc-500`}>Hot</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Lost – NI</th>
                  <th className={thCls('visit_date')} onClick={() => handleSort('visit_date')}>
                    Visit Date {sortField === 'visit_date' && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className={`${TH_BASE} text-zinc-500`} title="GPS captured at save (visit-linked ping)">Visit GPS</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Buy window</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Callback</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Next Action</th>
                  <th className={`${TH_BASE} text-zinc-500`}>Preview</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : visits.length === 0 ? (
                  <tr><td colSpan={18}>
                    <div className="text-center py-16 px-5 text-zinc-500">
                      <div className="text-[40px] mb-3.5 opacity-40"></div>
                      <div className="text-sm">
                        {searchQuery || filterStatus || filterDateFrom || filterDateTo || filterHot !== 'all'
                          ? <>No visits match your filters</>
                          : <>No visits recorded yet</>}
                      </div>
                    </div>
                  </td></tr>
                ) : (
                  visits.map((v, i) => (
                    <tr key={v.id ?? i} className="transition-colors duration-100 hover:bg-white/[0.02] [&:last-child>td]:border-b-0">
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle font-mono text-[11px] text-zinc-500">{String(i + 1).padStart(2, '0')}</td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle font-mono text-xs font-medium text-cyan-400">{v.lead_cust_code || '—'}</td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-zinc-200 text-[13px] font-medium">{v.cust_name || '—'}</td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-[13px]">
                        {v.lead_type ? (
                          <span className={v.lead_type === 'Digital Lead' ? `${BADGE_BASE} bg-cyan-400/[0.08] text-cyan-400 border-cyan-400/20` : `${BADGE_BASE} bg-teal-400/[0.08] text-teal-400 border-teal-400/20`}>{v.lead_type}</span>
                        ) : '—'}
                      </td>
                      <td
                        className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-zinc-400 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
                        title={v.lead_location || undefined}
                      >
                        {v.lead_location?.trim() ? v.lead_location : '—'}
                      </td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle font-mono text-[11.5px] text-zinc-400">{fmtDate(v.connect_date)}</td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-zinc-400 text-[13px]">{v.salesperson_name || '—'}</td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-[13px]">
                        <div className="font-mono text-[11.5px] text-zinc-400">{v.phone_no || '—'}</div>
                        {v.phone_no_2 && <div className="font-mono text-[11px] text-zinc-500 mt-0.5">{v.phone_no_2}</div>}
                      </td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-zinc-400 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">{v.vehicle || '—'}</td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-[13px]">
                        <span className={badgeClasses(v.status)}>{v.status || '—'}</span>
                      </td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-center text-[13px]">
                        {v.is_hot_lead ? (
                          <span className={`${QUOTATION_BADGE} text-[10px]`}>Hot</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="px-4 py-[13px] border-b border-zinc-800/60 align-middle max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-zinc-400"
                        title={formatLostNiSummary(v)}
                      >
                        {formatLostNiSummary(v)}
                      </td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle font-mono text-[11.5px] text-zinc-400">{fmtDate(v.visit_date)}</td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-[11px] text-zinc-400 whitespace-nowrap">
                        {v.visit_location_captured_at ? (
                          <span className={`${QUOTATION_BADGE} text-[10px]`} title={fmtDateTime(v.visit_location_captured_at)}>
                            {fmtDateTime(v.visit_location_captured_at)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-[11px] text-zinc-400 max-w-[88px] overflow-hidden text-ellipsis whitespace-nowrap"
                        title={labelForDeferral(v.deferral_bucket)}
                      >
                        {labelForDeferral(v.deferral_bucket)}
                      </td>
                      <td
                        className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-[11px] text-zinc-400 max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap"
                        title={labelForContact(v.contact_disposition)}
                      >
                        {labelForContact(v.contact_disposition)}
                      </td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-zinc-400 text-[13px]">
                        {v.next_action || '—'}
                        {v.next_action_date && (
                          <span className="block mt-0.5 font-mono text-[11px] text-zinc-500">
                            {fmtDate(v.next_action_date)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-[13px] border-b border-zinc-800/60 align-middle text-[13px]">
                        <button
                          className="font-sans text-xs font-semibold py-[5px] px-3 rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform] duration-150 whitespace-nowrap active:scale-[0.97] bg-cyan-400/[0.06] text-cyan-400 border border-cyan-400/[0.22] hover:bg-cyan-400/[0.12]"
                          onClick={() => openPreview(v)}
                        >
                          View
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
      {previewVisit && (
        <div
          className="fixed inset-0 bg-black/[0.72] backdrop-blur-[4px] z-[1000] flex items-center justify-center p-5 animate-in fade-in duration-150"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) closePreview(); }}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-[740px] max-h-[88vh] flex flex-col overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-3 duration-200"
            role="dialog"
            aria-modal="true"
          >

            {/* Head */}
            <div className="px-6 pt-[22px] pb-[18px] border-b border-zinc-800 flex items-start justify-between gap-3 flex-shrink-0">
              <div>
                <div className="text-xl font-extrabold tracking-tight text-zinc-100">{previewVisit.cust_name || 'Unknown Customer'}</div>
                <div className="font-mono text-xs text-cyan-400 mt-1">{previewVisit.lead_cust_code || '—'} · Visit #{previewVisit.id}</div>
              </div>
              <button
                className="bg-transparent border border-zinc-800 text-zinc-400 w-8 h-8 rounded-lg cursor-pointer text-base flex items-center justify-center flex-shrink-0 transition-all duration-150 hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-500"
                onClick={closePreview}
                aria-label="Close"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-[22px] flex-1 flex flex-col gap-6">

              {/* ── Details ── */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[1.2px] mb-3.5 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-zinc-800">Visit Details</div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Connect Date</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">{fmtDate(previewVisit.connect_date)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Visit GPS captured</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">
                      {previewVisit.visit_location_captured_at ? fmtDateTime(previewVisit.visit_location_captured_at) : '—'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Buying timeframe</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{labelForDeferral(previewVisit.deferral_bucket)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Call outcome</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{labelForContact(previewVisit.contact_disposition)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Follow-up from</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">{fmtDate(previewVisit.follow_up_after_date)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Earliest purchase intent</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">{fmtDate(previewVisit.earliest_purchase_intent_date)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">They asked to call after</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">
                      {previewVisit.callback_requested_at ? fmtDateTime(previewVisit.callback_requested_at) : '—'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Customer promised callback</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.customer_promised_callback ? 'Yes' : 'No'}</div>
                  </div>
                  {previewVisit.deferral_notes?.trim() ? (
                    <div className="flex flex-col gap-1 col-span-2">
                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Timing / callback notes</div>
                      <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.deferral_notes}</div>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Visit Date</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">{fmtDate(previewVisit.visit_date)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Status</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">
                      <span className={badgeClasses(previewVisit.status)}>{previewVisit.status || '—'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Lead Type</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">
                      {previewVisit.lead_type ? (
                        <span className={previewVisit.lead_type === 'Digital Lead' ? `${BADGE_BASE} bg-cyan-400/[0.08] text-cyan-400 border-cyan-400/20` : `${BADGE_BASE} bg-teal-400/[0.08] text-teal-400 border-teal-400/20`}>{previewVisit.lead_type}</span>
                      ) : '—'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Lead location</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.lead_location?.trim() ? previewVisit.lead_location : '—'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Lead priority</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">
                      {previewVisit.is_hot_lead ? (
                        <span className={`${QUOTATION_BADGE} text-[11px]`}>Hot lead</span>
                      ) : (
                        <span className="text-zinc-500">Standard</span>
                      )}
                    </div>
                  </div>
                  {(previewVisit.lost_not_interested_reason || previewVisit.lost_reason_notes?.trim()) && (
                    <>
                      <div className="flex flex-col gap-1 col-span-2">
                        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Lost – Not interested</div>
                        <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{formatLostNiSummary(previewVisit)}</div>
                      </div>
                      {previewVisit.lost_reason_notes?.trim() &&
                        previewVisit.lost_not_interested_reason &&
                        previewVisit.lost_not_interested_reason !== 'other' && (
                          <div className="flex flex-col gap-1 col-span-2">
                            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Notes</div>
                            <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.lost_reason_notes}</div>
                          </div>
                        )}
                      {previewVisit.lost_not_interested_reason === 'other' && previewVisit.lost_reason_notes?.trim() && (
                        <div className="flex flex-col gap-1 col-span-2">
                          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Explanation</div>
                          <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.lost_reason_notes}</div>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Salesperson</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.salesperson_name || '—'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Vehicle</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.vehicle || '—'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Phone No. 1</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">{previewVisit.phone_no || '—'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Phone No. 2</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">{previewVisit.phone_no_2 || <span className="text-zinc-500 italic">—</span>}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Next Action</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.next_action || '—'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Next Action Date</div>
                    <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed font-mono text-[12.5px]">{fmtDate(previewVisit.next_action_date)}</div>
                  </div>
                  {previewVisit.note && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.8px]">Note</div>
                      <div className="text-[13.5px] text-zinc-200 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[9px] min-h-[38px] break-words leading-relaxed">{previewVisit.note}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Audit ── */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[1.2px] mb-3.5 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-zinc-800">Record Audit</div>
                <div className="flex flex-wrap gap-2.5">
                  <div className="flex items-center gap-1.5 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[7px] text-xs">
                    <span className="text-[13px] text-green-400">＋</span>
                    <span className="text-zinc-200 font-semibold">Added by {previewVisit.created_by_name || 'unknown'}</span>
                    <span className="text-zinc-500 text-[11px]">{fmtDateTime(previewVisit.created_at)}</span>
                  </div>
                  {previewVisit.updated_by_name && (
                    <div className="flex items-center gap-1.5 bg-zinc-800/40 border border-zinc-800 rounded-lg px-3 py-[7px] text-xs">
                      <span className="text-[13px] text-amber-400">Edit</span>
                      <span className="text-zinc-200 font-semibold">Last edited by {previewVisit.updated_by_name}</span>
                      <span className="text-zinc-500 text-[11px]">{fmtDateTime(previewVisit.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── History ── */}
              <div>
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[1.2px] mb-3.5 flex items-center gap-2 after:content-[''] after:flex-1 after:h-px after:bg-zinc-800">Activity History</div>
                {historyLoading ? (
                  <div className="text-zinc-500 text-[13px] text-center py-[18px]">Loading history…</div>
                ) : history.length === 0 ? (
                  <div className="text-zinc-500 text-[13px] text-center py-6">No activity history recorded for this visit.</div>
                ) : (
                  <div className="flex flex-col">
                    {history.map((log, idx) => (
                      <div key={log.id} className="flex gap-3.5 relative pb-[18px] last:pb-0">
                        <div className="flex flex-col items-center w-7 flex-shrink-0">
                          <div className={tlDotClasses(log.action)}>{tlIcon(log.action)}</div>
                          {idx < history.length - 1 && <div className="flex-1 w-px bg-zinc-800 mt-1" />}
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="text-[13px] font-semibold text-zinc-200">{tlLabel(log.action)}</div>
                          {log.performed_by_name && <div className="text-xs text-zinc-400 mt-0.5">by {log.performed_by_name}</div>}
                          <div className="text-[11px] text-zinc-500 font-mono mt-[3px]">{fmtDateTime(log.performed_at)}</div>
                          {log.details && <div className="text-[11.5px] text-zinc-500 mt-1 italic">{log.details}</div>}
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
