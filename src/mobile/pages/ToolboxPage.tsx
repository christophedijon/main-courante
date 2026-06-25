import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Radio, Sparkles, FileText, UserCheck, BookOpen, Zap, X, Gauge, Maximize2, QrCode } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSessionActive } from '../../hooks/useSessionActive';
import EntrepriseBadge from '../components/EntrepriseBadge';

type Categorie = 'fiches_metier' | 'SSI' | 'PROCEDURE' | 'RADIO';

const colorMap: Record<string, { wrap: string; icon: string }> = {
  blue:  { wrap: 'bg-blue-500/15 border-blue-500/30',   icon: 'text-blue-400' },
  red:   { wrap: 'bg-red-500/15 border-red-500/30',     icon: 'text-red-400' },
  slate: { wrap: 'bg-slate-600/25 border-slate-500/30', icon: 'text-slate-300' },
  teal:  { wrap: 'bg-teal-500/15 border-teal-500/30',   icon: 'text-teal-400' },
};

const CAT_TO_ROUTE: Record<string, Categorie> = {
  ROLE:      'fiches_metier',
  SSI:       'SSI',
  PROCEDURE: 'PROCEDURE',
  RADIO:     'RADIO',
};

export default function ToolboxPage() {
  const navigate = useNavigate();
  const { isSuperAdmin, userFonction, session } = useAuth();
  const canAssign = isSuperAdmin || userFonction === 'Direction' || userFonction === 'Chef de poste';
  const canOpenExceptionnelle = userFonction === 'Direction' || isSuperAdmin;
  const canSeeJauge = isSuperAdmin || userFonction === 'Direction';

  const sessionState = useSessionActive();
  const [exceptionnelleModalOpen, setExceptionnelleModalOpen] = useState(false);
  const [openingExceptionnelle, setOpeningExceptionnelle] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const appUrl = `${window.location.origin}/jauge`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=e2e8f0&bgcolor=0f172a&data=${encodeURIComponent(appUrl)}`;

  const [unsignedByCat, setUnsignedByCat] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!session?.user || !userFonction) return;
    (async () => {
      const { data: docs } = await supabase
        .from('toolbox_documents')
        .select('id, categorie, content_version, destinataires')
        .eq('actif', true)
        .eq('signature_requise', true);

      if (!docs || docs.length === 0) return;

      const relevant = docs.filter((d: { destinataires: string[] }) =>
        !d.destinataires || d.destinataires.length === 0 || d.destinataires.includes(userFonction)
      );
      if (relevant.length === 0) return;

      const { data: sigs } = await supabase
        .from('signatures')
        .select('document_id, content_version')
        .eq('agent_id', session.user.id);

      const signedSet = new Set((sigs ?? []).map((s: { document_id: string; content_version: number }) => `${s.document_id}:${s.content_version}`));

      const counts: Record<string, number> = {};
      for (const doc of relevant) {
        if (!signedSet.has(`${doc.id}:${doc.content_version}`)) {
          counts[doc.categorie] = (counts[doc.categorie] ?? 0) + 1;
        }
      }
      setUnsignedByCat(counts);
    })();
  }, [session?.user?.id, userFonction]);

  function Badge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-red-900/50 z-10">
        {count > 9 ? '9+' : count}
      </span>
    );
  }

  const tools = [
    { Icon: UserCheck, title: 'Postes',          desc: 'Prendre mon poste',     accent: 'blue',  cat: 'ROLE',      route: () => navigate('/mobile/postes') },
    { Icon: Flame,     title: 'Consignes SSI',  desc: 'Évacuation, alarmes',   accent: 'red',   cat: 'SSI',       route: () => navigate('/mobile/outils/documents/SSI') },
    { Icon: FileText,  title: 'Info & Doc',      desc: 'Fiches & procédures',   accent: 'slate', cat: 'PROCEDURE', route: () => navigate('/mobile/outils/documents/PROCEDURE') },
    { Icon: Radio,     title: 'Radio',          desc: 'Codes & phonétique',    accent: 'teal',  cat: 'RADIO',     route: () => navigate('/mobile/outils/documents/RADIO') },
  ] as const;

  return (
    <div>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-2xl font-bold truncate">Boîte à outils</h1>
            <p className="text-slate-500 text-sm">Procédures & aide IA terrain</p>
          </div>
          <EntrepriseBadge />
        </div>
      </div>

      {/* IA banner */}
      <button
        type="button"
        onClick={() => navigate('/mobile/assistant-ia')}
        className="mx-5 w-[calc(100%-2.5rem)] rounded-2xl bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border border-blue-500/30 p-4 flex items-center gap-3 hover:from-blue-600/40 hover:to-cyan-600/30 active:scale-[0.99] transition-all"
      >
        <div className="w-11 h-11 rounded-xl bg-blue-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-blue-300" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-white font-bold text-[15px]">Assistant IA</p>
          <p className="text-blue-200/80 text-xs">Gestion sécurité personnes & incendie</p>
        </div>
      </button>

      <div className="px-5 py-5 grid grid-cols-2 gap-3">
        {tools.map(({ Icon, title, desc, accent, cat, route }) => {
          const c = colorMap[accent];
          const badgeCount = cat === 'ROLE' ? 0 : (unsignedByCat[CAT_TO_ROUTE[cat]] ?? 0);
          return (
            <button
              key={title}
              type="button"
              onClick={route}
              className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 transition-all active:scale-[0.98] min-h-[128px] flex flex-col"
            >
              <div className="relative w-fit mb-3">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${c.wrap}`}>
                  <Icon className={`w-5 h-5 ${c.icon}`} strokeWidth={2.3} />
                </div>
                <Badge count={badgeCount} />
              </div>
              <p className="text-white font-semibold text-[14px] leading-tight">{title}</p>
              <p className="text-slate-500 text-[11px] mt-0.5">{desc}</p>
            </button>
          );
        })}

        {canAssign && (
          <button
            type="button"
            onClick={() => navigate('/mobile/assignation')}
            className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 transition-all active:scale-[0.98] min-h-[128px] flex flex-col"
          >
            <div className="w-11 h-11 rounded-xl border flex items-center justify-center mb-3 bg-emerald-500/15 border-emerald-500/30">
              <UserCheck className="w-5 h-5 text-emerald-400" strokeWidth={2.3} />
            </div>
            <p className="text-white font-semibold text-[14px] leading-tight">Assignation</p>
            <p className="text-slate-500 text-[11px] mt-0.5">Attribuer les agents</p>
          </button>
        )}

        {canAssign && (
          <button
            type="button"
            onClick={() => navigate('/mobile/registre-securite')}
            className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 transition-all active:scale-[0.98] min-h-[128px] flex flex-col"
          >
            <div className="w-11 h-11 rounded-xl border flex items-center justify-center mb-3 bg-amber-500/15 border-amber-500/30">
              <BookOpen className="w-5 h-5 text-amber-400" strokeWidth={2.3} />
            </div>
            <p className="text-white font-semibold text-[14px] leading-tight">Registre</p>
            <p className="text-slate-500 text-[11px] mt-0.5">Sécurité ERP</p>
          </button>
        )}

        {canSeeJauge && (
          <div className="col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 bg-cyan-500/15 border-cyan-500/30">
              <Gauge className="w-5 h-5 text-cyan-400" strokeWidth={2.3} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[14px] leading-tight">Jauge de capacité</p>
              <p className="text-slate-500 text-[11px] mt-0.5">Suivi des entrées en temps réel</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setQrModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-all active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Code
              </button>
              <button
                type="button"
                onClick={() => navigate('/jauge')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-all active:scale-95"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Plein écran
              </button>
            </div>
          </div>
        )}
      </div>

      {canOpenExceptionnelle && !sessionState.isActive && (
        <div className="mx-4 mt-6 mb-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
              Gestion de session
            </span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <button
            onClick={() => setExceptionnelleModalOpen(true)}
            className="w-full flex items-center justify-center gap-3 rounded-2xl
                       px-5 py-3.5 font-bold text-sm transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.10) 100%)',
              border: '1px solid rgba(245,158,11,0.35)',
              color: '#f59e0b',
            }}
          >
            <Zap size={16} />
            Ouverture Exceptionnelle
          </button>
          <p className="text-center text-[11px] text-slate-600 mt-2">
            Hors horaires habituels — fermeture automatique à 08h00
          </p>
        </div>
      )}

      {qrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) setQrModalOpen(false); }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-t-3xl p-6 pb-10 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-[15px]">QR Code Jauge</p>
                  <p className="text-slate-500 text-xs">Accès direct à la jauge</p>
                </div>
              </div>
              <button
                onClick={() => setQrModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-[220px] h-[220px] rounded-2xl bg-slate-950 border border-slate-700 overflow-hidden flex items-center justify-center">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                <p className="text-slate-500 text-[10px] uppercase font-semibold tracking-wider mb-1">Lien public</p>
                <p className="text-slate-300 text-xs font-mono break-all">{appUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(appUrl); }}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium transition-all active:scale-[0.98]"
              >
                Copier le lien
              </button>
            </div>
          </div>
        </div>
      )}

      {exceptionnelleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) setExceptionnelleModalOpen(false); }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30
                              flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <button
                onClick={() => setExceptionnelleModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Ouverture Exceptionnelle</h3>
            <p className="text-slate-400 text-sm mb-1">
              Ouvre une session de soirée hors horaires habituels.
            </p>
            <p className="text-amber-400 text-sm font-medium mb-6">
              Fermeture automatique demain à 08h00.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setExceptionnelleModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300
                           text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setOpeningExceptionnelle(true);
                  await sessionState.openExceptionnelleSession();
                  setOpeningExceptionnelle(false);
                  setExceptionnelleModalOpen(false);
                }}
                disabled={openingExceptionnelle}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500
                           text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {openingExceptionnelle ? 'Ouverture…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
