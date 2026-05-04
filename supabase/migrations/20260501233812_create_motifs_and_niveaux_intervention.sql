/*
  # Créer les tables motifs et niveaux_intervention

  ## Nouvelles tables

  ### `motifs`
  - `id` (uuid, pk)
  - `nom` (text) — libellé du motif de sécurité des personnes
  - `description` (text) — description optionnelle
  - `ordre` (int) — ordre d'affichage
  - `created_at` (timestamptz)

  ### `niveaux_intervention`
  - `id` (uuid, pk)
  - `motif_id` (uuid, fk → motifs.id cascade delete)
  - `label` (text) — intitulé du niveau
  - `description` (text) — description optionnelle du niveau
  - `ordre` (int) — ordre dans la graduation
  - `created_at` (timestamptz)

  ## Sécurité
  - RLS activé sur les deux tables
  - Accès réservé aux super admins (email présent dans super_admins)
*/

CREATE TABLE IF NOT EXISTS motifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE motifs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can select motifs"
  ON motifs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert motifs"
  ON motifs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update motifs"
  ON motifs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete motifs"
  ON motifs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  );

-- ─── niveaux_intervention ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS niveaux_intervention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motif_id uuid NOT NULL REFERENCES motifs(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  ordre int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE niveaux_intervention ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can select niveaux"
  ON niveaux_intervention FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert niveaux"
  ON niveaux_intervention FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update niveaux"
  ON niveaux_intervention FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete niveaux"
  ON niveaux_intervention FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      JOIN auth.users ON auth.users.email = super_admins.email
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS niveaux_intervention_motif_id_idx ON niveaux_intervention(motif_id);
