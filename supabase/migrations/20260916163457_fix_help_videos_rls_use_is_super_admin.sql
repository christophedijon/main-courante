-- Fix help_videos RLS policies to use is_super_admin() (SECURITY DEFINER)
-- instead of a raw subquery that can fail due to RLS on super_admins.

DROP POLICY IF EXISTS "authenticated_read_help_videos" ON help_videos;
DROP POLICY IF EXISTS "super_admin_insert_help_videos" ON help_videos;
DROP POLICY IF EXISTS "super_admin_update_help_videos" ON help_videos;
DROP POLICY IF EXISTS "super_admin_delete_help_videos" ON help_videos;

-- SELECT: open to all authenticated users
CREATE POLICY "authenticated_read_help_videos"
  ON help_videos FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: SuperAdmin only
CREATE POLICY "super_admin_insert_help_videos"
  ON help_videos FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

-- UPDATE: SuperAdmin only
CREATE POLICY "super_admin_update_help_videos"
  ON help_videos FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- DELETE: SuperAdmin only
CREATE POLICY "super_admin_delete_help_videos"
  ON help_videos FOR DELETE
  TO authenticated
  USING (is_super_admin());
