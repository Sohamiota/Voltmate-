import type { QuoteTableRow, ReceiptDraft } from './types';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`.trim();
}

function sectionToWords(n: number, label: string): string {
  if (n === 0) return '';
  if (n === 1) return `One ${label}`;
  return `${twoDigits(n)} ${label}${n > 1 ? 's' : ''}`;
}

function amountParts(n: number): string[] {
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  const parts: string[] = [];
  if (crore) parts.push(sectionToWords(crore, 'Crore'));
  if (lakh) parts.push(sectionToWords(lakh, 'Lakh'));
  if (thousand) parts.push(sectionToWords(thousand, 'Thousand'));
  if (hundred) parts.push(sectionToWords(hundred, 'Hundred'));
  if (rest) parts.push(twoDigits(rest));
  return parts;
}

/** Indian numbering: Rupees in words (whole rupees only). */
export function amountInWords(amount: number): string {
  const n = Math.round(Math.max(0, amount));
  if (n === 0) return 'Zero Rupees Only';
  return `${amountParts(n).join(' ')} Rupees Only`;
}

/** Receipt style: "Seventy Two Thousand Nine Hundred Three Only." */
export function amountInWordsReceipt(amount: number): string {
  const n = Math.round(Math.max(0, amount));
  if (n === 0) return 'Zero Only.';
  return `${amountParts(n).join(' ')} Only.`;
}

/** Indian FY label e.g. 26-27 for May 2026. */
export function financialYearLabel(dateIso?: string): string {
  const [start, end] = financialYearParts(dateIso);
  return `${start}-${end}`;
}

export function financialYearParts(dateIso?: string): [string, string] {
  const d = dateIso ? new Date(`${dateIso}T00:00:00`) : new Date();
  const month = d.getMonth();
  const year = d.getFullYear();
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return [String(fyStart).slice(-2), String(fyEnd).slice(-2)];
}

/** Receipt date: 26.05.2026 */
export function fmtReceiptDateDot(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Booking date: 26/05/2026 */
export function fmtBookingDateSlash(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function fmtReceiptAmount(amount: number): string {
  return `RS ${Math.round(Math.max(0, amount))}/-`;
}

export type ReceiptPaymentSlice = Pick<
  ReceiptDraft,
  'cashAmount' | 'upiAmount' | 'chequeAmount' | 'bankTransferAmount'
>;

export function receiptTotalAmount(payments: ReceiptPaymentSlice): number {
  return (
    Math.round(Math.max(0, payments.cashAmount)) +
    Math.round(Math.max(0, payments.upiAmount)) +
    Math.round(Math.max(0, payments.chequeAmount ?? 0)) +
    Math.round(Math.max(0, payments.bankTransferAmount ?? 0))
  );
}

/** Cheque line on printed receipt e.g. "Cheque No. 123456 · HDFC Bank · Dated 26/05/2026" */
export function formatChequeRemarks(chequeNo?: string, chequeBank?: string, chequeDate?: string): string {
  const parts: string[] = [];
  if (chequeNo?.trim()) parts.push(`Cheque No. ${chequeNo.trim()}`);
  if (chequeBank?.trim()) parts.push(chequeBank.trim());
  if (chequeDate?.trim()) parts.push(`Dated ${fmtBookingDateSlash(chequeDate)}`);
  return parts.length ? parts.join(' · ') : '—';
}

/** Bank transfer line e.g. "RTGS · Ref: UTR123456789" */
export function formatBankTransferRemarks(mode?: string, ref?: string): string {
  const parts: string[] = [];
  if (mode?.trim()) parts.push(mode.trim());
  if (ref?.trim()) parts.push(`Ref: ${ref.trim()}`);
  return parts.length ? parts.join(' · ') : '—';
}

/** Payment clause for margin money receipt narrative block. */
export function receiptPaymentNarrative(receipt: Pick<
  ReceiptDraft,
  | 'cashAmount'
  | 'upiAmount'
  | 'upiRef'
  | 'chequeAmount'
  | 'chequeNo'
  | 'chequeBank'
  | 'chequeDate'
  | 'bankTransferAmount'
  | 'bankTransferMode'
  | 'bankTransferRef'
>): string {
  const parts: string[] = [];
  const c = Math.round(Math.max(0, receipt.cashAmount));
  const u = Math.round(Math.max(0, receipt.upiAmount));
  const ch = Math.round(Math.max(0, receipt.chequeAmount ?? 0));
  const bt = Math.round(Math.max(0, receipt.bankTransferAmount ?? 0));

  if (c > 0) parts.push(`cash ${fmtReceiptAmount(c)}`);
  if (u > 0) {
    let upiPart = `UPI ${fmtReceiptAmount(u)}`;
    if (receipt.upiRef?.trim()) upiPart += ` (Ref: ${receipt.upiRef.trim()})`;
    parts.push(upiPart);
  }
  if (ch > 0) {
    let chequePart = `Cheque ${fmtReceiptAmount(ch)}`;
    const remarks = formatChequeRemarks(receipt.chequeNo, receipt.chequeBank, receipt.chequeDate);
    if (remarks !== '—') chequePart += ` (${remarks})`;
    parts.push(chequePart);
  }
  if (bt > 0) {
    const mode = receipt.bankTransferMode?.trim() || 'Bank Transfer';
    let bankPart = `${mode} ${fmtReceiptAmount(bt)}`;
    if (receipt.bankTransferRef?.trim()) bankPart += ` (Ref: ${receipt.bankTransferRef.trim()})`;
    parts.push(bankPart);
  }
  if (parts.length === 0) return 'cash';
  return parts.join(' and ');
}

/** Fill defaults for saved receipts that pre-date cheque / bank-transfer fields. */
export function normalizeReceiptDraft(partial: Partial<ReceiptDraft>): ReceiptDraft {
  return {
    receiptNo: partial.receiptNo ?? '',
    date: partial.date ?? todayIso(),
    customerName: partial.customerName ?? '',
    customerPhone: partial.customerPhone ?? '',
    customerAddress: partial.customerAddress ?? '',
    cashAmount: partial.cashAmount ?? 0,
    upiAmount: partial.upiAmount ?? 0,
    upiRef: partial.upiRef ?? '',
    chequeAmount: partial.chequeAmount ?? 0,
    chequeNo: partial.chequeNo ?? '',
    chequeDate: partial.chequeDate ?? '',
    chequeBank: partial.chequeBank ?? '',
    bankTransferAmount: partial.bankTransferAmount ?? 0,
    bankTransferMode: partial.bankTransferMode ?? '',
    bankTransferRef: partial.bankTransferRef ?? '',
    vehicleModel: partial.vehicleModel ?? '',
    bookingDate: partial.bookingDate ?? partial.date ?? todayIso(),
    notes: partial.notes ?? '',
    visitId: partial.visitId ?? null,
    leadCustCode: partial.leadCustCode ?? null,
  };
}

export function fmtQuoteDateShort(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function fmtQuotePrice(amount: number): string {
  return `₹ ${Math.round(Math.max(0, amount)).toLocaleString('en-IN')}`;
}

export function fmtQuotePriceDecimal(amount: number): string {
  return `₹ ${Math.max(0, amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function newQuoteRow(partial?: Partial<QuoteTableRow>): QuoteTableRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: '',
    amount: 0,
    remarks: '',
    ...partial,
  };
}

export function defaultQuoteRows(vehicleName: string, vehicleRemarks = ''): QuoteTableRow[] {
  return [
    newQuoteRow({ id: 'row-vehicle', description: vehicleName, amount: 0, remarks: vehicleRemarks }),
    newQuoteRow({ id: 'row-insurance', description: 'Insurance charges', amount: 26000, remarks: '' }),
    newQuoteRow({ id: 'row-registration', description: 'Registration charges', amount: 12000, remarks: '' }),
  ];
}

export function quoteGrandTotal(rows: { amount: number }[]): number {
  return rows.reduce((s, r) => s + Math.round(Math.max(0, r.amount)), 0);
}

export function fmtInr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function lineTotal(item: { qty: number; rate: number }): number {
  return Math.round(item.qty * item.rate);
}

export function sumLines(items: { qty: number; rate: number }[]): number {
  return items.reduce((s, i) => s + lineTotal(i), 0);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDisplayDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function newLineItem(): { id: string; description: string; qty: number; rate: number } {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, description: '', qty: 1, rate: 0 };
}
