'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, getStoredToken } from '@/src/api/client';
import { listBillingDocuments, saveBillingDocument } from '@/lib/billing/api';
import {
  countLocalBillingDocuments,
  deleteLocalBillingDocument,
  listLocalBillingDocuments,
  type LocalEntry,
} from '@/lib/billing/localArchive';
import type { BillingDocType, BillingDocumentRecord } from '@/lib/billing/types';
import { printHtmlInIframe } from '@/lib/printDocument';

type Props = {
  docType: BillingDocType;
  printCss: string;
  onReload?: (doc: BillingDocumentRecord) => void;
  refreshKey?: number;
};

type SavedRow = BillingDocumentRecord & { local?: boolean; html_snapshot?: string };

function matchesSearch(doc: SavedRow, q: string): boolean {
  if (!q) return true;
  const hay = [
    doc.doc_no,
    doc.customer_name,
    doc.customer_phone,
    doc.vehicle_model,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

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

function openLocalHtml(html: string, title: string) {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export default function SavedDocumentsPanel({ docType, printCss, onReload, refreshKey = 0 }: Props) {
  const [docs, setDocs] = useState<SavedRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const localOnlyCount = countLocalBillingDocuments(docType);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const q = search.trim();
    try {
      let serverRows: BillingDocumentRecord[] = [];
      try {
        serverRows = await listBillingDocuments({
          doc_type: docType,
          search: q || undefined,
          limit: 50,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load server documents');
      }

      const localRows = listLocalBillingDocuments(docType).filter(r => matchesSearch(r, q));
      const merged = [...serverRows, ...localRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setDocs(merged);
    } finally {
      setLoading(false);
    }
  }, [docType, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  async function handlePrint(doc: SavedRow) {
    try {
      if (doc.local) {
        if (!doc.html_snapshot) throw new Error('No print data on this device copy');
        printHtmlInIframe({
          html: doc.html_snapshot,
          title: doc.doc_no,
          css: printCss,
        });
        return;
      }
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

  async function handleSync(doc: LocalEntry) {
    setSyncingId(doc.id);
    try {
      await saveBillingDocument({
        doc_type: doc.doc_type,
        doc_no: doc.doc_no,
        doc_date: String(doc.doc_date).slice(0, 10),
        customer_name: doc.customer_name ?? undefined,
        customer_phone: doc.customer_phone ?? undefined,
        vehicle_model: doc.vehicle_model ?? undefined,
        grand_total: doc.grand_total ?? undefined,
        payload: doc.payload,
        html_snapshot: doc.html_snapshot,
        visit_id: doc.visit_id,
      });
      deleteLocalBillingDocument(doc.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  const hasLocal = docs.some(d => d.local);
  const hasDrive = docs.some(d => d.drive_web_link);

  return (
    <div className="bill-saved-panel">
      <div className="bill-saved-hdr">
        <div>
          <div className="bill-saved-title">
            Saved {docType === 'quotation' ? 'quotations' : 'money receipts'}
          </div>
          <div className="bill-saved-sub">
            Documents on the server
            {hasLocal ? ', this device' : ''}
            {hasDrive ? ', and Google Drive' : ''}.
          </div>
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
        <div className="bill-visit-empty">
          {localOnlyCount > 0 ? (
            <>
              {localOnlyCount} {docType === 'quotation' ? 'quotation' : 'receipt'}{localOnlyCount === 1 ? '' : 's'} saved on this browser only
              {error ? ` (${error.toLowerCase()})` : ''}. Click Refresh — if still missing, the site needs the latest update deployed.
            </>
          ) : error ? (
            <>Could not load from server ({error}). No documents saved on this device yet.</>
          ) : (
            <>No saved documents yet. Use Save document to archive.</>
          )}
        </div>
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
                <tr key={`${doc.local ? 'local' : 'server'}-${doc.id}`}>
                  <td>
                    <strong>{doc.doc_no}</strong>
                    {doc.local && <div className="bill-saved-muted">This device</div>}
                  </td>
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
                      {doc.local ? (
                        doc.html_snapshot ? (
                          <button
                            type="button"
                            className="bill-btn bill-btn-ghost"
                            onClick={() => openLocalHtml(doc.html_snapshot!, doc.doc_no)}
                          >
                            Open
                          </button>
                        ) : null
                      ) : (
                        <button type="button" className="bill-btn bill-btn-ghost" onClick={() => openDocumentFile(doc.id, doc.doc_no)}>Open</button>
                      )}
                      <button type="button" className="bill-btn bill-btn-ghost" onClick={() => handlePrint(doc)}>Print</button>
                      {onReload && (
                        <button type="button" className="bill-btn bill-btn-ghost" onClick={() => onReload(doc)}>Reload</button>
                      )}
                      {doc.local && (
                        <button
                          type="button"
                          className="bill-btn bill-btn-ghost"
                          disabled={syncingId === doc.id}
                          onClick={() => handleSync(doc as LocalEntry)}
                        >
                          {syncingId === doc.id ? 'Syncing…' : 'Sync to server'}
                        </button>
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
