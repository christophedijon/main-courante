/*
# Create help_videos table

1. New Tables
- `help_videos`
  - `id` (uuid, primary key)
  - `page_key` (text, unique, not null) — identifier of the page/section (e.g. "toolbox", "postes")
  - `video_id` (text, not null) — the Loom video identifier
  - `titre` (text, nullable) — optional admin-facing title for reference
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Security
- Enable RLS on `help_videos`.
- SELECT: open to all authenticated users (any signed-in user can see which help videos exist).
- INSERT/UPDATE/DELETE: restricted to SuperAdmins (users whose email is in the `super_admins` table).

3. Seed Data
- Inserts the existing toolbox entry: page_key="toolbox", video_id="7baa2bdc5f5c4bb0964f5595e79177c4".
*/

CREATE TABLE IF NOT EXISTS help_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text UNIQUE NOT NULL,
  video_id text NOT NULL,
  titre text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE help_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_help_videos" ON help_videos;
CREATE POLICY "authenticated_read_help_videos"
  ON help_videos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "super_admin_insert_help_videos" ON help_videos;
CREATE POLICY "super_admin_insert_help_videos"
  ON help_videos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "super_admin_update_help_videos" ON help_videos;
CREATE POLICY "super_admin_update_help_videos"
  ON help_videos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "super_admin_delete_help_videos" ON help_videos;
CREATE POLICY "super_admin_delete_help_videos"
  ON help_videos FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins sa WHERE sa.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Seed existing entry
INSERT INTO help_videos (page_key, video_id, titre)
VALUES ('toolbox', '7baa2bdc5f5c4bb0964f5595e79177c4', 'Aide vidéo Boîte à outils')
ON CONFLICT (page_key) DO UPDATE SET video_id = EXCLUDED.video_id, updated_at = now();
