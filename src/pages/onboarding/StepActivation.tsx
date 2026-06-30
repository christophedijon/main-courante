import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Zap, Building2, MapPin, Tag, Music, Wine, PartyPopper } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  etabId: string;
  saving: boolean;
  activated: boolean;
  onActivate: () => Promise<void>;
}

type EtabStats = {
  nom: string | null;
  nb_espaces: number;
  nb_motifs: number;
} | null;

const POSTE_TEMPLATES = [
  { key: 'discotheque' as const, icon: Music,       label: 'Discothèque',          count: 6, color: 'text-violet-400', border: 'border-violet-500/30 hover:border-violet-500/60 bg-violet-500/5' },
  { key: 'bar'         as const, icon: Wine,        label: 'Bar de nuit',           count: 4, color: 'text-blue-400',   border: 'border-blue-500/30 hover:border-blue-500/60 bg-blue-500/5'     },
  { key: 'salle'       as const, icon: PartyPopper, label: 'Salle événementielle',  count: 5, color: 'text-amber-400',  border: 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5'   },
];

import { TEMPLATES_POSTES } from './types';

export default function StepActivation({ etabId, saving, activated, onActivate }: Props) {
  const [stats, setStats] = useState<EtabStats>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [templatesDone, setTemplatesDone] = useState(false);

  // Load quick stats on mount
  useEffect(() => {
    (async () => {
      const [etabRes, espacesRes, motifsRes] = await Promise.all([
        supabase.from('etablissements').select('nom').eq('id', etabId).maybeSingle(),
        supabase.from('espaces').select('id', { count: 'exact', head: true }).eq('etablissement_id', etabId),
        supabase.from('motifs').select('id', { count: 'exact', head: true }).eq('etablissement_id', etabId),
      ]);
      setStats({
        nom: etabRes.data?.nom ?? null,
        nb_espaces: espacesRes.count ?? 0,
        nb_motifs: motifsRes.count ?? 0,
      });
      setStatsLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etabId]);

  async function handleLoadTemplate(t: keyof typeof TEMPLATES_POSTES) {
    setLoadingTemplate(t);
    const postes = TEMPLATES_POSTES[t];
    await supabase.from('postes').insert(
      postes.map(p => ({ ...p, actif: true, etablissement_id: etabId }))
    );
    setLoadingTemplate(null);
    setTemplatesDone(true);
  }

  if (activated) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {stats?.nom ? `${stats.nom} activé !` : 'Établissement activé !'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">Configuration terminée avec succès.</p>
          </div>
        </div>

        {!templatesDone && (
          <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-white mb-1">Charger un template de postes ?</h3>
            <p className="text-xs text-slate-400 mb-4">
              Démarrez avec des postes préconfigurés selon le type d'établissement.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {POSTE_TEMPLATES.map(({ key, icon: Icon, label, count, color, border }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleLoadTemplate(key)}
                  disabled={!!loadingTemplate}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${border} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loadingTemplate === key ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  ) : (
                    <Icon className={`w-5 h-5 ${color}`} />
                  )}
                  <span className="text-sm font-medium text-white">{label}</span>
                  <span className="text-xs text-slate-500">{count} postes</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTemplatesDone(true)}
              className="mt-3 text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Ignorer — je configurerai les postes manuellement
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Étape 4/4</p>
          <h2 className="text-lg font-semibold text-white">Activation</h2>
          <p className="text-sm text-slate-400">Vérifiez le récapitulatif avant d'activer</p>
        </div>
      </div>

      {statsLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement du récapitulatif…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard icon={Building2} color="text-blue-400" bg="bg-blue-500/10 border-blue-500/20"
            label="Établissement" value={stats?.nom ?? '—'} />
          <StatCard icon={MapPin} color="text-emerald-400" bg="bg-emerald-500/10 border-emerald-500/20"
            label="Espaces" value={`${stats?.nb_espaces ?? 0} configuré(s)`} />
          <StatCard icon={Tag} color="text-amber-400" bg="bg-amber-500/10 border-amber-500/20"
            label="Motifs" value={`${stats?.nb_motifs ?? 0} configuré(s)`} />
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-sm text-slate-400">
        En activant, votre établissement sera opérationnel et accessible à votre équipe.
        Les vérificateurs, organismes et intégrations matérielles pourront être configurés
        ultérieurement dans les paramètres.
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onActivate}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {saving ? 'Activation en cours…' : 'Activer mon établissement'}
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, color, bg, label, value }: {
  icon: React.ElementType; color: string; bg: string; label: string; value: string;
}) {
  return (
    <div className={`bg-slate-800/40 border rounded-xl p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
      <p className="text-white font-semibold text-sm">{value}</p>
    </div>
  );
}
