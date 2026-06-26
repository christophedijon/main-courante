-- Detach the platform mega-admin from any specific company.
-- A mega-admin has no etablissement_id; Direction users keep theirs.

UPDATE managed_users
SET etablissement_id = NULL,
    is_super_admin    = true
WHERE email = 'christophelemesnil@gmail.com';

UPDATE super_admins
SET etablissement_id = NULL
WHERE email = 'christophelemesnil@gmail.com';
