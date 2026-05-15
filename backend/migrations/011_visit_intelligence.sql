-- Visit "Lost – Not Interested" dispositions + hot lead flag
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS lost_not_interested_reason TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason_notes TEXT;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS is_hot_lead boolean NOT NULL DEFAULT false;
