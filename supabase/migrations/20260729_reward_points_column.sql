-- ═══════════════════════════════════════════════════════════════════
-- Add reward_points column to customers table
-- This column was referenced in code but never added via migration.
-- Safe to run multiple times (IF NOT EXISTS).
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0 NOT NULL;

-- Backfill existing rows that have NULL (shouldn't happen with DEFAULT, but just in case)
UPDATE customers
SET reward_points = 0
WHERE reward_points IS NULL;

-- Create reward_transactions table if it doesn't exist
-- (referenced in BookingSummaryPage and BookingsPage for points logging)
CREATE TABLE IF NOT EXISTS reward_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points      INTEGER     NOT NULL,
  transaction_type TEXT   NOT NULL,
  description TEXT,
  booking_id  UUID        REFERENCES bookings(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on reward_transactions
ALTER TABLE reward_transactions ENABLE ROW LEVEL SECURITY;

-- Allow customers to read their own transactions
DROP POLICY IF EXISTS "customer_read_own_transactions" ON reward_transactions;
CREATE POLICY "customer_read_own_transactions"
  ON reward_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name = 'reward_points';
