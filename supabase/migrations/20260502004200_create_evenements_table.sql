/*
  # Création du registre de main courante (événements)

  Cette migration crée les tables nécessaires à la saisie d'événements
  par l'application mobile terrain.

  ## Nouvelles tables
  - `evenements` : un événement saisi (SSI ou Sécurité des personnes)
    - `id` (uuid, PK)
    - `numero` (text, unique, généré automatiquement type "2026-000001")
    - `type` (text, 'ssi' | 'securite_personnes')
    - `espace_id` (uuid, FK espaces, SET NULL)
    - `zone_id` (uuid, FK zones, SET NULL)
    - `niveau_id` (uuid, FK niveaux_intervention, SET NULL)
    - `commentaire` (text)
    - `date_evenement` (timestamptz, date/heure de l'événement)
    - `created_at` (timestamptz)
    - `created_by` (uuid, auth.uid de l'auteur)
    - `created_by_email` (text, snapshot email)
    - `user_fonction` (text, snapshot fonction)
    - `etablissement_nom` (text, snapshot nom entreprise)
    - Snapshots texte (espace_nom, zone_nom, niveau_label) pour historique stable

  - `evenement_motifs` : pivot multi-sélection de motifs par événement
    - `evenement_id` (uuid, FK evenements CASCADE)
    - `motif_id` (uuid, FK motifs CASCADE)
    - `motif_nom` (text, snapshot)
    - PK composite

  ## Sécurité
  - RLS activée sur les deux tables
  - SELECT : tout utilisateur authentifié
  - INSERT : tout utilisateur authentifié (enregistre ses événements)
  - UPDATE / DELETE : super admins (table super_admins) uniquement

  ## Numérotation
  - Séquence `evenement_numero_seq` + trigger BEFORE INSERT pour formater
    `AAAA-NNNNNN` basé sur l'année courante.

  ## Index
  - `date_evenement DESC`, `type`, `created_by`
*/

-- Sequence pour le compteur d'événements
CREATE SEQUENCE IF NOT EXISTS evenement_numero_seq START 1;

-- Table principale des événements
CREATE TABLE IF NOT EXISTS evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  type text NOT NULL CHECK (type IN ('ssi', 'securite_personnes')),
  espace_id uuid REFERENCES espaces(id) ON DELETE SET NULL,
  zone_id uuid REFERENCES zones(id) ON DELETE SET NULL,
  niveau_id uuid REFERENCES niveaux_intervention(id) ON DELETE SET NULL,
  espace_nom text DEFAULT '',
  zone_nom text DEFAULT '',
  niveau_label text DEFAULT '',
  commentaire text DEFAULT '',
  date_evenement timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_by_email text DEFAULT '',
  user_fonction text DEFAULT '',
  etablissement_nom text DEFAULT ''
);

-- Table pivot motifs
CREATE TABLE IF NOT EXISTS evenement_motifs (
  evenement_id uuid NOT NULL REFERENCES evenements(id) ON DELETE CASCADE,
  motif_id uuid NOT NULL REFERENCES motifs(id) ON DELETE CASCADE,
  motif_nom text DEFAULT '',
  PRIMARY KEY (evenement_id, motif_id)
);

-- Index
CREATE INDEX IF NOT EXISTS evenements_date_idx ON evenements (date_evenement DESC);
CREATE INDEX IF NOT EXISTS evenements_type_idx ON evenements (type);
CREATE INDEX IF NOT EXISTS evenements_created_by_idx ON evenements (created_by);
CREATE INDEX IF NOT EXISTS evenement_motifs_motif_idx ON evenement_motifs (motif_id);

-- Trigger pour numéro automatique
CREATE OR REPLACE FUNCTION set_evenement_numero()
RETURNS trigger AS $$
DECLARE
  seq_val bigint;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    seq_val := nextval('evenement_numero_seq');
    NEW.numero := to_char(now(), 'YYYY') || '-' || lpad(seq_val::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evenements_set_numero ON evenements;
CREATE TRIGGER evenements_set_numero
  BEFORE INSERT ON evenements
  FOR EACH ROW
  EXECUTE FUNCTION set_evenement_numero();

-- RLS
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenement_motifs ENABLE ROW LEVEL SECURITY;

-- Policies evenements
DROP POLICY IF EXISTS "Authenticated can view evenements" ON evenements;
CREATE POLICY "Authenticated can view evenements"
  ON evenements FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert evenements" ON evenements;
CREATE POLICY "Authenticated can insert evenements"
  ON evenements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Super admins can update evenements" ON evenements;
CREATE POLICY "Super admins can update evenements"
  ON evenements FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()))
  WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()));

DROP POLICY IF EXISTS "Super admins can delete evenements" ON evenements;
CREATE POLICY "Super admins can delete evenements"
  ON evenements FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()));

-- Policies evenement_motifs
DROP POLICY IF EXISTS "Authenticated can view evenement_motifs" ON evenement_motifs;
CREATE POLICY "Authenticated can view evenement_motifs"
  ON evenement_motifs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert evenement_motifs" ON evenement_motifs;
CREATE POLICY "Authenticated can insert evenement_motifs"
  ON evenement_motifs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Super admins can delete evenement_motifs" ON evenement_motifs;
CREATE POLICY "Super admins can delete evenement_motifs"
  ON evenement_motifs FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email()));
