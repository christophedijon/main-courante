/*
  # Champ "Rappel" par ligne du registre de sécurité

  ## Résumé
  - Ajoute la colonne `jours_rappel` sur `registre_securite` :
    chaque installation peut définir son propre délai de rappel (en jours avant l'échéance)
  - Supprime la colonne `jours_avant_echeance` de `email_rules` :
    cette logique est désormais portée par chaque ligne du registre

  ## Changements

  ### Table `registre_securite`
  - Nouvelle colonne `jours_rappel INTEGER NULL` :
    nombre de jours avant l'échéance à partir duquel un email d'alerte est envoyé.
    NULL = pas d'alerte d'approche configurée pour cette installation.

  ### Table `email_rules`
  - Suppression de la colonne `jours_avant_echeance` : remplacée par `jours_rappel` sur chaque ligne
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registre_securite' AND column_name = 'jours_rappel'
  ) THEN
    ALTER TABLE registre_securite ADD COLUMN jours_rappel INTEGER NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_rules' AND column_name = 'jours_avant_echeance'
  ) THEN
    ALTER TABLE email_rules DROP COLUMN jours_avant_echeance;
  END IF;
END $$;
