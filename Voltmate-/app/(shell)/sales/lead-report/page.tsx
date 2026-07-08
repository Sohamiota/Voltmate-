'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import PageHeader from '@/components/PageHeader';
import { useEffectiveSearch } from '@/components/SearchContext';
import { getBackNavigation, getBreadcrumbsForPath } from '@/lib/navigation';
import { labelForContact, labelForDeferral } from '@/lib/crmDeferral';
import { downloadXlsx, xlsDate, xlsDateTime, parseLocalDate, parseRecordDate } from '@/lib/exportXlsx';
import DatePickerField from '@/components/DatePickerField';

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
  deferral_bucket?: string | null;
  deferral_notes?: string | null;
  follow_up_after_date?: string | null;
  earliest_purchase_intent_date?: string | null;
  contact_disposition?: string | null;
  callback_requested_at?: string | null;
  customer_promised_callback?: boolean;
  /** Mirrors lead row; often updated when marking hot on a visit. */
  is_hot_lead?: boolean;
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
  'E-commerce',
  'Passenger & Vehicles',
  'Construction & Hardware',
  'Specialty & Others',
];

/** Maps each parent category to all its sub-types stored in the DB.
 *  Must stay in sync with the BUSINESS_OPTIONS in create-lead-report. */
const BUSINESS_SUBTYPES: Record<string, string[]> = {
  'Distribution & Logistics': [
    'Market Load', 'Super Stockist', 'Transport Business', 'Delivery Service',
    'Multipurpose Transport (Fruit / Veg / Ice Cream)', 'Neo Hi-Range (1.5–1.8 MT, Asansol–Kolkata)',
  ],
  'Water & Beverages': [
    'Mineral Water Distribution', 'Packaged Water Distribution',
    'Water Distribution – FMCG', 'Market Load – Water',
  ],
  'FMCG & Grocery': [
    'Chemical Distribution – FMCG', 'Flipkart Grocery',
    'Dairy Products', 'Egg Distributor / Poultry', 'Bakery',
  ],
  'E-commerce': [
    'Online retail / D2C', 'Marketplace seller (Amazon, Flipkart, etc.)',
    'Quick commerce / grocery delivery', 'Aggregator or logistics partner', 'Other e-commerce',
  ],
  'Passenger & Vehicles': ['Passenger Auto', 'Hi Capacity Passenger', 'Passenger Vehicles'],
  'Construction & Hardware': ['Construction', 'Hardware'],
  'Specialty & Others': ['Foreign Liquor', 'Neo Hi-Range'],
};

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
function leadBadgeClass(type = ''): string {
  if (type === 'Digital Lead') return 'bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20';
  if (type === 'Non Digital Lead') return 'bg-[#0ea5e9]/10 text-[#0ea5e9] border border-[#0ea5e9]/20';
  return 'bg-[#8b92a8]/10 text-[#8b92a8] border border-[#8b92a8]/20';
}

function tlDotClass(action: string): string {
  if (action === 'create') return 'border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10';
  if (action === 'update') return 'border-[#fbbf24] text-[#fbbf24] bg-[#fbbf24]/10';
  if (action === 'delete') return 'border-[#f43f5e] text-[#f43f5e] bg-[#f43f5e]/10';
  return 'border-[#1f2028] text-[#4f5463] bg-[#131419]';
}

function tlIcon(action: string) {
  if (action === 'create') return '＋';
  if (action === 'update') return 'Edit';
  if (action === 'delete') return 'Del';
  return '·';
}
function tlLabel(action: string) {
  if (action === 'create') return 'Lead Created';
  if (action === 'update') return 'Lead Updated';
  if (action === 'delete') return 'Lead Deleted';
  return action;
}

// ─── Shared class strings ─────────────────────────────────────────────────────
// lr-field kept as a bare marker class so clearFilters() querySelectorAll('.lr-field') continues to work
const FIELD_CLS =
  'lr-field font-sans text-[13px] bg-[#09090b] border border-[#1f2028] text-[#e4e6eb] px-3 py-2 rounded-[7px] w-full transition-[border-color,box-shadow] duration-150 appearance-none placeholder-[#4f5463] focus:outline-none focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[#7c3aed]/10';

const TH_BASE =
  'py-[11px] px-4 text-left text-[10px] font-bold text-[#4f5463] uppercase tracking-widest whitespace-nowrap border-b border-[#1f2028] select-none transition-colors duration-150 hover:text-[#8b92a8]';

const PV_FIELD_VAL =
  'text-[13.5px] text-[#e4e6eb] bg-[#131419] border border-[#1f2028] rounded-lg py-[9px] px-3 min-h-[38px] break-words leading-relaxed';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map(n => (
        <tr key={n}>
          {[26, 88, 130, 150, 100, 110, 100, 44, 88, 96, 90, 60].map((w, i) => (
            <td key={i} className="py-3.5 px-4 border-b border-[#1f2028]/60">
              <div className="h-[13px] rounded-sm bg-[#131419] animate-pulse" style={{ width: w }} />
            </td>
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
  const [filterHot, setFilterHot] = useState<'all' | 'hot' | 'not_hot'>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('connect_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Preview
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const searchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const effectiveSearch = useEffectiveSearch(searchQuery);

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
    } catch (e: unknown) {
      console.error('fetch leads error:', e);
      setError(e instanceof Error ? e.message : 'Failed to load leads');
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
    if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; }
    setSearchQuery('');
    setFilterType('');
    setFilterBusiness('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterHot('all');
    if (searchInputRef.current) searchInputRef.current.value = '';
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.lr-field');
    inputs.forEach(inp => { inp.value = ''; });
  }

  // ── Filtered & sorted leads ───────────────────────────────────────────────
  const leads = useMemo(() => {
    let filtered = [...allLeads];

    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase();
      filtered = filtered.filter(l =>
        (l.cust_name || '').toLowerCase().includes(q) ||
        (l.cust_code || '').toLowerCase().includes(q) ||
        (l.business || '').toLowerCase().includes(q) ||
        (l.phone_no || '').toLowerCase().includes(q)
      );
    }
    if (filterType) filtered = filtered.filter(l => l.lead_type === filterType);
    if (filterBusiness) {
      // Filter by parent category: check if the stored sub-type belongs to this category
      const subs = BUSINESS_SUBTYPES[filterBusiness] ?? [];
      filtered = filtered.filter(l =>
        subs.includes(l.business ?? '') ||
        (l.business ?? '').toLowerCase().includes(filterBusiness.toLowerCase()),
      );
    }
    if (filterDateFrom) {
      const from = parseLocalDate(filterDateFrom);
      filtered = filtered.filter(l => l.connect_date && parseRecordDate(l.connect_date) >= from);
    }
    if (filterDateTo) {
      const to = parseLocalDate(filterDateTo);
      filtered = filtered.filter(l => l.connect_date && parseRecordDate(l.connect_date) <= to);
    }
    if (filterHot === 'hot') filtered = filtered.filter(l => !!l.is_hot_lead);
    if (filterHot === 'not_hot') filtered = filtered.filter(l => !l.is_hot_lead);

    filtered.sort((a, b) => {
      const aVal: string | number = sortField === 'connect_date'
        ? (a.connect_date ? new Date(a.connect_date).getTime() : 0)
        : String(a[sortField] ?? '').toLowerCase();
      const bVal: string | number = sortField === 'connect_date'
        ? (b.connect_date ? new Date(b.connect_date).getTime() : 0)
        : String(b[sortField] ?? '').toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [allLeads, effectiveSearch, filterType, filterBusiness, filterDateFrom, filterDateTo, filterHot, sortField, sortDir]);

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
      hot: leads.filter(l => !!l.is_hot_lead).length,
    };
  }, [leads]);

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function exportCSV() {
    if (leads.length === 0) { alert('No rows to export for the current filters.'); return; }
    const rows = leads.map(l => ({
      'ID':                   l.id,
      'Cust Code':            l.cust_code ?? '',
      'Customer Name':        l.cust_name ?? '',
      'Business Type':        l.business ?? '',
      'Phone':                l.phone_no ?? '',
      'Phone 2':              l.phone_no_2 ?? '',
      'Lead Type':            l.lead_type ?? '',
      'Location':             l.location ?? '',
      'Connect Date':         xlsDate(l.connect_date),
      'Hot Lead':             l.is_hot_lead ? 'Yes' : 'No',
      'Note':                 l.note ?? '',
      'Deferral Bucket':      l.deferral_bucket ?? '',
      'Deferral Notes':       l.deferral_notes ?? '',
      'Follow Up After':      xlsDate(l.follow_up_after_date),
      'Earliest Purchase':    xlsDate(l.earliest_purchase_intent_date),
      'Contact Disposition':  l.contact_disposition ?? '',
      'Callback At':          xlsDateTime(l.callback_requested_at),
      'Promised Callback':    l.customer_promised_callback ? 'Yes' : 'No',
      'Created By':           l.created_by_name ?? '',
      'Created At':           xlsDateTime(l.created_at),
      'Updated By':           l.updated_by_name ?? '',
      'Updated At':           xlsDateTime(l.updated_at),
    }));
    const hasActiveFilters =
      !!searchQuery.trim() || !!filterType || !!filterBusiness ||
      !!filterDateFrom || !!filterDateTo || filterHot !== 'all';
    const suffix = hasActiveFilters ? '_filtered' : '';
    downloadXlsx(rows, `lead-report_${new Date().toISOString().slice(0, 10)}${suffix}`, 'Lead Report');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen">

      <div className="px-7 py-8 flex-1 max-w-[1680px] mx-auto w-full">

        {/* Header */}
        <div className="mb-7 flex items-start justify-between gap-3">
          <PageHeader
            variant="dark"
            className="mb-0 flex-1"
            title="Lead Report"
            description="Complete overview of all leads recorded in the system"
            backHref={getBackNavigation('/sales/lead-report')?.href}
            backLabel={`Back to ${getBackNavigation('/sales/lead-report')?.label ?? 'Sales'}`}
            breadcrumbs={getBreadcrumbsForPath('/sales/lead-report')}
          />
          <div className="flex gap-3 items-center shrink-0">
            {connected === null ? (
              <div className="text-[#4f5463] text-[13px]">Checking backend...</div>
            ) : connected ? (
              <div className="text-[#10b981] text-[13px]">Backend: Connected</div>
            ) : (
              <div className="text-[#f43f5e] text-[13px]">Backend: Disconnected</div>
            )}
            <button
              type="button"
              className="font-sans text-[12.5px] font-semibold py-[7px] px-3.5 rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform] duration-150 whitespace-nowrap active:scale-[0.97] bg-transparent text-[#8b92a8] border border-[#1f2028] hover:border-[#28293a] hover:text-[#e4e6eb]"
              onClick={() => { fetchLeads(); (async () => { try { const r = await fetch(`${API_BASE}/api/v1/health`); setConnected(r.ok); } catch { setConnected(false); } })(); }}
            >
              Retry
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-[#f43f5e]/10 border border-[#f43f5e]/20 text-[#f43f5e] py-3.5 px-[18px] rounded-[10px] mb-5 text-[13px] font-medium">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#0d0e13] border border-[#1f2028] rounded-xl p-5 mb-5">
          <div className="text-[11px] font-bold text-[#4f5463] uppercase tracking-widest mb-3.5 flex items-center gap-2">
            Filters
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-1.5">Search</label>
              <input ref={searchInputRef} className={FIELD_CLS} placeholder="Name, code, business, phone..." value={searchQuery} onChange={handleSearch} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-1.5">Lead Type</label>
              <select className={FIELD_CLS} value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All types</option>
                {LEAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-1.5">Business Category</label>
              <SearchableSelect fieldClass="lr-field" options={BUSINESS_CATEGORIES} value={filterBusiness} onChange={v => setFilterBusiness(v)} emptyLabel="All categories" accentColor="var(--primary)" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-1.5">Date From</label>
              <DatePickerField value={filterDateFrom} onChange={setFilterDateFrom} max={filterDateTo || undefined} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-1.5">Date To</label>
              <DatePickerField value={filterDateTo} onChange={setFilterDateTo} min={filterDateFrom || undefined} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-1.5">Hot lead</label>
              <select className={FIELD_CLS} value={filterHot} onChange={e => setFilterHot(e.target.value as 'all' | 'hot' | 'not_hot')}>
                <option value="all">All</option>
                <option value="hot">Hot only</option>
                <option value="not_hot">Not hot</option>
              </select>
            </div>
            <button
              className="font-sans text-[12.5px] font-semibold px-4 py-2 rounded-[7px] border border-[#1f2028] bg-transparent text-[#8b92a8] cursor-pointer transition-all duration-150 whitespace-nowrap hover:border-[#28293a] hover:text-[#e4e6eb]"
              onClick={clearFilters}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="bg-[#0d0e13] border border-[#1f2028] rounded-[10px] px-[18px] py-3.5 flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-[#28293a]">
            <div className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-[7px]">Total Leads</div>
            <div className="text-[24px] font-extrabold font-mono text-[#7c3aed]">{stats.total}</div>
          </div>
          <div className="bg-[#0d0e13] border border-[#1f2028] rounded-[10px] px-[18px] py-3.5 flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-[#28293a]">
            <div className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-[7px]">Digital Leads</div>
            <div className="text-[24px] font-extrabold font-mono text-[#10b981]">{stats.digital}</div>
          </div>
          <div className="bg-[#0d0e13] border border-[#1f2028] rounded-[10px] px-[18px] py-3.5 flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-[#28293a]">
            <div className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-[7px]">Non-Digital</div>
            <div className="text-[24px] font-extrabold font-mono text-[#0ea5e9]">{stats.nonDigital}</div>
          </div>
          <div className="bg-[#0d0e13] border border-[#1f2028] rounded-[10px] px-[18px] py-3.5 flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-[#28293a]">
            <div className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-[7px]">This Month</div>
            <div className="text-[24px] font-extrabold font-mono text-[#f59e0b]">{stats.thisMonth}</div>
          </div>
          <div className="bg-[#0d0e13] border border-[#1f2028] rounded-[10px] px-[18px] py-3.5 flex-1 min-w-[140px] transition-[border-color] duration-150 hover:border-[#28293a]">
            <div className="text-[10.5px] font-semibold text-[#4f5463] uppercase tracking-wide mb-[7px]">Hot Leads</div>
            <div className="text-[24px] font-extrabold font-mono text-[#f59e0b]">{stats.hot}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#0d0e13] border border-[#1f2028] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2028] flex-wrap gap-2.5">
            <div>
              <div className="text-sm font-bold">
                {leads.length === allLeads.length ? `${allLeads.length} Total Leads` : `${leads.length} of ${allLeads.length} Leads`}
              </div>
              <div className="text-[11.5px] text-[#4f5463] mt-0.5">
                {searchQuery || filterType || filterBusiness || filterDateFrom || filterDateTo || filterHot !== 'all' ? 'Filtered results' : 'Complete lead pipeline'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="font-sans text-[12.5px] font-semibold py-[7px] px-3.5 rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform] duration-150 whitespace-nowrap active:scale-[0.97] bg-transparent text-[#8b92a8] border border-[#1f2028] hover:border-[#28293a] hover:text-[#e4e6eb]"
                onClick={exportCSV}
              >
                ↓ Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#131419]">
                  <th className={TH_BASE}>#</th>
                  <th className={TH_BASE}>Cust Code</th>
                  <th
                    className={`${TH_BASE} cursor-pointer${sortField === 'cust_name' ? ' text-[#8b92a8]' : ''}`}
                    onClick={() => handleSort('cust_name')}
                  >
                    Customer Name{sortField === 'cust_name' && <span className="ml-1 text-[#7c3aed]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th
                    className={`${TH_BASE} cursor-pointer${sortField === 'business' ? ' text-[#8b92a8]' : ''}`}
                    onClick={() => handleSort('business')}
                  >
                    Business{sortField === 'business' && <span className="ml-1 text-[#7c3aed]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className={TH_BASE}>Phone</th>
                  <th className={TH_BASE}>Location</th>
                  <th
                    className={`${TH_BASE} cursor-pointer${sortField === 'lead_type' ? ' text-[#8b92a8]' : ''}`}
                    onClick={() => handleSort('lead_type')}
                  >
                    Lead Type{sortField === 'lead_type' && <span className="ml-1 text-[#7c3aed]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className={TH_BASE}>Hot</th>
                  <th className={TH_BASE}>Buy window</th>
                  <th className={TH_BASE}>Callback</th>
                  <th
                    className={`${TH_BASE} cursor-pointer${sortField === 'connect_date' ? ' text-[#8b92a8]' : ''}`}
                    onClick={() => handleSort('connect_date')}
                  >
                    Connect Date{sortField === 'connect_date' && <span className="ml-1 text-[#7c3aed]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th className={TH_BASE}>Preview</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : leads.length === 0 ? (
                  <tr><td colSpan={12}>
                    <div className="text-center py-16 px-5 text-[#4f5463]">
                      <div className="text-[40px] mb-3.5 opacity-40"></div>
                      <div className="text-[14px]">
                        {searchQuery || filterType || filterBusiness || filterDateFrom || filterDateTo || filterHot !== 'all'
                          ? <>No leads match your filters</>
                          : <>No leads recorded yet</>}
                      </div>
                    </div>
                  </td></tr>
                ) : (
                  leads.map((l, i) => (
                    <tr key={l.id ?? i} className="transition-colors duration-100 hover:bg-white/[0.02] [&:last-child_td]:border-b-0">
                      <td className="py-[13px] px-4 text-[#e4e6eb] text-[13px] border-b border-[#1f2028]/60 align-middle font-mono text-[11px] text-[#4f5463]">
                        {String(i + 1).padStart(2, '0')}
                      </td>
                      <td className="py-[13px] px-4 text-[#e4e6eb] text-[13px] border-b border-[#1f2028]/60 align-middle font-mono text-[12px] font-bold text-[#7c3aed]">
                        {l.cust_code || '—'}
                      </td>
                      <td className="py-[13px] px-4 text-[#e4e6eb] text-[13px] border-b border-[#1f2028]/60 align-middle font-medium">
                        {l.cust_name || '—'}
                      </td>
                      <td className="py-[13px] px-4 text-[#8b92a8] text-[13px] border-b border-[#1f2028]/60 align-middle max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {l.business || '—'}
                      </td>
                      <td className="py-[13px] px-4 text-[#e4e6eb] text-[13px] border-b border-[#1f2028]/60 align-middle">
                        <div className="font-mono text-[11.5px] text-[#8b92a8]">{l.phone_no || '—'}</div>
                        {l.phone_no_2 && <div className="font-mono text-[11px] text-[#4f5463] mt-0.5">{l.phone_no_2}</div>}
                      </td>
                      <td className="py-[13px] px-4 text-[#8b92a8] text-[13px] border-b border-[#1f2028]/60 align-middle max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {l.location || '—'}
                      </td>
                      <td className="py-[13px] px-4 text-[#e4e6eb] text-[13px] border-b border-[#1f2028]/60 align-middle">
                        <span className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold whitespace-nowrap ${leadBadgeClass(l.lead_type)}`}>
                          {l.lead_type || '—'}
                        </span>
                      </td>
                      <td className="py-[13px] px-4 text-[#e4e6eb] text-[13px] border-b border-[#1f2028]/60 align-middle">
                        {l.is_hot_lead ? (
                          <span className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[10px] font-semibold whitespace-nowrap bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/28">Hot</span>
                        ) : (
                          <span className="text-[#4f5463] text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-[13px] px-4 text-[#8b92a8] text-[11px] border-b border-[#1f2028]/60 align-middle max-w-[82px]" title={labelForDeferral(l.deferral_bucket)}>
                        {labelForDeferral(l.deferral_bucket)}
                      </td>
                      <td className="py-[13px] px-4 text-[#8b92a8] text-[11px] border-b border-[#1f2028]/60 align-middle max-w-[96px]" title={labelForContact(l.contact_disposition)}>
                        {labelForContact(l.contact_disposition)}
                      </td>
                      <td className="py-[13px] px-4 text-[#e4e6eb] text-[13px] border-b border-[#1f2028]/60 align-middle font-mono text-[11.5px] text-[#8b92a8]">
                        {fmtDate(l.connect_date)}
                      </td>
                      <td className="py-[13px] px-4 text-[#e4e6eb] text-[13px] border-b border-[#1f2028]/60 align-middle">
                        <button
                          className="font-sans text-[12px] font-semibold py-[5px] px-3 rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform] duration-150 whitespace-nowrap active:scale-[0.97] bg-[#0ea5e9]/10 text-[#0ea5e9] border border-[#0ea5e9]/20 hover:bg-[#0ea5e9]/15"
                          onClick={() => openPreview(l)}
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
      {previewLead && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-5 animate-[fadeIn_.15s_ease]"
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) closePreview(); }}
        >
          <div
            className="bg-[#0d0e13] border border-[#28293a] rounded-2xl w-full max-w-[740px] max-h-[88vh] flex flex-col overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,.6)] animate-[slideUp_.18s_ease]"
            role="dialog"
            aria-modal="true"
          >

            {/* Head */}
            <div className="px-6 pt-[22px] pb-[18px] border-b border-[#1f2028] flex items-start justify-between gap-3 flex-shrink-0">
              <div>
                <div className="text-[20px] font-extrabold tracking-tight">{previewLead.cust_name || 'Unnamed Customer'}</div>
                <div className="font-mono text-[12px] text-[#7c3aed] mt-1">{previewLead.cust_code || '—'}</div>
              </div>
              <button
                className="bg-transparent border border-[#1f2028] text-[#8b92a8] w-8 h-8 rounded-lg cursor-pointer text-[16px] flex items-center justify-center flex-shrink-0 transition-all duration-150 hover:bg-[#f43f5e]/10 hover:border-[#f43f5e] hover:text-[#f43f5e]"
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
                <div className="text-[10px] font-bold text-[#4f5463] uppercase tracking-[1.2px] mb-3.5 flex items-center gap-2">
                  Lead Details
                  <span className="flex-1 h-px bg-[#1f2028]" />
                </div>
                <div className="grid grid-cols-2 gap-[14px]">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Connect Date</div>
                    <div className={`${PV_FIELD_VAL} font-mono text-[12.5px]`}>{fmtDate(previewLead.connect_date)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Lead Type</div>
                    <div className={PV_FIELD_VAL}>
                      <span className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold whitespace-nowrap ${leadBadgeClass(previewLead.lead_type)}`}>
                        {previewLead.lead_type || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Hot lead</div>
                    <div className={PV_FIELD_VAL}>{previewLead.is_hot_lead ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Buying timeframe</div>
                    <div className={PV_FIELD_VAL}>{labelForDeferral(previewLead.deferral_bucket)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Call outcome</div>
                    <div className={PV_FIELD_VAL}>{labelForContact(previewLead.contact_disposition)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Follow-up from</div>
                    <div className={`${PV_FIELD_VAL} font-mono text-[12.5px]`}>{fmtDate(previewLead.follow_up_after_date)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Earliest purchase intent</div>
                    <div className={`${PV_FIELD_VAL} font-mono text-[12.5px]`}>{fmtDate(previewLead.earliest_purchase_intent_date)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Callback after</div>
                    <div className={`${PV_FIELD_VAL} font-mono text-[12.5px]`}>{previewLead.callback_requested_at ? fmtDateTime(previewLead.callback_requested_at) : '—'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Customer promised callback</div>
                    <div className={PV_FIELD_VAL}>{previewLead.customer_promised_callback ? 'Yes' : 'No'}</div>
                  </div>
                  {previewLead.deferral_notes?.trim() ? (
                    <div className="col-span-full flex flex-col gap-1">
                      <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Timing / callback notes</div>
                      <div className={PV_FIELD_VAL}>{previewLead.deferral_notes}</div>
                    </div>
                  ) : null}
                  <div className="col-span-full flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Business</div>
                    <div className={PV_FIELD_VAL}>{previewLead.business || <span className="text-[#4f5463] italic">—</span>}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Phone No. 1</div>
                    <div className={`${PV_FIELD_VAL} font-mono text-[12.5px]`}>{previewLead.phone_no || '—'}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Phone No. 2</div>
                    <div className={`${PV_FIELD_VAL} font-mono text-[12.5px]`}>{previewLead.phone_no_2 || <span className="text-[#4f5463] italic">—</span>}</div>
                  </div>
                  <div className="col-span-full flex flex-col gap-1">
                    <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Location</div>
                    <div className={PV_FIELD_VAL}>{previewLead.location || <span className="text-[#4f5463] italic">—</span>}</div>
                  </div>
                  {previewLead.note && (
                    <div className="col-span-full flex flex-col gap-1">
                      <div className="text-[10px] font-semibold text-[#4f5463] uppercase tracking-[0.8px]">Note</div>
                      <div className={PV_FIELD_VAL}>{previewLead.note}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Audit ── */}
              <div>
                <div className="text-[10px] font-bold text-[#4f5463] uppercase tracking-[1.2px] mb-3.5 flex items-center gap-2">
                  Record Audit
                  <span className="flex-1 h-px bg-[#1f2028]" />
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {previewLead.created_by_name ? (
                    <div className="flex items-center gap-1.5 bg-[#131419] border border-[#1f2028] rounded-lg py-[7px] px-3 text-[12px]">
                      <span className="text-[13px] text-[#4ade80]">＋</span>
                      <span className="text-[#e4e6eb] font-semibold">Added by {previewLead.created_by_name}</span>
                      <span className="text-[#4f5463] text-[11px]">{fmtDateTime(previewLead.created_at)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-[#131419] border border-[#1f2028] rounded-lg py-[7px] px-3 text-[12px]">
                      <span className="text-[13px] text-[#4ade80]">＋</span>
                      <span className="text-[#4f5463] font-semibold">Added by unknown</span>
                      <span className="text-[#4f5463] text-[11px]">{fmtDateTime(previewLead.created_at)}</span>
                    </div>
                  )}
                  {previewLead.updated_by_name && (
                    <div className="flex items-center gap-1.5 bg-[#131419] border border-[#1f2028] rounded-lg py-[7px] px-3 text-[12px]">
                      <span className="text-[13px] text-[#fbbf24]">Edit</span>
                      <span className="text-[#e4e6eb] font-semibold">Last edited by {previewLead.updated_by_name}</span>
                      <span className="text-[#4f5463] text-[11px]">{fmtDateTime(previewLead.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── History ── */}
              <div>
                <div className="text-[10px] font-bold text-[#4f5463] uppercase tracking-[1.2px] mb-3.5 flex items-center gap-2">
                  Activity History
                  <span className="flex-1 h-px bg-[#1f2028]" />
                </div>
                {historyLoading ? (
                  <div className="text-[#4f5463] text-[13px] text-center py-[18px]">Loading history…</div>
                ) : history.length === 0 ? (
                  <div className="text-[#4f5463] text-[13px] text-center py-6">No activity history recorded for this lead.</div>
                ) : (
                  <div className="flex flex-col">
                    {history.map((log, idx) => (
                      <div key={log.id} className={`flex gap-3.5 relative${idx < history.length - 1 ? ' pb-[18px]' : ''}`}>
                        <div className="flex flex-col items-center w-7 flex-shrink-0">
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[12px] flex-shrink-0 ${tlDotClass(log.action)}`}>
                            {tlIcon(log.action)}
                          </div>
                          {idx < history.length - 1 && <div className="flex-1 w-px bg-[#1f2028] mt-1" />}
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="text-[13px] font-semibold text-[#e4e6eb]">{tlLabel(log.action)}</div>
                          {log.performed_by_name && <div className="text-[12px] text-[#8b92a8] mt-0.5">by {log.performed_by_name}</div>}
                          <div className="text-[11px] text-[#4f5463] font-mono mt-[3px]">{fmtDateTime(log.performed_at)}</div>
                          {log.details && <div className="text-[11.5px] text-[#4f5463] mt-1 italic">{log.details}</div>}
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
