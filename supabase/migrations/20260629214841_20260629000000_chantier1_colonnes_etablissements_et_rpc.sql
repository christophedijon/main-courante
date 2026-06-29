
-- ════════════════════════════════════════════════════════════
-- PARTIE 1 — Ajouter les 26 colonnes manquantes à etablissements
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.etablissements
  ADD COLUMN IF NOT EXISTS type_erp text DEFAULT 'P',
  ADD COLUMN IF NOT EXISTS categorie_erp integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS effectif_public integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effectif_personnel integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effectif_public_maximum integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activite_principale text DEFAULT 'P',
  ADD COLUMN IF NOT EXISTS activites_complementaires jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activites_reelles text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS licence_boissons text DEFAULT '',
  ADD COLUMN IF NOT EXISTS questionnaire_reponses jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS derniere_visite_commission date,
  ADD COLUMN IF NOT EXISTS document_obligations_html text DEFAULT '',
  ADD COLUMN IF NOT EXISTS document_obligations_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS siret text DEFAULT '',
  ADD COLUMN IF NOT EXISTS code_ape text DEFAULT '',
  ADD COLUMN IF NOT EXISTS horaires_ouverture jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ronde_mode text DEFAULT 'aleatoire',
  ADD COLUMN IF NOT EXISTS mode_jauge text NOT NULL DEFAULT 'sortie',
  ADD COLUMN IF NOT EXISTS enseigne text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS url_billetterie text DEFAULT '',
  ADD COLUMN IF NOT EXISTS frequence_billetterie integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS force_session_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_session_type text,
  ADD COLUMN IF NOT EXISTS force_session_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS force_session_expires_at timestamptz;

-- ════════════════════════════════════════════════════════════
-- PARTIE 2 — Copier les données depuis entreprise
-- ════════════════════════════════════════════════════════════

UPDATE public.etablissements et
SET
  type_erp                        = ent.type_erp,
  categorie_erp                   = ent.categorie_erp,
  effectif_public                 = ent.effectif_public,
  effectif_personnel              = ent.effectif_personnel,
  effectif_public_maximum         = ent.effectif_public_maximum,
  activite_principale             = ent.activite_principale,
  activites_complementaires       = ent.activites_complementaires,
  activites_reelles               = ent.activites_reelles,
  licence_boissons                = ent.licence_boissons,
  questionnaire_reponses          = ent.questionnaire_reponses,
  derniere_visite_commission      = ent.derniere_visite_commission,
  document_obligations_html       = ent.document_obligations_html,
  document_obligations_updated_at = ent.document_obligations_updated_at,
  siret                           = ent.siret,
  code_ape                        = ent.code_ape,
  horaires_ouverture              = ent.horaires_ouverture,
  ronde_mode                      = ent.ronde_mode,
  mode_jauge                      = ent.mode_jauge,
  enseigne                        = ent.enseigne,
  email                           = ent.email,
  url_billetterie                 = ent.url_billetterie,
  frequence_billetterie           = ent.frequence_billetterie,
  force_session_active            = ent.force_session_active,
  force_session_type              = ent.force_session_type,
  force_session_opened_at         = ent.force_session_opened_at,
  force_session_expires_at        = ent.force_session_expires_at
FROM public.entreprise ent
WHERE ent.etablissement_id = et.id;

-- ════════════════════════════════════════════════════════════
-- PARTIE 3 — Réécrire get_my_entreprise_id en alias propre
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_entreprise_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_user_etablissement_id();
$function$;
