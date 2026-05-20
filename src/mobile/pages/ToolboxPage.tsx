import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Radio, Sparkles, MapPin, FileText, UserCheck, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import EntrepriseBadge from '../components/EntrepriseBadge';
import CarteJauge from '../components/CarteJauge';
import { useJauge } from '../../hooks/useJauge';

type Categorie = 'RONDE' | 'SSI' | 'PROCEDURE' | 'RADIO';

const colorMap: Record<string, { wrap: string; icon: string }> = {
  blue:  { wrap: 'bg-blue-500/15 border-blue-500/30',   icon: 'text-blue-400' },
  red:   { wrap: 'bg-red-500/15 border-red-500/30',     icon: 'text-red-400' },
  slate: { wrap: 'bg-slate-600/25 border-slate-500/30', icon: 'text-slate-300' },
  teal:  { wrap: 'bg-teal-500/15 border-teal-500/30',   icon: 'text-teal-400' },
};

const CAT_TO_ROUTE: Record<string, Categorie> = {
  ROLE:      'RONDE',
  SSI:       'SSI',
  PROCEDURE: 'PROCEDURE',
  RADIO:     'RADIO',
};

const JAUGE_ROLES = new Set(['Direction', 'Chef de poste', 'Agent de Sécurité']);

export default function ToolboxPage() {
  const navigate = useNavigate();
  const { isSuperAdmin, userFonction, session } = useAuth();
  const canAssign = isSuperAdmin || userFonction === 'Direction' || userFonction === 'Chef de poste';

  const jauge = useJauge();
  const [jaugeCount, setJaugeCount] = useState<number | null>(null);
  const showJauge =
    !jauge.loading &&
    jauge.mode_jauge === 'sortie' &&
    jauge.entrepriseId !== null &&
    (isSuperAdmin || (userFonction !== null && JAUGE_ROLES.has(userFonction)));

  // Sync local override with realtime count from hook
  const displayCount = jaugeCount !== null ? jaugeCount : jauge.count;

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
    { Icon: MapPin,    title: 'Rôle',           desc: 'Postes & assignations', accent: 'blue',  cat: 'ROLE',      route: () => navigate('/mobile/postes') },
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

      {/* Jauge billetterie card — sortie mode only, allowed roles */}
      {showJauge && (
        <CarteJauge
          count={displayCount}
          Ep={jauge.Ep}
          entrepriseId={jauge.entrepriseId!}
          onCountUpdate={(n) => setJaugeCount(n)}
        />
      )}

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
            <p className="text-slate-500 text-[11px] mt-0.5">Postes ce soir</p>
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
      </div>
    </div>
  );
}
