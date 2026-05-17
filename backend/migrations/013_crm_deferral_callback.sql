-- CRM: deferred purchase intent + callback / stall dispositions (visit capture + lead rollup)

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS deferral_bucket TEXT,
  ADD COLUMN IF NOT EXISTS deferral_notes TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_after_date DATE,
  ADD COLUMN IF NOT EXISTS earliest_purchase_intent_date DATE,
  ADD COLUMN IF NOT EXISTS contact_disposition TEXT,
  ADD COLUMN IF NOT EXISTS callback_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_promised_callback BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS deferral_bucket TEXT,
  ADD COLUMN IF NOT EXISTS deferral_notes TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_after_date DATE,
  ADD COLUMN IF NOT EXISTS earliest_purchase_intent_date DATE,
  ADD COLUMN IF NOT EXISTS contact_disposition TEXT,
  ADD COLUMN IF NOT EXISTS callback_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_promised_callback BOOLEAN NOT NULL DEFAULT false;
