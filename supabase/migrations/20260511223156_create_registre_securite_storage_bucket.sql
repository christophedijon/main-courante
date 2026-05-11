/*
  # Bucket Storage registre-securite

  Bucket public pour stocker les rapports PDF des vérifications du registre de sécurité.
  - Accès public en lecture (pour affichage des PDF sans authentification)
  - Upload réservé aux utilisateurs authentifiés
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('registre-securite', 'registre-securite', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "registre_securite_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'registre-securite');

CREATE POLICY "registre_securite_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'registre-securite');

CREATE POLICY "registre_securite_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'registre-securite');

CREATE POLICY "registre_securite_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'registre-securite');
