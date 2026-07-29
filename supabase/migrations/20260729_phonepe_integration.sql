-- PhonePe Gateway Integration Migration (Owner Panel)
-- Apply this same migration in your Supabase SQL editor

-- 1. Add PhonePe configuration columns to platform_config
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS phonepe_enabled                BOOLEAN     DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS phonepe_merchant_id            TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_salt_key               TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_salt_index             TEXT        DEFAULT '1',
  ADD COLUMN IF NOT EXISTS phonepe_env                    TEXT        DEFAULT 'UAT';

-- 2. Add PhonePe tracking columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS phonepe_merchant_transaction_id TEXT       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phonepe_transaction_id         TEXT       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phonepe_provider_reference_id  TEXT       DEFAULT NULL;

-- 3. Grant permissions
GRANT ALL ON TABLE platform_config TO anon, authenticated, service_role;
GRANT ALL ON TABLE bookings TO anon, authenticated, service_role;
