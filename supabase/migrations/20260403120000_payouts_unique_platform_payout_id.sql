-- Required for PostgREST upsert: ON CONFLICT needs a matching unique index.
-- Run in Supabase SQL Editor if migrations are not auto-applied.

CREATE UNIQUE INDEX IF NOT EXISTS payouts_payment_platform_payout_id_key
ON public.payouts (payment_platform, payout_id);
