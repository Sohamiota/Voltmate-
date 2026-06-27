import {
  openBillingPrintRoute,
  printBillingDocumentInWindow,
  printWhenImagesReady,
  type BillingPrintJob,
} from '@/lib/billing/printJob';

type PrintInIframeOptions = BillingPrintJob;

/** Print isolated HTML in a hidden iframe (fallback when popup is blocked). */
export function printHtmlInIframe({ html, title, css }: PrintInIframeOptions): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:820px;height:1200px;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>`
    + `<style>${css}</style></head><body>${html}</body></html>`,
  );
  doc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  printWhenImagesReady(doc, () => {
    win.focus();
    win.print();
    cleanup();
  });
}

/** Print a billing document without app navigation chrome. */
export function printBillingDocument(job: BillingPrintJob): void {
  if (printBillingDocumentInWindow(job)) return;

  const routeWin = openBillingPrintRoute(job);
  if (routeWin) return;

  const useFallback = window.confirm(
    'Could not open a print window. Allow pop-ups for this site, or click OK for inline fallback print.',
  );
  if (useFallback) printHtmlInIframe(job);
}

/** Print a DOM node by id. */
export function printElementById(elementId: string, title: string, css = ''): boolean {
  const root = document.getElementById(elementId);
  if (!root) return false;
  printBillingDocument({ html: root.outerHTML, title, css });
  return true;
}

/** Download document HTML as a file (works offline). */
export function downloadBillingHtml(job: BillingPrintJob): void {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${job.title}</title>`
    + `<style>${job.css}</style></head><body>${job.html}</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${job.title.replace(/[/\\:*?"<>|]/g, '-')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
