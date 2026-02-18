-- Migration: create leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  cust_code TEXT,
  connect_date DATE,
  cust_name TEXT,
  business TEXT,
  phone_no TEXT,
  lead_type TEXT,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_connect_date_idx ON leads(connect_date);

