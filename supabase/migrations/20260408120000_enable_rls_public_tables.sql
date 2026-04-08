-- Row Level Security: stop anonymous (anon key) access to public tables.
-- Authenticated users (JWT session) match policy below; service_role bypasses RLS.
--
-- Apply: Supabase Dashboard → SQL Editor, or `supabase db push` / linked CI.
-- Tighten later with per-table policies or has_permission(...) if desired.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      r.tablename
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS "authenticated_all" ON public.%I',
      r.tablename
    );

    EXECUTE format(
      'CREATE POLICY "authenticated_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      r.tablename
    );
  END LOOP;
END $$;
