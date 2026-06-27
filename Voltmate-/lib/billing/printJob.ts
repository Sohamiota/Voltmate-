export const BILLING_PRINT_STORAGE_KEY = 'billing-print-job';
const MAX_AGE_MS = 5 * 60 * 1000;

export type BillingPrintJob = {
  title: string;
  html: string;
  css: string;
};

type StoredJob = BillingPrintJob & { ts: number };

export function buildPrintHtml(job: BillingPrintJob): string {
  const title = job.title.replace(/</g, '\u003c');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>`
    + `<style>${job.css}</style></head><body>${job.html}</body></html>`;
}

/** Persist job for /billing-print fallback (localStorage is shared across tabs). */
export function storeBillingPrintJob(job: BillingPrintJob): void {
  const payload: StoredJob = { ...job, ts: Date.now() };
  try {
    localStorage.setItem(BILLING_PRINT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota — direct popup print still works */
  }
}

export function readBillingPrintJob(): BillingPrintJob | null {
  try {
    const raw = localStorage.getItem(BILLING_PRINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredJob;
    if (!parsed?.html || !parsed?.css) return null;
    if (Date.now() - (parsed.ts ?? 0) > MAX_AGE_MS) {
      clearBillingPrintJob();
      return null;
    }
    return { title: parsed.title, html: parsed.html, css: parsed.css };
  } catch {
    return null;
  }
}

export function clearBillingPrintJob(): void {
  localStorage.removeItem(BILLING_PRINT_STORAGE_KEY);
}

export function printWhenImagesReady(doc: Document, onReady: () => void): void {
  const imgs = Array.from(doc.images);
  if (imgs.length === 0) {
    onReady();
    return;
  }
  let pending = imgs.length;
  const done = () => {
    pending -= 1;
    if (pending <= 0) onReady();
  };
  imgs.forEach(img => {
    if (img.complete) done();
    else {
      img.onload = done;
      img.onerror = done;
    }
  });
}

/** Write document into a new window and print (no app shell). */
export function printBillingDocumentInWindow(job: BillingPrintJob): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;

  try {
    win.document.open();
    win.document.write(buildPrintHtml(job));
    win.document.close();
    printWhenImagesReady(win.document, () => {
      win.focus();
      win.print();
    });
    return true;
  } catch {
    win.close();
    return false;
  }
}

/** Legacy route fallback — opens /billing-print with job in localStorage. */
export function openBillingPrintRoute(job: BillingPrintJob): Window | null {
  storeBillingPrintJob(job);
  return window.open('/billing-print', '_blank');
}
