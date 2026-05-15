/*
  # Ajout du champ email_organisme dans registre_securite

  1. Modification
    - `registre_securite` : ajout de la colonne `email_organisme` (text, nullable)
      Permet de renseigner l'email de contact de l'organisme vérificateur pour chaque installation.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registre_securite' AND column_name = 'email_organisme'
  ) THEN
    ALTER TABLE registre_securite ADD COLUMN email_organisme text DEFAULT '' NOT NULL;
  END IF;
END $$;
