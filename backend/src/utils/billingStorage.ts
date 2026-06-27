import fs from 'fs';
import path from 'path';

export const BILLING_UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads', 'billing');

export function saveBillingHtmlFile(
  docType: 'quotation' | 'receipt',
  docNo: string,
  docDate: string,
  html: string,
  css: string,
): string {
  const d = new Date(`${docDate}T00:00:00`);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const safeNo = docNo.replace(/[/\\:*?"<>|]/g, '-');
  const dir = path.join(BILLING_UPLOAD_ROOT, docType === 'quotation' ? 'quotations' : 'receipts', year, month);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${safeNo}.html`;
  const fullPath = path.join(dir, filename);
  const document = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeNo}</title>`
    + `<style>${css}</style></head><body>${html}</body></html>`;
  fs.writeFileSync(fullPath, document, 'utf8');

  return path.join('uploads', 'billing', docType === 'quotation' ? 'quotations' : 'receipts', year, month, filename)
    .replace(/\\/g, '/');
}

export function resolveBillingAbsolute(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.includes('..')) throw new Error('invalid_path');
  return path.join(__dirname, '..', '..', normalized);
}

export function readBillingFile(relativePath: string): string {
  const abs = resolveBillingAbsolute(relativePath);
  if (!fs.existsSync(abs)) throw new Error('file_not_found');
  return fs.readFileSync(abs, 'utf8');
}
