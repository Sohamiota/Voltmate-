/** Minimal print styles for saved billing HTML files (server-side). */
export const BILLING_PRINT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @page{size:A4;margin:10mm;}
  #billing-print-root{width:100%;}
  .bill-doc-brand{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:24px;padding-bottom:14px;margin-bottom:16px;border-bottom:2px solid #0057B8;font-family:Calibri,'Segoe UI',Arial,sans-serif;}
  .bill-doc-brand-vw-meta{min-width:0;}
  .bill-doc-brand-euler{display:flex;flex-direction:column;align-items:flex-end;gap:5px;padding-left:16px;border-left:1px solid #e2e8f0;}
  .bill-doc-brand-euler-logo{height:38px;width:auto;max-width:110px;object-fit:contain;}
  .bill-doc-brand-vw-title{font-size:18px;font-weight:800;color:#0f172a;}
  .bill-doc-brand-name{font-size:13px;font-weight:600;color:#334155;margin-top:2px;}
  .bill-doc-brand-addr{font-size:11px;color:#475569;margin-top:3px;line-height:1.45;}
  .bill-doc-brand-meta{font-size:10px;color:#64748b;margin-top:2px;}
  .bill-doc-brand-tag{font-size:10px;color:#64748b;text-align:right;max-width:140px;}
  .bill-doc-foot{margin-top:18px;padding-top:10px;border-top:1px solid #cbd5e1;text-align:center;font-size:10px;color:#64748b;}
  .bill-qt-title-bar{background:#fff3cd;border:1px solid #e6c200;text-align:center;font-size:14px;font-weight:800;text-decoration:underline;padding:8px 12px;margin-bottom:14px;}
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
  .bill-qt-vmodel{font-weight:700;margin-bottom:8px;}
  .bill-qt-vimg{max-width:160px;max-height:90px;object-fit:contain;display:block;margin-top:4px;}
  .bill-qt-price{font-weight:700;white-space:nowrap;}
  .bill-qt-total-row td{background:#f1f5f9;border-top:2px solid #333;}
  .bill-qt-total-lbl{text-align:right;font-weight:800;}
  .bill-qt-total-val{font-size:13px;color:#0057B8;}
  .bill-qt-list,.bill-qt-terms{margin-left:22px;line-height:1.55;}
  .bill-qt-bank{margin-left:auto;max-width:320px;font-size:12px;border-top:1px solid #ccc;padding-top:10px;}
  .bill-mm-accent{height:5px;background:linear-gradient(90deg,#0057B8,#0ea5e9,#22d3ee);}
  .bill-mm-head{display:flex;justify-content:space-between;padding:22px 28px 16px;flex-wrap:wrap;}
  .bill-mm-badge{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;color:#0057B8;background:#eff6ff;border:1px solid #bfdbfe;padding:4px 10px;border-radius:999px;margin-bottom:10px;}
  .bill-mm-co-name{font-size:17px;font-weight:800;color:#0f172a;}
  .bill-mm-co-addr{font-size:11px;color:#64748b;margin-top:5px;}
  .bill-mm-id-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;min-width:168px;}
  .bill-mm-id-row{display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px dashed #e2e8f0;}
  .bill-mm-gst-strip{display:flex;flex-wrap:wrap;gap:16px;padding:8px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;font-size:11px;}
  .bill-mm-party{padding:18px 28px 14px;}
  .bill-mm-party-name{font-size:18px;font-weight:800;}
  .bill-mm-amount-hero{margin:16px 28px;padding:18px 20px;background:linear-gradient(135deg,#0057B8,#0284c7);border-radius:12px;color:#fff;}
  .bill-mm-amount-val{font-size:32px;font-weight:800;}
  .bill-mm-pay-table{width:calc(100% - 56px);margin:16px 28px 0;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;}
  .bill-mm-pay-table th,.bill-mm-pay-table td{padding:10px 12px;border-bottom:1px solid #e2e8f0;}
  .bill-mm-pay-table th{background:#f8fafc;font-size:10px;text-transform:uppercase;color:#64748b;}
  .bill-mm-footer-row{display:flex;justify-content:space-between;margin:24px 28px 20px;}
`;
