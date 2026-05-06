import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Flame, FileText, Radio } from 'lucide-react';
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

function isRichHtml(content: string): boolean {
  return (
    content.includes('<style') ||
    content.includes('<script') ||
    content.includes('<div ')
  );
}

export default function DocumentDetailPage() {
  const { categorie, id } = useParams<{ categorie: string; id: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeHeight, setIframeHeight] = useState(600);

  const cat = (categorie?.toUpperCase() ?? '') as Categorie;
  const meta = META[cat];

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'iframeHeight') {
        setIframeHeight(e.data.height + 48);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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

  const iframeTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 4px 0 16px;
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #e2e8f0;
    font-size: 14px;
  }
</style>
</head>
<body>
${doc.contenu}
<script>
function notifyHeight() {
  window.parent.postMessage(
    { type: 'iframeHeight', height: document.body.scrollHeight },
    '*'
  );
}
window.addEventListener('load', notifyHeight);
window.addEventListener('click', function() {
  setTimeout(notifyHeight, 150);
});
new ResizeObserver(notifyHeight).observe(document.body);
<\/script>
</body>
</html>`;

  const cleanedContent = doc.contenu
    .replace(/<p><a[^>]+href="[^"]+\.pdf[^"]*"[^>]*>[^<]*<\/a><\/p>/gi, '');

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
          <p className="font-bold text-[17px] leading-snug text-white">{doc.titre}</p>
          {doc.description && (
            <p className="text-slate-400 text-sm mt-1">{doc.description}</p>
          )}
        </div>

        {/* Main content */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          {isRichHtml(doc.contenu) ? (
            <iframe
              srcDoc={iframeTemplate}
              className="w-full border-0"
              style={{ height: iframeHeight + 'px' }}
              title={doc.titre}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="p-4">
              <div
                className="mobile-doc-content text-slate-300 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: cleanedContent }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
