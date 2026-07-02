/*
# Création table reminder_logs

## Objectif
Tracer tous les emails de relance et de bienvenue envoyés par établissement,
afin de garantir l'idempotence : un même type d'email ne peut être envoyé
qu'une seule fois par établissement.

## Nouvelle table : reminder_logs
- `id` — UUID, clé primaire auto-générée
- `etablissement_id` — UUID, FK vers etablissements(id), cascade sur suppression
- `reminder_type` — text, type de relance :
    'welcome'        → email bienvenue post-onboarding
    'testeur_j30'    → relance J+30 plan testeur
    'testeur_j60'    → relance J+60 plan testeur
    'light_j15'      → relance J+15 plan light
    'urgence_j20'    → relance urgence J+20
    'urgence_j5'     → relance urgence J+5
    'expired'        → notification fin d'essai
- `sent_at` — timestamptz, date/heure d'envoi (défaut NOW())
- `recipient_email` — text, adresse du destinataire

## Contrainte d'unicité
UNIQUE(etablissement_id, reminder_type) : garantit qu'un même type d'email
ne peut être logué qu'une seule fois par établissement. Toute tentative
d'envoi vérifie d'abord cette table.

## Sécurité
- RLS activé
- Une seule politique ALL pour service_role (les edge functions utilisent
  SUPABASE_SERVICE_ROLE_KEY et peuvent tout faire)
- Les clients authentifiés normaux ne peuvent pas lire/écrire cette table
*/

CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  reminder_type    text NOT NULL,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  recipient_email  text NOT NULL,
  UNIQUE(etablissement_id, reminder_type)
);

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_reminder_logs" ON public.reminder_logs;
CREATE POLICY "service_role_all_reminder_logs" ON public.reminder_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
