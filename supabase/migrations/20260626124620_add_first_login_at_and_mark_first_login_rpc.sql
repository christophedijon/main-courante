-- Add first_login_at column to managed_users
ALTER TABLE managed_users
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz;

-- RPC callable by any authenticated user to stamp their own first login
CREATE OR REPLACE FUNCTION mark_first_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE managed_users
  SET first_login_at = now()
  WHERE auth_user_id = auth.uid()
    AND first_login_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_first_login() TO authenticated;
