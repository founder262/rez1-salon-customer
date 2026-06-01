-- ═══════════════════════════════════════════════════════════════════
-- BOOKINGS TABLE — Full Column Repair Migration
-- Adds ALL columns that create-booking edge function expects.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).
-- Run in Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Core booking columns (may already exist) ──
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS subtotal          INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offer_discount    INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee      INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount        INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS person_count      INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_minutes  INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_names     TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id  TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_order_id    TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_method    TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_status    TEXT        DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS total_amount      INTEGER     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- ── 2. Cancellation & refund columns (from today's migration) ──
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason     TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_amount     INTEGER     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_id         TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_status     TEXT        DEFAULT NULL;

-- ── 3. Drop any CHECK constraint on status that blocks valid values ──
--    (Only runs if constraint exists; safe no-op otherwise)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'bookings'::regclass
      AND  contype  = 'c'
      AND  (conname ILIKE '%status%' OR pg_get_constraintdef(oid) ILIKE '%status%')
  LOOP
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END
$$;

-- ── 4. Drop any CHECK constraint on payment_status ──
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'bookings'::regclass
      AND  contype  = 'c'
      AND  (conname ILIKE '%payment%' OR pg_get_constraintdef(oid) ILIKE '%payment_status%')
  LOOP
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END
$$;

-- ── 5. Indexes for fast queries ──
CREATE INDEX IF NOT EXISTS idx_bookings_salon_date
  ON bookings(salon_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_bookings_customer
  ON bookings(customer_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_refund_status
  ON bookings(refund_status)
  WHERE refund_status IS NOT NULL;

-- ── 6. Verify all columns exist ──
SELECT column_name, data_type, column_default
FROM   information_schema.columns
WHERE  table_name = 'bookings'
ORDER  BY ordinal_position;
