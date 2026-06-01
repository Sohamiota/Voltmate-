-- Proof documents for sick leave > 2 days; CL advance-notice enforced in application logic

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS requires_proof BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proof_filename TEXT,
  ADD COLUMN IF NOT EXISTS proof_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS proof_path TEXT,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ;
