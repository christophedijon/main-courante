/*
  # Découpler niveaux_intervention des motifs

  Les graduations deviennent un référentiel indépendant — elles ne sont plus
  liées à un motif spécifique. La colonne motif_id et la FK associée sont
  retirées. Un label et une description suffisent pour définir chaque niveau.

  ## Modifications
  - Suppression de la colonne `motif_id` sur `niveaux_intervention`
  - La table `niveaux_intervention` devient un référentiel autonome de niveaux de gravité
*/

DO $$
BEGIN
  -- Drop FK constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'niveaux_intervention'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE niveaux_intervention
      DROP CONSTRAINT IF EXISTS niveaux_intervention_motif_id_fkey;
  END IF;

  -- Drop motif_id column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'niveaux_intervention' AND column_name = 'motif_id'
  ) THEN
    ALTER TABLE niveaux_intervention DROP COLUMN motif_id;
  END IF;
END $$;

DROP INDEX IF EXISTS niveaux_intervention_motif_id_idx;
