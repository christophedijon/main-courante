-- Allow anonymous users to read jauge data for the public display page

-- entreprise: anon can read all rows (venue name + capacity not sensitive)
CREATE POLICY "anon_read_entreprise_public_jauge"
  ON entreprise FOR SELECT
  TO anon
  USING (true);

-- jauge_etat: anon can read non-test rows only (live count not sensitive)
CREATE POLICY "anon_read_jauge_etat_public"
  ON jauge_etat FOR SELECT
  TO anon
  USING (is_test = false);
