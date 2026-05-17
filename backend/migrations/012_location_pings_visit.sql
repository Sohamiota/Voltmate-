-- CRM visit-linked pings + context (attendance vs visit capture)
ALTER TABLE location_pings
  ADD COLUMN IF NOT EXISTS visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS context TEXT;

CREATE INDEX IF NOT EXISTS location_pings_visit_id_idx ON location_pings (visit_id);
CREATE INDEX IF NOT EXISTS location_pings_user_ping_desc ON location_pings (user_id, pinged_at DESC);
