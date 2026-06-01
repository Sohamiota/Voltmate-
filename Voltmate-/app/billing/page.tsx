'use client';

import { useCallback, useEffect, useState } from 'react';
import BillingDocumentPreview from '@/components/billing/BillingDocumentPreview';
import { DEFAULT_COMPANY, detectCompanyAddress } from '@/lib/billing/company';
import {
  addDaysIso, receiptTotalAmount, todayIso,
} from '@/lib/billing/format';
import { nextQuoteNo, nextReceiptNo } from '@/lib/billing/numbering';
import { EULER_VEHICLES, EULER_VEHICLE_NAMES, resolveQuoteVehicle, vehicleByName } from '@/lib/billing/eulerVehicles';
import type {
  CompanyProfile, QuotationDraft, ReceiptDraft,
} from '@/lib/billing/types';

const DEFAULT_QUOTE_TERMS = `1. The above prices are inclusive of GST 5%
2. Prices are Subject to Change without notice and only those effective on date of delivery shall be charged
3. Insurance & registration/handling charges are approx., will be charged at actual
4. Prices are valid for 7 days from the date mentioned above.
5. Delivery against full payment within 15 days`;

const DEFAULT_INCLUSIONS = `1. GST included
2. Price inclusive of all discounts.`;

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  .bill-root{min-height:100vh;background:#0a0a0a;color:#e5e5e5;font-family:'Inter',system-ui,sans-serif;padding:clamp(14px,4vw,28px);}
  .bill-pg-hdr{margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  .bill-pg-title{font-size:clamp(20px,4vw,26px);font-weight:700;color:#fff;}
  .bill-pg-sub{color:#9ca3af;font-size:13px;margin-top:4px;max-width:520px;line-height:1.45;}
  .bill-tabs{display:flex;gap:6px;margin-bottom:18px;background:#141414;border:1px solid #232323;border-radius:12px;padding:5px;max-width:420px;}
  .bill-tab{flex:1;padding:10px 14px;border:none;background:transparent;color:#9ca3af;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .15s;}
  .bill-tab.active{background:linear-gradient(135deg,rgba(0,217,255,.15),rgba(124,58,237,.15));color:#fff;border:1px solid rgba(0,217,255,.25);}
  .bill-layout{display:grid;grid-template-columns:1fr;gap:20px;}
  @media(min-width:1100px){.bill-layout{grid-template-columns:1fr 1fr;align-items:start;}}
  .bill-panel{background:#111;border:1px solid #2a2a2a;border-radius:14px;padding:18px;}
  .bill-panel-title{font-size:14px;font-weight:700;color:#fff;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;}
  .bill-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  @media(max-width:560px){.bill-form-grid{grid-template-columns:1fr;}}
  .bill-field{display:flex;flex-direction:column;gap:5px;}
  .bill-field.full{grid-column:1/-1;}
  .bill-field label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:600;}
  .bill-field input,.bill-field select,.bill-field textarea{background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:9px 11px;color:#e5e5e5;font-size:13px;outline:none;font-family:inherit;}
  .bill-field input:focus,.bill-field select:focus,.bill-field textarea:focus{border-color:#00d9ff;}
  .bill-field textarea{min-height:72px;resize:vertical;}
  .bill-items{margin-top:16px;}
  .bill-item-row{display:grid;grid-template-columns:1fr 56px 90px 90px 36px;gap:8px;margin-bottom:8px;align-items:center;}
  @media(max-width:640px){.bill-item-row{grid-template-columns:1fr 1fr;}}
  .bill-item-row input{background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px;color:#e5e5e5;font-size:12px;}
  .bill-item-del{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#ef4444;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;}
  .bill-btn-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;}
  .bill-btn{padding:9px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid;transition:all .15s;}
  .bill-btn:disabled{opacity:.45;cursor:not-allowed;}
  .bill-btn-primary{background:rgba(0,217,255,.12);color:#00d9ff;border-color:rgba(0,217,255,.35);}
  .bill-btn-primary:hover:not(:disabled){background:rgba(0,217,255,.2);}
  .bill-btn-ghost{background:transparent;color:#9ca3af;border-color:#333;}
  .bill-btn-ghost:hover:not(:disabled){border-color:#555;color:#fff;}
  .bill-btn-print{background:rgba(34,197,94,.14);color:#22c55e;border-color:rgba(34,197,94,.35);}
  .bill-btn-print:hover:not(:disabled){background:rgba(34,197,94,.22);}
  .bill-loc-status{font-size:11px;color:#86efac;margin-top:6px;}
  .bill-loc-status.warn{color:#fbbf24;}
  .bill-preview-wrap{background:#f8fafc;border-radius:14px;padding:16px;overflow:auto;max-height:85vh;}
  .bill-doc{background:#fff;color:#0f172a;padding:28px 32px;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.25);font-size:13px;line-height:1.45;min-width:min(100%,640px);}
  .bill-hdr{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0ea5e9;padding-bottom:16px;margin-bottom:16px;flex-wrap:wrap;}
  .bill-brand{display:flex;align-items:center;gap:14px;}
  .bill-euler-logo{height:44px;width:auto;}
  .bill-vw-name{font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-.3px;}
  .bill-vw-tag{font-size:11px;font-weight:600;color:#0057B8;text-transform:uppercase;letter-spacing:.6px;margin-top:2px;}
  .bill-co-meta{text-align:right;font-size:11px;color:#475569;line-height:1.5;max-width:240px;}
  .bill-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px;flex-wrap:wrap;}
  .bill-title{font-size:18px;font-weight:800;color:#0057B8;letter-spacing:1px;}
  .bill-meta-grid{display:grid;gap:4px;font-size:12px;text-align:right;}
  .bill-meta-grid span{color:#64748b;margin-right:6px;}
  .bill-party{background:#f1f5f9;border-radius:8px;padding:12px 14px;margin-bottom:16px;}
  .bill-party-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700;margin-bottom:4px;}
  .bill-party-name{font-size:15px;font-weight:700;color:#0f172a;}
  .bill-party-line{font-size:12px;color:#475569;margin-top:2px;}
  .bill-table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12px;}
  .bill-table th,.bill-table td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;}
  .bill-table th{background:#e2e8f0;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#334155;}
  .bill-table td:nth-child(3),.bill-table td:nth-child(4),.bill-table td:nth-child(5),.bill-table th:nth-child(3),.bill-table th:nth-child(4),.bill-table th:nth-child(5){text-align:right;}
  .bill-empty-row{text-align:center;color:#94a3b8;font-style:italic;}
  .bill-total-lbl{text-align:right;font-weight:700;}
  .bill-total-val{font-weight:800;color:#0057B8;font-size:14px;}
  .bill-words,.bill-pay,.bill-notes{font-size:12px;color:#334155;margin-bottom:10px;padding:10px 12px;background:#f8fafc;border-radius:6px;border-left:3px solid #0ea5e9;}
  .bill-terms{font-size:11px;color:#475569;margin-bottom:10px;}
  .bill-terms pre{white-space:pre-wrap;font-family:inherit;margin-top:6px;line-height:1.5;}
  .bill-footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;flex-wrap:wrap;gap:16px;}
  .bill-sign{text-align:center;min-width:180px;}
  .bill-sign-line{border-top:1px solid #334155;width:160px;margin:40px auto 8px;}
  .bill-sign-co{display:block;font-size:10px;color:#64748b;margin-top:2px;}
  .bill-footer-note{font-size:10px;color:#94a3b8;max-width:200px;}
  .bill-vehicle-showcase{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:16px;padding:14px 16px;background:linear-gradient(135deg,#f0f9ff,#f8fafc);border:1px solid #bae6fd;border-radius:10px;flex-wrap:wrap;}
  .bill-vehicle-showcase-text{flex:1;min-width:180px;}
  .bill-vehicle-showcase-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#0369a1;font-weight:700;margin-bottom:4px;}
  .bill-vehicle-showcase-name{font-size:15px;font-weight:800;color:#0f172a;line-height:1.35;}
  .bill-vehicle-showcase-tag{font-size:11px;color:#475569;margin-top:4px;line-height:1.4;}
  .bill-vehicle-showcase-cat{display:inline-block;margin-top:8px;font-size:9px;text-transform:uppercase;letter-spacing:.4px;font-weight:700;color:#0057B8;background:#e0f2fe;padding:3px 8px;border-radius:4px;}
  .bill-vehicle-showcase-img{max-width:min(100%,280px);max-height:140px;object-fit:contain;flex-shrink:0;}
  .bill-brand-bar{display:flex;align-items:center;gap:14px;margin-bottom:18px;padding:14px 18px;background:#111;border:1px solid #2a2a2a;border-radius:14px;}
  .bill-brand-bar img{height:36px;width:auto;}
  .bill-brand-bar span{font-size:13px;color:#9ca3af;}
  .bill-brand-bar strong{color:#00d9ff;font-weight:600;}
  .bill-gallery{margin-bottom:20px;}
  .bill-gallery-title{font-size:14px;font-weight:700;color:#fff;margin-bottom:12px;}
  .bill-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;}
  .bill-v-card{background:#111;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;cursor:pointer;transition:all .18s;text-align:left;padding:0;}
  .bill-v-card:hover,.bill-v-card.selected{border-color:#00d9ff;box-shadow:0 6px 20px rgba(0,217,255,.12);}
  .bill-v-card.selected{outline:2px solid rgba(0,217,255,.35);}
  .bill-v-thumb{aspect-ratio:16/10;background:#0f0f0f;display:flex;align-items:center;justify-content:center;padding:8px;}
  .bill-v-thumb img{max-width:100%;max-height:100%;object-fit:contain;}
  .bill-v-body{padding:10px 12px 12px;}
  .bill-v-name{font-size:11px;font-weight:600;color:#e5e5e5;line-height:1.35;margin-bottom:4px;}
  .bill-v-cat{font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#6b7280;}
  .bill-v-pick{margin-top:12px;border-radius:10px;overflow:hidden;border:1px solid #333;background:#0f0f0f;}
  .bill-v-pick img{width:100%;max-height:160px;object-fit:contain;padding:10px;}
  .bill-doc-mm{background:#fff;padding:32px 36px;min-height:520px;position:relative;font-family:'Times New Roman',Georgia,serif;color:#111;}
  .bill-doc-brand{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:14px;margin-bottom:16px;border-bottom:2px solid #0057B8;flex-wrap:wrap;font-family:Calibri,'Segoe UI',Arial,sans-serif;}
  .bill-doc-brand-vw,.bill-doc-brand-euler{display:flex;align-items:center;gap:12px;}
  .bill-doc-brand-euler{text-align:right;flex-direction:row-reverse;}
  .bill-doc-brand-vw-logo{height:52px;width:auto;object-fit:contain;}
  .bill-doc-brand-euler-logo{height:44px;width:auto;object-fit:contain;}
  .bill-doc-brand-name{font-size:16px;font-weight:800;color:#0f172a;letter-spacing:.2px;}
  .bill-doc-brand-addr{font-size:11px;color:#475569;margin-top:2px;line-height:1.4;max-width:280px;}
  .bill-doc-brand-meta{font-size:10px;color:#64748b;margin-top:2px;}
  .bill-doc-brand-euler-lbl{font-size:12px;font-weight:700;color:#0057B8;text-transform:uppercase;letter-spacing:.4px;}
  .bill-doc-brand-tag{font-size:10px;font-weight:600;color:#334155;margin-top:2px;max-width:180px;line-height:1.35;}
  .bill-doc-foot{margin-top:18px;padding-top:10px;border-top:1px solid #cbd5e1;text-align:center;font-size:10px;color:#64748b;font-family:Calibri,'Segoe UI',Arial,sans-serif;}
  .bill-mm-hdr{text-align:center;margin-bottom:22px;}
  .bill-mm-co-name{font-size:15px;font-weight:700;line-height:1.4;}
  .bill-mm-co-addr{font-size:13px;margin-top:4px;line-height:1.4;}
  .bill-mm-title{font-size:15px;font-weight:700;text-decoration:underline;margin-top:18px;letter-spacing:.3px;}
  .bill-mm-meta{display:flex;justify-content:space-between;gap:24px;margin-bottom:28px;font-size:13px;line-height:1.7;flex-wrap:wrap;}
  .bill-mm-meta-col{min-width:180px;}
  .bill-mm-meta-right{text-align:right;}
  .bill-mm-meta span{font-weight:700;}
  .bill-mm-body{font-size:13px;line-height:1.75;text-align:justify;margin-bottom:80px;}
  .bill-mm-cust{font-weight:700;text-transform:uppercase;}
  .bill-mm-stamp{position:absolute;bottom:36px;right:36px;width:120px;height:120px;display:flex;align-items:center;justify-content:center;}
  .bill-mm-stamp-img{width:56px;height:auto;opacity:.85;}
  .bill-mm-stamp-ring{position:absolute;inset:0;border:2px solid rgba(124,58,237,.55);border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:7px;font-weight:700;color:rgba(124,58,237,.75);padding:8px;line-height:1.2;letter-spacing:.2px;}
  .bill-doc-qt{padding:24px 28px;font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;min-width:min(100%,720px);}
  .bill-qt-title-bar{background:#fff3cd;border:1px solid #e6c200;text-align:center;font-size:14px;font-weight:800;text-decoration:underline;padding:8px 12px;margin-bottom:14px;letter-spacing:.5px;}
  .bill-qt-info{display:grid;grid-template-columns:1fr 1fr;border:1px solid #333;margin-bottom:14px;}
  .bill-qt-info-col{border-right:1px solid #333;}
  .bill-qt-info-col:last-child{border-right:none;}
  .bill-qt-kv{display:grid;grid-template-columns:130px 1fr;border-bottom:1px solid #333;min-height:32px;}
  .bill-qt-kv:last-child{border-bottom:none;}
  .bill-qt-kv span{padding:6px 8px;border-right:1px solid #333;background:#f8fafc;font-weight:600;font-size:11px;}
  .bill-qt-kv strong{padding:6px 8px;font-weight:600;font-size:12px;}
  .bill-qt-kv.bill-qt-addr span{background:#1b4332;color:#fff;}
  .bill-qt-kv.bill-qt-shared strong{background:#d8f3dc;}
  .bill-qt-table{width:100%;border-collapse:collapse;margin-bottom:14px;}
  .bill-qt-table th,.bill-qt-table td{border:1px solid #333;padding:8px 10px;vertical-align:top;font-size:12px;}
  .bill-qt-table th{background:#f1f5f9;font-weight:700;text-align:center;}
  .bill-qt-table td:nth-child(1),.bill-qt-table td:nth-child(3){text-align:center;}
  .bill-qt-vmodel{font-weight:700;margin-bottom:8px;}
  .bill-qt-vimg{max-width:160px;max-height:90px;object-fit:contain;display:block;margin-top:4px;}
  .bill-qt-price{font-weight:700;white-space:nowrap;}
  .bill-qt-section{margin-bottom:12px;}
  .bill-qt-section-h{font-weight:700;margin-bottom:4px;}
  .bill-qt-list,.bill-qt-terms{margin-left:22px;line-height:1.55;}
  .bill-qt-terms{margin-bottom:20px;}
  .bill-qt-bank{margin-left:auto;max-width:320px;text-align:left;line-height:1.6;font-size:12px;border-top:1px solid #ccc;padding-top:10px;}
  @media print{
    body *{visibility:hidden;}
    #billing-print-root,#billing-print-root *{visibility:visible;}
    #billing-print-root{position:absolute;left:0;top:0;width:100%;box-shadow:none;border-radius:0;padding:20px;}
    .bill-root,.bill-preview-wrap{background:#fff;padding:0;}
  }
`;

export default function BillingPage() {
  const [tab, setTab] = useState<'receipt' | 'quotation'>('receipt');
  const [company, setCompany] = useState<CompanyProfile>(DEFAULT_COMPANY);
  const [locStatus, setLocStatus] = useState('');

  const [receipt, setReceipt] = useState<ReceiptDraft>(() => ({
    receiptNo: '',
    date: todayIso(),
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    cashAmount: 0,
    upiAmount: 0,
    upiRef: '',
    vehicleModel: EULER_VEHICLES[0].name,
    bookingDate: todayIso(),
    notes: '',
  }));

  const [quote, setQuote] = useState<QuotationDraft>(() => ({
    quoteNo: '',
    date: todayIso(),
    validUntil: addDaysIso(todayIso(), 7),
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    sharedBy: '',
    sharedByPhone: '',
    vehicleModel: EULER_VEHICLES[0].name,
    exShowroomPrice: 0,
    vehicleRemarks: EULER_VEHICLES[0].tagline || '',
    inclusions: DEFAULT_INCLUSIONS,
    insuranceCharges: 26000,
    registrationCharges: 12000,
    terms: DEFAULT_QUOTE_TERMS,
    notes: '',
  }));

  useEffect(() => {
    setReceipt(r => ({ ...r, receiptNo: r.receiptNo || nextReceiptNo(r.date) }));
    setQuote(q => ({ ...q, quoteNo: q.quoteNo || nextQuoteNo(q.date) }));
  }, []);

  const refreshLocation = useCallback(async () => {
    setLocStatus('Detecting location…');
    const addr = await detectCompanyAddress(setLocStatus);
    setCompany(c => ({ ...c, address: addr }));
    setLocStatus('Office address updated from your location.');
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  function handlePrint() {
    window.print();
  }

  function resetReceipt() {
    const date = todayIso();
    setReceipt({
      receiptNo: nextReceiptNo(date),
      date,
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      cashAmount: 0,
      upiAmount: 0,
      upiRef: '',
      vehicleModel: EULER_VEHICLES[0].name,
      bookingDate: date,
      notes: '',
    });
  }

  function resetQuote() {
    const date = todayIso();
    setQuote({
      quoteNo: nextQuoteNo(date),
      date,
      validUntil: addDaysIso(date, 7),
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      sharedBy: '',
      sharedByPhone: '',
      vehicleModel: EULER_VEHICLES[0].name,
      exShowroomPrice: 0,
      vehicleRemarks: EULER_VEHICLES[0].tagline || '',
      inclusions: DEFAULT_INCLUSIONS,
      insuranceCharges: 26000,
      registrationCharges: 12000,
      terms: DEFAULT_QUOTE_TERMS,
      notes: '',
    });
  }

  function selectQuoteVehicle(name: string) {
    const v = vehicleByName(name);
    setQuote(q => ({
      ...q,
      vehicleModel: name,
      vehicleRemarks: v?.tagline || q.vehicleRemarks,
    }));
  }

  const selectedVehicle = resolveQuoteVehicle(quote.vehicleModel);
  const receiptTotal = receiptTotalAmount(receipt.cashAmount, receipt.upiAmount);

  return (
    <div className="bill-root">
      <style>{CSS}</style>

      <div className="bill-pg-hdr">
        <div>
          <div className="bill-pg-title">Billing &amp; Documents</div>
          <div className="bill-pg-sub">
            Professional money receipts and quotations for VoltWheels — Authorized Euler Motors Dealer.
            Office address is auto-detected from your location when permitted.
          </div>
        </div>
        <div className="bill-btn-row">
          <button type="button" className="bill-btn bill-btn-print" onClick={handlePrint}>Print / Save PDF</button>
        </div>
      </div>

      <div className="bill-tabs">
        <button type="button" className={`bill-tab${tab === 'receipt' ? ' active' : ''}`} onClick={() => setTab('receipt')}>
          Margin Money Receipt
        </button>
        <button type="button" className={`bill-tab${tab === 'quotation' ? ' active' : ''}`} onClick={() => setTab('quotation')}>
          Quotation
        </button>
      </div>

      <div className="bill-brand-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/voltwheels-logo.png" alt="Volt Wheels" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/euler-logo-black.png" alt="Euler Motors" style={{ height: 32 }} />
        <span><strong>Volt Wheels</strong> · Authorized Euler Motors Dealer</span>
      </div>

      {tab === 'quotation' && (
        <div className="bill-gallery">
          <div className="bill-gallery-title">Euler vehicle catalogue — tap to use in quotation</div>
          <div className="bill-gallery-grid">
            {EULER_VEHICLES.map(v => (
              <button
                key={v.id}
                type="button"
                className={`bill-v-card${quote.vehicleModel === v.name ? ' selected' : ''}`}
                onClick={() => selectQuoteVehicle(v.name)}
              >
                <div className="bill-v-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.image} alt={v.name} loading="lazy" />
                </div>
                <div className="bill-v-body">
                  <div className="bill-v-name">{v.name}</div>
                  <div className="bill-v-cat">{v.category}{v.tagline ? ` · ${v.tagline}` : ''}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bill-layout">
        <div className="bill-panel">
          <div className="bill-panel-title">Company &amp; {tab === 'receipt' ? 'Receipt' : 'Quote'} details</div>

          <div className="bill-form-grid">
            <div className="bill-field">
              <label>Company name</label>
              <input value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} />
            </div>
            <div className="bill-field">
              <label>Branch</label>
              <input value={company.branch} onChange={e => setCompany(c => ({ ...c, branch: e.target.value }))} placeholder="Durgapur" />
            </div>
            <div className="bill-field">
              <label>Financial year</label>
              <input value={company.financialYear} onChange={e => setCompany(c => ({ ...c, financialYear: e.target.value }))} placeholder="Auto from date (e.g. 26-27)" />
            </div>
            <div className="bill-field">
              <label>State</label>
              <input value={company.state} onChange={e => setCompany(c => ({ ...c, state: e.target.value }))} />
            </div>
            <div className="bill-field full">
              <label>Office address</label>
              <textarea
                value={company.address}
                onChange={e => setCompany(c => ({ ...c, address: e.target.value }))}
              />
              <button type="button" className="bill-btn bill-btn-ghost" style={{ marginTop: 8 }} onClick={refreshLocation}>
                Refresh location
              </button>
              {locStatus && <div className={`bill-loc-status${locStatus.includes('Detecting') ? ' warn' : ''}`}>{locStatus}</div>}
            </div>
            <div className="bill-field">
              <label>Phone</label>
              <input value={company.phone} onChange={e => setCompany(c => ({ ...c, phone: e.target.value }))} />
            </div>
            <div className="bill-field">
              <label>Email</label>
              <input value={company.email} onChange={e => setCompany(c => ({ ...c, email: e.target.value }))} />
            </div>
            <div className="bill-field">
              <label>GSTIN / UIN</label>
              <input value={company.gstin} onChange={e => setCompany(c => ({ ...c, gstin: e.target.value }))} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="bill-field">
              <label>Website</label>
              <input value={company.website} onChange={e => setCompany(c => ({ ...c, website: e.target.value }))} />
            </div>
            {tab === 'quotation' && (
              <>
                <div className="bill-field full" style={{ marginTop: 4 }}>
                  <label style={{ color: '#00d9ff' }}>Bank details (printed on quotation)</label>
                </div>
                <div className="bill-field">
                  <label>Account name</label>
                  <input value={company.bank.accountName} onChange={e => setCompany(c => ({ ...c, bank: { ...c.bank, accountName: e.target.value } }))} />
                </div>
                <div className="bill-field">
                  <label>Banker</label>
                  <input value={company.bank.banker} onChange={e => setCompany(c => ({ ...c, bank: { ...c.bank, banker: e.target.value } }))} />
                </div>
                <div className="bill-field">
                  <label>Account number</label>
                  <input value={company.bank.accountNumber} onChange={e => setCompany(c => ({ ...c, bank: { ...c.bank, accountNumber: e.target.value } }))} />
                </div>
                <div className="bill-field">
                  <label>IFSC code</label>
                  <input value={company.bank.ifsc} onChange={e => setCompany(c => ({ ...c, bank: { ...c.bank, ifsc: e.target.value } }))} />
                </div>
              </>
            )}
          </div>

          {tab === 'receipt' ? (
            <>
              <div className="bill-form-grid" style={{ marginTop: 16 }}>
                <div className="bill-field">
                  <label>Receipt No.</label>
                  <input value={receipt.receiptNo} onChange={e => setReceipt(r => ({ ...r, receiptNo: e.target.value }))} placeholder="26/27/05-05" />
                </div>
                <div className="bill-field">
                  <label>Date</label>
                  <input type="date" value={receipt.date} onChange={e => setReceipt(r => ({ ...r, date: e.target.value }))} />
                </div>
                <div className="bill-field">
                  <label>Customer name</label>
                  <input value={receipt.customerName} onChange={e => setReceipt(r => ({ ...r, customerName: e.target.value.toUpperCase() }))} placeholder="NABIN KUMAR MODI" />
                </div>
                <div className="bill-field">
                  <label>Cash amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={receipt.cashAmount || ''}
                    onChange={e => setReceipt(r => ({ ...r, cashAmount: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    placeholder="50000"
                  />
                </div>
                <div className="bill-field">
                  <label>UPI amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={receipt.upiAmount || ''}
                    onChange={e => setReceipt(r => ({ ...r, upiAmount: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    placeholder="22903"
                  />
                </div>
                <div className="bill-field">
                  <label>UPI reference / transaction ID</label>
                  <input
                    value={receipt.upiRef}
                    onChange={e => setReceipt(r => ({ ...r, upiRef: e.target.value }))}
                    placeholder="UPI ref no."
                  />
                </div>
                <div className="bill-field">
                  <label>Total amount (₹)</label>
                  <input readOnly value={receiptTotal ? receiptTotal.toLocaleString('en-IN') : ''} placeholder="Auto: cash + UPI" />
                </div>
                <div className="bill-field full">
                  <label>Vehicle model (against booking)</label>
                  <input
                    list="receipt-vehicle-models"
                    value={receipt.vehicleModel}
                    onChange={e => setReceipt(r => ({ ...r, vehicleModel: e.target.value }))}
                    placeholder="Euler Turbo City HD"
                  />
                  <datalist id="receipt-vehicle-models">
                    {EULER_VEHICLE_NAMES.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div className="bill-field">
                  <label>Booking date</label>
                  <input type="date" value={receipt.bookingDate} onChange={e => setReceipt(r => ({ ...r, bookingDate: e.target.value }))} />
                </div>
                <div className="bill-field">
                  <label>Phone (optional)</label>
                  <input value={receipt.customerPhone} onChange={e => setReceipt(r => ({ ...r, customerPhone: e.target.value }))} />
                </div>
                <div className="bill-field full">
                  <label>Customer address (optional)</label>
                  <textarea value={receipt.customerAddress} onChange={e => setReceipt(r => ({ ...r, customerAddress: e.target.value }))} />
                </div>
                <div className="bill-field full">
                  <label>Notes (optional, not printed)</label>
                  <textarea value={receipt.notes} onChange={e => setReceipt(r => ({ ...r, notes: e.target.value }))} />
                </div>
              </div>
              <div className="bill-btn-row">
                <button type="button" className="bill-btn bill-btn-ghost" onClick={resetReceipt}>New receipt</button>
              </div>
            </>
          ) : (
            <>
              <div className="bill-form-grid" style={{ marginTop: 16 }}>
                <div className="bill-field">
                  <label>Quotation number</label>
                  <input value={quote.quoteNo} onChange={e => setQuote(q => ({ ...q, quoteNo: e.target.value }))} placeholder="VW-2627-05/10" />
                </div>
                <div className="bill-field">
                  <label>Quotation date</label>
                  <input
                    type="date"
                    value={quote.date}
                    onChange={e => {
                      const date = e.target.value;
                      setQuote(q => ({ ...q, date, validUntil: addDaysIso(date, 7) }));
                    }}
                  />
                </div>
                <div className="bill-field">
                  <label>Valid until</label>
                  <input type="date" value={quote.validUntil} onChange={e => setQuote(q => ({ ...q, validUntil: e.target.value }))} />
                </div>
                <div className="bill-field">
                  <label>Quotation shared by</label>
                  <input value={quote.sharedBy} onChange={e => setQuote(q => ({ ...q, sharedBy: e.target.value }))} placeholder="Satish" />
                </div>
                <div className="bill-field">
                  <label>Salesperson phone</label>
                  <input value={quote.sharedByPhone} onChange={e => setQuote(q => ({ ...q, sharedByPhone: e.target.value }))} placeholder="9046576555" />
                </div>
                <div className="bill-field">
                  <label>Customer name</label>
                  <input value={quote.customerName} onChange={e => setQuote(q => ({ ...q, customerName: e.target.value }))} placeholder="SRL Earth Moving Equipments" />
                </div>
                <div className="bill-field">
                  <label>Customer mobile</label>
                  <input value={quote.customerPhone} onChange={e => setQuote(q => ({ ...q, customerPhone: e.target.value }))} placeholder="9800858862" />
                </div>
                <div className="bill-field full">
                  <label>Customer address</label>
                  <textarea value={quote.customerAddress} onChange={e => setQuote(q => ({ ...q, customerAddress: e.target.value }))} placeholder="Opposite to DPL Gate, DGP - 1" />
                </div>
                <div className="bill-field full">
                  <label>Vehicle model</label>
                  <input
                    list="quote-vehicle-models"
                    value={quote.vehicleModel}
                    onChange={e => setQuote(q => ({ ...q, vehicleModel: e.target.value }))}
                    placeholder="STORM T1500 PV"
                  />
                  <datalist id="quote-vehicle-models">
                    {EULER_VEHICLE_NAMES.map(n => <option key={n} value={n} />)}
                  </datalist>
                  {selectedVehicle && (
                    <div className="bill-v-pick">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedVehicle.image} alt={selectedVehicle.name} />
                    </div>
                  )}
                </div>
                <div className="bill-field">
                  <label>Ex showroom price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={quote.exShowroomPrice || ''}
                    onChange={e => setQuote(q => ({ ...q, exShowroomPrice: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    placeholder="965000"
                  />
                </div>
                <div className="bill-field full">
                  <label>Vehicle remarks / specs</label>
                  <textarea
                    value={quote.vehicleRemarks}
                    onChange={e => setQuote(q => ({ ...q, vehicleRemarks: e.target.value }))}
                    placeholder="Payload - 1500 kg. ; Range - 140 km ; Torque - 180 NM;"
                  />
                </div>
                <div className="bill-field">
                  <label>Insurance charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={quote.insuranceCharges || ''}
                    onChange={e => setQuote(q => ({ ...q, insuranceCharges: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  />
                </div>
                <div className="bill-field">
                  <label>Registration charges (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={quote.registrationCharges || ''}
                    onChange={e => setQuote(q => ({ ...q, registrationCharges: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  />
                </div>
                <div className="bill-field full">
                  <label>Price inclusions (one per line)</label>
                  <textarea value={quote.inclusions} onChange={e => setQuote(q => ({ ...q, inclusions: e.target.value }))} rows={3} />
                </div>
                <div className="bill-field full">
                  <label>Terms &amp; conditions</label>
                  <textarea value={quote.terms} onChange={e => setQuote(q => ({ ...q, terms: e.target.value }))} rows={6} />
                </div>
                <div className="bill-field full">
                  <label>Notes (optional, not printed)</label>
                  <textarea value={quote.notes} onChange={e => setQuote(q => ({ ...q, notes: e.target.value }))} />
                </div>
              </div>
              <div className="bill-btn-row">
                <button type="button" className="bill-btn bill-btn-ghost" onClick={resetQuote}>New quotation</button>
              </div>
            </>
          )}
        </div>

        <div className="bill-preview-wrap">
          {tab === 'receipt' ? (
            <BillingDocumentPreview
              kind="receipt"
              company={company}
              receipt={{
                docNo: receipt.receiptNo,
                date: receipt.date,
                customerName: receipt.customerName,
                cashAmount: receipt.cashAmount,
                upiAmount: receipt.upiAmount,
                upiRef: receipt.upiRef,
                vehicleModel: receipt.vehicleModel,
                bookingDate: receipt.bookingDate,
              }}
            />
          ) : (
            <BillingDocumentPreview
              kind="quotation"
              company={company}
              quote={quote}
            />
          )}
        </div>
      </div>
    </div>
  );
}
