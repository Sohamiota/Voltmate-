import type { BillingDocType, BillingDocumentRecord } from '@/lib/billing/types';

const STORAGE_KEY = 'billing-local-archive-v1';

type LocalEntry = BillingDocumentRecord & { local: true };

function readAll(): LocalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: LocalEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 100)));
}

export function listLocalBillingDocuments(docType?: BillingDocType): LocalEntry[] {
  const rows = readAll();
  return docType ? rows.filter(r => r.doc_type === docType) : rows;
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
  visit_id?: number | null;
  lead_cust_code?: string | null;
}): LocalEntry {
  const entry: LocalEntry = {
    id: Date.now(),
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
  };

  writeAll([entry, ...readAll()]);
  return entry;
}

export function deleteLocalBillingDocument(id: number): void {
  writeAll(readAll().filter(r => r.id !== id));
}
