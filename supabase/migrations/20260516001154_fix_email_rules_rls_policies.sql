/*
  # Fix email_rules RLS policies

  The previous policies used a subquery on auth.users to get the email,
  which can fail due to permission issues. Replace with a direct join
  using the same pattern used in other tables (lower(auth.jwt()->>'email')).
*/

DROP POLICY IF EXISTS "Super admins can select email_rules" ON public.email_rules;
DROP POLICY IF EXISTS "Super admins can insert email_rules" ON public.email_rules;
DROP POLICY IF EXISTS "Super admins can update email_rules" ON public.email_rules;
DROP POLICY IF EXISTS "Super admins can delete email_rules" ON public.email_rules;

CREATE POLICY "Super admins can select email_rules"
  ON public.email_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE lower(super_admins.email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Super admins can insert email_rules"
  ON public.email_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE lower(super_admins.email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Super admins can update email_rules"
  ON public.email_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE lower(super_admins.email) = lower(auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE lower(super_admins.email) = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Super admins can delete email_rules"
  ON public.email_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE lower(super_admins.email) = lower(auth.jwt() ->> 'email')
    )
  );
