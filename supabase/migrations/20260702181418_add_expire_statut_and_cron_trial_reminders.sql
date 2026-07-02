-- Extend statut CHECK to include 'expire'
ALTER TABLE public.etablissements
  DROP CONSTRAINT IF EXISTS etablissements_statut_check;

ALTER TABLE public.etablissements
  ADD CONSTRAINT etablissements_statut_check
  CHECK (statut = ANY (ARRAY[
    'brouillon'::text,
    'essai'::text,
    'actif'::text,
    'suspendu'::text,
    'resilie'::text,
    'expire'::text
  ]));

-- pg_cron: daily at 10h for check-trial-reminders
SELECT cron.schedule(
  'check-trial-reminders',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/check-trial-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
