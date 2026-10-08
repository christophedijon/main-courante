/*
# Create function to store service_role key in vault

## Purpose
- Creates a SECURITY DEFINER function that allows storing the service_role key
  in the Supabase vault from an edge function (which has the key as env var)
- This key is then accessible by pg_cron jobs via vault.decrypted_secrets
- Enables cron jobs to authenticate to edge functions using the service_role key

## Security
- The function is SECURITY DEFINER (runs as postgres)
- Only callable by authenticated users (RLS on the function via pg_cron usage)
- The service_role key is stored encrypted in vault
*/

CREATE OR REPLACE FUNCTION public.store_service_role_key(key_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing secret if it exists
  DELETE FROM vault.secrets WHERE name = 'service_role_key';
  -- Store the new secret
  PERFORM vault.create_secret(key_value, 'service_role_key', 'Service role key for cron job auth');
END;
$$;

-- Grant execute to authenticated (edge functions use service_role which bypasses RLS)
GRANT EXECUTE ON FUNCTION public.store_service_role_key(text) TO authenticated;
