import { get, post } from '@/src/api/client';
import type { BillingDocType, BillingDocumentRecord, CompanyProfile, QuotationDraft, ReceiptDraft } from '@/lib/billing/types';

export async function fetchNextDocNo(docType: BillingDocType, docDate: string): Promise<string> {
  const data = await get(`/billing/next-number?type=${docType}&date=${encodeURIComponent(docDate)}`);
  return data.doc_no as string;
}

export async function saveBillingDocument(input: {
  doc_type: BillingDocType;
  doc_no: string;
  doc_date: string;
  customer_name?: string;
  customer_phone?: string;
  vehicle_model?: string;
  grand_total?: number;
  payload: Record<string, unknown>;
  html_snapshot?: string;
  print_css?: string;
  visit_id?: number | null;
  update_visit_status?: boolean;
}): Promise<BillingDocumentRecord> {
  const data = await post('/billing', input);
  return data.document as BillingDocumentRecord;
}

export async function listBillingDocuments(opts: {
  doc_type?: BillingDocType;
  visit_id?: number;
  search?: string;
  limit?: number;
}): Promise<BillingDocumentRecord[]> {
  const params = new URLSearchParams();
  if (opts.doc_type) params.set('doc_type', opts.doc_type);
  if (opts.visit_id) params.set('visit_id', String(opts.visit_id));
  if (opts.search) params.set('search', opts.search);
  if (opts.limit) params.set('limit', String(opts.limit));
  const q = params.toString();
  const data = await get(`/billing${q ? `?${q}` : ''}`);
  return (data.documents ?? []) as BillingDocumentRecord[];
}

export function buildQuotationPayload(quote: QuotationDraft, company: CompanyProfile) {
  return { quote, company };
}

export function buildReceiptPayload(receipt: ReceiptDraft, company: CompanyProfile) {
  return { receipt, company };
}
