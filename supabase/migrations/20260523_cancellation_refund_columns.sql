-- ═══════════════════════════════════════════════════════════════════
-- Booking Cancellation & Refund Columns — Database Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add cancellation & refund tracking columns to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason       TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_amount       INTEGER     DEFAULT NULL,   -- rupees (service only, NOT platform fee)
  ADD COLUMN IF NOT EXISTS refund_id           TEXT        DEFAULT NULL,   -- Razorpay refund ID (rfnd_xxx)
  ADD COLUMN IF NOT EXISTS refund_status       TEXT        DEFAULT NULL;   -- 'processing' | 'refunded' | 'failed'

-- 2. Also allow 'refund_processing' as a valid payment_status
--    (the existing column is TEXT so no enum change needed, just documenting)
--    payment_status values: 'paid' | 'pending' | 'failed' | 'refund_processing' | 'refunded'

-- 3. Index for fast lookup of refunds in progress
CREATE INDEX IF NOT EXISTS idx_bookings_refund_status
  ON bookings(refund_status)
  WHERE refund_status IS NOT NULL;

-- 4. Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('cancelled_at', 'cancel_reason', 'refund_amount', 'refund_id', 'refund_status')
ORDER BY column_name;
