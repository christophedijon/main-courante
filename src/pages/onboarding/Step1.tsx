import { useState } from 'react';
import { Building2, Zap, Music, Wine, PartyPopper, FlaskConical, Hotel } from 'lucide-react';
import type { OnboardingData } from './types';
import { TYPE_ERP_LABELS, PLAN_INFO } from './types';

interface Props {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: (patch: Partial<OnboardingData>) => void;
  saving: boolean;
}

const ERP_CODES = ['N', 'P', 'L', 'O'] as const;

const ERP_DESCRIPTIONS: Record<string, { short: string; detail: string }> = {
  N: { short: 'Restaurant & boissons', detail: 'Bars, restaurants, cafés' },
  P: { short: 'Jeux et danse', detail: 'Discothèques, dancings, salles de jeux' },
  L: { short: 'Spectacle, cabaret', detail: 'Salles de spectacle, conférences, théâtre' },
  O: { short: 'Hôtels & hébergements', detail: 'Hôtels, gîtes, résidences' },
};

const TEMPLATES = [
  {
    icon: FlaskConical,
    label: 'Testeur',
    patch: { type_erp: 'N' as const, type_erp_secondaires: [] as string[], plan: 'testeur' as const, essai_duree_jours: 180 },
  },
  {
    icon: Music,
    label: 'Discothèque',
    patch: { type_erp: 'P' as const, type_erp_secondaires: ['N'] as string[], plan: 'light' as const, essai_duree_jours: 30 },
  },
  {
    icon: Wine,
    label: 'Bar de nuit',
    patch: { type_erp: 'N' as const, type_erp_secondaires: ['P'] as string[], plan: 'light' as const, essai_duree_jours: 30 },
  },
  {
    icon: PartyPopper,
    label: 'Salle événementielle',
    patch: { type_erp: 'L' as const, type_erp_secondaires: [] as string[], plan: 'light' as const, essai_duree_jours: 30 },
  },
  {
    icon: Hotel,
    label: 'Hôtel',
    patch: { type_erp: 'O' as const, type_erp_secondaires: ['N', 'L'] as string[], plan: 'light' as const, essai_duree_jours: 30 },
  },
];

export default function Step1({ data, onChange, onNext, saving }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const secondaires = data.type_erp_secondaires ?? [];

  function toggleSecondaire(code: string) {
    const current = secondaires.filter(c => c !== data.type_erp);
    if (current.includes(code)) {
      onChange({ type_erp_secondaires: current.filter(c => c !== code) });
    } else if (current.length < 3) {
      onChange({ type_erp_secondaires: [...current, code] });
    }
  }

  function selectPrincipal(code: typeof ERP_CODES[number]) {
    onChange({
      type_erp: code,
      type_erp_secondaires: secondaires.filter(c => c !== code),
    });
  }

  function getErpCode(): string {
    if (!data.type_erp) return '';
    const parts = [data.type_erp, ...secondaires.filter(c => c !== data.type_erp)];
    return parts.join(', ');
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!data.nom.trim()) e.nom = 'Nom requis';
    if (!data.siret.trim() || data.siret.replace(/\s/g, '').length !== 14) e.siret = 'SIRET invalide (14 chiffres)';
    if (!data.type_erp) e.type_erp = 'Code ERP principal requis';
    if (!data.effectif_public) e.effectif_public = 'Effectif requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (validate()) onNext({});
  }

  const availableSecondaires = ERP_CODES.filter(c => c !== data.type_erp);
  const erpCode = getErpCode();

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
      </div>

      {/* Type ERP */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Code ERP <span className="text-red-400">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-3">Sélectionnez le code principal, puis les codes secondaires si applicable.</p>

        {/* Principal — radio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {ERP_CODES.map(code => {
            const active = data.type_erp === code;
            const desc = ERP_DESCRIPTIONS[code];
            return (
              <button
                key={code}
                type="button"
                onClick={() => selectPrincipal(code)}
                className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  active ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                }`}>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-blue-400 text-sm">{code}</span>
                    <span className="text-white text-sm">{desc.short}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc.detail}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Secondaires — checkboxes (only visible if principal selected) */}
        {data.type_erp && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400 mb-3">Codes secondaires <span className="text-slate-600">(optionnel)</span></p>
            <div className="flex flex-wrap gap-2">
              {availableSecondaires.map(code => {
                const checked = secondaires.includes(code);
                const desc = ERP_DESCRIPTIONS[code];
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleSecondaire(code)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      checked
                        ? 'border-blue-500/50 bg-blue-500/10 text-white'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      checked ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10.28 2.28L4 8.56 1.72 6.28a1 1 0 00-1.44 1.44l3 3a1 1 0 001.44 0l7-7a1 1 0 00-1.44-1.44z" />
                        </svg>
                      )}
                    </div>
                    <span className="font-semibold text-blue-400">{code}</span>
                    <span>{desc.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        {erpCode && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl">
            <span className="text-xs text-slate-500">Code ERP complet :</span>
            <span className="font-mono font-semibold text-blue-300 text-sm tracking-wider">{erpCode}</span>
          </div>
        )}

        {errors.type_erp && <p className="mt-1 text-xs text-red-400">{errors.type_erp}</p>}
      </div>

      {/* Plan */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Plan tarifaire <span className="text-red-400">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          {(['testeur', 'light', 'base', 'premium'] as const).map(p => {
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
                {p === 'testeur' && <div className="text-xs text-slate-500 mt-1">Accès complet — validation</div>}
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