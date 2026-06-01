-- ═══════════════════════════════════════════════════════════════════
-- Allow 'pending_payment' as a booking status
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- 1. Drop any CHECK constraint on bookings.status that may block 'pending_payment'
--    (safe to run even if no constraint exists)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'bookings'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE bookings DROP CONSTRAINT ' || quote_ident(constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'No status CHECK constraint found — nothing to drop.';
  END IF;
END $$;

-- 2. Ensure status column exists with no restriction
--    Valid status values: 'upcoming' | 'completed' | 'cancelled' | 'pending_payment'
--    payment_status values: 'paid' | 'pending' | 'failed' | 'refund_processing' | 'refunded'

-- 3. Index for fast cleanup of abandoned pending_payment bookings
CREATE INDEX IF NOT EXISTS idx_bookings_pending_payment
  ON bookings(status, created_at)
  WHERE status = 'pending_payment';

-- 4. Verify
SELECT DISTINCT status FROM bookings LIMIT 20;
