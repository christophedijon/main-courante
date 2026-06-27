import { useState } from 'react';
import { Building2, Zap, Music, Wine, PartyPopper, FlaskConical, Hotel } from 'lucide-react';
import type { OnboardingData } from './types';

interface Props {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: (patch: Partial<OnboardingData>) => void;
  saving: boolean;
}

const TEMPLATES = [
  { icon: FlaskConical, label: 'Testeur',             patch: { type_erp: 'N' as const, type_erp_secondaires: [] as string[],       plan: 'testeur' as const, essai_duree_jours: 180 } },
  { icon: Music,        label: 'Discothèque',          patch: { type_erp: 'P' as const, type_erp_secondaires: ['N'] as string[],    plan: 'light'   as const, essai_duree_jours: 30  } },
  { icon: Wine,         label: 'Bar de nuit',          patch: { type_erp: 'N' as const, type_erp_secondaires: ['P'] as string[],    plan: 'light'   as const, essai_duree_jours: 30  } },
  { icon: PartyPopper,  label: 'Salle événementielle', patch: { type_erp: 'L' as const, type_erp_secondaires: [] as string[],       plan: 'light'   as const, essai_duree_jours: 30  } },
  { icon: Hotel,        label: 'Hôtel',                patch: { type_erp: 'O' as const, type_erp_secondaires: ['N', 'L'] as string[], plan: 'light' as const, essai_duree_jours: 30  } },
];

export default function StepCoordonnees({ data, onChange, onNext, saving }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!data.nom.trim()) e.nom = 'Nom requis';
    if (!data.siret.trim() || data.siret.replace(/\s/g, '').length !== 14) e.siret = 'SIRET invalide (14 chiffres)';
    if (!data.effectif_public) e.effectif_public = 'Effectif requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Coordonnées</h2>
          <p className="text-sm text-slate-400">Informations administratives de l'établissement</p>
        </div>
      </div>

      {/* Quick templates — pre-fill ERP + plan for subsequent steps */}
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
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Nom de l'établissement <span className="text-red-400">*</span>
          </label>
          <input
            value={data.nom}
            onChange={e => onChange({ nom: e.target.value })}
            placeholder="Le Club Noir"
            className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.nom ? 'border-red-500' : 'border-slate-700'}`}
          />
          {errors.nom && <p className="mt-1 text-xs text-red-400">{errors.nom}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            SIRET <span className="text-red-400">*</span>
          </label>
          <input
            value={data.siret}
            onChange={e => onChange({ siret: e.target.value.replace(/\D/g, '').slice(0, 14) })}
            placeholder="12345678901234"
            maxLength={14}
            className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.siret ? 'border-red-500' : 'border-slate-700'}`}
          />
          {errors.siret && <p className="mt-1 text-xs text-red-400">{errors.siret}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Effectif public max <span className="text-red-400">*</span>
          </label>
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
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => { if (validate()) onNext({}); }}
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
