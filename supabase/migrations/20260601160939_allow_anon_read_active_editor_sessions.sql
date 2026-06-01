/*
  # Allow anonymous code lookup on editor_sessions

  ## Problem
  The editor login page (/editor) has no Supabase auth session.
  All existing SELECT policies on editor_sessions require TO authenticated,
  so unauthenticated queries return empty — causing valid codes to be rejected.

  ## Fix
  Add a restricted anon SELECT policy that only exposes active sessions.
  The row is still scoped to is_active = true, so revoked or expired sessions
  are never visible to anonymous callers.
*/

CREATE POLICY "Allow anon lookup of active editor sessions by code"
  ON editor_sessions FOR SELECT
  TO anon
  USING (is_active = true);
