import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE is the default in v2 — make it explicit so invite/recovery
    // token_hash params in the URL search are processed correctly.
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
  },
});

export type ManagedUser = {
  id: string;
  email: string;
  fonction: string;
  status: string;
  auth_user_id: string | null;
  created_at: string;
};
