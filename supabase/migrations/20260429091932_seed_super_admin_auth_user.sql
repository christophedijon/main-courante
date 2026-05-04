/*
  # Seed super admin auth user

  Creates the default super admin account in Supabase Auth so the back office
  can be accessed immediately.

  Credentials:
    - Email:    superadmin@backoffice.com
    - Password: Admin@2024!

  The user is also added to the `super_admins` table (if not already present)
  so the `is_super_admin()` RLS check passes.
*/

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Only create if the user does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'superadmin@backoffice.com'
  ) THEN
    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      role,
      aud,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'superadmin@backoffice.com',
      crypt('Admin@2024!', gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      new_user_id,
      'superadmin@backoffice.com',
      jsonb_build_object('sub', new_user_id::text, 'email', 'superadmin@backoffice.com'),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  -- Ensure super_admins record exists
  INSERT INTO super_admins (email)
  VALUES ('superadmin@backoffice.com')
  ON CONFLICT (email) DO NOTHING;
END $$;
