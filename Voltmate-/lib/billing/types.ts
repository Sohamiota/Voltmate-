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
};

export type BankDetails = {
  accountName: string;
  banker: string;
  accountNumber: string;
  ifsc: string;
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
  exShowroomPrice: number;
  vehicleRemarks: string;
  inclusions: string;
  insuranceCharges: number;
  registrationCharges: number;
  terms: string;
  notes: string;
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
