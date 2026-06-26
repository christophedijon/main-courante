
-- Supprimer l'ancien job cassé
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-billetterie-job') THEN
    PERFORM cron.unschedule('poll-billetterie-job');
  END IF;
END $$;

-- Recréer avec URL et token en dur
SELECT cron.schedule(
  'poll-billetterie-job',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://wliobldgrzjjchfknqju.supabase.co/functions/v1/poll-billetterie',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaW9ibGRncnpqamNoZmtucWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDYzODQsImV4cCI6MjA5MzAyMjM4NH0.5yT_REihgqmCQAnKSfsylcKHyvnsBxwFxy7rgGKwBEo'
    ),
    body    := '{}'::jsonb
  );
  $$
);
