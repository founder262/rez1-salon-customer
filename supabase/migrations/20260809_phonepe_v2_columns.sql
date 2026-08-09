-- ============================================================
-- PhonePe PG 2.0 V2 Credentials Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

-- 1. Add missing PhonePe V2 credential columns to platform_config
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS phonepe_client_id        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_client_secret    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_client_version   TEXT DEFAULT '1',
  ADD COLUMN IF NOT EXISTS phonepe_webhook_url      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_webhook_username TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_webhook_password TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_success_url      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_failure_url      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_cancel_url       TEXT DEFAULT '';

-- 2. Ensure V1 columns exist (in case earlier migration wasn't applied)
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS phonepe_enabled     BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS phonepe_merchant_id TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_salt_key    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS phonepe_salt_index  TEXT    DEFAULT '1',
  ADD COLUMN IF NOT EXISTS phonepe_env         TEXT    DEFAULT 'UAT';

-- 3. Grant permissions so service_role can read/write
GRANT ALL ON TABLE platform_config TO anon, authenticated, service_role;
