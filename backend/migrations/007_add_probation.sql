-- Migration: add probation flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_on_probation boolean NOT NULL DEFAULT false;
