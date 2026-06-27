type PrintInIframeOptions = {
  html: string;
  title: string;
  css: string;
};

/** Print isolated HTML in a hidden iframe (no app shell / nav chrome). */
export function printHtmlInIframe({ html, title, css }: PrintInIframeOptions): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
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
    setTimeout(() => iframe.remove(), 500);
  };

  const triggerPrint = () => {
    win.focus();
    win.print();
    cleanup();
  };

  const imgs = Array.from(doc.images);
  if (imgs.length === 0) {
    triggerPrint();
    return;
  }

  let pending = imgs.length;
  const onImageReady = () => {
    pending -= 1;
    if (pending <= 0) triggerPrint();
  };

  imgs.forEach(img => {
    if (img.complete) onImageReady();
    else {
      img.onload = onImageReady;
      img.onerror = onImageReady;
    }
  });
}

/** Print a DOM node by id, using optional extra CSS for document styling. */
export function printElementById(elementId: string, title: string, css = ''): boolean {
  const root = document.getElementById(elementId);
  if (!root) return false;
  printHtmlInIframe({ html: root.outerHTML, title, css });
  return true;
}
