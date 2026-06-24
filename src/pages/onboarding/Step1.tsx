import { useState } from 'react';
import { Building2, Zap, Music, Wine, PartyPopper } from 'lucide-react';
import type { OnboardingData } from './types';
import { TYPE_ERP_LABELS, PLAN_INFO } from './types';

interface Props {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: (patch: Partial<OnboardingData>) => void;
  saving: boolean;
}

const TEMPLATES = [
  { icon: Music, label: 'Discothèque', patch: { type_erp: 'N' as const, plan: 'light' as const, essai_duree_jours: 30 } },
  { icon: Wine, label: 'Bar de nuit', patch: { type_erp: 'P' as const, plan: 'light' as const, essai_duree_jours: 30 } },
  { icon: PartyPopper, label: 'Salle événementielle', patch: { type_erp: 'L' as const, plan: 'light' as const, essai_duree_jours: 30 } },
];

export default function Step1({ data, onChange, onNext, saving }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!data.nom.trim()) e.nom = 'Nom requis';
    if (!data.siret.trim() || data.siret.replace(/\s/g, '').length !== 14) e.siret = 'SIRET invalide (14 chiffres)';
    if (!data.type_erp) e.type_erp = 'Type ERP requis';
    if (!data.effectif_public) e.effectif_public = 'Effectif requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (validate()) onNext({});
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Établissement</h2>
          <p className="text-sm text-slate-400">Informations de base et plan tarifaire</p>
        </div>
      </div>

      {/* Quick templates */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Démarrage rapide</p>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATES.map(({ icon: Icon, label, patch }) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(patch)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-sm text-slate-300 transition-all"
            >
              <Icon className="w-3.5 h-3.5 text-slate-400" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nom */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom de l'établissement <span className="text-red-400">*</span></label>
          <input
            value={data.nom}
            onChange={e => onChange({ nom: e.target.value })}
            placeholder="Le Club Noir"
            className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.nom ? 'border-red-500' : 'border-slate-700'}`}
          />
          {errors.nom && <p className="mt-1 text-xs text-red-400">{errors.nom}</p>}
        </div>

        {/* SIRET */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">SIRET <span className="text-red-400">*</span></label>
          <input
            value={data.siret}
            onChange={e => onChange({ siret: e.target.value.replace(/\D/g, '').slice(0, 14) })}
            placeholder="12345678901234"
            maxLength={14}
            className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.siret ? 'border-red-500' : 'border-slate-700'}`}
          />
          {errors.siret && <p className="mt-1 text-xs text-red-400">{errors.siret}</p>}
        </div>

        {/* Effectif public */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Effectif public max <span className="text-red-400">*</span></label>
          <input
            type="number"
            min={1}
            value={data.effectif_public}
            onChange={e => onChange({ effectif_public: e.target.value ? parseInt(e.target.value) : '' })}
            placeholder="886"
            className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.effectif_public ? 'border-red-500' : 'border-slate-700'}`}
          />
          {errors.effectif_public && <p className="mt-1 text-xs text-red-400">{errors.effectif_public}</p>}
        </div>

        {/* Type ERP */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Type ERP <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['N', 'P', 'L'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ type_erp: t })}
                className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${data.type_erp === t ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'}`}
              >
                <span className="font-semibold text-blue-400">{t}</span>
                <span className="ml-2 text-xs text-slate-400">{TYPE_ERP_LABELS[t].split('—')[1]?.trim()}</span>
              </button>
            ))}
          </div>
          {errors.type_erp && <p className="mt-1 text-xs text-red-400">{errors.type_erp}</p>}
        </div>
      </div>

      {/* Plan */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Plan tarifaire <span className="text-red-400">*</span></label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['light', 'base', 'premium'] as const).map(p => {
            const info = PLAN_INFO[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ plan: p })}
                className={`p-4 rounded-xl border text-left transition-all ${data.plan === p ? info.border : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
              >
                <div className={`font-semibold ${info.color}`}>{info.label}</div>
                <div className="text-sm text-slate-400 mt-0.5">{info.price}</div>
                {p === 'light' && <div className="text-xs text-slate-500 mt-1">Essai gratuit</div>}
              </button>
            );
          })}
        </div>
      </div>

      {data.plan === 'light' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Durée de l'essai (jours)</label>
          <input
            type="number"
            min={7}
            max={90}
            value={data.essai_duree_jours}
            onChange={e => onChange({ essai_duree_jours: parseInt(e.target.value) || 30 })}
            className="w-32 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all"
        >
          <Zap className="w-4 h-4" />
          Étape suivante
        </button>
      </div>
    </div>
  );
}
