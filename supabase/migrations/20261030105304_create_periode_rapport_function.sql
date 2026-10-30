/*
# Fonction de période des rapports et statistiques

1. Nouvelle fonction
- `periode_rapport(p_date)` renvoie le début (08:00 heure de Paris le jour p_date) et la fin exclue (08:00 heure de Paris le lendemain).
- Le passage à l'heure d'hiver (25/10/2026) est géré par le fuseau horaire Europe/Paris : la période du 24/10 dure 25 heures, celle du 25/10 dure 24 heures.

2. Modifications
- Aucune table ni donnée existante n'est modifiée.

3. Sécurité
- Fonction stable, sans accès aux données.
- EXECUTE retiré à PUBLIC, anon et authenticated ; accordé à service_role uniquement.
*/

CREATE OR REPLACE FUNCTION public.periode_rapport(p_date date)
RETURNS TABLE (debut timestamptz, fin timestamptz)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    (p_date + time '08:00') AT TIME ZONE 'Europe/Paris',
    (p_date + 1 + time '08:00') AT TIME ZONE 'Europe/Paris';
$$;

REVOKE EXECUTE ON FUNCTION public.periode_rapport(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.periode_rapport(date) TO service_role;
