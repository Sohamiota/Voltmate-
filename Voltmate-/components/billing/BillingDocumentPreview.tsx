'use client';

import type { BankDetails, CompanyProfile, QuotationDraft } from '@/lib/billing/types';
import { resolveQuoteVehicle } from '@/lib/billing/eulerVehicles';
import { EulerLogo } from '@/components/billing/BrandMark';
import {
  amountInWords,
  financialYearLabel,
  fmtBookingDateSlash,
  fmtInr,
  fmtQuoteDateShort,
  fmtQuotePrice,
  fmtReceiptDateDot,
  quoteGrandTotal,
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
  const total = receiptTotalAmount(cashAmount, upiAmount);
  const cash = Math.round(Math.max(0, cashAmount));
  const upi = Math.round(Math.max(0, upiAmount));
  const branchLabel = company.branch ? `${company.name} · ${company.branch}` : company.name;

  return (
    <div className="bill-mm-doc">
      <div className="bill-mm-accent" aria-hidden />

      <header className="bill-mm-head">
        <div className="bill-mm-head-left">
          <span className="bill-mm-badge">Margin Money Receipt</span>
          <div className="bill-mm-co-name">{branchLabel}</div>
          <div className="bill-mm-co-addr">{company.address}</div>
          {(company.phone && company.phone !== '+91 XXXXXXXXXX') || company.email ? (
            <div className="bill-mm-co-contact">
              {company.phone && company.phone !== '+91 XXXXXXXXXX' && <span>{company.phone}</span>}
              {company.email && <span>{company.email}</span>}
            </div>
          ) : null}
        </div>
        <div className="bill-mm-head-right">
          <div className="bill-mm-id-card">
            <div className="bill-mm-id-row">
              <span>Receipt No.</span>
              <strong>{docNo || '—'}</strong>
            </div>
            <div className="bill-mm-id-row">
              <span>Date</span>
              <strong>{fmtReceiptDateDot(date)}</strong>
            </div>
            <div className="bill-mm-id-row">
              <span>Financial Year</span>
              <strong>{fy}</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="bill-mm-gst-strip">
        <span><em>GSTIN</em> {company.gstin || '—'}</span>
        <span><em>State</em> {company.state || '—'}</span>
      </div>

      <section className="bill-mm-party">
        <div className="bill-mm-party-lbl">Received from</div>
        <div className="bill-mm-party-name">{customerName?.trim() || '—'}</div>
        <p className="bill-mm-party-note">
          Margin money received against vehicle booking as detailed below.
        </p>
      </section>

      <section className="bill-mm-amount-hero">
        <div className="bill-mm-amount-meta">
          <span className="bill-mm-amount-lbl">Total amount received</span>
          <span className="bill-mm-amount-fy">FY {fy}</span>
        </div>
        <div className="bill-mm-amount-val">{fmtInr(total)}</div>
        <div className="bill-mm-amount-words">{amountInWords(total)}</div>
      </section>

      <table className="bill-mm-pay-table">
        <thead>
          <tr>
            <th>Payment mode</th>
            <th>Reference / remarks</th>
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {cash > 0 && (
            <tr>
              <td><span className="bill-mm-mode bill-mm-mode-cash">Cash</span></td>
              <td>—</td>
              <td className="bill-mm-pay-amt">{fmtInr(cash)}</td>
            </tr>
          )}
          {upi > 0 && (
            <tr>
              <td><span className="bill-mm-mode bill-mm-mode-upi">UPI</span></td>
              <td>{upiRef?.trim() || '—'}</td>
              <td className="bill-mm-pay-amt">{fmtInr(upi)}</td>
            </tr>
          )}
          {total === 0 && (
            <tr>
              <td colSpan={3} className="bill-mm-pay-empty">Enter cash or UPI amount</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Grand total</td>
            <td className="bill-mm-pay-total">{fmtInr(total)}</td>
          </tr>
        </tfoot>
      </table>

      <section className="bill-mm-booking">
        <div className="bill-mm-section-title">Booking details</div>
        <div className="bill-mm-detail-grid">
          <div className="bill-mm-detail-cell">
            <span>Vehicle model</span>
            <strong>{vehicleModel?.trim() || '—'}</strong>
          </div>
          <div className="bill-mm-detail-cell">
            <span>Booking date</span>
            <strong>{fmtBookingDateSlash(bookingDate || date)}</strong>
          </div>
          <div className="bill-mm-detail-cell bill-mm-detail-wide">
            <span>Purpose</span>
            <strong>Margin money against vehicle booking</strong>
          </div>
        </div>
      </section>

      <p className="bill-mm-ack">
        We acknowledge receipt of the above sum as margin money towards the stated booking.
        This is a computer-generated receipt and is valid subject to realisation of payment
        and company terms &amp; conditions.
      </p>

      <div className="bill-mm-footer-row">
        <div className="bill-mm-stamp">
          <div className="bill-mm-stamp-ring">
            VOLT WHEELS {company.branch?.toUpperCase() || 'DURGAPUR'} - 12
          </div>
        </div>
        <div className="bill-mm-sign">
          <div className="bill-mm-sign-line" />
          <span className="bill-mm-sign-lbl">Authorised signatory</span>
          <span className="bill-mm-sign-co">
            {company.name}{company.branch ? ` (${company.branch})` : ''}
          </span>
        </div>
      </div>

      {company.website && (
        <footer className="bill-mm-foot">{company.website}</footer>
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
