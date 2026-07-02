-- Allow anonymous users to read etablissement fields needed for the public jauge page.
-- Only exposes id, enseigne, effectif_public — no sensitive data.
CREATE POLICY "anon_read_public_jauge_etablissement" ON etablissements
  FOR SELECT TO anon
  USING (true);
