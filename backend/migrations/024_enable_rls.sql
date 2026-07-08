-- 024_enable_rls.sql
-- Lock down Supabase PostgREST (anon / authenticated) while keeping Render backend access.
--
-- Voltmate uses Express + DATABASE_URL (postgres pooler), not Supabase client SDK.
-- Enabling RLS with no permissive policies blocks public REST API table access.
-- The postgres / service_role DB users used by the backend bypass RLS as usual.
--
-- Run once in Supabase SQL Editor, or: node scripts/migrate.js (applies all migrations).

-- ── 1. Enable RLS on every table in public ───────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    RAISE NOTICE 'RLS enabled on public.%', t;
  END LOOP;
END $$;

-- ── 2. Revoke direct table access from Supabase API roles ─────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ── 3. Harden schema defaults for future tables ───────────────────────────────
REVOKE ALL ON SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Keep introspection / API schema discovery working where needed
GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres, service_role;
