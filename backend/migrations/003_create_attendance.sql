-- Migration: create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in_at TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out_at TIMESTAMP WITH TIME ZONE,
  date date NOT NULL,
  timezone text,
  location text,
  note text,
  duration_seconds INTEGER,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  needs_approval boolean NOT NULL DEFAULT false,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- prevent multiple open sessions per user
CREATE UNIQUE INDEX IF NOT EXISTS attendance_one_open_per_user ON attendance(user_id) WHERE clock_out_at IS NULL;

