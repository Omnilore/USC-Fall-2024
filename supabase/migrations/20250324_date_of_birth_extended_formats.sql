-- Extended partial date_of_birth formats for public.members
-- Run in Supabase SQL Editor (safe to run if you already applied the earlier partial-date migration)

-- Ensure column is text (no-op if already text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'members'
      AND column_name = 'date_of_birth'
      AND udt_name = 'date'
  ) THEN
    ALTER TABLE public.members
      ALTER COLUMN date_of_birth TYPE text
      USING date_of_birth::text;
  END IF;
END $$;

ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_date_of_birth_format;

ALTER TABLE public.members
  ADD CONSTRAINT members_date_of_birth_format
  CHECK (
    date_of_birth IS NULL
    OR date_of_birth ~ '^\d{4}$'
    OR date_of_birth ~ '^\d{4}-\d{2}$'
    OR date_of_birth ~ '^\d{4}-\d{2}-\d{2}$'
    OR date_of_birth ~ '^--(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
  );

-- Allowed values (use exactly these strings in Table Editor):
--   1953              year only
--   1953-07           year + month
--   1953-07-01        full date
--   --07-15           month + day only (leading -- means unknown year)
