'use client';

import { useEffect, useState } from 'react';
import {
  buildPrintHtml,
  clearBillingPrintJob,
  printWhenImagesReady,
  readBillingPrintJob,
} from '@/lib/billing/printJob';

export default function BillingPrintPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    const job = readBillingPrintJob();
    if (!job) {
      setError('Nothing to print. Go back to Billing and click Print / Save PDF again.');
      return;
    }

    document.open();
    document.write(buildPrintHtml(job));
    document.close();
    clearBillingPrintJob();

    printWhenImagesReady(document, () => {
      window.focus();
      window.print();
    });
  }, []);

  if (!error) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#334155' }}>
        Preparing document for print…
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#334155', maxWidth: 480 }}>
      <p>{error}</p>
      <p>
        <a href="/billing">Return to Billing</a>
      </p>
    </div>
  );
}
