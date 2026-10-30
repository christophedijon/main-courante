/*
# Journal d'envoi des rapports de soirée et second déclenchement à 07:00 UTC

## 1. Nouvelle table
- `rapport_envois` : une ligne par tentative d'envoi à un destinataire.
  - `rapport_id` (lien optionnel vers `rapports_soiree`, vide pour les envois de test)
  - `etablissement_id`, `date_soiree`, `destinataire`
  - `resend_id` (identifiant renvoyé par Resend), `statut` ('envoye' ou 'erreur')
  - `http_status`, `erreur`, `test` (true pour les envois de test), `created_at`

## 2. Sécurité
- RLS activé.
- Lecture uniquement pour les membres Direction de l'établissement concerné et le SuperAdmin.
- Aucune politique d'écriture pour les utilisateurs : seule la fonction serveur (service_role) écrit dans le journal.

## 3. Planification
- Ajout d'une seconde entrée de cron `rapport-soiree-07utc` à 07:00 UTC, qui appelle la même fonction `rapport-soiree` avec la clé de service stockée dans le coffre.
- L'entrée existante `rapport-soiree` (06:00 UTC) n'est pas modifiée.
- La fonction ne génère le rapport qu'à partir de 08:00 heure de Paris : le passage de 06:00 UTC est donc sans effet l'hiver, celui de 07:00 UTC fait le travail.

## 4. Notes importantes
- Aucune donnée existante n'est modifiée ni supprimée.
- Le délai de réponse de la requête HTTP du cron est fixé à 60 secondes, pour laisser à la fonction le temps d'envoyer tous les emails.
*/

CREATE TABLE IF NOT EXISTS public.rapport_envois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapport_id uuid REFERENCES public.rapports_soiree(id) ON DELETE SET NULL,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  date_soiree date NOT NULL,
  destinataire text NOT NULL,
  resend_id text,
  statut text NOT NULL CHECK (statut IN ('envoye', 'erreur')),
  http_status integer,
  erreur text,
  test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rapport_envois_etab_date
  ON public.rapport_envois (etablissement_id, date_soiree);

ALTER TABLE public.rapport_envois ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.rapport_envois TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapport_envois TO service_role;

DROP POLICY IF EXISTS "rapport_envois_select_direction_or_super_admin" ON public.rapport_envois;
CREATE POLICY "rapport_envois_select_direction_or_super_admin"
  ON public.rapport_envois FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR public.is_direction_of_etab(etablissement_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rapport-soiree-07utc') THEN
    PERFORM cron.unschedule('rapport-soiree-07utc');
  END IF;
END $$;

SELECT cron.schedule(
  'rapport-soiree-07utc',
  '0 7 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://wliobldgrzjjchfknqju.supabase.co/functions/v1/rapport-soiree',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$
);
