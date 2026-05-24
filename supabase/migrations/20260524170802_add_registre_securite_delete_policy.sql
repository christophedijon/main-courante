/*
  # Add DELETE policy for registre_securite

  ## Problem
  No DELETE RLS policy existed on the registre_securite table, causing all
  delete operations to be silently blocked by Row Level Security.

  ## Change
  - Adds a DELETE policy allowing authenticated users to delete rows.
    This matches the existing INSERT/UPDATE policies which also use USING (true)
    and WITH CHECK (true) for authenticated users (admin-only app).
*/

CREATE POLICY "registre_delete"
  ON public.registre_securite
  FOR DELETE
  TO authenticated
  USING (true);
