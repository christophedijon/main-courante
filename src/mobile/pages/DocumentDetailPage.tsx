import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Flame, FileText, Radio, ChevronDown,
  Image as ImageIcon, CheckCircle, PenLine, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import ImageViewer from '../components/ImageViewer';
import bcrypt from 'bcryptjs';

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

type SignatureRecord = {
  id: string;
  agent_nom: string;
  signed_at: string;
  content_version: number;
};

const META: Record<Categorie, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  iconBg: string;
}> = {
  RONDE:     { label: 'Rôle',          icon: Shield,   accent: 'text-blue-400',  iconBg: 'bg-blue-500/15 border-blue-500/30' },
  SSI:       { label: 'Consignes SSI', icon: Flame,    accent: 'text-red-400',   iconBg: 'bg-red-500/15 border-red-500/30' },
  PROCEDURE: { label: 'Info & Doc',    icon: FileText, accent: 'text-slate-300', iconBg: 'bg-slate-600/25 border-slate-500/30' },
  RADIO:     { label: 'Radio',         icon: Radio,    accent: 'text-teal-400',  iconBg: 'bg-teal-500/15 border-teal-500/30' },
};

function isRichHtml(content: string): boolean {
  return (
    content.includes('<style') ||
    content.includes('<script') ||
    content.includes('<div ') ||
    content.includes('<table')
  );
}

function extractPdfLinks(html: string): { href: string; label: string }[] {
  const matches = [...html.matchAll(/<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>([^<]*)<\/a>/gi)];
  return matches.map((m) => ({ href: m[1], label: m[2].replace(/📎\s*/g, '').trim() || 'Document PDF' }));
}

function extractImages(html: string): { src: string; alt: string }[] {
  const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*/gi)];
  return matches.map((m) => ({ src: m[1], alt: m[2] || 'Image' }));
}

function stripPdfLinks(html: string): string {
  return html.replace(/<p><a[^>]+href="[^"]+\.pdf[^"]*"[^>]*>[^<]*<\/a><\/p>/gi, '');
}

function stripImages(html: string): string {
  return html.replace(/<img[^>]*>/gi, '');
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function PdfViewer({ href, label }: { href: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 transition-all active:bg-slate-800">
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-slate-400" />
        </div>
        <p className="flex-1 text-white font-medium text-[14px] truncate text-left">{label}</p>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-800 overflow-hidden rounded-b-2xl" style={{ height: '75vh' }}>
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(href)}&embedded=true`}
            className="w-full h-full border-0"
            title={label}
            allow="fullscreen"
          />
        </div>
      )}
    </div>
  );
}

export default function DocumentDetailPage() {
  const { categorie, id } = useParams<{ categorie: string; id: string }>();
  const navigate = useNavigate();
  const { session, userFonction } = useAuth();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(600);
  const contentRef = useRef<HTMLDivElement>(null);

  // Signature state
  const [signature, setSignature] = useState<SignatureRecord | null>(null);
  const [password, setPassword] = useState('');
  const [signing, setSigning] = useState(false);
  const [signMsg, setSignMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [showPwdInput, setShowPwdInput] = useState(false);

  const cat = (categorie?.toUpperCase() ?? '') as Categorie;
  const meta = META[cat];

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'iframeHeight') {
        setIframeHeight(e.data.height);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('toolbox_documents')
        .select('id, titre, description, contenu, categorie, destinataires, signature_requise, content_version')
        .eq('id', id)
        .eq('actif', true)
        .maybeSingle();

      const docData = data as Doc | null;
      setDoc(docData);

      // Vérifier si l'agent a déjà signé cette version
      if (docData?.signature_requise && session?.user) {
        const { data: existingSig } = await supabase
          .from('signatures')
          .select('id, agent_nom, signed_at, content_version')
          .eq('document_id', docData.id)
          .eq('agent_id', session.user.id)
          .eq('content_version', docData.content_version)
          .maybeSingle();
        setSignature(existingSig as SignatureRecord | null);
      }

      setLoading(false);
    })();
  }, [id, session?.user?.id]);

  async function handleSign() {
    if (!doc || !session?.user || !password) return;
    setSigning(true);
    setSignMsg(null);

    if (navigator.onLine) {
      // Vérification en ligne via re-authentification
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: session.user.email!,
        password,
      });
      if (authErr) {
        setSignMsg({ type: 'error', text: 'Mot de passe incorrect.' });
        setSigning(false);
        return;
      }
    } else {
      // Vérification hors ligne via hash local
      const storedHash = localStorage.getItem('mc_pwd_hash');
      const valid = storedHash && await bcrypt.compare(password, storedHash);
      if (!valid) {
        setSignMsg({ type: 'error', text: 'Mot de passe incorrect.' });
        setSigning(false);
        return;
      }
    }

    // Récupérer le nom de l'agent
    let agentNom = session.user.email ?? 'Inconnu';
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profile) {
      const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
      if (full) agentNom = full;
    }

    const sigData = {
      document_id: doc.id,
      agent_id: session.user.id,
      agent_nom: agentNom,
      agent_role: userFonction ?? '',
      signed_at: new Date().toISOString(),
      content_version: doc.content_version,
      synced: navigator.onLine,
    };

    if (navigator.onLine) {
      const { error } = await supabase.from('signatures').insert(sigData);
      if (error) {
        setSignMsg({ type: 'error', text: 'Erreur lors de la signature.' });
        setSigning(false);
        return;
      }
    } else {
      // Mode hors ligne : stocker en queue
      const pending = JSON.parse(localStorage.getItem('mc_pending_signatures') ?? '[]');
      pending.push(sigData);
      localStorage.setItem('mc_pending_signatures', JSON.stringify(pending));
      setSignMsg({ type: 'success', text: 'Signature enregistrée localement. Elle sera synchronisée à la reprise de la connexion.' });
    }

    setSignature({ id: '', agent_nom: agentNom, signed_at: sigData.signed_at, content_version: doc.content_version });
    setPassword('');
    setShowPwdInput(false);
    setSigning(false);
    if (navigator.onLine) {
      setSignMsg({ type: 'success', text: 'Document signé avec succès.' });
    }
    setTimeout(() => setSignMsg(null), 4000);
  }

  const needsSignature = doc?.signature_requise
    && (
      !doc.destinataires
      || doc.destinataires.length === 0
      || (userFonction && doc.destinataires.includes(userFonction))
    );

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
        <button onClick={() => navigate(-1)} className="text-blue-400 text-sm font-semibold">Retour</button>
      </div>
    );
  }

  const Icon = meta.icon;
  const pdfLinks = extractPdfLinks(doc.contenu);
  const images = extractImages(doc.contenu);
  const cleanedContent = stripImages(stripPdfLinks(doc.contenu));

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
        {needsSignature && signature && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 shrink-0">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 text-[11px] font-semibold">Signé</span>
          </div>
        )}
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Title + description card */}
        <div className={`rounded-2xl border p-4 ${meta.iconBg}`}>
          <p className="font-bold text-[17px] leading-snug text-white">{doc.titre}</p>
          {doc.description && (
            <p className="text-slate-400 text-sm mt-1">{doc.description}</p>
          )}
        </div>

        {/* Main text content */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          {isRichHtml(cleanedContent) ? (
            <iframe
              srcDoc={`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #e2e8f0;
  }
</style>
</head>
<body>
${cleanedContent}
<script>
function notifyHeight() {
  window.parent.postMessage({ type: 'iframeHeight', height: document.body.scrollHeight }, '*');
}
window.addEventListener('load', notifyHeight);
window.addEventListener('click', function() { setTimeout(notifyHeight, 100); });
new ResizeObserver(notifyHeight).observe(document.body);
<\/script>
</body>
</html>`}
              className="w-full border-0"
              style={{ height: iframeHeight + 'px' }}
              title={doc.titre}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div ref={contentRef} className="mobile-doc-content p-4" dangerouslySetInnerHTML={{ __html: cleanedContent }} />
          )}
        </div>

        {/* ── Section signature ── */}
        {needsSignature && (
          signature ? (
            /* Déjà signé */
            <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/25 p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-400 font-semibold text-[14px]">Lu et signé</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {fmtDate(signature.signed_at)}
                </p>
              </div>
            </div>
          ) : (
            /* Pas encore signé */
            <div className="rounded-2xl bg-slate-900 border border-amber-500/30 overflow-hidden">
              <div className="px-4 py-3.5 flex items-center gap-3 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <PenLine className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-[14px]">Signature requise</p>
                  <p className="text-slate-400 text-xs">Confirmez la lecture de ce document</p>
                </div>
              </div>

              <div className="px-4 py-4 space-y-3">
                {!showPwdInput ? (
                  <button
                    type="button"
                    onClick={() => setShowPwdInput(true)}
                    className="w-full py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <PenLine className="w-4 h-4" />
                    J'ai lu ce document — Signer
                  </button>
                ) : (
                  <>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSign()}
                        placeholder="Votre mot de passe…"
                        autoFocus
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-[14px] focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                      />
                    </div>

                    {signMsg && (
                      <div className={`flex items-start gap-2 rounded-xl p-3 text-[13px] border
                        ${signMsg.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                        {signMsg.type === 'error'
                          ? <span className="font-semibold">Erreur :</span>
                          : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                        {signMsg.text}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSign}
                        disabled={!password || signing}
                        className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900 disabled:cursor-not-allowed text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      >
                        {signing ? (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {signing ? 'Vérification…' : 'Confirmer la signature'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowPwdInput(false); setPassword(''); setSignMsg(null); }}
                        className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-[14px] transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        )}

        {/* Images section */}
        {images.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            <button type="button" onClick={() => setImagesOpen((v) => !v)}
              className="w-full flex items-center gap-3 p-4 transition-all active:bg-slate-800">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium text-[14px]">Documents visuels</p>
                <p className="text-slate-500 text-xs mt-0.5">{images.length} image{images.length > 1 ? 's' : ''}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${imagesOpen ? 'rotate-180' : ''}`} />
            </button>
            {imagesOpen && (
              <div className="border-t border-slate-800 p-4 space-y-3">
                {images.map((img, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-slate-700 cursor-zoom-in" onClick={() => setLightboxSrc(img.src)}>
                    <img src={img.src} alt={img.alt} className="w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                ))}
                <p className="text-slate-600 text-xs text-center">Appuyez sur une image pour l'agrandir</p>
              </div>
            )}
          </div>
        )}

        {/* PDF attachments */}
        {pdfLinks.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Pièces jointes</p>
            {pdfLinks.map((pdf, i) => (
              <PdfViewer key={i} href={pdf.href} label={pdf.label} />
            ))}
          </div>
        )}
      </div>

      <ImageViewer src={lightboxSrc ?? ''} isOpen={!!lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
