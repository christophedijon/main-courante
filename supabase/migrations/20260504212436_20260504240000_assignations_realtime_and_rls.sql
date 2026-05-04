/*
  # Enable realtime on assignations and ensure correct RLS policies

  ## Changes
  - Add assignations table to supabase_realtime publication for live updates
  - The table already has the correct columns and RLS policies from previous migrations
    (using auth.email() instead of auth.users subquery)
  - Ensure all authenticated users can SELECT assignations (needed for mobile view)
*/

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.postes;
