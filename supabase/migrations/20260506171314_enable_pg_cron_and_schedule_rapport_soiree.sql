/*
  # Activation pg_cron + pg_net et planification du rapport de soirée

  ## Objectif
  Déclencher automatiquement la génération du rapport de soirée chaque jour à 8h00 UTC
  en appelant la Edge Function `rapport-soiree` via pg_cron + pg_net.

  ## Actions
  1. Active l'extension pg_cron (planification de tâches)
  2. Active l'extension pg_net (requêtes HTTP depuis PostgreSQL)
  3. Crée un cron job `rapport-soiree-8h` qui s'exécute tous les jours à 8h00 UTC
     et appelle la Edge Function via HTTP POST

  ## Notes
  - Le cron tourne en UTC : 8h00 UTC = heure choisie pour couvrir 7h00 locale + marge
  - Le job est idempotent : si le rapport existe déjà pour la date, la fonction ne fait rien
  - Les credentials sont lus depuis les paramètres de configuration Supabase
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Supprimer le job s'il existe déjà (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rapport-soiree-8h') THEN
    PERFORM cron.unschedule('rapport-soiree-8h');
  END IF;
END $$;

SELECT cron.schedule(
  'rapport-soiree-8h',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/rapport-soiree',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{}'::jsonb
    );
  $$
);
