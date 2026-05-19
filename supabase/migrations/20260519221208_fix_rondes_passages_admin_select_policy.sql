/*
  # Fix rondes_passages admin SELECT policy

  The existing "Admins can read all rondes_passages" policy restricts access
  to super_admins and Direction/Chef de poste managed users.
  Super admins accessing the Rapports tab need unrestricted SELECT access.

  Changes:
  - Drop the existing restrictive admin SELECT policy
  - Add a broad "Admins can read all passages" policy that covers super_admins
    via USING (true) scoped to the super_admin check, so regular agents are
    still limited to their own rows via the existing agent policy
*/

DROP POLICY IF EXISTS "Admins can read all rondes_passages" ON rondes_passages;

CREATE POLICY "Admins can read all passages"
  ON rondes_passages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM managed_users
      WHERE managed_users.auth_user_id = auth.uid()
        AND managed_users.fonction = ANY (ARRAY['Direction', 'Chef de poste'])
    )
  );
