-- PostgREST cannot choose between upsert_payouts(json) and upsert_payouts(jsonb).
-- Keep one signature (jsonb is typical). Re-create json version only if you rely on it elsewhere.
-- Run in Supabase SQL Editor if migration deploy is not used.

DROP FUNCTION IF EXISTS public.upsert_payouts(json);
