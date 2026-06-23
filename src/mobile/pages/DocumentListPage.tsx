import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Flame, FileText, Radio, ChevronRight, FileX, PenLine } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Categorie = 'fiches_metier' | 'SSI' | 'PROCEDURE' | 'RADIO';

type Doc = {
  id: string;
  titre: string;
  description: string;
  ordre: number;
  destinataires: string[];
  signature_requise: boolean;
};

const META: Record<Categorie, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconBg: string;
}> = {
  fiches_metier: { label: 'Fiches métier', icon: Shield,   accent: 'text-blue-400', iconBg: 'bg-blue-500/15 border-blue-500/30' },
  SSI:           { label: 'Consignes SSI', icon: Flame,    accent: 'text-red-400',  iconBg: 'bg-red-500/15 border-red-500/30' },
  PROCEDURE:     { label: 'Info & Doc',    icon: FileText, accent: 'text-slate-300',iconBg: 'bg-slate-600/25 border-slate-500/30' },
  RADIO:         { label: 'Radio',         icon: Radio,    accent: 'text-teal-400', iconBg: 'bg-teal-500/15 border-teal-500/30' },
};

export default function DocumentListPage() {
  const { categorie } = useParams<{ categorie: string }>();
  const navigate = useNavigate();
  const { userFonction } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cat = (categorie ?? '') as Categorie;
  const meta = META[cat];

  useEffect(() => {
    if (!cat || !meta) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error: queryError } = await supabase
        .from('toolbox_documents')
        .select('id, titre, description, ordre, destinataires, signature_requise')
        .eq('categorie', cat)
        .eq('actif', true)
        .order('ordre', { ascending: true });

      if (queryError) {
        console.error('[DocumentListPage] Supabase error:', queryError);
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const all = (data ?? []) as Doc[];
      const visible = all.filter((doc) =>
        !doc.destinataires || doc.destinataires.length === 0 || (userFonction && doc.destinataires.includes(userFonction))
      );
      setDocs(visible);
      setLoading(false);
    })();
  }, [cat, userFonction]);

  if (!meta) {
    return (
      <div className="px-5 py-10 text-center text-slate-400 text-sm">
        Catégorie inconnue.
      </div>
    );
  }

  const Icon = meta.icon;

  return (
    <div className="pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/mobile/outils')}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${meta.iconBg}`}>
          <Icon className={`w-4 h-4 ${meta.accent}`} strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px]">{meta.label}</p>
          {!loading && (
            <p className="text-slate-500 text-xs">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Chargement…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-900/20 border border-red-500/20 flex items-center justify-center">
              <FileX className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-slate-300 font-semibold">Erreur de chargement</p>
            <p className="text-slate-500 text-sm px-4">{error}</p>
          </div>
        )}

        {!loading && docs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <FileX className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-300 font-semibold">Aucun document disponible</p>
            <p className="text-slate-500 text-sm">Cette section n'a pas encore de contenu.</p>
          </div>
        )}

        {!loading && docs.length > 0 && (
          <div className="space-y-2.5">
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => navigate(`/mobile/outils/documents/${cat}/${doc.id}`)}
                className="w-full text-left rounded-2xl bg-slate-900 border border-slate-800 active:border-slate-700 active:scale-[0.99] p-4 flex items-center gap-3 transition-all"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                  <Icon className={`w-4 h-4 ${meta.accent}`} strokeWidth={2.3} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold text-[14px] leading-tight">{doc.titre}</p>
                    {doc.signature_requise && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold shrink-0">
                        <PenLine className="w-2.5 h-2.5" />
                        Signature
                      </span>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-slate-500 text-[12px] mt-0.5 truncate">{doc.description}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
