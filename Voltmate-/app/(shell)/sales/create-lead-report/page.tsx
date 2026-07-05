'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Lead } from '@/types/api';
import SearchableSelect from '@/components/SearchableSelect';
import PageHeader from '@/components/PageHeader';
import { useEffectiveSearch } from '@/components/SearchContext';
import { getBackNavigation, getBreadcrumbsForPath } from '@/lib/navigation';
import {
  CRM_CONTACT_OPTIONS,
  CRM_DEFERRAL_OPTIONS,
  crmPayloadFromForm,
  isoToDatetimeLocal,
  labelForContact,
  labelForDeferral,
} from '@/lib/crmDeferral';
import { downloadXlsx, xlsDate, xlsDateTime } from '@/lib/exportXlsx';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  connect_date: string;
  cust_name: string;
  phone_no: string;
  phone_no_2: string;
  lead_type: string;
  location: string;
  note: string;
  deferral_bucket: string;
  deferral_notes: string;
  follow_up_after_date: string;
  earliest_purchase_intent_date: string;
  contact_disposition: string;
  callback_requested_at: string;
  customer_promised_callback: boolean;
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
  'E-commerce': [
    'Online retail / D2C',
    'Marketplace seller (Amazon, Flipkart, etc.)',
    'Quick commerce / grocery delivery',
    'Aggregator or logistics partner',
    'Other e-commerce',
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
  deferral_bucket: '',
  deferral_notes: '',
  follow_up_after_date: '',
  earliest_purchase_intent_date: '',
  contact_disposition: '',
  callback_requested_at: '',
  customer_promised_callback: false,
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
  if (t) h['Authorization'] = `Bearer ${t}`; // only added when token exists
  return h;
}

// ─── Tailwind class constants (outside component — never recreated) ────────────
const FIELD = [
  'font-sans text-[13px] bg-[#080a10] border border-[#1e2236] text-[#dde3f0]',
  'px-3 py-[9px] rounded-[7px] w-full transition-[border-color,box-shadow]',
  'focus:outline-none focus:border-[#00c9b1] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.09)]',
  'placeholder:text-[#4b5268] appearance-none',
].join(' ');

const BTN_BASE = [
  'font-sans font-semibold text-[12.5px] px-4 py-2 rounded-[7px] cursor-pointer',
  'inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform]',
  'active:scale-[0.97] disabled:opacity-[0.45] disabled:cursor-not-allowed',
  'disabled:pointer-events-none whitespace-nowrap',
].join(' ');

const BTN_GHOST = `${BTN_BASE} bg-transparent text-[#8b93a8] border border-[#1e2236] hover:border-[#272b40] hover:text-[#dde3f0]`;
const BTN_TEAL  = `${BTN_BASE} bg-[#00c9b1] text-[#080a10] border-0 hover:shadow-[0_0_18px_rgba(0,201,177,0.20)]`;
const BTN_RED   = `${BTN_BASE} bg-[rgba(244,63,94,0.09)] text-[#f43f5e] border border-[rgba(244,63,94,0.22)] hover:bg-[rgba(244,63,94,0.16)]`;
const BTN_AMBER = `${BTN_BASE} bg-[rgba(251,191,36,0.08)] text-[#fbbf24] border border-[rgba(251,191,36,0.22)] hover:bg-[rgba(251,191,36,0.16)]`;
const LABEL_CLS = 'block text-[10.5px] font-bold text-[#4b5268] uppercase tracking-[0.9px] mb-1.5';
const TH_CLS    = 'px-4 py-2.5 text-left text-[10px] font-semibold text-[#4b5268] uppercase tracking-[1px] whitespace-nowrap';
const TD_BASE   = 'py-[13px] px-4 text-[#dde3f0] align-middle';

// ─── Badge class helper ───────────────────────────────────────────────────────
function leadBadgeClasses(type = '') {
  const base = 'inline-flex items-center px-[9px] py-[3px] rounded-full whitespace-nowrap text-[11px] font-semibold';
  if (type === 'Digital Lead')     return `${base} bg-[rgba(0,201,177,0.09)] text-[#00c9b1] border border-[rgba(0,201,177,0.20)]`;
  if (type === 'Non Digital Lead') return `${base} bg-[rgba(96,165,250,0.09)] text-[#60a5fa] border border-[rgba(96,165,250,0.22)]`;
  return `${base} bg-[rgba(139,147,168,0.08)] text-[#8b93a8] border border-[rgba(139,147,168,0.18)]`;
}

// ─── Toast class helper ───────────────────────────────────────────────────────
function toastClasses(type: ToastType) {
  const base = 'px-[18px] py-[11px] rounded-[9px] text-[13px] font-semibold pointer-events-auto max-w-[320px] border';
  if (type === 'success') return `${base} bg-[rgba(0,201,177,0.1)] border-[rgba(0,201,177,0.28)] text-[#00c9b1]`;
  if (type === 'error')   return `${base} bg-[rgba(244,63,94,0.1)] border-[rgba(244,63,94,0.28)] text-[#f43f5e]`;
  return `${base} bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.28)] text-[#60a5fa]`;
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map(n => (
        <tr key={n}>
          {[28, 72, 80, 130, 140, 90, 110, 100, 88, 96, 110, 60].map((w, i) => (
            <td key={i} className="py-3.5 px-4">
              <div className="h-[13px] rounded animate-pulse bg-zinc-800" style={{ width: w }} />
            </td>
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
  const [allLeads, setAllLeads] = useState<Lead[]>([]);       // source-of-truth, never mutated by search
  const [searchQuery, setSearchQuery] = useState('');          // search as string, not state mutation
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
  const effectiveSearch = useEffectiveSearch(searchQuery);

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
  const leads = useMemo(() => {
    if (!effectiveSearch) return allLeads;
    const q = effectiveSearch.toLowerCase();
    return allLeads.filter(l =>
      (l.cust_name || '').toLowerCase().includes(q) ||
      (l.cust_code || '').toLowerCase().includes(q) ||
      (l.business || '').toLowerCase().includes(q) ||
      (l.phone_no || '').toLowerCase().includes(q) ||
      (l.location || '').toLowerCase().includes(q)
    );
  }, [allLeads, effectiveSearch]);

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
  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/leads`, { headers: buildHeaders() });
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

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── Search with debounce (no instant-filter lag) ──────────────────────────
  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(val), 180);
  }

  // ── Open / close modal — resets ALL form state ────────────────────────────
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
    const { cat, sub } = findBusinessParts(lead.business || '');
    setBusinessCategory(cat);
    setBusinessSub(sub);
    setForm({
      connect_date: lead.connect_date ? lead.connect_date.slice(0, 10) : '',
      cust_name:  lead.cust_name  || '',
      phone_no:   lead.phone_no   || '',
      phone_no_2: lead.phone_no_2 || '',
      lead_type:  lead.lead_type  || '',
      location:   lead.location   || '',
      note:       lead.note       || '',
      deferral_bucket:           lead.deferral_bucket ?? '',
      deferral_notes:            lead.deferral_notes ?? '',
      follow_up_after_date:      lead.follow_up_after_date ? String(lead.follow_up_after_date).slice(0, 10) : '',
      earliest_purchase_intent_date: lead.earliest_purchase_intent_date
        ? String(lead.earliest_purchase_intent_date).slice(0, 10)
        : '',
      contact_disposition:       lead.contact_disposition ?? '',
      callback_requested_at:     isoToDatetimeLocal(lead.callback_requested_at ?? undefined),
      customer_promised_callback: !!lead.customer_promised_callback,
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

    const payload: Record<string, unknown> = {
      connect_date: form.connect_date || null,
      cust_name: form.cust_name,
      phone_no: form.phone_no,
      phone_no_2: form.phone_no_2 || null,
      lead_type: form.lead_type || null,
      note: form.note || null,
      location: form.location || null,
      business,
      ...crmPayloadFromForm(form),
    };

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
  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/leads/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: buildHeaders(),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        showToast(`Delete failed (${res.status})${txt ? ' – ' + txt : ''}`, 'error');
        return;
      }
      showToast(`"${deleteTarget.cust_name || 'Lead'}" deleted`, 'success');
      await fetchList();
    } catch (err) {
      console.error('delete error:', err);
      showToast('Network error — could not delete lead', 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── XLSX export (exports the currently visible/filtered rows) ─────────────
  function exportCSV() {
    if (leads.length === 0) { showToast('No rows to export', 'error'); return; }
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
    const suffix = searchQuery ? '_filtered' : '';
    downloadXlsx(rows, `leads_${new Date().toISOString().slice(0, 10)}${suffix}`, 'Leads');
    showToast('Export started', 'success');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!roleChecked) {
    return (
      <div className="min-h-screen bg-[#080a10] flex items-center justify-center text-zinc-400 font-sans">
        Checking access…
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#080a10] flex flex-col items-center justify-center gap-3 font-sans">
        <div className="text-red-500 font-bold text-[18px]">Access Denied</div>
        <div className="text-zinc-400 text-[14px]">Only Admin and Sales Admin can access this page.</div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-5 py-2 bg-[#1a1a2e] border border-[#333] rounded-lg text-zinc-200 cursor-pointer text-[13px]"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#080a10] text-[#dde3f0] font-sans antialiased text-[13.5px]">

      {/* ── Content ── */}
      <main className="p-7">
        <PageHeader
          variant="dark"
          title="Lead Management"
          description="Track and manage your dealership leads"
          backHref={getBackNavigation('/sales/create-lead-report')?.href}
          backLabel={`Back to ${getBackNavigation('/sales/create-lead-report')?.label ?? 'Sales'}`}
          breadcrumbs={getBreadcrumbsForPath('/sales/create-lead-report')}
        />

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-[14px] mb-[22px] max-[860px]:grid-cols-2">
          <div className="bg-[#0e1118] border border-[#1e2236] rounded-[10px] p-[18px_20px] transition-[border-color,transform] hover:border-[#272b40] hover:-translate-y-px">
            <div className="text-[10.5px] font-semibold text-[#4b5268] uppercase tracking-[0.9px] mb-2">Total Leads</div>
            <div className="text-[28px] font-extrabold font-mono text-[#00c9b1]">{stats.total}</div>
          </div>
          <div className="bg-[#0e1118] border border-[#1e2236] rounded-[10px] p-[18px_20px] transition-[border-color,transform] hover:border-[#272b40] hover:-translate-y-px">
            <div className="text-[10.5px] font-semibold text-[#4b5268] uppercase tracking-[0.9px] mb-2">Digital Leads</div>
            <div className="text-[28px] font-extrabold font-mono text-[#60a5fa]">{stats.digital}</div>
          </div>
          <div className="bg-[#0e1118] border border-[#1e2236] rounded-[10px] p-[18px_20px] transition-[border-color,transform] hover:border-[#272b40] hover:-translate-y-px">
            <div className="text-[10.5px] font-semibold text-[#4b5268] uppercase tracking-[0.9px] mb-2">Non-Digital</div>
            <div className="text-[28px] font-extrabold font-mono text-[#f59e0b]">{stats.nonDigital}</div>
          </div>
          <div className="bg-[#0e1118] border border-[#1e2236] rounded-[10px] p-[18px_20px] transition-[border-color,transform] hover:border-[#272b40] hover:-translate-y-px">
            <div className="text-[10.5px] font-semibold text-[#4b5268] uppercase tracking-[0.9px] mb-2">This Month</div>
            <div className="text-[28px] font-extrabold font-mono text-[#dde3f0]">{stats.thisMonth}</div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-[#0e1118] border border-[#1e2236] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-[15px] border-b border-[#1e2236] flex-wrap gap-2.5">
            <div>
              <div className="text-sm font-bold">All Leads</div>
              <div className="text-[11.5px] text-[#4b5268] mt-0.5">
                {searchQuery
                  ? `Showing ${leads.length} of ${allLeads.length} leads`
                  : `${allLeads.length} leads total`}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-2 bg-[#080a10] border border-[#1e2236] rounded-lg px-[13px] py-[7px] w-56 transition-[border-color] focus-within:border-[#00c9b1]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-[#4b5268]">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  className="bg-transparent border-none outline-none text-[#dde3f0] text-[12.5px] font-sans w-full placeholder:text-[#4b5268]"
                  placeholder="Search leads, customers..."
                  value={searchQuery}
                  onChange={handleSearch}
                  aria-label="Search leads"
                />
              </div>
              <button className={BTN_GHOST} onClick={exportCSV}>↓ Export CSV</button>
              <button className={BTN_TEAL} onClick={openModal}>+ Add Lead</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-[#141720] border-b border-[#1e2236]">
                  <th className={TH_CLS}>#</th>
                  <th className={TH_CLS}>Cust. Code</th>
                  <th className={TH_CLS}>Connect Date</th>
                  <th className={TH_CLS}>Customer Name</th>
                  <th className={TH_CLS}>Business</th>
                  <th className={TH_CLS}>Phone No.</th>
                  <th className={TH_CLS}>Location</th>
                  <th className={TH_CLS}>Lead Type</th>
                  <th className={TH_CLS}>Buy window</th>
                  <th className={TH_CLS}>Callback</th>
                  <th className={TH_CLS}>Logged By</th>
                  <th className={TH_CLS}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={12} className={TD_BASE}>
                      <div className="text-center py-14 px-5 text-[#4b5268]">
                        <div className="text-[34px] mb-3 opacity-45"></div>
                        <div className="text-[13.5px]">
                          {searchQuery
                            ? <>No leads match <strong className="text-[#8b93a8]">"{searchQuery}"</strong></>
                            : <>No leads yet. Click <strong className="text-[#8b93a8]">+ Add Lead</strong> to get started.</>}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  leads.map((l, i) => (
                    // safe key fallback
                    <tr key={l.id ?? i} className="border-b border-[#1e2236] last:border-b-0 transition-colors hover:bg-white/[0.02]">
                      <td className={`${TD_BASE} font-mono text-[11px] text-[#8b93a8]`}>{String(i + 1).padStart(2, '0')}</td>
                      <td className={`${TD_BASE} font-mono text-xs font-medium text-[#00c9b1]`}>{l.cust_code || '—'}</td>
                      <td className={`${TD_BASE} font-mono text-[11.5px] text-[#8b93a8]`}>
                        {l.connect_date
                          ? new Date(l.connect_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className={`${TD_BASE} font-semibold`}>{l.cust_name || '—'}</td>
                      <td className={`${TD_BASE} text-[#8b93a8] max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap`}>
                        {l.business || '—'}
                      </td>
                      <td className={`${TD_BASE} font-mono text-[11.5px] text-[#8b93a8]`}>{l.phone_no || '—'}</td>
                      <td className={`${TD_BASE} text-[#8b93a8] max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap`}>
                        {l.location || '—'}
                      </td>
                      <td className={TD_BASE}>
                        <span className={leadBadgeClasses(l.lead_type || '')}>
                          {l.lead_type || '—'}
                        </span>
                      </td>
                      <td
                        className={`${TD_BASE} text-[11px] text-[#8b93a8] max-w-[88px] overflow-hidden text-ellipsis whitespace-nowrap`}
                        title={labelForDeferral(l.deferral_bucket)}
                      >
                        {labelForDeferral(l.deferral_bucket)}
                      </td>
                      <td
                        className={`${TD_BASE} text-[11px] text-[#8b93a8] max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap`}
                        title={labelForContact(l.contact_disposition)}
                      >
                        {labelForContact(l.contact_disposition)}
                      </td>
                      <td className={TD_BASE}>
                        <div className="flex flex-col gap-[3px] min-w-[130px]">
                          {l.created_by_name && (
                            <span className="flex items-center gap-1 text-[11px] leading-[1.3] whitespace-nowrap text-[#4ade80]">
                              <span className="text-[10px] opacity-70">＋</span>
                              <span>{l.created_by_name}</span>
                              {l.created_at && (
                                <span className="opacity-[0.55] text-[10px]">
                                  {new Date(l.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                                </span>
                              )}
                            </span>
                          )}
                          {l.updated_by_name && (
                            <span className="flex items-center gap-1 text-[11px] leading-[1.3] whitespace-nowrap text-[#fbbf24]">
                              <span className="text-[10px] opacity-70">Edit</span>
                              <span>{l.updated_by_name}</span>
                              {l.updated_at && (
                                <span className="opacity-[0.55] text-[10px]">
                                  {new Date(l.updated_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' })}
                                </span>
                              )}
                            </span>
                          )}
                          {!l.created_by_name && !l.updated_by_name && <span className="text-[#4b5268]">—</span>}
                        </div>
                      </td>
                      <td className={TD_BASE}>
                        <div className="flex gap-1.5">
                          <button
                            className="font-sans font-semibold text-[12px] px-3 py-[5px] rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform] active:scale-[0.97] whitespace-nowrap bg-[rgba(251,191,36,0.08)] text-[#fbbf24] border border-[rgba(251,191,36,0.22)] hover:bg-[rgba(251,191,36,0.16)]"
                            onClick={() => openEditModal(l)}
                          >
                            Edit
                          </button>
                          <button
                            className={`font-sans font-semibold text-[12px] px-3 py-[5px] rounded-[7px] cursor-pointer inline-flex items-center gap-1.5 transition-[opacity,box-shadow,transform] active:scale-[0.97] whitespace-nowrap bg-[rgba(244,63,94,0.09)] text-[#f43f5e] border border-[rgba(244,63,94,0.22)] hover:bg-[rgba(244,63,94,0.16)]`}
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
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center p-5"
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          role="presentation"
        >
          <div
            className="bg-[#0e1118] border border-[#1e2236] rounded-[14px] w-full max-w-[580px] shadow-[0_30px_80px_rgba(0,0,0,0.8)] max-h-[92vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-start justify-between px-6 pt-[22px] pb-4 border-b border-[#1e2236] sticky top-0 bg-[#0e1118] z-[1]">
              <div>
                <div className="text-base font-extrabold" id="modal-title">
                  {editTarget ? 'Edit Lead' : 'Add New Lead'}
                </div>
                <div className="text-xs text-[#4b5268] mt-[3px]">
                  {editTarget ? (
                    <span>
                      Editing: <strong>{editTarget.cust_name || ''}</strong>
                      {editTarget.created_by_name && (
                        <span className="ml-2 text-[11px] text-[#4ade80]">
                          ＋ Added by {editTarget.created_by_name}
                          {editTarget.created_at && ` on ${new Date(editTarget.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </span>
                      )}
                      {editTarget.updated_by_name && (
                        <span className="ml-2 text-[11px] text-[#fbbf24]">
                          · Last edited by {editTarget.updated_by_name}
                          {editTarget.updated_at && ` on ${new Date(editTarget.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </span>
                      )}
                    </span>
                  ) : 'Fill in the lead details below'}
                </div>
              </div>
              <button
                className="bg-transparent border-none cursor-pointer text-[#4b5268] text-[17px] px-1.5 py-1 rounded-[5px] leading-none transition-colors hover:text-[#dde3f0]"
                onClick={closeModal}
                aria-label="Close"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitForm}>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-[14px] max-[500px]:grid-cols-1">

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="f-date">Connect Date</label>
                    <input
                      id="f-date"
                      type="date"
                      className={FIELD}
                      value={form.connect_date}
                      onChange={e => setForm(f => ({ ...f, connect_date: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="f-name">Cust. Name</label>
                    <input
                      id="f-name"
                      className={FIELD}
                      placeholder="Full name"
                      value={form.cust_name}
                      onChange={e => setForm(f => ({ ...f, cust_name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="f-cat">Business Category</label>
                    <SearchableSelect
                      id="f-cat"
                      fieldClass={FIELD}
                      options={Object.keys(BUSINESS_OPTIONS)}
                      value={businessCategory}
                      onChange={v => { setBusinessCategory(v); setBusinessSub(''); }}
                      placeholder="Select category"
                      emptyLabel="Select category"
                      accentColor="#00c9b1"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="f-sub">Business Type</label>
                    <SearchableSelect
                      id="f-sub"
                      fieldClass={FIELD}
                      options={BUSINESS_OPTIONS[businessCategory] || []}
                      value={businessSub}
                      onChange={v => setBusinessSub(v)}
                      placeholder="Select specific type"
                      emptyLabel="Select specific type"
                      disabled={!businessCategory}
                      accentColor="#00c9b1"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="f-phone">
                      Phone No. 1 <span className="text-[#f43f5e] font-bold">*</span>
                    </label>
                    <input
                      id="f-phone"
                      type="tel"
                      className={`${FIELD}${form.phone_no && !isValidPhone(form.phone_no) ? ' !border-[#f43f5e]' : ''}`}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      required
                      value={form.phone_no}
                      onChange={e => setForm(f => ({ ...f, phone_no: e.target.value.replace(/\D/g, '') }))}
                    />
                    {form.phone_no && !isValidPhone(form.phone_no) && (
                      <span className="text-[11px] text-[#f43f5e] mt-1">Enter a valid 10-digit number starting with 6–9</span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="f-phone2">
                      Phone No. 2 <span className="text-[#4b5268] font-normal">(optional)</span>
                    </label>
                    <input
                      id="f-phone2"
                      type="tel"
                      className={`${FIELD}${form.phone_no_2 && !isValidPhoneOptional(form.phone_no_2) ? ' !border-[#f43f5e]' : ''}`}
                      placeholder="Alternate 10-digit number"
                      maxLength={10}
                      value={form.phone_no_2}
                      onChange={e => setForm(f => ({ ...f, phone_no_2: e.target.value.replace(/\D/g, '') }))}
                    />
                    {form.phone_no_2 && !isValidPhoneOptional(form.phone_no_2) && (
                      <span className="text-[11px] text-[#f43f5e] mt-1">Enter a valid 10-digit number starting with 6–9</span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="f-type">Lead Type</label>
                    <select
                      id="f-type"
                      className={`${FIELD} !appearance-auto`}
                      value={form.lead_type}
                      onChange={e => setForm(f => ({ ...f, lead_type: e.target.value }))}
                      required
                    >
                      <option value="">Select type</option>
                      <option value="Digital Lead">Digital Lead</option>
                      <option value="Non Digital Lead">Non Digital Lead</option>
                    </select>
                  </div>

                  <div className="flex flex-col col-span-2" ref={locRef}>
                    <label className={LABEL_CLS} htmlFor="f-loc">Location (West Bengal)</label>
                    <div className="relative">
                      <input
                        id="f-loc"
                        className={FIELD}
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
                        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-[#141720] border border-[#272b40] rounded-lg max-h-[220px] overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
                          {locLoading && <div className="p-3 text-center text-[#4b5268] text-xs">Searching…</div>}
                          {!locLoading && locResults.map((item, idx) => {
                            const parts = item.display_name.split(',');
                            const name = parts.slice(0, 2).join(',').trim();
                            const sub  = parts.slice(2, 5).join(',').trim();
                            return (
                              <div
                                key={item.place_id}
                                className={`px-3 py-[9px] cursor-pointer text-[12.5px] border-b border-[#1e2236] last:border-b-0 transition-colors flex flex-col gap-0.5 hover:bg-[rgba(0,201,177,0.09)]${locHighlight === idx ? ' bg-[rgba(0,201,177,0.09)]' : ''}`}
                                onMouseDown={() => pickLocation(item)}
                                onMouseEnter={() => setLocHighlight(idx)}
                              >
                                <span className="text-[#dde3f0] font-semibold">{name}</span>
                                {sub && <span className="text-[#4b5268] text-[11px]">{sub}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col col-span-2 mt-2 pt-[14px] border-t border-[#1e2236]">
                    <div className="text-[11px] font-bold text-[#4b5268] uppercase tracking-[0.06em] mb-3">
                      Buying timeframe &amp; call outcome
                    </div>
                    <div className="text-[11px] text-[#4b5268] mb-3 leading-[1.45]">
                      If buying window is set (except Unknown) or outcome is busy/callback, set <strong>Follow-up from</strong> or <strong>Callback time</strong>.
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="lm-deferral">Buying timeframe</label>
                    <SearchableSelect
                      id="lm-deferral"
                      fieldClass={FIELD}
                      options={CRM_DEFERRAL_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                      value={form.deferral_bucket}
                      onChange={v => setForm(f => ({ ...f, deferral_bucket: v }))}
                      placeholder="Optional"
                      emptyLabel="Not specified"
                      accentColor="#00c9b1"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="lm-contact">Call outcome / stall</label>
                    <SearchableSelect
                      id="lm-contact"
                      fieldClass={FIELD}
                      options={CRM_CONTACT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                      value={form.contact_disposition}
                      onChange={v => setForm(f => ({ ...f, contact_disposition: v }))}
                      placeholder="Optional"
                      emptyLabel="Not specified"
                      accentColor="#6366f1"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="lm-follow">Follow-up from</label>
                    <input
                      id="lm-follow"
                      type="date"
                      className={FIELD}
                      value={form.follow_up_after_date}
                      onChange={e => setForm(f => ({ ...f, follow_up_after_date: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="lm-earliest">Earliest purchase intent</label>
                    <input
                      id="lm-earliest"
                      type="date"
                      className={FIELD}
                      value={form.earliest_purchase_intent_date}
                      onChange={e => setForm(f => ({ ...f, earliest_purchase_intent_date: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className={LABEL_CLS} htmlFor="lm-callback-at">They asked to call after</label>
                    <input
                      id="lm-callback-at"
                      type="datetime-local"
                      className={FIELD}
                      value={form.callback_requested_at}
                      onChange={e => setForm(f => ({ ...f, callback_requested_at: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center gap-2.5 col-span-2">
                    <input
                      id="lm-promised"
                      type="checkbox"
                      checked={form.customer_promised_callback}
                      onChange={e => setForm(f => ({ ...f, customer_promised_callback: e.target.checked }))}
                      className="w-[18px] h-[18px] accent-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="lm-promised" className="cursor-pointer text-[13px] text-[#dde3f0] select-none">
                      Customer promised they will call back
                    </label>
                  </div>

                  <div className="flex flex-col col-span-2">
                    <label className={LABEL_CLS} htmlFor="lm-defer-notes">Timing / callback notes</label>
                    <textarea
                      id="lm-defer-notes"
                      className={`${FIELD} resize-y min-h-[82px] leading-[1.55]`}
                      rows={2}
                      placeholder="Optional context…"
                      value={form.deferral_notes}
                      onChange={e => setForm(f => ({ ...f, deferral_notes: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col col-span-2">
                    <label className={LABEL_CLS} htmlFor="f-note">Note</label>
                    <textarea
                      id="f-note"
                      className={`${FIELD} resize-y min-h-[82px] leading-[1.55]`}
                      rows={3}
                      placeholder="Any additional notes..."
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    />
                  </div>

                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-3.5 border-t border-[#1e2236] sticky bottom-0 bg-[#0e1118]">
                <button type="button" className={BTN_GHOST} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className={BTN_TEAL} disabled={submitting}>
                  {submitting ? (editTarget ? 'Updating…' : 'Saving…') : (editTarget ? 'Update Lead' : 'Save Lead')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal (replaces browser confirm()) ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-[4px] flex items-center justify-center" role="presentation">
          <div
            className="bg-[#0e1118] border border-[#1e2236] rounded-xl px-[26px] py-6 max-w-[380px] w-full shadow-[0_24px_60px_rgba(0,0,0,0.75)]"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="text-[15px] font-bold mb-2">Delete Lead</div>
            <div className="text-[13px] text-[#8b93a8] mb-5 leading-[1.6]">
              Are you sure you want to delete{' '}
              <strong className="text-[#dde3f0]">
                {deleteTarget.cust_name || `Lead #${deleteTarget.id}`}
              </strong>?
              <br />This action cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <button className={BTN_GHOST} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className={BTN_RED} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts (replaces all alert() calls) ── */}
      <div className="fixed bottom-[22px] right-[22px] flex flex-col gap-2 z-[500] pointer-events-none" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={toastClasses(t.type)}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}
