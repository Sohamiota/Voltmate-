-- Track which IP address was used for clock-in and whether it matched an allowed network.
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS clock_in_ip      TEXT,
  ADD COLUMN IF NOT EXISTS network_verified BOOLEAN NOT NULL DEFAULT false;
