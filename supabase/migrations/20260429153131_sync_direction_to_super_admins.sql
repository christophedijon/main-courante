/*
  # Synchroniser les utilisateurs Direction avec super_admins

  1. Changements
    - Insère tous les managed_users avec fonction='Direction' dans super_admins (si pas déjà présents)
    - Crée un trigger sur managed_users pour maintenir super_admins à jour automatiquement :
        - INSERT ou UPDATE vers 'Direction' → ajoute dans super_admins
        - UPDATE depuis 'Direction' vers autre chose → retire de super_admins
        - DELETE d'un Direction → retire de super_admins

  2. Notes
    - Utilise ON CONFLICT DO NOTHING pour les insertions idempotentes
    - Ne supprime pas les super_admins créés manuellement (non présents dans managed_users)
*/

-- Insérer les Direction existants qui ne sont pas encore super_admins
INSERT INTO super_admins (email)
SELECT mu.email
FROM managed_users mu
WHERE mu.fonction = 'Direction'
ON CONFLICT (email) DO NOTHING;

-- Fonction trigger
CREATE OR REPLACE FUNCTION sync_direction_to_super_admins()
RETURNS TRIGGER AS $$
BEGIN
  -- Cas INSERT : si la nouvelle fonction est Direction, on ajoute
  IF TG_OP = 'INSERT' THEN
    IF NEW.fonction = 'Direction' THEN
      INSERT INTO super_admins (email) VALUES (NEW.email) ON CONFLICT (email) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  -- Cas UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.fonction = 'Direction' AND OLD.fonction != 'Direction' THEN
      INSERT INTO super_admins (email) VALUES (NEW.email) ON CONFLICT (email) DO NOTHING;
    ELSIF OLD.fonction = 'Direction' AND NEW.fonction != 'Direction' THEN
      DELETE FROM super_admins WHERE email = OLD.email;
    END IF;
    RETURN NEW;
  END IF;

  -- Cas DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.fonction = 'Direction' THEN
      DELETE FROM super_admins WHERE email = OLD.email;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attacher le trigger
DROP TRIGGER IF EXISTS trg_sync_direction_to_super_admins ON managed_users;
CREATE TRIGGER trg_sync_direction_to_super_admins
  AFTER INSERT OR UPDATE OR DELETE ON managed_users
  FOR EACH ROW EXECUTE FUNCTION sync_direction_to_super_admins();
