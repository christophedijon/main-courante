/*
  # Open RLS on all ronde tables for authenticated users

  Adds permissive FOR ALL policies on the four ronde tables so that
  any authenticated user can read and write without restriction.
  These complement the existing narrower policies.

  Tables affected:
  - rondes_passages
  - rondes_rapports
  - rondes_config
  - rondes_config_balises
*/

CREATE POLICY "Allow all authenticated on rondes_passages"
  ON rondes_passages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated on rondes_rapports"
  ON rondes_rapports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated on rondes_config"
  ON rondes_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all authenticated on rondes_config_balises"
  ON rondes_config_balises FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
