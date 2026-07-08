import { Request, Response } from 'express';
import {
  getBillingDocumentById,
  listBillingDocuments,
  nextBillingDocNo,
  saveBillingDocument,
  type BillingDocType,
} from '../services/billingService';
import { readBillingFile } from '../utils/billingStorage';
import { optPlainText, optDate, collectErrors } from '../utils/validate';

function parseDocType(raw: unknown): BillingDocType | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'quotation' || v === 'receipt') return v;
  return null;
}

export async function getNextNumber(req: Request, res: Response) {
  try {
    const docType = parseDocType(req.query.type);
    const docDate = optDate(req.query.date);
    if (!docType) return res.status(400).json({ error: 'type must be quotation or receipt' });
    if (docDate.error || !docDate.value) return res.status(400).json({ error: docDate.error || 'date required' });

    const doc_no = await nextBillingDocNo(docType, docDate.value);
    return res.json({ doc_no, doc_type: docType, doc_date: docDate.value });
  } catch (e) {
    console.error('[billing next-number]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createDocument(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const body = req.body || {};

    const docType = parseDocType(body.doc_type);
    const vDate = optDate(body.doc_date);
    const vDocNo = optPlainText(body.doc_no, 'identifier', 80);
    const vCustomer = optPlainText(body.customer_name, 'name', 200);
    const vPhone = optPlainText(body.customer_phone, 'identifier', 30);
    const vVehicle = optPlainText(body.vehicle_model, 'note', 200);

    const fieldErr = collectErrors({
      doc_type: !docType ? 'must be quotation or receipt' : null,
      doc_date: vDate.error || (!vDate.value ? 'required' : null),
    });
    if (fieldErr) return res.status(400).json({ error: fieldErr });
    if (!body.payload || typeof body.payload !== 'object') {
      return res.status(400).json({ error: 'payload is required' });
    }
    if (typeof body.html_snapshot === 'string' && body.html_snapshot.length > 512_000) {
      return res.status(400).json({ error: 'html_snapshot too large' });
    }
    if (typeof body.print_css === 'string' && body.print_css.length > 64_000) {
      return res.status(400).json({ error: 'print_css too large' });
    }

    const grandTotal = body.grand_total != null ? Number(body.grand_total) : null;
    const visitId = body.visit_id != null ? Number(body.visit_id) : null;

    const doc = await saveBillingDocument({
      docType: docType!,
      docNo: vDocNo.value || undefined,
      docDate: vDate.value!,
      customerName: vCustomer.value || undefined,
      customerPhone: vPhone.value || undefined,
      vehicleModel: vVehicle.value || undefined,
      grandTotal: Number.isFinite(grandTotal!) ? grandTotal! : undefined,
      payload: body.payload,
      htmlSnapshot: typeof body.html_snapshot === 'string' ? body.html_snapshot : undefined,
      printCss: typeof body.print_css === 'string' ? body.print_css : undefined,
      visitId: Number.isFinite(visitId!) ? visitId : null,
      updateVisitStatus: Boolean(body.update_visit_status),
      createdBy: user?.sub ?? null,
    });

    return res.status(201).json({ document: doc });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'visit_not_found') return res.status(404).json({ error: 'Visit not found' });
    if (msg.includes('duplicate key') || msg.includes('billing_documents_doc_no')) {
      return res.status(409).json({ error: 'Document number already exists' });
    }
    console.error('[billing create]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listDocuments(req: Request, res: Response) {
  try {
    const docType = parseDocType(req.query.doc_type);
    const visitId = req.query.visit_id != null ? Number(req.query.visit_id) : undefined;
    const search = optPlainText(req.query.search, 'note', 100).value || undefined;
    const limit = req.query.limit != null ? Number(req.query.limit) : 50;
    const offset = req.query.offset != null ? Number(req.query.offset) : 0;

    const result = await listBillingDocuments({
      docType: docType ?? undefined,
      visitId: Number.isFinite(visitId!) ? visitId : undefined,
      search,
      limit,
      offset,
    });

    return res.json(result);
  } catch (e) {
    console.error('[billing list]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getDocument(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const doc = await getBillingDocumentById(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json({ document: doc });
  } catch (e) {
    console.error('[billing get]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getDocumentFile(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const doc = await getBillingDocumentById(id);
    if (!doc?.file_path) return res.status(404).json({ error: 'File not found' });

    const html = readBillingFile(doc.file_path as string);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'file_not_found') return res.status(404).json({ error: 'File not found' });
    console.error('[billing file]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
