import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type UnsignedDoc = {
  id: string;
  categorie: string;
};

export default function UnsignedDocsBanner() {
  const { session, userFonction, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [count, setCount] = useState(0);
  const [unsignedDocs, setUnsignedDocs] = useState<UnsignedDoc[]>([]);

  useEffect(() => {
    if (!session?.user || !userFonction || isSuperAdmin) {
      setShow(false);
      return;
    }

    (async () => {
      const { data: docs } = await supabase
        .from('toolbox_documents')
        .select('id, destinataires, content_version, categorie')
        .eq('actif', true)
        .eq('signature_requise', true);

      if (!docs || docs.length === 0) {
        setCount(0);
        setUnsignedDocs([]);
        setShow(false);
        return;
      }

      const relevant = docs.filter(
        (d: { destinataires: string[] | null; id: string; content_version: number; categorie: string }) =>
          !d.destinataires || d.destinataires.length === 0 || d.destinataires.includes(userFonction)
      );

      if (relevant.length === 0) {
        setCount(0);
        setUnsignedDocs([]);
        setShow(false);
        return;
      }

      const { data: sigs } = await supabase
        .from('signatures')
        .select('document_id, content_version')
        .eq('agent_id', session.user.id);

      const signedSet = new Set(
        (sigs ?? []).map((s: { document_id: string; content_version: number }) =>
          `${s.document_id}:${s.content_version}`
        )
      );

      const unsigned = relevant.filter(
        (d: { id: string; content_version: number; categorie: string }) =>
          !signedSet.has(`${d.id}:${d.content_version}`)
      );

      const unsignedList: UnsignedDoc[] = unsigned.map(
        (d: { id: string; categorie: string }) => ({ id: d.id, categorie: d.categorie })
      );

      setUnsignedDocs(unsignedList);
      setCount(unsignedList.length);
      setShow(unsignedList.length > 0);
    })();
  }, [session?.user?.id, userFonction, isSuperAdmin]);

  if (!show || count === 0) return null;

  function handleViewDocs() {
    setShow(false);
    if (unsignedDocs.length === 1) {
      const doc = unsignedDocs[0];
      navigate(`/mobile/outils/documents/${doc.categorie}/${doc.id}`);
    } else {
      navigate('/mobile/outils/documents/a_signer');
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShow(false)} />
      <div className="relative bg-red-950 border-2 border-red-500/50 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto">
            <FileWarning className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Documents à signer</h3>
            <p className="text-red-200/80 text-sm mt-1">
              Vous avez {count} document{count > 1 ? 's' : ''} non signé{count > 1 ? 's' : ''}.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={handleViewDocs}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
            >
              {unsignedDocs.length === 1 ? 'Voir le document' : 'Voir mes documents'}
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
