
-- get_my_entreprise_id() retournait managed_users.etablissement_id (qui est
-- entreprise.etablissement_id) au lieu de entreprise.id (PK).
-- La politique jauge_etat_isolation compare entreprise_id = get_my_entreprise_id()
-- donc les deux UUID ne correspondaient jamais → les utilisateurs Direction ne
-- pouvaient pas lire jauge_etat depuis l'app interne.
CREATE OR REPLACE FUNCTION get_my_entreprise_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM managed_users mu
  JOIN entreprise e ON e.etablissement_id = mu.etablissement_id
  WHERE mu.auth_user_id = auth.uid()
  LIMIT 1;
$$;
