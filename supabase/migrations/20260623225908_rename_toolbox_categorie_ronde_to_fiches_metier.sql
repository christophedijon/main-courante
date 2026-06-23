
-- 1. Supprimer l'ancienne contrainte CHECK
ALTER TABLE public.toolbox_documents
  DROP CONSTRAINT IF EXISTS toolbox_documents_categorie_check;

-- 2. Recréer la contrainte avec 'fiches_metier' à la place de 'RONDE'
ALTER TABLE public.toolbox_documents
  ADD CONSTRAINT toolbox_documents_categorie_check
  CHECK (categorie = ANY (ARRAY['fiches_metier'::text, 'SSI'::text, 'PROCEDURE'::text, 'RADIO'::text]));

-- 3. Migrer les données existantes
UPDATE public.toolbox_documents
  SET categorie = 'fiches_metier'
  WHERE categorie = 'RONDE';
