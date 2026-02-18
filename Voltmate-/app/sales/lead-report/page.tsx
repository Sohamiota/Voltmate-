'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: number;
  cust_code?: string;
  cust_name?: string;
  business?: string;
  phone_no?: string;
  lead_type?: string;
  connect_date?: string;
  note?: string;
}

type SortField = 'cust_name' | 'business' | 'lead_type' | 'connect_date';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081');

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
  return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
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
`;

// ─── Badge helper ─────────────────────────────────────────────────────────────
function leadBadgeClass(type = ''): string {
  if (type === 'Digital Lead') return 'digital';
  if (type === 'Non Digital Lead') return 'nondigital';
  return 'default';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map(n => (
        <tr key={n} className="lr-skel-row">
          {[26, 88, 130, 150, 100, 110, 90].map((w, i) => (
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
  // quick backend health check
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/health`);
        if (!mounted) return;
        setConnected(res.ok);
      } catch (e) {
        if (!mounted) return;
        setConnected(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        (l.cust_name || '').toLowerCase().includes(q) ||
        (l.cust_code || '').toLowerCase().includes(q) ||
        (l.business || '').toLowerCase().includes(q) ||
        (l.phone_no || '').toLowerCase().includes(q)
      );
    }

    // Lead type filter
    if (filterType) {
      filtered = filtered.filter(l => l.lead_type === filterType);
    }

    // Business category filter (partial match)
    if (filterBusiness) {
      filtered = filtered.filter(l =>
        (l.business || '').toLowerCase().includes(filterBusiness.toLowerCase())
      );
    }

    // Date range filter
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      filtered = filtered.filter(l => {
        if (!l.connect_date) return false;
        return new Date(l.connect_date).getTime() >= from;
      });
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime();
      filtered = filtered.filter(l => {
        if (!l.connect_date) return false;
        return new Date(l.connect_date).getTime() <= to;
      });
    }

    // Sort
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

  // ── Toggle sort ────────────────────────────────────────────────────────────
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  async function exportCSV() {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/v1/leads/export/csv`, { headers });
      if (!res.ok) {
        alert('Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lead-report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('export error:', err);
      alert('Export failed');
    }
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

        {/* Error */}
        {error && <div className="lr-error">⚠️ {error}</div>}

        {/* Filters */}
        <div className="lr-filters">
          <div className="lr-filters-label">
            <span>🔍</span> Filters
          </div>
          <div className="lr-filters-grid">
            <div className="lr-fg">
              <label className="lr-label">Search</label>
              <input
                className="lr-field"
                placeholder="Name, code, business, phone..."
                onChange={handleSearch}
              />
            </div>
            <div className="lr-fg">
              <label className="lr-label">Lead Type</label>
              <select
                className="lr-field"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                <option value="">All types</option>
                {LEAD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="lr-fg">
              <label className="lr-label">Business Category</label>
              <select
                className="lr-field"
                value={filterBusiness}
                onChange={e => setFilterBusiness(e.target.value)}
              >
                <option value="">All categories</option>
                {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="lr-fg">
              <label className="lr-label">Date From</label>
              <input
                type="date"
                className="lr-field"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div className="lr-fg">
              <label className="lr-label">Date To</label>
              <input
                type="date"
                className="lr-field"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
              />
            </div>
            <button className="lr-btn-clear" onClick={clearFilters}>
              Clear All
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="lr-stats">
          <div className="lr-stat">
            <div className="lr-stat-label">Total Leads</div>
            <div className="lr-stat-val primary">{stats.total}</div>
          </div>
          <div className="lr-stat">
            <div className="lr-stat-label">Digital Leads</div>
            <div className="lr-stat-val emerald">{stats.digital}</div>
          </div>
          <div className="lr-stat">
            <div className="lr-stat-label">Non-Digital</div>
            <div className="lr-stat-val sky">{stats.nonDigital}</div>
          </div>
          <div className="lr-stat">
            <div className="lr-stat-label">This Month</div>
            <div className="lr-stat-val amber">{stats.thisMonth}</div>
          </div>
        </div>

        {/* Table */}
        <div className="lr-table-card">
          <div className="lr-table-header">
            <div>
              <div className="lr-table-title">
                {leads.length === allLeads.length
                  ? `${allLeads.length} Total Leads`
                  : `${leads.length} of ${allLeads.length} Leads`}
              </div>
              <div className="lr-table-sub">
                {searchQuery || filterType || filterBusiness || filterDateFrom || filterDateTo
                  ? 'Filtered results'
                  : 'Complete lead pipeline'}
              </div>
            </div>
            <div className="lr-table-actions">
              <button className="lr-btn lr-btn-ghost" onClick={exportCSV}>
                ↓ Export CSV
              </button>
            </div>
          </div>

          <div className="lr-table-outer">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cust Code</th>
                  <th
                    className={`sortable ${sortField === 'cust_name' ? `sorted ${sortDir}` : ''}`}
                    onClick={() => handleSort('cust_name')}
                  >
                    Customer Name
                  </th>
                  <th
                    className={`sortable ${sortField === 'business' ? `sorted ${sortDir}` : ''}`}
                    onClick={() => handleSort('business')}
                  >
                    Business
                  </th>
                  <th>Phone</th>
                  <th
                    className={`sortable ${sortField === 'lead_type' ? `sorted ${sortDir}` : ''}`}
                    onClick={() => handleSort('lead_type')}
                  >
                    Lead Type
                  </th>
                  <th
                    className={`sortable ${sortField === 'connect_date' ? `sorted ${sortDir}` : ''}`}
                    onClick={() => handleSort('connect_date')}
                  >
                    Connect Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="lr-empty">
                        <div className="lr-empty-icon">📋</div>
                        <div className="lr-empty-msg">
                          {searchQuery || filterType || filterBusiness || filterDateFrom || filterDateTo
                            ? <>No leads match your filters</>
                            : <>No leads recorded yet</>}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  leads.map((l, i) => (
                    <tr key={l.id ?? i}>
                      <td className="lr-num">{String(i + 1).padStart(2, '0')}</td>
                      <td className="lr-code">{l.cust_code || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{l.cust_name || '—'}</td>
                      <td style={{ color: 'var(--text2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.business || '—'}
                      </td>
                      <td className="lr-date">{l.phone_no || '—'}</td>
                      <td>
                        <span className={`lr-badge ${leadBadgeClass(l.lead_type)}`}>
                          {l.lead_type || '—'}
                        </span>
                      </td>
                      <td className="lr-date">
                        {l.connect_date
                          ? new Date(l.connect_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}