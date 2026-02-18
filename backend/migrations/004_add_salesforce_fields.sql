-- add salesforce fields to opportunities
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS salesforce_id TEXT;

ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS amount NUMERIC;

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_salesforce_id_idx ON opportunities(salesforce_id);

