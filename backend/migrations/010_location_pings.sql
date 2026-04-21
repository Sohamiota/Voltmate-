-- Location pings from sales reps during their clock-in session.
-- Type 'auto' = periodic background ping; 'manual' = rep tapped "Check In Here".
CREATE TABLE IF NOT EXISTS location_pings (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_id INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  accuracy_m    REAL,                          -- meters, from browser Geolocation API
  type          TEXT NOT NULL DEFAULT 'auto',  -- 'auto' | 'manual'
  note          TEXT,                          -- optional label for manual check-ins
  pinged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_pings_user_date
  ON location_pings (user_id, pinged_at);
