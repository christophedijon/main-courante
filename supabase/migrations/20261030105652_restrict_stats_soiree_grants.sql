/*
# Retrait des droits par défaut sur les statistiques de soirée

1. Constat
- Les droits par défaut du projet accordent tous les privilèges à anon et authenticated sur les nouvelles tables.
- Les politiques RLS bloquent déjà l'accès, mais les droits doivent être minimaux et explicites.

2. Modifications (uniquement sur stats_soiree et stats_soiree_heures)
- anon : tous les droits retirés.
- authenticated : tous les droits retirés, puis lecture (SELECT) rétablie seule ; la lecture reste filtrée par la politique RLS de la Direction.
- service_role : inchangé (accès complet, requis pour le calcul).
*/

REVOKE ALL ON public.stats_soiree, public.stats_soiree_heures FROM anon;
REVOKE ALL ON public.stats_soiree, public.stats_soiree_heures FROM authenticated;
GRANT SELECT ON public.stats_soiree, public.stats_soiree_heures TO authenticated;
