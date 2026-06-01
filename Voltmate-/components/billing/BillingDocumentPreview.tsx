'use client';

import type { BankDetails, CompanyProfile, QuotationDraft } from '@/lib/billing/types';
import { resolveQuoteVehicle } from '@/lib/billing/eulerVehicles';
import { EulerLogo } from '@/components/billing/BrandMark';
import {
  amountInWordsReceipt,
  financialYearLabel,
  fmtBookingDateSlash,
  fmtQuoteDateShort,
  fmtQuotePrice,
  fmtReceiptAmount,
  fmtReceiptDateDot,
  quoteGrandTotal,
  receiptPaymentNarrative,
  receiptTotalAmount,
} from '@/lib/billing/format';

type Props = {
  kind: 'receipt' | 'quotation';
  company: CompanyProfile;
  receipt?: {
    docNo: string;
    date: string;
    customerName: string;
    cashAmount?: number;
    upiAmount?: number;
    upiRef?: string;
    vehicleModel?: string;
    bookingDate?: string;
  };
  quote?: QuotationDraft;
};

function DocumentBrandHeader({ company }: { company: CompanyProfile }) {
  return (
    <header className="bill-doc-brand">
      <div className="bill-doc-brand-vw">
        <div className="bill-doc-brand-vw-meta">
          <div className="bill-doc-brand-vw-title">{company.name}</div>
          {company.branch && (
            <div className="bill-doc-brand-name">{company.branch}</div>
          )}
          <div className="bill-doc-brand-addr">{company.address}</div>
          {company.phone && company.phone !== '+91 XXXXXXXXXX' && (
            <div className="bill-doc-brand-meta">Ph: {company.phone}</div>
          )}
        </div>
      </div>
      <div className="bill-doc-brand-euler">
        <EulerLogo className="bill-doc-brand-euler-logo" />
        <div className="bill-doc-brand-tag">Authorized Euler Motors Dealer</div>
      </div>
    </header>
  );
}

function DocumentBrandFooter({ company }: { company: CompanyProfile }) {
  return (
    <footer className="bill-doc-foot">
      {company.name} · Authorized Euler Motors Dealer
      {company.gstin ? ` · GSTIN: ${company.gstin}` : ''}
      {company.website ? ` · ${company.website}` : ''}
    </footer>
  );
}

function MarginMoneyReceipt({
  company,
  docNo,
  date,
  customerName,
  cashAmount = 0,
  upiAmount = 0,
  upiRef,
  vehicleModel,
  bookingDate,
}: NonNullable<Props['receipt']> & { company: CompanyProfile }) {
  const fy = company.financialYear || financialYearLabel(date);
  const branchLine = company.branch
    ? `${company.name} (${company.branch}) (FY ${fy})`
    : `${company.name} (FY ${fy})`;
  const total = receiptTotalAmount(cashAmount, upiAmount);

  return (
    <div className="bill-mm-doc">
      <header className="bill-mm-letterhead">
        <div className="bill-mm-co-name">{branchLine}</div>
        <div className="bill-mm-co-addr">{company.address}</div>
        <h1 className="bill-mm-title">Margin Money Receipt</h1>
      </header>

      <div className="bill-mm-meta-table">
        <div className="bill-mm-meta-col">
          <div className="bill-mm-meta-row">
            <span className="bill-mm-meta-lbl">GSTIN/UIN:</span>
            <span className="bill-mm-meta-val">{company.gstin || '—'}</span>
          </div>
          <div className="bill-mm-meta-row">
            <span className="bill-mm-meta-lbl">State Name:</span>
            <span className="bill-mm-meta-val">{company.state || '—'}</span>
          </div>
        </div>
        <div className="bill-mm-meta-col bill-mm-meta-col-right">
          <div className="bill-mm-meta-row">
            <span className="bill-mm-meta-lbl">RECIPT NO –</span>
            <span className="bill-mm-meta-val">{docNo || '—'}</span>
          </div>
          <div className="bill-mm-meta-row">
            <span className="bill-mm-meta-lbl">DATE-</span>
            <span className="bill-mm-meta-val">{fmtReceiptDateDot(date)}</span>
          </div>
        </div>
      </div>

      <div className="bill-mm-body">
        <p>
          Receive with Thanks{' '}
          <strong className="bill-mm-cust">{customerName || '—'}</strong>{' '}
          The sum of rupees. Amount:{' '}
          <strong className="bill-mm-amt">{fmtReceiptAmount(total)}</strong>{' '}
          (<strong>{amountInWordsReceipt(total)}</strong>) via{' '}
          {receiptPaymentNarrative(cashAmount, upiAmount, upiRef)} Against booking of{' '}
          <strong>{vehicleModel || '—'}</strong>. Dated- {fmtBookingDateSlash(bookingDate || date)}.
        </p>
      </div>

      <div className="bill-mm-footer-row">
        <div className="bill-mm-stamp">
          <div className="bill-mm-stamp-ring">
            VOLT WHEELS {company.branch?.toUpperCase() || 'DURGAPUR'} - 12
          </div>
        </div>
        <div className="bill-mm-sign">
          <div className="bill-mm-sign-line" />
          <span className="bill-mm-sign-lbl">Authorised Signatory</span>
          <span className="bill-mm-sign-co">{company.name}{company.branch ? ` (${company.branch})` : ''}</span>
        </div>
      </div>

      {(company.phone || company.email) && (
        <footer className="bill-mm-foot">
          {company.phone && company.phone !== '+91 XXXXXXXXXX' && <span>Ph: {company.phone}</span>}
          {company.email && <span>{company.email}</span>}
        </footer>
      )}
    </div>
  );
}

function BankBlock({ bank }: { bank: BankDetails }) {
  return (
    <div className="bill-qt-bank">
      <div><strong>Bank Details:</strong> {bank.accountName}</div>
      <div><strong>Banker:</strong> {bank.banker}</div>
      <div><strong>Account Number:</strong> {bank.accountNumber}</div>
      <div><strong>IFSC Code:</strong> {bank.ifsc}</div>
    </div>
  );
}

function VoltWheelsQuotation({ company, quote }: { company: CompanyProfile; quote: QuotationDraft }) {
  const quoteVehicle = resolveQuoteVehicle(quote.vehicleModel);
  const inclusionLines = quote.inclusions.split('\n').map(l => l.trim()).filter(Boolean);
  const grandTotal = quoteGrandTotal(quote.rows);

  return (
    <div className="bill-qt-doc">
      <DocumentBrandHeader company={company} />
      <div className="bill-qt-title-bar">QUOTATION</div>

      <div className="bill-qt-info">
        <div className="bill-qt-info-col">
          <div className="bill-qt-kv"><span>Customer Name</span><strong>{quote.customerName || '—'}</strong></div>
          <div className="bill-qt-kv"><span>Customer Mobile</span><strong>{quote.customerPhone || '—'}</strong></div>
          <div className="bill-qt-kv bill-qt-addr"><span>Customer Address</span><strong>{quote.customerAddress || '—'}</strong></div>
        </div>
        <div className="bill-qt-info-col">
          <div className="bill-qt-kv"><span>Quotation Number</span><strong>{quote.quoteNo || '—'}</strong></div>
          <div className="bill-qt-kv"><span>Quotation Date</span><strong>{fmtQuoteDateShort(quote.date)}</strong></div>
          <div className="bill-qt-kv bill-qt-shared"><span>Quotation Shared by</span><strong>{quote.sharedBy || '—'}</strong></div>
          <div className="bill-qt-kv"><span>Phone Number</span><strong>{quote.sharedByPhone || '—'}</strong></div>
        </div>
      </div>

      <table className="bill-qt-table">
        <thead>
          <tr>
            <th>Index</th>
            <th>Vehicle Model</th>
            <th>Ex Showroom Price</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {quote.rows.length === 0 ? (
            <tr><td colSpan={4} className="bill-qt-empty">Add line items</td></tr>
          ) : quote.rows.map((row, i) => (
            <tr key={row.id}>
              <td>{i + 1}</td>
              <td>
                <div className="bill-qt-vmodel">{row.description || '—'}</div>
                {i === 0 && quoteVehicle && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={quoteVehicle.image} alt={row.description} className="bill-qt-vimg" />
                )}
              </td>
              <td className="bill-qt-price">{fmtQuotePrice(row.amount)}</td>
              <td>{row.remarks || '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bill-qt-total-row">
            <td />
            <td className="bill-qt-total-lbl">Grand Total</td>
            <td className="bill-qt-price bill-qt-total-val">{fmtQuotePrice(grandTotal)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="bill-qt-section">
        <div className="bill-qt-section-h">The above prices are inclusive of :</div>
        <ol className="bill-qt-list">
          {inclusionLines.length === 0 ? (
            <>
              <li>GST included</li>
              <li>Price inclusive of all discounts.</li>
            </>
          ) : inclusionLines.map((line, i) => (
            <li key={i}>{line.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ol>
      </div>

      <div className="bill-qt-section">
        <div className="bill-qt-section-h">Terms &amp; Conditions</div>
        <ol className="bill-qt-terms">
          {quote.terms.split('\n').map(l => l.trim()).filter(Boolean).map((line, i) => (
            <li key={i}>{line.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ol>
      </div>

      <BankBlock bank={company.bank} />
      <DocumentBrandFooter company={company} />
    </div>
  );
}

export default function BillingDocumentPreview({ kind, company, receipt, quote }: Props) {
  if (kind === 'receipt' && receipt) {
    return (
      <div className="bill-doc bill-doc-mm" id="billing-print-root">
        <MarginMoneyReceipt company={company} {...receipt} />
      </div>
    );
  }

  if (kind === 'quotation' && quote) {
    return (
      <div className="bill-doc bill-doc-qt" id="billing-print-root">
        <VoltWheelsQuotation company={company} quote={quote} />
      </div>
    );
  }

  return null;
}
