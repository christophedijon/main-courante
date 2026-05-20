/*
  # Allow all authenticated users to read niveaux_intervention and motifs

  Currently both tables have SELECT policies restricted to super admins only,
  causing regular agents to see "Aucun niveau configuré" and "Aucun motif configuré"
  in the mobile saisie flow.

  Changes:
  - Add SELECT policy on niveaux_intervention for all authenticated users
  - Add SELECT policy on motifs for all authenticated users

  Write operations (INSERT, UPDATE, DELETE) remain super-admin only.
*/

CREATE POLICY "Allow authenticated to read niveaux_intervention"
  ON niveaux_intervention
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to read motifs"
  ON motifs
  FOR SELECT
  TO authenticated
  USING (true);
