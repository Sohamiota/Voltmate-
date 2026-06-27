'use client';

import { useEffect, useState } from 'react';
import { clearBillingPrintJob, readBillingPrintJob } from '@/lib/billing/printJob';

export default function BillingPrintPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    const job = readBillingPrintJob();
    if (!job) {
      setError('Nothing to print. Go back to Billing and click Print / Save PDF again.');
      return;
    }

    document.title = job.title;

    const style = document.createElement('style');
    style.textContent = job.css;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = job.html;
    document.body.appendChild(wrap);
    document.body.style.margin = '0';
    document.body.style.background = '#fff';

    clearBillingPrintJob();

    const printWhenReady = () => {
      window.focus();
      window.print();
    };

    const imgs = Array.from(document.images);
    if (imgs.length === 0) {
      printWhenReady();
      return;
    }

    let pending = imgs.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) printWhenReady();
    };

    imgs.forEach(img => {
      if (img.complete) done();
      else {
        img.onload = done;
        img.onerror = done;
      }
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
