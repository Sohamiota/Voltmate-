-- Migration: create visits table
CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  lead_cust_code TEXT,
  salesperson_id INTEGER REFERENCES users(id),
  vehicle TEXT,
  status TEXT,
  visit_date DATE,
  next_action TEXT,
  next_action_date DATE,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visits_lead_id_idx ON visits(lead_id);
CREATE INDEX IF NOT EXISTS visits_salesperson_idx ON visits(salesperson_id);

