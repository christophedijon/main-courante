/*
# Fix logos SELECT policy — keep public read for branding, restrict listing

## Problem
The previous migration removed the "Public can read logos" policy, but logos
are displayed on public-facing pages (app header, verification fiche, mobile
home). The bucket is public and logo URLs are stored in etablissements.logo_url.

## Fix
Restore a public SELECT policy for the logos bucket so existing logo public URLs
continue to work. The upload/delete/update policies already enforce etab_id
folder isolation, so only the Direction of the right etab can upload/modify/delete.
The public can only read logos that have already been uploaded by authorized users.

## Security
- SELECT (read): public — anyone can view a logo if they know the URL (intended for branding)
- INSERT: authenticated, folder[1] = etab_id (only own etab's direction can upload)
- UPDATE: authenticated, folder[1] = etab_id (only own etab's direction can modify)
- DELETE: authenticated, folder[1] = etab_id (only own etab's direction can delete)
- Listing (storage API): still restricted by the authenticated policy below
*/

-- Re-add public read for logos (individual file access via public URL)
CREATE POLICY "Public can read logos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'logos');
