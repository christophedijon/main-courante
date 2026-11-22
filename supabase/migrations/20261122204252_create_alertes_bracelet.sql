/*
# Table alertes_bracelet : alertes des bracelets anti-vol

1. Nouvelle table
- `alertes_bracelet`
- `id` (uuid, clé primaire, généré automatiquement)
- `created_at` (horodatage, rempli automatiquement)
- `bracelet_id` (texte, identifiant du bracelet)
- `code` (texte, code de l'alerte)
- `batterie` (entier, niveau de batterie)
- `rssi` (entier, qualité du signal)
- `passerelle` (texte, passerelle émettrice)
- `statut` (texte, défaut « nouvelle »)
- `etablissement_id` (uuid, OBLIGATOIRE, clé étrangère vers `etablissements.id`,
  suppression en cascade si l'établissement est supprimé)

2. Sécurité
- RLS activée.
- anon : INSERT uniquement (borne/relais qui pousse une alerte sans session).
- authenticated : SELECT / UPDATE / DELETE sur les alertes de son propre établissement
  (même logique que les autres tables : via get_user_etablissement_id() et is_super_admin()).
- Droits accordés au minimum : INSERT pour anon, SELECT/UPDATE/DELETE pour authenticated.
  Aucun droit pour service_role sur cette table (aucune fonction serveur ne l'utilise).
*/

CREATE TABLE IF NOT EXISTS public.alertes_bracelet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  bracelet_id text,
  code text,
  batterie integer,
  rssi integer,
  passerelle text,
  statut text NOT NULL DEFAULT 'nouvelle',
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS alertes_bracelet_etablissement_created_idx
  ON public.alertes_bracelet (etablissement_id, created_at DESC);

ALTER TABLE public.alertes_bracelet ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.alertes_bracelet TO anon;
GRANT SELECT, UPDATE, DELETE ON public.alertes_bracelet TO authenticated;

DROP POLICY IF EXISTS "anon_insert_alertes_bracelet" ON public.alertes_bracelet;
CREATE POLICY "anon_insert_alertes_bracelet"
ON public.alertes_bracelet FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_own_etab_alertes_bracelet" ON public.alertes_bracelet;
CREATE POLICY "authenticated_select_own_etab_alertes_bracelet"
ON public.alertes_bracelet FOR SELECT
TO authenticated
USING (etablissement_id = get_user_etablissement_id() OR is_super_admin());

DROP POLICY IF EXISTS "authenticated_update_own_etab_alertes_bracelet" ON public.alertes_bracelet;
CREATE POLICY "authenticated_update_own_etab_alertes_bracelet"
ON public.alertes_bracelet FOR UPDATE
TO authenticated
USING (etablissement_id = get_user_etablissement_id() OR is_super_admin())
WITH CHECK (etablissement_id = get_user_etablissement_id() OR is_super_admin());

DROP POLICY IF EXISTS "authenticated_delete_own_etab_alertes_bracelet" ON public.alertes_bracelet;
CREATE POLICY "authenticated_delete_own_etab_alertes_bracelet"
ON public.alertes_bracelet FOR DELETE
TO authenticated
USING (etablissement_id = get_user_etablissement_id() OR is_super_admin());