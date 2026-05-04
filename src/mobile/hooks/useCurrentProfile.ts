import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export type CurrentProfile = {
  first_name: string;
  last_name: string;
  telephone: string;
  email: string;
  nationalite: string;
};

export function useCurrentProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<CurrentProfile>({
    first_name: '', last_name: '', telephone: '', email: session?.user.email ?? '', nationalite: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, telephone, nationalite')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile({
        first_name:  data?.first_name  ?? '',
        last_name:   data?.last_name   ?? '',
        telephone:   data?.telephone   ?? '',
        nationalite: data?.nationalite ?? '',
        email:       session.user.email ?? '',
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  return { profile, loading };
}
