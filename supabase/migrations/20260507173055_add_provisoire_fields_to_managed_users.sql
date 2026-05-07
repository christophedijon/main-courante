/*
  # Ajout des champs de compte provisoire dans managed_users

  ## Modifications
  - `managed_users` : ajout de 5 colonnes pour le système d'invitation
    - `is_provisoire` (boolean) : indique si le compte est provisoire
    - `provisoire_expires_at` (timestamptz) : expiration du compte provisoire (48h)
    - `profile_completed` (boolean) : indique si le profil a été complété à la première connexion
    - `invited_by` (uuid) : référence à l'utilisateur ayant créé l'invitation
    - `invited_at` (timestamptz) : date de l'invitation

  ## Notes
  - Les comptes provisoires non connectés dans les 48h sont supprimés automatiquement
  - La valeur par défaut de `profile_completed` est false uniquement pour les nouveaux comptes
    provisoires ; les utilisateurs existants ont true via une mise à jour conditionnelle
*/

ALTER TABLE public.managed_users
  ADD COLUMN IF NOT EXISTS is_provisoire boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS provisoire_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

-- Les comptes existants ont déjà leur profil complété
UPDATE public.managed_users
  SET profile_completed = true
  WHERE profile_completed IS NULL OR profile_completed = false AND is_provisoire = false;
