import { query } from '../db';
import {
  financialYearParts,
  formatQuoteNo,
  formatReceiptNo,
} from '../utils/billingNumbering';
import { saveBillingHtmlFile } from '../utils/billingStorage';
import { BILLING_PRINT_CSS } from '../utils/billingPrintCss';
import { uploadBillingFileToDrive } from './googleDriveService';

export type BillingDocType = 'quotation' | 'receipt';

export type SaveBillingDocumentInput = {
  docType: BillingDocType;
  docNo?: string;
  docDate: string;
  customerName?: string;
  customerPhone?: string;
  vehicleModel?: string;
  grandTotal?: number;
  payload: Record<string, unknown>;
  htmlSnapshot?: string;
  printCss?: string;
  visitId?: number | null;
  updateVisitStatus?: boolean;
  createdBy: number | null;
};

let schemaReady = false;
async function ensureBillingSchema() {
  if (schemaReady) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS billing_number_sequences (
        doc_type TEXT NOT NULL CHECK (doc_type IN ('quotation', 'receipt')),
        fy_start SMALLINT NOT NULL,
        fy_end SMALLINT NOT NULL,
        month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
        last_serial INT NOT NULL DEFAULT 0,
        PRIMARY KEY (doc_type, fy_start, fy_end, month)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS billing_documents (
        id SERIAL PRIMARY KEY,
        doc_type TEXT NOT NULL CHECK (doc_type IN ('quotation', 'receipt')),
        doc_no TEXT NOT NULL UNIQUE,
        doc_date DATE NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        vehicle_model TEXT,
        grand_total NUMERIC(12, 2),
        payload JSONB NOT NULL,
        html_snapshot TEXT,
        print_css TEXT,
        file_path TEXT,
        visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
        lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        lead_cust_code TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        drive_file_id TEXT,
        drive_web_link TEXT,
        drive_upload_status TEXT NOT NULL DEFAULT 'skipped',
        drive_error TEXT
      )
    `);
  } catch {
    /* migration may have already run */
  }
  schemaReady = true;
}

export async function nextBillingDocNo(docType: BillingDocType, docDate: string): Promise<string> {
  await ensureBillingSchema();
  const d = new Date(`${docDate}T00:00:00`);
  const month = d.getMonth() + 1;
  const [fyStart, fyEnd] = financialYearParts(docDate);

  const r = await query(
    `INSERT INTO billing_number_sequences (doc_type, fy_start, fy_end, month, last_serial)
     VALUES ($1, $2, $3, $4, 1)
     ON CONFLICT (doc_type, fy_start, fy_end, month)
     DO UPDATE SET last_serial = billing_number_sequences.last_serial + 1
     RETURNING last_serial`,
    [docType, fyStart, fyEnd, month],
  );

  const serial = Number(r.rows[0]?.last_serial ?? 1);
  return docType === 'quotation'
    ? formatQuoteNo(fyStart, fyEnd, month, serial)
    : formatReceiptNo(fyStart, fyEnd, month, serial);
}

async function resolveVisitContext(visitId: number | null | undefined) {
  if (!visitId) return { leadId: null as number | null, leadCustCode: null as string | null };
  const r = await query(
    `SELECT v.lead_id, v.lead_cust_code FROM visits v WHERE v.id = $1`,
    [visitId],
  );
  if (!r.rows[0]) throw new Error('visit_not_found');
  return {
    leadId: r.rows[0].lead_id ?? null,
    leadCustCode: r.rows[0].lead_cust_code ?? null,
  };
}

export async function saveBillingDocument(input: SaveBillingDocumentInput) {
  await ensureBillingSchema();

  const docNo = input.docNo?.trim() || await nextBillingDocNo(input.docType, input.docDate);
  const visitCtx = await resolveVisitContext(input.visitId ?? null);

  let filePath: string | null = null;
  if (input.htmlSnapshot?.trim()) {
    filePath = saveBillingHtmlFile(
      input.docType,
      docNo,
      input.docDate,
      input.htmlSnapshot,
      input.printCss?.trim() || BILLING_PRINT_CSS,
    );
  }

  const insert = await query(
    `INSERT INTO billing_documents (
       doc_type, doc_no, doc_date, customer_name, customer_phone, vehicle_model, grand_total,
       payload, html_snapshot, print_css, file_path,
       visit_id, lead_id, lead_cust_code, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      input.docType,
      docNo,
      input.docDate,
      input.customerName?.trim() || null,
      input.customerPhone?.trim() || null,
      input.vehicleModel?.trim() || null,
      input.grandTotal ?? null,
      JSON.stringify(input.payload),
      input.htmlSnapshot || null,
      input.printCss || null,
      filePath,
      input.visitId ?? null,
      visitCtx.leadId,
      visitCtx.leadCustCode,
      input.createdBy,
    ],
  );

  const row = insert.rows[0];

  if (input.updateVisitStatus && input.visitId && input.docType === 'quotation') {
    await query(
      `UPDATE visits SET status = 'Quotation Shared', updated_at = NOW(), updated_by = COALESCE($2, updated_by)
       WHERE id = $1`,
      [input.visitId, input.createdBy],
    );
  }

  if (filePath) {
    try {
      const drive = await uploadBillingFileToDrive({
        docType: input.docType,
        docNo,
        docDate: input.docDate,
        filePath,
        customerName: input.customerName,
      });
      if (drive) {
        const upd = await query(
          `UPDATE billing_documents
           SET drive_file_id = $2, drive_web_link = $3, drive_upload_status = $4, drive_error = NULL
           WHERE id = $1 RETURNING *`,
          [row.id, drive.fileId, drive.webViewLink, 'uploaded'],
        );
        return mapBillingRow(upd.rows[0]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Drive upload failed';
      const upd = await query(
        `UPDATE billing_documents SET drive_upload_status = 'failed', drive_error = $2 WHERE id = $1 RETURNING *`,
        [row.id, msg.slice(0, 500)],
      );
      return mapBillingRow(upd.rows[0]);
    }
  }

  return mapBillingRow(row);
}

export async function listBillingDocuments(opts: {
  docType?: BillingDocType;
  visitId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  await ensureBillingSchema();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const params: unknown[] = [];
  const where: string[] = [];

  if (opts.docType) {
    params.push(opts.docType);
    where.push(`bd.doc_type = $${params.length}`);
  }
  if (opts.visitId) {
    params.push(opts.visitId);
    where.push(`bd.visit_id = $${params.length}`);
  }
  if (opts.search?.trim()) {
    params.push(`%${opts.search.trim()}%`);
    where.push(`(
      bd.doc_no ILIKE $${params.length}
      OR bd.customer_name ILIKE $${params.length}
      OR bd.customer_phone ILIKE $${params.length}
      OR bd.lead_cust_code ILIKE $${params.length}
      OR bd.vehicle_model ILIKE $${params.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit, offset);

  const r = await query(
    `SELECT bd.*,
            u.name AS created_by_name,
            v.status AS visit_status,
            v.visit_date,
            v.next_action AS visit_next_action,
            v.next_action_date AS visit_next_action_date,
            l.cust_name AS visit_cust_name
     FROM billing_documents bd
     LEFT JOIN users u ON u.id = bd.created_by
     LEFT JOIN visits v ON v.id = bd.visit_id
     LEFT JOIN leads l ON l.id = bd.lead_id
     ${whereSql}
     ORDER BY bd.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    documents: r.rows.map(mapBillingRow),
    limit,
    offset,
  };
}

export async function getBillingDocumentById(id: number) {
  await ensureBillingSchema();
  const r = await query(
    `SELECT bd.*,
            u.name AS created_by_name,
            v.status AS visit_status,
            v.visit_date,
            v.next_action AS visit_next_action,
            v.next_action_date AS visit_next_action_date
     FROM billing_documents bd
     LEFT JOIN users u ON u.id = bd.created_by
     LEFT JOIN visits v ON v.id = bd.visit_id
     WHERE bd.id = $1`,
    [id],
  );
  if (!r.rows[0]) return null;
  return mapBillingRow(r.rows[0]);
}

function mapBillingRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    doc_type: row.doc_type,
    doc_no: row.doc_no,
    doc_date: row.doc_date,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    vehicle_model: row.vehicle_model,
    grand_total: row.grand_total != null ? Number(row.grand_total) : null,
    payload: row.payload,
    visit_id: row.visit_id,
    lead_id: row.lead_id,
    lead_cust_code: row.lead_cust_code,
    file_path: row.file_path,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    drive_file_id: row.drive_file_id,
    drive_web_link: row.drive_web_link,
    drive_upload_status: row.drive_upload_status,
    drive_error: row.drive_error,
    visit_status: row.visit_status,
    visit_date: row.visit_date,
    visit_next_action: row.visit_next_action,
    visit_next_action_date: row.visit_next_action_date,
    visit_cust_name: row.visit_cust_name,
  };
}
