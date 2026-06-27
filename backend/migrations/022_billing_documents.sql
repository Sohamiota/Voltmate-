-- Billing documents: quotations & margin money receipts linked to visits

CREATE TABLE IF NOT EXISTS billing_number_sequences (
  doc_type   TEXT NOT NULL CHECK (doc_type IN ('quotation', 'receipt')),
  fy_start   SMALLINT NOT NULL,
  fy_end     SMALLINT NOT NULL,
  month      SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  last_serial INT NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, fy_start, fy_end, month)
);

CREATE TABLE IF NOT EXISTS billing_documents (
  id                SERIAL PRIMARY KEY,
  doc_type          TEXT NOT NULL CHECK (doc_type IN ('quotation', 'receipt')),
  doc_no            TEXT NOT NULL UNIQUE,
  doc_date          DATE NOT NULL,
  customer_name     TEXT,
  customer_phone    TEXT,
  vehicle_model     TEXT,
  grand_total       NUMERIC(12, 2),
  payload           JSONB NOT NULL,
  html_snapshot     TEXT,
  print_css         TEXT,
  file_path         TEXT,
  visit_id          INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  lead_id           INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  lead_cust_code    TEXT,
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  drive_file_id     TEXT,
  drive_web_link    TEXT,
  drive_upload_status TEXT NOT NULL DEFAULT 'skipped',
  drive_error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_billing_docs_type_date ON billing_documents(doc_type, doc_date DESC);
CREATE INDEX IF NOT EXISTS idx_billing_docs_visit ON billing_documents(visit_id);
CREATE INDEX IF NOT EXISTS idx_billing_docs_customer ON billing_documents(customer_name);
CREATE INDEX IF NOT EXISTS idx_billing_docs_lead_code ON billing_documents(lead_cust_code);
