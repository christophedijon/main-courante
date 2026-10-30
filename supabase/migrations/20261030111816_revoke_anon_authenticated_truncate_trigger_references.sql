/*
# Retrait des droits TRUNCATE, TRIGGER et REFERENCES pour anon et authenticated

1. Changements
- Sur chaque table du schéma public : retrait de TRUNCATE, TRIGGER et REFERENCES pour les rôles anon et authenticated.
- Aucun autre droit n'est retiré. SELECT, INSERT, UPDATE et DELETE restent accordés comme avant.
- Sur la table app_secrets (clés techniques : URL et clé anon), retrait de tous les droits pour anon et authenticated. Seules les fonctions SECURITY DEFINER appartenant au propriétaire de la base y accèdent, et aucun code client ni fonction exécutable par anon/authenticated ne la lit.

2. Données et fonctionnement
- Aucune ligne n'est modifiée ni supprimée.
- Aucune politique RLS n'est changée.
- service_role et postgres conservent tous leurs droits.
- Aucun code de l'application n'utilise TRUNCATE, TRIGGER ou REFERENCES.

3. Sécurité
- TRUNCATE n'est pas soumis au RLS : sans ce retrait, anon et authenticated pouvaient vider entièrement une table.
*/

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.app_secrets FROM anon, authenticated;
