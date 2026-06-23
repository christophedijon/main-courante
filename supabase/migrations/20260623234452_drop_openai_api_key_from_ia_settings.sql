-- Remove openai_api_key from ia_settings — key will live in Supabase Secrets only
ALTER TABLE ia_settings DROP COLUMN IF EXISTS openai_api_key;
