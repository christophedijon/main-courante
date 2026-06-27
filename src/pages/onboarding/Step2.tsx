import { useState } from 'react';
import { User, Mail, Loader2, ChevronLeft, ChevronRight, Info, Building2 } from 'lucide-react';
import type { OnboardingData } from './types';
import { TYPE_ERP_LABELS, PLAN_INFO } from './types';

interface Props {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: (patch: Partial<OnboardingData>) => void;
  onBack: () => void;
  saving: boolean;
  etabId: string;
  createDirectionUser: (etabId: string, email: string, prenom: string, nom: string, telephone: string) => Promise<{ managed_id: string; auth_user_id: string } | null>;
}

export default function Step2({ data, onChange, onNext, onBack, saving, etabId, createDirectionUser }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const alreadyCreated = !!data.direction_user_id;

  function validate() {
    const e: Record<string, string> = {};
    if (!data.direction_prenom.trim()) e.direction_prenom = 'Prénom requis';
    if (!data.direction_nom.trim()) e.direction_nom = 'Nom requis';
    if (!data.direction_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.direction_email)) {
      e.direction_email = 'Email valide requis';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleNext() {
    if (!validate()) return;

    if (alreadyCreated) {
      onNext({});
      return;
    }

    const result = await createDirectionUser(
      etabId,
      data.direction_email,
      data.direction_prenom,
      data.direction_nom,
      data.direction_telephone,
    );
    if (!result) return;

    onNext({
      direction_user_id: result.auth_user_id,
      direction_managed_id: result.managed_id,
    });
  }

  const field = (
    key: keyof OnboardingData,
    label: string,
    type = 'text',
    placeholder = '',
    required = true,
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={data[key] as string}
        onChange={e => onChange({ [key]: e.target.value } as Partial<OnboardingData>)}
        placeholder={placeholder}
        disabled={alreadyCreated}
        className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${errors[key] ? 'border-red-500' : 'border-slate-700'}`}
      />
      {errors[key] && <p className="mt-1 text-xs text-red-400">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <User className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Compte Direction</h2>
          <p className="text-sm text-slate-400">Le responsable recevra un email d'invitation</p>
        </div>
      </div>

      {/* Context recap from previous steps */}
      {(data.nom || data.type_erp || data.plan) && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-xl">
          <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
          {data.nom && <span className="text-sm font-medium text-slate-200">{data.nom}</span>}
          {data.type_erp && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
              {TYPE_ERP_LABELS[data.type_erp] ?? `Type ${data.type_erp}`}
            </span>
          )}
          {data.plan && (
            <span className={`text-xs font-semibold ${PLAN_INFO[data.plan]?.color ?? 'text-slate-300'}`}>
              {PLAN_INFO[data.plan]?.label ?? data.plan}
            </span>
          )}
        </div>
      )}

      {alreadyCreated && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-sm text-emerald-400">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Compte créé — invitation envoyée à <strong>{data.direction_email}</strong>. Vous pouvez modifier les informations ci-dessous.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('direction_prenom', 'Prénom', 'text', 'Jean')}
        {field('direction_nom', 'Nom', 'text', 'Dupont')}
        <div className="sm:col-span-2">
          {field('direction_email', 'Email', 'email', 'direction@etablissement.fr')}
        </div>
        {field('direction_telephone', 'Téléphone', 'tel', '06 00 00 00 00', false)}
      </div>

      <div className="flex items-start gap-2 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
        <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-400">
          Un email d'invitation avec un lien de connexion sera automatiquement envoyé à l'adresse renseignée.
          Le responsable définira son mot de passe à la première connexion.
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Création en cours…</>
          ) : (
            <><ChevronRight className="w-4 h-4" />{alreadyCreated ? 'Continuer' : "Envoyer l'invitation"}</>
          )}
        </button>
      </div>
    </div>
  );
}
