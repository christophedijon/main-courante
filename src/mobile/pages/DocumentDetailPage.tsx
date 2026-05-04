import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Flame, FileText, Radio, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Categorie = 'RONDE' | 'SSI' | 'PROCEDURE' | 'RADIO';

type Doc = {
  id: string;
  titre: string;
  description: string;
  contenu: string;
  categorie: Categorie;
};

const META: Record<Categorie, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconBg: string;
}> = {
  RONDE:     { label: 'Ronde',         icon: Shield,   accent: 'text-blue-400',  iconBg: 'bg-blue-500/15 border-blue-500/30' },
  SSI:       { label: 'Consignes SSI', icon: Flame,    accent: 'text-red-400',   iconBg: 'bg-red-500/15 border-red-500/30' },
  PROCEDURE: { label: 'Procédure',     icon: FileText, accent: 'text-slate-300', iconBg: 'bg-slate-600/25 border-slate-500/30' },
  RADIO:     { label: 'Radio',         icon: Radio,    accent: 'text-teal-400',  iconBg: 'bg-teal-500/15 border-teal-500/30' },
};

export default function DocumentDetailPage() {
  const { categorie, id } = useParams<{ categorie: string; id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);

  const cat = (categorie?.toUpperCase() ?? '') as Categorie;
  const meta = META[cat];

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('toolbox_documents')
        .select('id, titre, description, contenu, categorie')
        .eq('id', id)
        .eq('actif', true)
        .maybeSingle();
      setDoc(data as Doc | null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Chargement…</span>
      </div>
    );
  }

  if (!doc || !meta) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-slate-400 text-sm mb-4">Document introuvable.</p>
        <button
          onClick={() => navigate(-1)}
          className="text-blue-400 text-sm font-semibold"
        >
          Retour
        </button>
      </div>
    );
  }

  const Icon = meta.icon;

  // Extract PDF links from HTML content
  function extractPdfLinks(html: string): { href: string; label: string }[] {
    const matches = [...html.matchAll(/<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>([^<]*)<\/a>/gi)];
    return matches.map((m) => ({ href: m[1], label: m[2].replace(/📎\s*/g, '').trim() || 'Ouvrir le document' }));
  }

  const pdfLinks = extractPdfLinks(doc.contenu);

  // Strip PDF anchor tags from content (they'll be shown as buttons below)
  const cleanedContent = doc.contenu.replace(/<p><a[^>]+href="[^"]+\.pdf[^"]*"[^>]*>[^<]*<\/a><\/p>/gi, '');

  return (
    <div className="pb-12">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(`/mobile/outils/documents/${cat}`)}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconBg}`}>
          <Icon className={`w-4 h-4 ${meta.accent}`} strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px] truncate">{doc.titre}</p>
          <p className="text-slate-500 text-xs">{meta.label}</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Title + description card */}
        <div className={`rounded-2xl border p-4 ${meta.iconBg}`}>
          <p className={`font-bold text-[17px] leading-snug text-white`}>{doc.titre}</p>
          {doc.description && (
            <p className="text-slate-400 text-sm mt-1">{doc.description}</p>
          )}
        </div>

        {/* Main content */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div
            className="mobile-doc-content"
            dangerouslySetInnerHTML={{ __html: cleanedContent }}
          />
        </div>

        {/* PDF attachments */}
        {pdfLinks.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Pièces jointes
            </p>
            {pdfLinks.map((pdf, i) => (
              <a
                key={i}
                href={pdf.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-slate-900 border border-slate-800 active:border-slate-700 p-4 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <p className="flex-1 text-white font-medium text-[14px] truncate">{pdf.label}</p>
                <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
