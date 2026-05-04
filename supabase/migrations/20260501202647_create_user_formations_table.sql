/*
  # Create user_formations table

  1. New Tables
    - `user_formations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK -> auth.users.id)
      - `type_formation` (text) — ex: 'Extincteur', 'SST', etc.
      - `date_formation` (date) — peut être passée
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Users can read/insert/update/delete their own rows
    - Admins / Direction can view all rows
*/

CREATE TABLE IF NOT EXISTS user_formations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_formation text NOT NULL DEFAULT '',
  date_formation date NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_formations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own formations"
  ON user_formations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own formations"
  ON user_formations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own formations"
  ON user_formations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own formations"
  ON user_formations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_formations_user_id ON user_formations(user_id);
