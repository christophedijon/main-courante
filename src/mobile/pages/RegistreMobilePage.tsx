import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, AlertTriangle, Clock, Minus, FileText, ChevronDown, ChevronUp,
  FileDown, Printer, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEntreprise } from '../../hooks/useEntreprise';
import FicheVerification from '../../components/FicheVerification';

type RegistreItem = {
  id: string;
  installation: string;
  reference_reglementaire: string;
  organisme_verificateur: string;
  periodicite: string;
  applicable: boolean;
  date_verification: string | null;
  nom_verificateur: string;
  observations: string;
  observations_levees: string;
  rapport_url: string;
  updated_at: string;
};

type Statut = 'non_applicable' | 'non_planifie' | 'a_jour' | 'attention' | 'retard';

function getNextDate(lastDate: string, periodicite: string): Date | null {
  if (!lastDate) return null;
  const d = new Date(lastDate);
  switch (periodicite.toLowerCase()) {
    case 'mensuelle': d.setMonth(d.getMonth() + 1); break;
    case 'trimestrielle': d.setMonth(d.getMonth() + 3); break;
    case 'semestrielle': d.setMonth(d.getMonth() + 6); break;
    case 'annuelle': d.setFullYear(d.getFullYear() + 1); break;
    case 'triennale': d.setFullYear(d.getFullYear() + 3); break;
    case 'quinquennale': d.setFullYear(d.getFullYear() + 5); break;
    case 'sans': return null;
    default: return null;
  }
  return d;
}

function getStatut(lastDate: string | null, periodicite: string, applicable: boolean): Statut {
  if (!applicable) return 'non_applicable';
  if (periodicite.toLowerCase() === 'sans') return 'non_applicable';
  if (!lastDate) return 'non_planifie';
  const next = getNextDate(lastDate, periodicite);
  if (!next) return 'non_planifie';
  const diff = next.getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'retard';
  if (days < 90) return 'attention';
  return 'a_jour';
}

function formatDate(d: string | null) {
  if (!d) return 'Non planifié';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const GROUP_CONFIG = [
  {
    key: 'retard' as Statut,
    label: 'En retard',
    icon: AlertTriangle,
    cardBorder: 'border-red-700/40',
    cardBg: 'bg-red-950/30',
    badgeBg: 'bg-red-500/15 text-red-400 border-red-500/30',
    iconColor: 'text-red-400',
  },
  {
    key: 'attention' as Statut,
    label: 'À planifier sous 3 mois',
    icon: AlertTriangle,
    cardBorder: 'border-amber-700/40',
    cardBg: 'bg-amber-950/30',
    badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    iconColor: 'text-amber-400',
  },
  {
    key: 'non_planifie' as Statut,
    label: 'Non planifié',
    icon: Clock,
    cardBorder: 'border-slate-700/40',
    cardBg: 'bg-slate-900/60',
    badgeBg: 'bg-slate-600/30 text-slate-400 border-slate-600/30',
    iconColor: 'text-slate-400',
  },
  {
    key: 'a_jour' as Statut,
    label: 'À jour',
    icon: CheckCircle,
    cardBorder: 'border-emerald-700/30',
    cardBg: 'bg-emerald-950/20',
    badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    key: 'non_applicable' as Statut,
    label: 'Sans objet',
    icon: Minus,
    cardBorder: 'border-slate-800',
    cardBg: 'bg-slate-900/40',
    badgeBg: 'bg-slate-700/50 text-slate-500 border-slate-600/30',
    iconColor: 'text-slate-500',
    collapsible: true,
  },
];

function RegistreCard({
  item,
  config,
  onFiche,
}: {
  item: RegistreItem;
  config: typeof GROUP_CONFIG[0];
  onFiche: (item: RegistreItem) => void;
}) {
  const nextDate = item.date_verification ? getNextDate(item.date_verification, item.periodicite) : null;
  const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const pdfUrl = item.rapport_url
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(item.rapport_url)}&embedded=true`
    : null;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${config.cardBorder} ${config.cardBg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-snug">{item.installation}</p>
          <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-400 border border-slate-600/30">
            {item.reference_reglementaire}
          </span>
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${config.badgeBg}`}>
          <config.icon className={`w-3 h-3 ${config.iconColor}`} />
          {config.key === 'retard' && daysLeft !== null ? `${Math.abs(daysLeft)}j de retard` :
           config.key === 'attention' && daysLeft !== null ? `J-${daysLeft}` :
           config.key === 'a_jour' ? 'À jour' :
           config.key === 'non_planifie' ? 'Non planifié' :
           'Sans objet'}
        </span>
      </div>

      {/* Infos */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Organisme</p>
          <p className="text-slate-300 mt-0.5">{item.organisme_verificateur}</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Périodicité</p>
          <p className="text-slate-300 mt-0.5">{item.periodicite}</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Dernière vérif.</p>
          <p className={`mt-0.5 ${!item.date_verification ? 'text-red-400' : 'text-slate-300'}`}>
            {formatDate(item.date_verification)}
          </p>
        </div>
        {nextDate && (
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Prochaine vérif.</p>
            <p className="text-slate-300 mt-0.5">
              {nextDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {/* Observations */}
      {item.observations && (
        <div className="bg-slate-950/50 rounded-xl px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Observations</p>
          <p className="text-slate-300 text-xs leading-relaxed">{item.observations}</p>
        </div>
      )}
      {item.observations_levees && (
        <div className="bg-emerald-950/30 border border-emerald-700/20 rounded-xl px-3 py-2">
          <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-semibold mb-1">Levée des observations</p>
          <p className="text-emerald-300 text-xs leading-relaxed">{item.observations_levees}</p>
        </div>
      )}

      {/* Rapport PDF */}
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-[12px] text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-xl transition-colors"
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          Voir le rapport PDF
        </a>
      )}

      {/* Fiche PDF — applicable items only */}
      {item.applicable && (
        <button
          onClick={() => onFiche(item)}
          className="flex items-center gap-2 text-[12px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl transition-colors w-full"
        >
          <FileDown className="w-3.5 h-3.5 shrink-0" />
          Fiche PDF
        </button>
      )}
    </div>
  );
}

type EntrepriseInfo = {
  nom: string | null;
  logo_url: string | null;
  type_erp: string | null;
  categorie_erp: string | null;
  siret: string | null;
};

export default function RegistreMobilePage() {
  const navigate = useNavigate();
  const { nom, logo_url } = useEntreprise();
  const [items, setItems] = useState<RegistreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapseNonApp, setCollapseNonApp] = useState(true);
  const [entreprise, setEntreprise] = useState<EntrepriseInfo | null>(null);
  const [ficheItem, setFicheItem] = useState<RegistreItem | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('registre_securite').select('*').order('installation'),
      supabase.from('entreprise').select('nom, logo_url, type_erp, categorie_erp, siret').limit(1).maybeSingle(),
    ]).then(([registreRes, entrepriseRes]) => {
      setItems((registreRes.data ?? []) as RegistreItem[]);
      setEntreprise(entrepriseRes.data as EntrepriseInfo | null);
      setLoading(false);
    });
  }, []);

  const lastUpdated = items.reduce<string | null>((acc, it) => {
    if (!acc || it.updated_at > acc) return it.updated_at;
    return acc;
  }, null);

  const grouped = GROUP_CONFIG.map((cfg) => ({
    ...cfg,
    items: items.filter((it) => getStatut(it.date_verification, it.periodicite, it.applicable) === cfg.key),
  }));

  return (
    <div className="pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {logo_url && <img src={logo_url} alt="logo" className="h-5 w-auto object-contain rounded" />}
            <p className="text-white font-semibold text-[15px] truncate">{nom || 'Registre de sécurité'}</p>
          </div>
          {lastUpdated && (
            <p className="text-slate-500 text-xs mt-0.5">
              Mis à jour le {new Date(lastUpdated).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {loading && <p className="text-center text-slate-500 text-sm py-16">Chargement…</p>}

      {!loading && (
        <div className="px-4 py-5 space-y-6">
          {grouped.map((group) => {
            if (group.items.length === 0) return null;
            const isNonApp = group.key === 'non_applicable';

            return (
              <section key={group.key}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between mb-3"
                  onClick={() => isNonApp && setCollapseNonApp((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className={`w-4 h-4 ${group.iconColor}`} />
                    <h2 className="text-white font-bold text-[15px]">{group.label}</h2>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${group.badgeBg}`}>
                      {group.items.length}
                    </span>
                  </div>
                  {isNonApp && (collapseNonApp ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />)}
                </button>

                {(!isNonApp || !collapseNonApp) && (
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <RegistreCard key={item.id} item={item} config={group} onFiche={setFicheItem} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Fiche PDF modal ── */}
      {ficheItem && (
        <div className="fixed inset-0 z-[9999] bg-white overflow-auto">
          {/* Toolbar */}
          <div
            className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }}
          >
            <p className="text-sm font-semibold text-slate-700 truncate min-w-0">
              Fiche — {ficheItem.installation}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Exporter en PDF
              </button>
              <button
                onClick={() => setFicheItem(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Fermer
              </button>
            </div>
          </div>
          {/* Document */}
          <div className="p-6">
            <FicheVerification item={ficheItem} entreprise={entreprise} />
          </div>
        </div>
      )}
    </div>
  );
}
