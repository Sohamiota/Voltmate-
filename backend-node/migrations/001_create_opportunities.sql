-- Migration: create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id SERIAL PRIMARY KEY,
  sl_no INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  opportunity_name TEXT,
  phone_no TEXT,
  stage TEXT,
  next_connect TIMESTAMP WITH TIME ZONE,
  last_connect TIMESTAMP WITH TIME ZONE,
  month_of_reconnect TEXT,
  stage_remark TEXT,
  connected_person TEXT,
  probability INTEGER,
  business_payload JSONB,
  use_range TEXT,
  customer_own_vehicle BOOLEAN,
  customer_location TEXT,
  vehicle_suggested_action TEXT,
  distributor_manufacturer TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

