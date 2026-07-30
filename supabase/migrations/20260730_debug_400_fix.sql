-- ═══════════════════════════════════════════════════════════════════
-- DEBUG & FIX: create-booking 400 error
-- Run section by section in Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- ── STEP 1: Check if PhonePe columns exist in bookings ──
-- (Missing columns = the insert fails with a 500, not 400)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN (
    'phonepe_merchant_transaction_id',
    'phonepe_transaction_id',
    'phonepe_provider_reference_id'
  );

-- ── STEP 2: Add missing PhonePe columns if not already added ──
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS phonepe_merchant_transaction_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phonepe_transaction_id          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phonepe_provider_reference_id   TEXT DEFAULT NULL;

-- ── STEP 3: Check if 'phonepe' is blocked by a CHECK constraint on payment_method ──
SELECT conname, pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
  AND contype = 'c';

-- ── STEP 4: Drop any CHECK constraint on payment_method that blocks 'phonepe' ──
-- (Uncomment if Step 3 shows a payment_method constraint)
-- DO $$
-- DECLARE r RECORD;
-- BEGIN
--   FOR r IN
--     SELECT conname FROM pg_constraint
--     WHERE conrelid = 'bookings'::regclass AND contype = 'c'
--       AND pg_get_constraintdef(oid) ILIKE '%payment_method%'
--   LOOP
--     EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS %I', r.conname);
--     RAISE NOTICE 'Dropped: %', r.conname;
--   END LOOP;
-- END $$;

-- ── STEP 5: Check bookings for today's date/time to see if slot is truly full ──
-- Replace 'YOUR_SALON_ID', '2026-07-30', '18:00' with actual values
SELECT 
  id, booking_date, booking_time, status, person_count, payment_status
FROM bookings
WHERE salon_id = 'YOUR_SALON_ID'
  AND booking_date = '2026-07-30'
  AND booking_time = '18:00'
  AND status NOT IN ('cancelled', 'pending_payment');

-- ── STEP 6: Check the salon's total_seats ──
SELECT id, name, total_seats
FROM salons
WHERE id = 'YOUR_SALON_ID';

-- ── STEP 7: Check if a slot is explicitly blocked for that date/time ──
SELECT *
FROM slots
WHERE salon_id = 'YOUR_SALON_ID'
  AND slot_date = '2026-07-30'
  AND slot_time = '18:00'
  AND status = 'blocked';

-- ── STEP 8: Ensure permissions are granted ──
GRANT ALL ON TABLE bookings TO anon, authenticated, service_role;
GRANT ALL ON TABLE salons  TO anon, authenticated, service_role;
GRANT ALL ON TABLE slots   TO anon, authenticated, service_role;
