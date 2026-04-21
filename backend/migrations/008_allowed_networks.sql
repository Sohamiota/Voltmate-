-- Trusted office networks used to gate clock-in.
-- Admins add rows here; the clock-in handler checks the client IP against each ip_cidr entry.
CREATE TABLE IF NOT EXISTS allowed_networks (
  id         SERIAL PRIMARY KEY,
  label      TEXT NOT NULL,                       -- human-readable name, e.g. "Office WiFi"
  ip_cidr    TEXT NOT NULL,                       -- CIDR notation, e.g. "203.0.113.0/24" or single IP "203.0.113.5/32"
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
