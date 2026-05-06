/*
  # Add RLS policies for documents-médias storage bucket

  1. Security
    - SELECT: public access to read files from documents-médias
    - INSERT: authenticated users can upload files to documents-médias
    - DELETE: authenticated users can delete files from documents-médias
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'documents_medias_select'
  ) THEN
    CREATE POLICY "documents_medias_select"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'documents-médias');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'documents_medias_insert'
  ) THEN
    CREATE POLICY "documents_medias_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documents-médias');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'documents_medias_delete'
  ) THEN
    CREATE POLICY "documents_medias_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'documents-médias');
  END IF;
END $$;
