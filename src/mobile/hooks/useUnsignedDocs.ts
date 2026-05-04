import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function useUnsignedDocs() {
  const { session, userFonction } = useAuth();
  const [unsignedCount, setUnsignedCount] = useState(0);

  async function refresh() {
    if (!session?.user || !userFonction) {
      setUnsignedCount(0);
      return;
    }

    const { data: docs } = await supabase
      .from('toolbox_documents')
      .select('id, destinataires, content_version')
      .eq('actif', true)
      .eq('signature_requise', true);

    if (!docs || docs.length === 0) {
      setUnsignedCount(0);
      return;
    }

    const relevant = docs.filter((d: { destinataires: string[] }) =>
      !d.destinataires || d.destinataires.length === 0 || d.destinataires.includes(userFonction)
    );

    if (relevant.length === 0) {
      setUnsignedCount(0);
      return;
    }

    const { data: sigs } = await supabase
      .from('signatures')
      .select('document_id, content_version')
      .eq('agent_id', session.user.id);

    const signedSet = new Set(
      (sigs ?? []).map((s: { document_id: string; content_version: number }) => `${s.document_id}:${s.content_version}`)
    );

    const unsigned = relevant.filter(
      (d: { id: string; content_version: number }) => !signedSet.has(`${d.id}:${d.content_version}`)
    );

    setUnsignedCount(unsigned.length);
  }

  useEffect(() => {
    refresh();
  }, [session?.user?.id, userFonction]);

  useEffect(() => {
    if (!session?.user) return;
    const channel = supabase
      .channel('unsigned-docs-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signatures' }, () => {
        refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  return { unsignedCount, refresh };
}
