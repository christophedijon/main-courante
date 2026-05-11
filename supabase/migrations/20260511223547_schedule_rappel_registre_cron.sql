/*
  # Cron job — Rappel registre de sécurité

  Déclenche la Edge Function rappel-registre tous les lundis à 9h00.
  Envoie un email récapitulatif aux Direction si des vérifications
  sont en retard ou à planifier dans les 90 jours.
*/

SELECT cron.schedule(
  'rappel-registre-lundi',
  '0 9 * * 1',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/rappel-registre',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
