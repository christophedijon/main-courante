/*
  # Balises & Rondes — Schema Creation

  ## Summary
  Creates all tables for the BLE beacon-based security patrol feature.
  Mono-tenant app — no site_id. Auth via managed_users table.

  ## New Tables

  1. `beacons` — Physical BLE beacons, optionally linked to a zone
  2. `rondes_config` — Named patrol configurations with mode and scheduled time
  3. `rondes_config_balises` — Ordered join between rondes_config and beacons
  4. `rondes_passages` — Agent beacon scan events during patrols
  5. `rondes_rapports` — One nightly report per agent (unique agent_id + date_nuit)

  ## Modified Tables
  - `entreprise`: adds `ronde_mode` text column (default 'aleatoire')

  ## Security
  - RLS enabled on all new tables
  - Config tables (beacons, rondes_config, rondes_config_balises): readable by all
    authenticated users, writable only by admins (Direction / Chef de poste / super_admins)
  - Passage/rapport tables: admins read all; agents read/insert own rows only
*/

-- ─── beacons ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beacons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id     uuid REFERENCES zones(id) ON DELETE SET NULL,
  nom         text NOT NULL,
  description text DEFAULT '',
  minor       integer NOT NULL,
  major       integer DEFAULT 1,
  uuid_beacon text NOT NULL DEFAULT '426C7565-4368-6172-6D42-6561636F6E73',
  mac         text,
  rssi_seuil  integer DEFAULT -72,
  is_entree   boolean DEFAULT false,
  actif       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE beacons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read beacons"
  ON beacons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert beacons"
  ON beacons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

CREATE POLICY "Admins can update beacons"
  ON beacons FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

CREATE POLICY "Admins can delete beacons"
  ON beacons FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

-- ─── rondes_config ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rondes_config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom          text NOT NULL,
  heure_prevue time,
  mode         text DEFAULT 'aleatoire' CHECK (mode IN ('aleatoire', 'defini')),
  actif        boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE rondes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rondes_config"
  ON rondes_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert rondes_config"
  ON rondes_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

CREATE POLICY "Admins can update rondes_config"
  ON rondes_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

CREATE POLICY "Admins can delete rondes_config"
  ON rondes_config FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

-- ─── rondes_config_balises ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rondes_config_balises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ronde_config_id uuid REFERENCES rondes_config(id) ON DELETE CASCADE,
  beacon_id       uuid REFERENCES beacons(id) ON DELETE CASCADE,
  ordre           integer NOT NULL
);

ALTER TABLE rondes_config_balises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rondes_config_balises"
  ON rondes_config_balises FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert rondes_config_balises"
  ON rondes_config_balises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

CREATE POLICY "Admins can update rondes_config_balises"
  ON rondes_config_balises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

CREATE POLICY "Admins can delete rondes_config_balises"
  ON rondes_config_balises FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

-- ─── rondes_passages ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rondes_passages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid REFERENCES managed_users(id),
  beacon_id       uuid REFERENCES beacons(id),
  ronde_config_id uuid REFERENCES rondes_config(id) NULL,
  rssi            integer,
  timestamp       timestamptz DEFAULT now()
);

ALTER TABLE rondes_passages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all rondes_passages"
  ON rondes_passages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

CREATE POLICY "Agents can read own rondes_passages"
  ON rondes_passages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM managed_users WHERE id = agent_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can insert rondes_passages"
  ON rondes_passages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM managed_users WHERE id = agent_id AND auth_user_id = auth.uid())
  );

-- ─── rondes_rapports ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rondes_rapports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          uuid REFERENCES managed_users(id),
  date_nuit         date NOT NULL,
  heure_prise_poste timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (agent_id, date_nuit)
);

ALTER TABLE rondes_rapports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all rondes_rapports"
  ON rondes_rapports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR EXISTS (SELECT 1 FROM managed_users WHERE auth_user_id = auth.uid() AND fonction IN ('Direction', 'Chef de poste'))
  );

CREATE POLICY "Agents can read own rondes_rapports"
  ON rondes_rapports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM managed_users WHERE id = agent_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can insert rondes_rapports"
  ON rondes_rapports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM managed_users WHERE id = agent_id AND auth_user_id = auth.uid())
  );

-- ─── entreprise: add ronde_mode column ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprise' AND column_name = 'ronde_mode'
  ) THEN
    ALTER TABLE entreprise ADD COLUMN ronde_mode text DEFAULT 'aleatoire';
  END IF;
END $$;
