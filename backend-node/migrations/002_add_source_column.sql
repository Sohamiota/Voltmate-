-- Migration: add source column to opportunities
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS source VARCHAR(64);

-- Optionally set existing rows as non-salesforce if you want:
-- UPDATE opportunities SET source = 'non-salesforce' WHERE source IS NULL;

