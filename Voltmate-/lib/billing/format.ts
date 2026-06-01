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

export function receiptTotalAmount(cash: number, upi: number): number {
  return Math.round(Math.max(0, cash)) + Math.round(Math.max(0, upi));
}

/** Payment clause for margin money receipt e.g. "cash RS 50000/- and UPI RS 22903/- (Ref: xxx)" */
export function receiptPaymentNarrative(cash: number, upi: number, upiRef?: string): string {
  const c = Math.round(Math.max(0, cash));
  const u = Math.round(Math.max(0, upi));
  const parts: string[] = [];
  if (c > 0) parts.push(`cash ${fmtReceiptAmount(c)}`);
  if (u > 0) {
    let upiPart = `UPI ${fmtReceiptAmount(u)}`;
    if (upiRef?.trim()) upiPart += ` (Ref: ${upiRef.trim()})`;
    parts.push(upiPart);
  }
  if (parts.length === 0) return 'cash';
  return parts.join(' and ');
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
