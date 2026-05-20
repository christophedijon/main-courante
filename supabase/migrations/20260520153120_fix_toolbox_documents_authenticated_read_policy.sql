/*
  # Fix toolbox_documents SELECT policy for authenticated users

  The existing "Authenticated users can read active toolbox documents" policy
  was missing the TO authenticated scope, meaning it may not apply correctly
  to logged-in non-admin users. This migration replaces it with a proper
  policy scoped to the authenticated role.

  Changes:
  - Drop the old incomplete SELECT policy
  - Add a new SELECT policy explicitly scoped to authenticated users
*/

DROP POLICY IF EXISTS "Authenticated users can read active toolbox documents" ON toolbox_documents;

CREATE POLICY "Authenticated users can read active toolbox documents"
  ON toolbox_documents
  FOR SELECT
  TO authenticated
  USING (actif = true);
