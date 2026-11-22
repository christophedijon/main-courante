/*
# Activer Supabase Realtime sur alertes_bracelet

1. Modifications
- Ajoute la table `alertes_bracelet` à la publication `supabase_realtime`
  afin que les nouvelles lignes (INSERT) soient poussées en temps réel
  aux clients abonnés.
- Les politiques RLS existantes continuent de s'appliquer : un abonné ne
  reçoit que les alertes de son propre établissement.
- Idempotent : la table n'est ajoutée que si elle n'y figure pas déjà.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'alertes_bracelet'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alertes_bracelet;
  END IF;
END
$$;