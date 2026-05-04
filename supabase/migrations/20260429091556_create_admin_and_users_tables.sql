/*
  # Create admin back office schema

  ## Summary
  Sets up the data model for the super admin back office.

  ## New Tables

  ### `super_admins`
  - `id` (uuid, primary key) - unique identifier
  - `email` (text, unique) - login email
  - `created_at` (timestamptz) - account creation time

  ### `managed_users`
  - `id` (uuid, primary key) - unique identifier
  - `name` (text) - full name
  - `email` (text, unique) - user email
  - `role` (text) - user role (e.g. 'user', 'editor', 'manager')
  - `status` (text) - account status ('active', 'inactive', 'suspended')
  - `created_at` (timestamptz) - creation time

  ## Security
  - RLS enabled on both tables
  - `super_admins`: authenticated users can read their own row
  - `managed_users`: authenticated users (super admins) can read, insert, delete all managed users
    (access gated by presence in super_admins table)

  ## Notes
  1. Authentication is handled via Supabase Auth (auth.users)
  2. `super_admins` links to auth.users by matching the email
  3. Managed users are NOT Supabase auth users - they are records managed by the super admin
*/

-- Super admins table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Super admin can read their own record
CREATE POLICY "Super admin reads own record"
  ON super_admins FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT au.id FROM auth.users au WHERE au.email = super_admins.email
  ));

-- Managed users table
CREATE TABLE IF NOT EXISTS managed_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE managed_users ENABLE ROW LEVEL SECURITY;

-- Helper: check if the current auth user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins sa
    JOIN auth.users au ON au.email = sa.email
    WHERE au.id = auth.uid()
  );
$$;

CREATE POLICY "Super admins can read managed users"
  ON managed_users FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can insert managed users"
  ON managed_users FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete managed users"
  ON managed_users FOR DELETE
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can update managed users"
  ON managed_users FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
