import { useState } from 'react';
import {
  CheckCircle2, Loader2, ChevronLeft, Zap, Building2, User,
  LayoutGrid, ShieldCheck, Cpu, Music, Wine, PartyPopper
} from 'lucide-react';
import type { OnboardingData } from './types';
import { TYPE_ERP_LABELS, PLAN_INFO, CATEGORIE_LABELS } from './types';

interface Props {
  data: OnboardingData;
  etabId: string;
  onBack: () => void;
  saving: boolean;
  activated: boolean;
  onActivate: () => Promise<void>;
  onLoadTemplate: (t: 'discotheque' | 'bar' | 'salle') => Promise<void>;
}

const POSTE_TEMPLATES = [
  { key: 'discotheque' as const, icon: Music, label: 'Discothèque', count: 6, color: 'text-violet-400', border: 'border-violet-500/30 hover:border-violet-500/60 bg-violet-500/5' },
  { key: 'bar' as const, icon: Wine, label: 'Bar de nuit', count: 4, color: 'text-blue-400', border: 'border-blue-500/30 hover:border-blue-500/60 bg-blue-500/5' },
  { key: 'salle' as const, icon: PartyPopper, label: 'Salle événementielle', count: 5, color: 'text-amber-400', border: 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5' },
];

export default function Step6({ data, etabId: _etabId, onBack, saving, activated, onActivate, onLoadTemplate }: Props) {
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [templatesDone, setTemplatesDone] = useState(false);

  const planInfo = PLAN_INFO[data.plan];
  const finEssai = data.plan === 'light'
    ? new Date(Date.now() + data.essai_duree_jours * 86400000).toLocaleDateString('fr-FR')
    : null;

  async function handleLoadTemplate(t: 'discotheque' | 'bar' | 'salle') {
    setLoadingTemplate(t);
    await onLoadTemplate(t);
    setLoadingTemplate(null);
    setTemplatesDone(true);
  }

  if (activated) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{data.nom} activé !</h2>
            <p className="text-slate-400 text-sm mt-1">
              Plan <span className={`font-medium ${planInfo.color}`}>{planInfo.label}</span>
              {finEssai && ` — essai jusqu'au ${finEssai}`}
            </p>
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

        {templatesDone && (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400">Configuration terminée. L'établissement est maintenant actif.</p>
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
          <h2 className="text-lg font-semibold text-white">Récapitulatif & Activation</h2>
          <p className="text-sm text-slate-400">Vérifiez les informations avant d'activer</p>
        </div>
      </div>

      <div className="space-y-3">
        <RecapRow icon={Building2} color="text-blue-400" bg="bg-blue-500/10 border-blue-500/20">
          <RecapItem label="Établissement" value={data.nom} />
          <RecapItem label="SIRET" value={data.siret || '—'} />
          <RecapItem label="Type ERP" value={data.type_erp ? TYPE_ERP_LABELS[data.type_erp] : '—'} />
          <RecapItem label="Effectif max" value={data.effectif_public ? `${data.effectif_public} pers.` : '—'} />
          <RecapItem label="Plan" value={<span className={planInfo.color}>{planInfo.label} — {planInfo.price}{finEssai ? ` (jusqu'au ${finEssai})` : ''}</span>} />
        </RecapRow>

        <RecapRow icon={User} color="text-rose-400" bg="bg-rose-500/10 border-rose-500/20">
          <RecapItem label="Direction" value={`${data.direction_prenom} ${data.direction_nom}`} />
          <RecapItem label="Email" value={data.direction_email || '—'} />
          {data.direction_telephone && <RecapItem label="Tél." value={data.direction_telephone} />}
          <RecapItem
            label="Invitation"
            value={data.direction_user_id
              ? <span className="text-emerald-400">Envoyée ✓</span>
              : <span className="text-amber-400">Sera envoyée à l'activation</span>}
          />
        </RecapRow>

        <RecapRow icon={LayoutGrid} color="text-violet-400" bg="bg-violet-500/10 border-violet-500/20">
          <RecapItem label="Espaces" value={`${data.espaces.length} espace(s)`} />
          <RecapItem label="Zones" value={`${data.zones.length} zone(s)`} />
          <RecapItem label="Niveaux" value={`${data.niveaux.length} niveau(x)`} />
          {data.zones.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-1 mt-1">
              {data.zones.map((z, i) => (
                <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                  {z.nom} · {CATEGORIE_LABELS[z.categorie]}
                </span>
              ))}
            </div>
          )}
        </RecapRow>

        <RecapRow icon={ShieldCheck} color="text-amber-400" bg="bg-amber-500/10 border-amber-500/20">
          <RecapItem label="Organismes" value={`${data.verificateurs.length} vérificateur(s)`} />
        </RecapRow>

        <RecapRow icon={Cpu} color="text-cyan-400" bg="bg-cyan-500/10 border-cyan-500/20">
          <RecapItem label="Flic Hub" value={data.flic_hub_enabled ? `Activé${data.flic_hub_mac ? ` (${data.flic_hub_mac})` : ''}` : 'Non'} />
          <RecapItem label="ZAPSIS" value={data.zapsis_enabled ? 'Activé' : 'Non'} />
          <RecapItem label="BLE Rondes" value={data.ble_rondes_enabled ? `${data.ble_rondes_nombre || '?'} balises` : 'Non'} />
        </RecapRow>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-all">
          <ChevronLeft className="w-4 h-4" />Retour
        </button>
        <button
          onClick={onActivate}
          disabled={saving}
          className="flex items-center gap-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {saving ? 'Activation…' : 'Activer le client'}
        </button>
      </div>
    </div>
  );
}

function RecapRow({ icon: Icon, color, bg, children }: { icon: React.ElementType; color: string; bg: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-lg ${bg} border flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 flex-1">{children}</div>
      </div>
    </div>
  );
}

function RecapItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-[120px]">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}
