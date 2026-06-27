import type { BillingDocType, BillingDocumentRecord } from '@/lib/billing/types';

const STORAGE_KEY = 'billing-local-archive-v1';
const HTML_KEY_PREFIX = 'billing-local-html-';

export type LocalEntry = BillingDocumentRecord & { local: true; html_snapshot?: string };

function htmlKey(id: number) {
  return `${HTML_KEY_PREFIX}${id}`;
}

function readHtml(id: number): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(htmlKey(id)) ?? undefined;
}

function writeHtml(id: number, html: string | undefined) {
  if (typeof window === 'undefined' || !html) return;
  try {
    localStorage.setItem(htmlKey(id), html);
  } catch {
    /* quota — list entry still saved without print HTML */
  }
}

function deleteHtml(id: number) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(htmlKey(id));
}

function readAll(): LocalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<LocalEntry & { html_snapshot?: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(row => ({
      ...row,
      local: true as const,
      html_snapshot: row.html_snapshot ?? readHtml(row.id),
    }));
  } catch {
    return [];
  }
}

function writeAll(entries: LocalEntry[]) {
  const slim = entries.map(({ html_snapshot: _html, ...rest }) => rest);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim.slice(0, 100)));
  } catch {
    throw new Error('Could not save on this device — browser storage is full. Clear old data or sync to server.');
  }
}

export function listLocalBillingDocuments(docType?: BillingDocType): LocalEntry[] {
  const rows = readAll();
  return docType ? rows.filter(r => r.doc_type === docType) : rows;
}

export function countLocalBillingDocuments(docType?: BillingDocType): number {
  return listLocalBillingDocuments(docType).length;
}

export function saveLocalBillingDocument(input: {
  doc_type: BillingDocType;
  doc_no: string;
  doc_date: string;
  customer_name?: string;
  customer_phone?: string;
  vehicle_model?: string;
  grand_total?: number;
  payload: Record<string, unknown>;
  html_snapshot?: string;
  visit_id?: number | null;
  lead_cust_code?: string | null;
}): LocalEntry {
  const id = Date.now();
  if (input.html_snapshot) writeHtml(id, input.html_snapshot);

  const entry: LocalEntry = {
    id,
    doc_type: input.doc_type,
    doc_no: input.doc_no,
    doc_date: input.doc_date,
    customer_name: input.customer_name ?? null,
    customer_phone: input.customer_phone ?? null,
    vehicle_model: input.vehicle_model ?? null,
    grand_total: input.grand_total ?? null,
    payload: input.payload,
    visit_id: input.visit_id ?? null,
    lead_id: null,
    lead_cust_code: input.lead_cust_code ?? null,
    file_path: null,
    created_by: null,
    created_by_name: 'This device',
    created_at: new Date().toISOString(),
    drive_file_id: null,
    drive_web_link: null,
    drive_upload_status: 'local',
    drive_error: null,
    visit_status: null,
    visit_date: null,
    visit_next_action: null,
    visit_next_action_date: null,
    visit_cust_name: null,
    local: true,
    html_snapshot: input.html_snapshot,
  };

  writeAll([entry, ...readAll()]);
  return entry;
}

export function deleteLocalBillingDocument(id: number): void {
  deleteHtml(id);
  writeAll(readAll().filter(r => r.id !== id));
}

export function getLocalBillingDocument(id: number): LocalEntry | undefined {
  return readAll().find(r => r.id === id);
}
