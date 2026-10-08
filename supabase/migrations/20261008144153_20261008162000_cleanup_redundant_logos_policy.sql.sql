/*
# Clean up redundant logos SELECT policy

## What
Drop "Users can read own etab logos" — redundant now that "Public can read logos"
covers all reads (logos are public branding, like avatars).

## Security
Logos are inherently public — they appear on the app header, verification fiche,
and mobile pages. Write isolation (INSERT/UPDATE/DELETE) still enforces etab_id
folder matching, so only the Direction of the correct etab can upload/modify/delete
logos. Anyone can view a logo if they know the URL, which is the same model as
any public CDN asset (avatar, brand image).
*/

DROP POLICY IF EXISTS "Users can read own etab logos" ON storage.objects;
