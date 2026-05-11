import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Flame, FileText, Radio, CheckCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Categorie = 'RONDE' | 'SSI' | 'PROCEDURE' | 'RADIO';

type Doc = {
  id: string;
  titre: string;
  description: string;
  contenu: string;
  categorie: Categorie;
  destinataires: string[];
  signature_requise: boolean;
  content_version: number;
};

type Signature = {
  id: string;
  signed_at: string;
  content_version: number;
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
  const { session, userFonction } = useAuth();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeHeight, setIframeHeight] = useState(600);
  const [signature, setSignature] = useState<Signature | null>(null);

  const [hasRead, setHasRead] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const [password, setPassword] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [openPdfHref, setOpenPdfHref] = useState<string | null>(null);

  const cat = (categorie?.toUpperCase() ?? '') as Categorie;
  const meta = META[cat];

  const markAsRead = useCallback(() => {
    if (!doc || !session) return;
    const storageKey = `doc_read_${doc.id}_${session.user.id}`;
    localStorage.setItem(storageKey, 'true');
    setHasRead(true);
    setReadProgress(100);
  }, [doc, session]);

  // Load doc + existing signature
  useEffect(() => {
    if (!id || !session) return;
    (async () => {
      const [docRes, sigRes] = await Promise.all([
        supabase
          .from('toolbox_documents')
          .select('id, titre, description, contenu, categorie, destinataires, signature_requise, content_version')
          .eq('id', id)
          .eq('actif', true)
          .maybeSingle(),
        supabase
          .from('signatures')
          .select('id, signed_at, content_version')
          .eq('document_id', id)
          .eq('agent_id', session.user.id)
          .maybeSingle(),
      ]);
      setDoc(docRes.data as Doc | null);
      setSignature(sigRes.data as Signature | null);
      setLoading(false);
    })();
  }, [id, session]);

  // Check localStorage read state once doc is loaded
  useEffect(() => {
    if (!doc || !session) return;

    const storageKey = `doc_read_${doc.id}_${session.user.id}`;
    const alreadyRead = localStorage.getItem(storageKey) === 'true';

    if (alreadyRead) {
      setHasRead(true);
      setReadProgress(100);
      return;
    }

    // For short documents that don't need scrolling
    setTimeout(() => {
      const el = contentRef.current;
      if (!el) return;
      if (el.scrollHeight <= el.clientHeight + 50) {
        markAsRead();
      }
    }, 500);
  }, [doc, session, markAsRead]);

  // Scroll detection for plain HTML content (window scroll)
  useEffect(() => {
    if (hasRead) return;

    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollable = docHeight - winHeight;
      if (scrollable <= 0) return;
      const progress = (scrollTop / scrollable) * 100;
      setReadProgress(Math.min(progress, 100));
      if (progress >= 90) {
        markAsRead();
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasRead, markAsRead]);

  // postMessage handler for iframe height + scroll progress
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'iframeHeight') {
        setIframeHeight(e.data.height + 48);
      }
      if (e.data?.type === 'iframeScroll') {
        if (hasRead) return;
        const progress = e.data.progress as number;
        setReadProgress(Math.min(progress, 100));
        if (progress >= 90) {
          markAsRead();
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [hasRead, markAsRead]);

  async function handleSign() {
    if (!doc || !session || !password) return;
    setSigning(true);
    setSignError(null);

    // Verify password by re-authenticating
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: session.user.email!,
      password,
    });

    if (authError) {
      setSigning(false);
      setSignError('Mot de passe incorrect.');
      return;
    }

    const { data: managed } = await supabase
      .from('managed_users')
      .select('fonction, email')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    const agentNom = session.user.email ?? '';
    const agentRole = managed?.fonction ?? userFonction ?? '';

    const { data: newSig, error: insertError } = await supabase
      .from('signatures')
      .insert({
        document_id: doc.id,
        agent_id: session.user.id,
        agent_nom: agentNom,
        agent_role: agentRole,
        content_version: doc.content_version,
      })
      .select('id, signed_at, content_version')
      .maybeSingle();

    setSigning(false);
    if (insertError) {
      setSignError('Erreur lors de la signature. Veuillez réessayer.');
      return;
    }
    setSignature(newSig as Signature);
    setPassword('');
  }

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
        <button onClick={() => navigate(-1)} className="text-blue-400 text-sm font-semibold">
          Retour
        </button>
      </div>
    );
  }

  const Icon = meta.icon;
  const showSignatureBlock =
    doc.signature_requise &&
    userFonction &&
    (!doc.destinataires || doc.destinataires.length === 0 || doc.destinataires.includes(userFonction));

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
    background: #0f172a;
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
function notifyScroll() {
  var scrollTop = window.scrollY || document.documentElement.scrollTop;
  var docHeight = document.documentElement.scrollHeight;
  var winHeight = window.innerHeight;
  var scrollable = docHeight - winHeight;
  var progress = 0;
  if (scrollable <= 0) {
    progress = 100;
  } else {
    progress = (scrollTop / scrollable) * 100;
  }
  window.parent.postMessage(
    { type: 'iframeScroll', progress: Math.min(progress, 100) },
    '*'
  );
}
window.addEventListener('load', function() {
  notifyHeight();
  notifyScroll();
});
window.addEventListener('scroll', notifyScroll);
window.addEventListener('click', function() {
  setTimeout(notifyHeight, 150);
  setTimeout(notifyScroll, 150);
});
new ResizeObserver(notifyHeight).observe(document.body);
<\/script>
</body>
</html>`;

  function extractPdfLinks(html: string): { href: string; label: string }[] {
    const matches = [...html.matchAll(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi)];
    return matches
      .filter(m =>
        m[1].includes('.pdf') ||
        m[1].includes('documents-media') ||
        m[2].includes('📎')
      )
      .map((m) => ({
        href: m[1],
        label: m[2].replace(/📎\s*/g, '').trim() || 'Ouvrir le document',
      }));
  }

  const pdfLinks = extractPdfLinks(doc.contenu);

  const cleanedContent = doc.contenu
    ?.replace(/<p><a[^>]+href="[^"]*(?:\.pdf|documents-media)[^"]*"[^>]*>[^<]*<\/a><\/p>/gi, '') ?? '';

  return (
    <div ref={contentRef} className="pb-12">
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

        {/* PDF attachments */}
        {pdfLinks.length > 0 && (
          <div className="space-y-2">
            {pdfLinks.map((pdf, i) => (
              <div key={i} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenPdfHref(openPdfHref === pdf.href ? null : pdf.href)}
                  className="w-full flex items-center gap-3 p-4 active:border-slate-700 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="flex-1 text-white font-medium text-[14px] truncate text-left">
                    {pdf.label}
                  </p>
                  <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${openPdfHref === pdf.href ? 'rotate-180' : ''}`} />
                </button>
                {openPdfHref === pdf.href && (
                  <div className="border-t border-slate-800 overflow-hidden" style={{ height: '75vh' }}>
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdf.href)}&embedded=true`}
                      className="w-full h-full border-0"
                      title={pdf.label}
                      allow="fullscreen"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Signature block ── */}
      {showSignatureBlock && !signature && (
        <div className="px-4 pb-6 mt-4 space-y-3">

          {/* Read progress bar */}
          {!hasRead && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-xs font-semibold">Progression de lecture</p>
                <p className="text-slate-400 text-xs font-mono">{Math.round(readProgress)}%</p>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${readProgress}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs mt-2 text-center">
                Lisez le document jusqu'à la fin pour pouvoir signer
              </p>
            </div>
          )}

          {/* Password + sign button */}
          <div className={`rounded-2xl border p-4 space-y-3 transition-all
            ${hasRead
              ? 'bg-slate-900 border-slate-700'
              : 'bg-slate-900/50 border-slate-800 opacity-50 pointer-events-none'
            }`}>
            <p className="text-white font-semibold text-sm">Signature requise</p>
            <p className="text-slate-400 text-xs">
              {hasRead
                ? 'Saisissez votre mot de passe pour confirmer que vous avez lu ce document.'
                : 'Terminez la lecture du document pour signer.'
              }
            </p>

            {signError && (
              <p className="text-red-400 text-xs font-medium">{signError}</p>
            )}

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              disabled={!hasRead}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled={!hasRead || !password || signing}
              onClick={handleSign}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all
                ${hasRead && password
                  ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
            >
              {signing
                ? 'Signature en cours…'
                : hasRead
                  ? "J'ai lu et j'approuve ce document"
                  : 'Terminez la lecture pour signer'
              }
            </button>
          </div>
        </div>
      )}

      {/* Already signed */}
      {signature && (
        <div className="px-4 pb-6 mt-4">
          <div className="rounded-2xl bg-emerald-950/40 border border-emerald-800/40 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-emerald-300 font-semibold text-sm">Lu et signé</p>
              <p className="text-emerald-400/70 text-xs mt-0.5">
                {new Date(signature.signed_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
