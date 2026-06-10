-- Add columns to salons table for emergency close
ALTER TABLE salons
ADD COLUMN IF NOT EXISTS is_emergency_closed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS emergency_closed_at timestamptz,
ADD COLUMN IF NOT EXISTS emergency_close_reason text;

-- Add columns to customers table for profile completion
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS gender text;

-- Add columns to bookings for cancellations
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS cancelled_by text;

-- Create an RPC to trigger emergency close safely from the backend
CREATE OR REPLACE FUNCTION trigger_emergency_close(p_salon_id uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Update the salon status
  UPDATE salons
  SET is_emergency_closed = true,
      emergency_closed_at = now(),
      emergency_close_reason = p_reason
  WHERE id = p_salon_id;

  -- 2. Cancel all upcoming bookings for this salon
  -- Note: Depending on refund logic, an edge function might be better here to trigger external API calls.
  -- This at least handles the database state.
  UPDATE bookings
  SET status = 'cancelled',
      cancellation_reason = 'Emergency Close: ' || p_reason,
      cancelled_by = 'owner'
  WHERE salon_id = p_salon_id
    AND status = 'upcoming';

  RETURN true;
END;
$$;

-- Create an RPC to deactivate emergency close
CREATE OR REPLACE FUNCTION deactivate_emergency_close(p_salon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE salons
  SET is_emergency_closed = false,
      emergency_closed_at = null,
      emergency_close_reason = null
  WHERE id = p_salon_id;

  RETURN true;
END;
$$;
