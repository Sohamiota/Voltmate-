import { financialYearParts } from './format';

/** Margin money receipt no. e.g. 26/27/05-05 (FY / month / serial). */
export function nextReceiptNo(dateIso?: string): string {
  if (typeof window === 'undefined') return '26/27/01-01';
  const iso = dateIso ?? new Date().toISOString().slice(0, 10);
  const [fyStart, fyEnd] = financialYearParts(iso);
  const d = new Date(`${iso}T00:00:00`);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const storeKey = `billing_mr_${fyStart}_${fyEnd}_${mm}`;
  const prev = parseInt(localStorage.getItem(storeKey) || '0', 10);
  const next = prev + 1;
  localStorage.setItem(storeKey, String(next));
  return `${fyStart}/${fyEnd}/${mm}-${String(next).padStart(2, '0')}`;
}

/** Quotation no. e.g. VW-2627-05/10 */
export function nextQuoteNo(dateIso?: string): string {
  if (typeof window === 'undefined') return 'VW-2627-01/01';
  const iso = dateIso ?? new Date().toISOString().slice(0, 10);
  const [fyStart, fyEnd] = financialYearParts(iso);
  const d = new Date(`${iso}T00:00:00`);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const storeKey = `billing_qt_${fyStart}${fyEnd}_${mm}`;
  const prev = parseInt(localStorage.getItem(storeKey) || '0', 10);
  const next = prev + 1;
  localStorage.setItem(storeKey, String(next));
  return `VW-${fyStart}${fyEnd}-${mm}/${String(next).padStart(2, '0')}`;
}
