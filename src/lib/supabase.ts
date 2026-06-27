import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// detectSessionInUrl: true lets Supabase JS process #access_token=... fragments
// that the /auth/v1/verify endpoint always emits (implicit-style token in hash).
// Do NOT set flowType: 'pkce' — it breaks implicit hash token detection.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
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
