-- Leave management: join date, holidays, leave requests, FY SL carry-forward

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS join_date DATE;

UPDATE users SET join_date = created_at::date WHERE join_date IS NULL;

-- ── Company holidays ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays (
  id         SERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Holiday list 2026 (from company calendar)
INSERT INTO holidays (holiday_date, name) VALUES
  ('2026-01-01', '1st January'),
  ('2026-01-23', 'Saraswati Puja'),
  ('2026-01-26', 'Republic Day'),
  ('2026-03-03', 'Dol Purnima'),
  ('2026-04-14', 'Poila Boisakh'),
  ('2026-05-01', 'Labour Day'),
  ('2026-08-15', 'Independence Day'),
  ('2026-09-17', 'Biswakarma Puja'),
  ('2026-10-02', 'Gandhi Jayanti'),
  ('2026-10-17', 'Durga Puja'),
  ('2026-10-18', 'Durga Puja'),
  ('2026-10-19', 'Durga Puja'),
  ('2026-10-20', 'Durga Puja'),
  ('2026-10-21', 'Durga Puja'),
  ('2026-10-25', 'Laxmi Puja'),
  ('2026-11-08', 'Kali Puja (Diwali)'),
  ('2026-12-25', 'Christmas')
ON CONFLICT (holiday_date) DO NOTHING;

-- ── Leave requests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type  TEXT NOT NULL CHECK (leave_type IN ('CL', 'SL')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  days        NUMERIC(5, 1) NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note  TEXT,
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS leave_requests_user_idx ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON leave_requests(status);
CREATE INDEX IF NOT EXISTS leave_requests_dates_idx ON leave_requests(start_date, end_date);

-- ── SL carry-forward per financial year (April–March) ────────────────────────
CREATE TABLE IF NOT EXISTS leave_fy_balances (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fy_start_year INT NOT NULL,
  sl_carried_in NUMERIC(5, 1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fy_start_year)
);
