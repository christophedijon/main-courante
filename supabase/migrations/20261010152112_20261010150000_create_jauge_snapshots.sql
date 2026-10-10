/*
# Create jauge_snapshots table + independent pg_cron + 12-month purge

## Purpose
The rapport-soiree edge function needs "Max en salle" and "Heure de pointe" statistics.
In automatic (Zapsis) mode, sync_jauge_zapsis updates jauge_etat but does NOT write
to jauge_actions, so the current report shows 0 for these cards.

This migration creates a lightweight snapshot table that captures the jauge_etat
state every 3 minutes during each establishment's opening hours. The snapshot
job is completely independent from sync_jauge_zapsis and can never make the
jauge fail — it only reads jauge_etat and inserts a copy.

## New Tables
- `jauge_snapshots`: one row per (etablissement, snapshot_at) with the current
  entrees_billetterie, sorties_boutons, count_actuel from jauge_etat.

## Security
- RLS enabled on jauge_snapshots.
- SELECT: Direction + SuperAdmin for their own etablissement only.
- INSERT/DELETE: service_role only (used by the cron job and purge).
- No anon access — this is internal reporting data.

## Cron
- `jauge-snapshots-cron`: every 3 minutes, calls a SECURITY DEFINER function
  `snapshot_jauge_etat()` that reads all jauge_etat rows for the current soirée
  and inserts snapshots for establishments currently within their opening hours.
- `jauge-snapshots-purge`: daily at 04:00 UTC, deletes snapshots older than 12 months.

## Important Notes
1. This does NOT modify sync_jauge_zapsis — the snapshot is taken independently.
2. The cron function is SECURITY DEFINER to allow the cron role to read jauge_etat
   and insert into jauge_snapshots without granting broad access.
3. Opening hours check: the function parses horaires_ouverture JSON and checks if
   current Paris time falls within today's opening window OR yesterday's crossing-
   midnight window (post-midnight leg).
4. If the function errors, it logs a warning and continues — it can never block
   the jauge or poll-billetterie.
*/

-- ============================================================
-- 1. Create jauge_snapshots table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jauge_snapshots (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid        NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  date_soiree      date        NOT NULL,
  snapshot_at      timestamptz NOT NULL DEFAULT now(),
  entrees_billetterie integer  NOT NULL DEFAULT 0,
  sorties_boutons  integer     NOT NULL DEFAULT 0,
  count_actuel     integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_jauge_snapshots_etab_date
  ON public.jauge_snapshots (etablissement_id, date_soiree, snapshot_at);
CREATE INDEX IF NOT EXISTS idx_jauge_snapshots_purge
  ON public.jauge_snapshots (snapshot_at);

-- ============================================================
-- 2. Enable RLS
-- ============================================================
ALTER TABLE public.jauge_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_jauge_snapshots" ON public.jauge_snapshots;
CREATE POLICY "select_own_jauge_snapshots"
  ON public.jauge_snapshots FOR SELECT
  TO authenticated
  USING (
    etablissement_id = public.get_user_etablissement_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "insert_jauge_snapshots_service_role" ON public.jauge_snapshots;
CREATE POLICY "insert_jauge_snapshots_service_role"
  ON public.jauge_snapshots FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_jauge_snapshots_service_role" ON public.jauge_snapshots;
CREATE POLICY "delete_jauge_snapshots_service_role"
  ON public.jauge_snapshots FOR DELETE
  TO service_role
  USING (true);

-- ============================================================
-- 3. SECURITY DEFINER function: snapshot_jauge_etat()
-- ============================================================
CREATE OR REPLACE FUNCTION public.snapshot_jauge_etat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now             timestamptz := now();
  v_paris_hour      int;
  v_paris_minute    int;
  v_paris_dow       int;
  v_paris_date      date;
  v_soiree          date;
  v_yesterday_dow   int;
  v_today_key       text;
  v_yesterday_key   text;
  v_row             RECORD;
  v_horaire         jsonb;
  v_ouvert          boolean;
  v_ouverture       text;
  v_fermeture       text;
  v_ouverture_min   int;
  v_fermeture_min   int;
  v_current_min     int;
  v_should_snapshot boolean;
BEGIN
  SELECT
    EXTRACT(hour FROM v_now AT TIME ZONE 'Europe/Paris')::int,
    EXTRACT(minute FROM v_now AT TIME ZONE 'Europe/Paris')::int,
    EXTRACT(dow FROM v_now AT TIME ZONE 'Europe/Paris')::int,
    (v_now AT TIME ZONE 'Europe/Paris')::date
  INTO v_paris_hour, v_paris_minute, v_paris_dow, v_paris_date;

  v_current_min := v_paris_hour * 60 + v_paris_minute;

  IF v_paris_hour >= 6 THEN
    v_soiree := v_paris_date;
  ELSE
    v_soiree := v_paris_date - 1;
  END IF;

  v_yesterday_dow := (v_paris_dow + 6) % 7;

  v_today_key := CASE v_paris_dow
    WHEN 0 THEN 'dimanche' WHEN 1 THEN 'lundi' WHEN 2 THEN 'mardi'
    WHEN 3 THEN 'mercredi' WHEN 4 THEN 'jeudi' WHEN 5 THEN 'vendredi'
    WHEN 6 THEN 'samedi' END;

  v_yesterday_key := CASE v_yesterday_dow
    WHEN 0 THEN 'dimanche' WHEN 1 THEN 'lundi' WHEN 2 THEN 'mardi'
    WHEN 3 THEN 'mercredi' WHEN 4 THEN 'jeudi' WHEN 5 THEN 'vendredi'
    WHEN 6 THEN 'samedi' END;

  FOR v_row IN
    SELECT je.etablissement_id, je.count_actuel, je.entrees_billetterie, je.sorties_boutons,
           e.horaires_ouverture
    FROM jauge_etat je
    JOIN etablissements e ON e.id = je.etablissement_id
    WHERE je.date_soiree = v_soiree
    AND je.is_test = false
    AND e.statut IN ('essai', 'actif')
  LOOP
    v_should_snapshot := false;

    -- Check today's schedule
    BEGIN
      v_horaire := v_row.horaires_ouverture -> v_today_key;
      IF v_horaire IS NOT NULL THEN
        v_ouvert := COALESCE((v_horaire ->> 'ouvert')::boolean, false);
        v_ouverture := v_horaire ->> 'ouverture';
        v_fermeture := v_horaire ->> 'fermeture';

        IF v_ouvert AND v_ouverture IS NOT NULL AND v_fermeture IS NOT NULL
           AND v_ouverture <> '' AND v_fermeture <> '' THEN
          v_ouverture_min := (split_part(v_ouverture, ':', 1)::int * 60) + split_part(v_ouverture, ':', 2)::int;
          v_fermeture_min := (split_part(v_fermeture, ':', 1)::int * 60) + split_part(v_fermeture, ':', 2)::int;

          IF v_fermeture_min > v_ouverture_min THEN
            IF v_current_min >= v_ouverture_min AND v_current_min < v_fermeture_min THEN
              v_should_snapshot := true;
            END IF;
          ELSE
            IF v_current_min >= v_ouverture_min THEN
              v_should_snapshot := true;
            END IF;
          END IF;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_should_snapshot := false;
    END;

    -- Check yesterday's schedule (post-midnight leg, only before 06:00)
    IF NOT v_should_snapshot AND v_paris_hour < 6 THEN
      BEGIN
        v_horaire := v_row.horaires_ouverture -> v_yesterday_key;
        IF v_horaire IS NOT NULL THEN
          v_ouvert := COALESCE((v_horaire ->> 'ouvert')::boolean, false);
          v_ouverture := v_horaire ->> 'ouverture';
          v_fermeture := v_horaire ->> 'fermeture';

          IF v_ouvert AND v_ouverture IS NOT NULL AND v_fermeture IS NOT NULL
             AND v_ouverture <> '' AND v_fermeture <> '' THEN
            v_fermeture_min := (split_part(v_fermeture, ':', 1)::int * 60) + split_part(v_fermeture, ':', 2)::int;
            v_ouverture_min := (split_part(v_ouverture, ':', 1)::int * 60) + split_part(v_ouverture, ':', 2)::int;

            IF v_fermeture_min < v_ouverture_min AND v_current_min < v_fermeture_min THEN
              v_should_snapshot := true;
            END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_should_snapshot := false;
      END;
    END IF;

    IF v_should_snapshot THEN
      BEGIN
        INSERT INTO jauge_snapshots (etablissement_id, date_soiree, snapshot_at,
                                      entrees_billetterie, sorties_boutons, count_actuel)
        VALUES (v_row.etablissement_id, v_soiree, v_now,
                COALESCE(v_row.entrees_billetterie, 0),
                COALESCE(v_row.sorties_boutons, 0),
                COALESCE(v_row.count_actuel, 0));
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'snapshot_jauge_etat: insert failed for etab %: %', v_row.etablissement_id, SQLERRM;
      END;
    END IF;
  END LOOP;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'snapshot_jauge_etat: top-level error: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_jauge_etat() TO service_role;

-- ============================================================
-- 4. Purge function
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_jauge_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM jauge_snapshots
  WHERE snapshot_at < now() - interval '12 months';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_jauge_snapshots() TO service_role;

-- ============================================================
-- 5. pg_cron jobs
-- ============================================================
SELECT cron.schedule(
  'jauge-snapshots-cron',
  '*/3 * * * *',
  $$SELECT public.snapshot_jauge_etat();$$
);

SELECT cron.schedule(
  'jauge-snapshots-purge',
  '0 4 * * *',
  $$SELECT public.purge_jauge_snapshots();$$
);
