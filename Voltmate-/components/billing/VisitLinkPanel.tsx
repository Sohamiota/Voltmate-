'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Visit } from '@/types/api';
import { API_BASE, getStoredToken } from '@/src/api/client';
import { listBillingDocuments } from '@/lib/billing/api';
import type { BillingDocumentRecord } from '@/lib/billing/types';

export type LinkedVisit = {
  id: number;
  leadCustCode: string | null;
  custName: string;
  phone: string;
  address: string;
  vehicle: string;
  status: string;
  visitDate: string;
  nextAction: string;
  nextActionDate: string;
  salesperson: string;
  note: string;
};

type Props = {
  linkedVisitId: number | null;
  onSelect: (visit: LinkedVisit | null) => void;
  onApplyToForm: (visit: LinkedVisit) => void;
  docType: 'quotation' | 'receipt';
};

function mapVisit(v: Visit): LinkedVisit {
  return {
    id: v.id,
    leadCustCode: v.lead_cust_code ?? null,
    custName: v.cust_name || '—',
    phone: v.phone_no || v.lead_phone_no || '',
    address: v.lead_location || '',
    vehicle: v.vehicle || '',
    status: v.status || '—',
    visitDate: v.visit_date || '—',
    nextAction: v.next_action || '—',
    nextActionDate: v.next_action_date || '—',
    salesperson: v.salesperson_name || '—',
    note: v.note || '',
  };
}

export default function VisitLinkPanel({ linkedVisitId, onSelect, onApplyToForm, docType }: Props) {
  const [search, setSearch] = useState('');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visitDocs, setVisitDocs] = useState<BillingDocumentRecord[]>([]);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getStoredToken();
      const res = await fetch(`${API_BASE}/visits/report?limit=500&include_lost=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not load visit reports');
      const data = await res.json();
      setVisits(data.visits ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visits.slice(0, 12);
    return visits.filter(v =>
      (v.cust_name || '').toLowerCase().includes(q)
      || (v.lead_cust_code || '').toLowerCase().includes(q)
      || (v.phone_no || '').includes(q)
      || (v.lead_phone_no || '').includes(q)
      || (v.vehicle || '').toLowerCase().includes(q)
      || (v.salesperson_name || '').toLowerCase().includes(q),
    ).slice(0, 20);
  }, [visits, search]);

  const selected = useMemo(() => {
    if (!linkedVisitId) return null;
    const v = visits.find(x => x.id === linkedVisitId);
    return v ? mapVisit(v) : null;
  }, [visits, linkedVisitId]);

  useEffect(() => {
    if (!linkedVisitId) {
      setVisitDocs([]);
      return;
    }
    listBillingDocuments({ visit_id: linkedVisitId, limit: 20 })
      .then(setVisitDocs)
      .catch(() => setVisitDocs([]));
  }, [linkedVisitId]);

  return (
    <div className="bill-visit-panel">
      <div className="bill-visit-hdr">
        <div>
          <div className="bill-visit-title">Link to visit report</div>
          <div className="bill-visit-sub">
            Review the customer visit before generating a {docType === 'quotation' ? 'quotation' : 'receipt'} follow-up.
          </div>
        </div>
        <button type="button" className="bill-btn bill-btn-ghost" onClick={loadVisits} disabled={loading}>
          Refresh visits
        </button>
      </div>

      <input
        className="bill-visit-search"
        placeholder="Search customer, code, phone, vehicle, salesperson…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {error && <div className="bill-visit-error">{error}</div>}

      {selected ? (
        <div className="bill-visit-selected">
          <div className="bill-visit-selected-hdr">
            <strong>Linked visit #{selected.id}</strong>
            <button type="button" className="bill-btn bill-btn-ghost" onClick={() => onSelect(null)}>Clear</button>
          </div>
          <div className="bill-visit-grid">
            <div><span>Customer</span><strong>{selected.custName}</strong></div>
            <div><span>Lead code</span><strong>{selected.leadCustCode || '—'}</strong></div>
            <div><span>Phone</span><strong>{selected.phone || '—'}</strong></div>
            <div><span>Vehicle</span><strong>{selected.vehicle || '—'}</strong></div>
            <div><span>Visit status</span><strong>{selected.status}</strong></div>
            <div><span>Visit date</span><strong>{selected.visitDate}</strong></div>
            <div><span>Next action</span><strong>{selected.nextAction}</strong></div>
            <div><span>Follow-up date</span><strong>{selected.nextActionDate}</strong></div>
            <div><span>Salesperson</span><strong>{selected.salesperson}</strong></div>
            <div className="bill-visit-wide"><span>Address</span><strong>{selected.address || '—'}</strong></div>
            {selected.note && (
              <div className="bill-visit-wide"><span>Visit note</span><strong>{selected.note}</strong></div>
            )}
          </div>
          <div className="bill-btn-row">
            <button type="button" className="bill-btn bill-btn-primary" onClick={() => onApplyToForm(selected)}>
              Apply customer details to {docType}
            </button>
          </div>

          {visitDocs.length > 0 && (
            <div className="bill-visit-prior">
              <div className="bill-visit-prior-title">Previous documents for this visit</div>
              <ul>
                {visitDocs.map(d => (
                  <li key={d.id}>
                    {d.doc_type === 'quotation' ? 'Quotation' : 'Receipt'} {d.doc_no}
                    {' · '}{d.doc_date}
                    {d.grand_total != null ? ` · ₹${d.grand_total.toLocaleString('en-IN')}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="bill-visit-list">
          {loading && <div className="bill-visit-empty">Loading visits…</div>}
          {!loading && filtered.length === 0 && (
            <div className="bill-visit-empty">No matching visits. Try a different search.</div>
          )}
          {filtered.map(v => {
            const row = mapVisit(v);
            return (
              <button
                key={v.id}
                type="button"
                className="bill-visit-row"
                onClick={() => onSelect(row)}
              >
                <div className="bill-visit-row-top">
                  <strong>{row.custName}</strong>
                  <span>{row.leadCustCode || `#${row.id}`}</span>
                </div>
                <div className="bill-visit-row-meta">
                  {row.vehicle || 'No vehicle'} · {row.status} · Visit {row.visitDate}
                </div>
                <div className="bill-visit-row-meta">
                  Next: {row.nextAction} {row.nextActionDate !== '—' ? `(${row.nextActionDate})` : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
