/*
  # Add Gauge (Jauge) Feature

  ## Summary
  Implements a real-time public capacity gauge system for venues.

  ## Changes

  ### 1. Modified Tables
  - `entreprise`
    - `mode_jauge` (text, NOT NULL, DEFAULT 'sortie'): Operating mode — 'sortie' tracks exits only, 'entree_sortie' tracks both entries and exits
    - `effectif_public_maximum` (integer, NOT NULL, DEFAULT 0): Maximum allowed public capacity

  ### 2. New Tables
  - `jauge_etat`: Current gauge state per venue per day
    - `id` (uuid, PK)
    - `entreprise_id` (uuid, FK → entreprise.id)
    - `count_actuel` (integer, ≥ 0): Current occupancy count
    - `date_soiree` (date): The evening/event date this count belongs to
    - `updated_at` (timestamptz)
    - `updated_by` (text): User identifier who last updated
    - Unique constraint on (entreprise_id, date_soiree)

  - `jauge_actions`: Immutable audit log of every gauge action
    - `id` (uuid, PK)
    - `entreprise_id` (uuid, FK → entreprise.id)
    - `action` (text): 'entree', 'sortie', or 'reset'
    - `delta` (integer): The change applied
    - `source` (text, DEFAULT 'app'): Origin — 'app', 'flic', or 'manuel'
    - `created_at` (timestamptz)
    - `created_by` (uuid): Auth user id

  ### 3. Functions
  - `increment_jauge(p_entreprise_id, p_delta, p_source, p_user_id)`: Upserts jauge_etat for today with GREATEST(0, current + delta), logs to jauge_actions
  - `reset_jauge(p_entreprise_id, p_user_id)`: Resets today's count to 0, logs a 'reset' action

  ### 4. Security
  - RLS enabled on both new tables
  - Authenticated users can read jauge_etat and jauge_actions
  - Authenticated users can insert/update jauge_etat
  - jauge_actions is insert-only (no update/delete) for authenticated users

  ### 5. Realtime
  - Realtime publication enabled on jauge_etat
*/

-- ─── 1. Alter entreprise ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprise' AND column_name = 'mode_jauge'
  ) THEN
    ALTER TABLE entreprise
      ADD COLUMN mode_jauge text NOT NULL DEFAULT 'sortie'
        CHECK (mode_jauge IN ('entree_sortie', 'sortie'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprise' AND column_name = 'effectif_public_maximum'
  ) THEN
    ALTER TABLE entreprise
      ADD COLUMN effectif_public_maximum integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ─── 2. Create jauge_etat ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jauge_etat (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id   uuid REFERENCES entreprise(id),
  count_actuel    integer NOT NULL DEFAULT 0 CHECK (count_actuel >= 0),
  date_soiree     date NOT NULL DEFAULT CURRENT_DATE,
  updated_at      timestamptz DEFAULT now(),
  updated_by      text,
  UNIQUE (entreprise_id, date_soiree)
);

ALTER TABLE jauge_etat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read jauge_etat"
  ON jauge_etat FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jauge_etat"
  ON jauge_etat FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jauge_etat"
  ON jauge_etat FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── 3. Create jauge_actions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jauge_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id   uuid REFERENCES entreprise(id),
  action          text NOT NULL CHECK (action IN ('entree', 'sortie', 'reset')),
  delta           integer NOT NULL,
  source          text DEFAULT 'app' CHECK (source IN ('app', 'flic', 'manuel')),
  created_at      timestamptz DEFAULT now(),
  created_by      uuid
);

ALTER TABLE jauge_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read jauge_actions"
  ON jauge_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jauge_actions"
  ON jauge_actions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── 4. Function: increment_jauge ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_jauge(
  p_entreprise_id uuid,
  p_delta         integer,
  p_source        text,
  p_user_id       uuid
) RETURNS void AS $$
DECLARE
  v_new integer;
BEGIN
  INSERT INTO jauge_etat (entreprise_id, count_actuel, date_soiree)
  VALUES (p_entreprise_id, GREATEST(0, p_delta), CURRENT_DATE)
  ON CONFLICT (entreprise_id, date_soiree)
  DO UPDATE SET
    count_actuel = GREATEST(0, jauge_etat.count_actuel + p_delta),
    updated_at   = now(),
    updated_by   = p_user_id::text
  RETURNING count_actuel INTO v_new;

  INSERT INTO jauge_actions (entreprise_id, action, delta, source, created_by)
  VALUES (
    p_entreprise_id,
    CASE WHEN p_delta > 0 THEN 'entree' ELSE 'sortie' END,
    p_delta,
    p_source,
    p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- ─── 5. Function: reset_jauge ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reset_jauge(
  p_entreprise_id uuid,
  p_user_id       uuid
) RETURNS void AS $$
BEGIN
  UPDATE jauge_etat
  SET count_actuel = 0,
      updated_at   = now()
  WHERE entreprise_id = p_entreprise_id
    AND date_soiree   = CURRENT_DATE;

  INSERT INTO jauge_actions (entreprise_id, action, delta, source, created_by)
  VALUES (p_entreprise_id, 'reset', 0, 'app', p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ─── 6. Enable Realtime on jauge_etat ──────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE jauge_etat;
