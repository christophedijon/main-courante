/*
  # Fix beacons RLS policies

  Adds permissive policies for authenticated users on the beacons table so that
  admins can insert, update, select, and delete beacons without hitting RLS
  permission errors. Previously only super_admins could write to this table via
  the super_admins email check, which caused 403s for direction/chef de poste roles.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'beacons' AND policyname = 'Authenticated users can select beacons'
  ) THEN
    CREATE POLICY "Authenticated users can select beacons"
      ON beacons FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'beacons' AND policyname = 'Authenticated users can insert beacons'
  ) THEN
    CREATE POLICY "Authenticated users can insert beacons"
      ON beacons FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'beacons' AND policyname = 'Authenticated users can update beacons'
  ) THEN
    CREATE POLICY "Authenticated users can update beacons"
      ON beacons FOR UPDATE
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'beacons' AND policyname = 'Authenticated users can delete beacons'
  ) THEN
    CREATE POLICY "Authenticated users can delete beacons"
      ON beacons FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
