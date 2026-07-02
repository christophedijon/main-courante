-- app_secrets has RLS enabled but no policies.
-- service_role bypasses RLS by default, but adding this explicit policy
-- documents the intent and satisfies security audits.
CREATE POLICY "service_role_only" ON public.app_secrets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
