/*
  # Ajout contrainte unique sur titre dans toolbox_documents

  Nécessaire pour permettre le upsert onConflict: 'titre'
  lors de la synchronisation du document "Mes obligations réglementaires".
*/

ALTER TABLE public.toolbox_documents
  ADD CONSTRAINT toolbox_documents_titre_unique UNIQUE (titre);
