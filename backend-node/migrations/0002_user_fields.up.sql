ALTER TABLE users
  ADD COLUMN is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN is_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN role text NOT NULL DEFAULT 'employee',
  ADD COLUMN otp_code text,
  ADD COLUMN otp_expires_at timestamptz;

