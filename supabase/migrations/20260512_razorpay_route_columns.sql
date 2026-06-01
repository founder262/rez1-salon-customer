-- ═══════════════════════════════════════════════════════════════════
-- Razorpay Route Payment Split — Database Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add Razorpay Route columns to platform_config
--    razorpay_key_secret  → used ONLY in the edge function (server-side)
--    razorpay_account_id  → Admin's Razorpay linked account (acc_xxx)
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS razorpay_key_secret   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS razorpay_account_id   TEXT DEFAULT '';

-- 2. Add owner's Razorpay linked account to owners table
--    The salon owner must link their bank account via Razorpay Route onboarding.
--    Once linked, Razorpay provides an account ID (acc_xxx) to store here.
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS razorpay_account_id   TEXT DEFAULT '';

-- 3. (Optional) Restrict read access to razorpay_key_secret
--    Only the service role (edge functions) should read this column.
--    Anon and authenticated roles get NULL for this column via RLS.
--    If you have column-level security enabled, you can revoke select
--    on the column. For now, rely on the edge function using service role key.

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('platform_config', 'owners')
  AND column_name LIKE '%razorpay%'
ORDER BY table_name, column_name;
