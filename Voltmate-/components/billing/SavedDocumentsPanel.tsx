'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, getStoredToken } from '@/src/api/client';
import { listBillingDocuments } from '@/lib/billing/api';
import type { BillingDocType, BillingDocumentRecord } from '@/lib/billing/types';
import { printHtmlInIframe } from '@/lib/printDocument';

type Props = {
  docType: BillingDocType;
  printCss: string;
  onReload?: (doc: BillingDocumentRecord) => void;
  refreshKey?: number;
};

async function openDocumentFile(id: number, title: string) {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}/billing/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Could not open document');
  const html = await res.text();
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export default function SavedDocumentsPanel({ docType, printCss, onReload, refreshKey = 0 }: Props) {
  const [docs, setDocs] = useState<BillingDocumentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listBillingDocuments({
        doc_type: docType,
        search: search.trim() || undefined,
        limit: 50,
      });
      setDocs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved documents');
    } finally {
      setLoading(false);
    }
  }, [docType, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  async function handlePrint(doc: BillingDocumentRecord) {
    try {
      const token = getStoredToken();
      const res = await fetch(`${API_BASE}/billing/${doc.id}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not load document');
      const html = await res.text();
      const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const body = match ? match[1] : html;
      printHtmlInIframe({
        html: body,
        title: doc.doc_no,
        css: printCss,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Print failed');
    }
  }

  return (
    <div className="bill-saved-panel">
      <div className="bill-saved-hdr">
        <div>
          <div className="bill-saved-title">
            Saved {docType === 'quotation' ? 'quotations' : 'money receipts'}
          </div>
          <div className="bill-saved-sub">Documents stored in the system{docs.some(d => d.drive_web_link) ? ' and Google Drive' : ''}.</div>
        </div>
        <button type="button" className="bill-btn bill-btn-ghost" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <input
        className="bill-visit-search"
        placeholder="Search doc no, customer, phone, vehicle…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {error && <div className="bill-visit-error">{error}</div>}
      {loading && <div className="bill-visit-empty">Loading…</div>}

      {!loading && docs.length === 0 && (
        <div className="bill-visit-empty">No saved documents yet. Use Save document to archive.</div>
      )}

      {docs.length > 0 && (
        <div className="bill-saved-table-wrap">
          <table className="bill-saved-table">
            <thead>
              <tr>
                <th>Doc no</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Amount</th>
                <th>Visit</th>
                <th>Saved by</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id}>
                  <td><strong>{doc.doc_no}</strong></td>
                  <td>{String(doc.doc_date).slice(0, 10)}</td>
                  <td>
                    <div>{doc.customer_name || '—'}</div>
                    {doc.customer_phone && <div className="bill-saved-muted">{doc.customer_phone}</div>}
                  </td>
                  <td>{doc.vehicle_model || '—'}</td>
                  <td>{doc.grand_total != null ? `₹${doc.grand_total.toLocaleString('en-IN')}` : '—'}</td>
                  <td>
                    {doc.visit_id ? (
                      <>
                        <div>#{doc.visit_id}</div>
                        <div className="bill-saved-muted">{doc.visit_status || '—'}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td>
                    <div>{doc.created_by_name || '—'}</div>
                    <div className="bill-saved-muted">{new Date(doc.created_at).toLocaleDateString('en-IN')}</div>
                  </td>
                  <td>
                    <div className="bill-saved-actions">
                      <button type="button" className="bill-btn bill-btn-ghost" onClick={() => openDocumentFile(doc.id, doc.doc_no)}>Open</button>
                      <button type="button" className="bill-btn bill-btn-ghost" onClick={() => handlePrint(doc)}>Print</button>
                      {onReload && (
                        <button type="button" className="bill-btn bill-btn-ghost" onClick={() => onReload(doc)}>Reload</button>
                      )}
                      {doc.drive_web_link && (
                        <a className="bill-btn bill-btn-ghost" href={doc.drive_web_link} target="_blank" rel="noreferrer">Drive</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
