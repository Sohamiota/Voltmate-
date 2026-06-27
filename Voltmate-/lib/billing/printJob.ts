export const BILLING_PRINT_STORAGE_KEY = 'billing-print-job';

export type BillingPrintJob = {
  title: string;
  html: string;
  css: string;
};

export function storeBillingPrintJob(job: BillingPrintJob): void {
  sessionStorage.setItem(BILLING_PRINT_STORAGE_KEY, JSON.stringify(job));
}

export function readBillingPrintJob(): BillingPrintJob | null {
  try {
    const raw = sessionStorage.getItem(BILLING_PRINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BillingPrintJob;
    if (!parsed?.html || !parsed?.css) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearBillingPrintJob(): void {
  sessionStorage.removeItem(BILLING_PRINT_STORAGE_KEY);
}

/** Open a shell-free print page — only the quotation/receipt is printed. */
export function openBillingPrintWindow(job: BillingPrintJob): Window | null {
  storeBillingPrintJob(job);
  return window.open('/billing-print', '_blank', 'noopener,noreferrer');
}
