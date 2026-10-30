/*
# Suppression du déclencheur de replanification du cron rapport-soiree

1. Modification
- Suppression du déclencheur `trg_reschedule_rapport_cron` sur `rapport_email_settings`.

2. Non modifié
- La fonction `trg_fn_reschedule_rapport_cron` et `reschedule_rapport_cron` sont conservées.
- La table `rapport_email_settings` et ses données sont conservées.
- Les jobs cron existants (16, 22) ne sont pas touchés.

3. Retour arrière
- CREATE TRIGGER trg_reschedule_rapport_cron AFTER UPDATE OF heure_envoi ON public.rapport_email_settings FOR EACH ROW EXECUTE FUNCTION trg_fn_reschedule_rapport_cron();
*/

DROP TRIGGER IF EXISTS trg_reschedule_rapport_cron ON public.rapport_email_settings;