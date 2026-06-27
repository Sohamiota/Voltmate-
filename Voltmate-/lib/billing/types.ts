export type LineItem = {
  id: string;
  description: string;
  qty: number;
  rate: number;
};

export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card';

export type ReceiptDraft = {
  receiptNo: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  cashAmount: number;
  upiAmount: number;
  upiRef: string;
  vehicleModel: string;
  bookingDate: string;
  notes: string;
  visitId?: number | null;
  leadCustCode?: string | null;
};

export type BankDetails = {
  accountName: string;
  banker: string;
  accountNumber: string;
  ifsc: string;
};

export type QuoteTableRow = {
  id: string;
  description: string;
  amount: number;
  remarks: string;
};

export type QuotationDraft = {
  quoteNo: string;
  date: string;
  validUntil: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  sharedBy: string;
  sharedByPhone: string;
  vehicleModel: string;
  rows: QuoteTableRow[];
  inclusions: string;
  terms: string;
  notes: string;
  visitId?: number | null;
  leadCustCode?: string | null;
  showVehicleImage?: boolean;
};

export type CompanyProfile = {
  name: string;
  branch: string;
  financialYear: string;
  tagline: string;
  address: string;
  state: string;
  phone: string;
  email: string;
  gstin: string;
  website: string;
  bank: BankDetails;
};

export type BillingDocType = 'quotation' | 'receipt';

export type BillingDocumentRecord = {
  id: number;
  doc_type: BillingDocType;
  doc_no: string;
  doc_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  vehicle_model: string | null;
  grand_total: number | null;
  payload: Record<string, unknown>;
  visit_id: number | null;
  lead_id: number | null;
  lead_cust_code: string | null;
  file_path: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  drive_file_id: string | null;
  drive_web_link: string | null;
  drive_upload_status: string | null;
  drive_error: string | null;
  visit_status: string | null;
  visit_date: string | null;
  visit_next_action: string | null;
  visit_next_action_date: string | null;
  visit_cust_name: string | null;
};
