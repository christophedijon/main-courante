import { Cpu, Wifi, Radio, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { OnboardingData } from './types';

interface Props {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: (patch: Partial<OnboardingData>) => void;
  onBack: () => void;
  saving: boolean;
}

export default function Step5({ data, onChange, onNext, onBack, saving }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Matériel & Intégrations</h2>
          <p className="text-sm text-slate-400">Toutes les intégrations sont optionnelles</p>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50 mb-2">
        <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-400">Ces intégrations peuvent être activées ou configurées plus tard dans les paramètres de l'établissement.</p>
      </div>

      {/* Flic Hub */}
      <IntegrationCard
        icon={Wifi}
        iconColor="text-blue-400"
        iconBg="bg-blue-500/10 border-blue-500/20"
        title="Flic Hub"
        description="Connexion aux boutons Flic pour déclenchements d'alertes matérielles"
        enabled={data.flic_hub_enabled}
        onToggle={v => onChange({ flic_hub_enabled: v })}
      >
        {data.flic_hub_enabled && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Adresse MAC du Flic Hub</label>
            <input
              value={data.flic_hub_mac}
              onChange={e => onChange({ flic_hub_mac: e.target.value })}
              placeholder="90:88:a9:5b:10:fb"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </IntegrationCard>

      {/* ZAPSIS */}
      <IntegrationCard
        icon={Radio}
        iconColor="text-emerald-400"
        iconBg="bg-emerald-500/10 border-emerald-500/20"
        title="ZAPSIS"
        description="Synchronisation de la jauge d'entrées via l'API ZAPSIS billetterie"
        enabled={data.zapsis_enabled}
        onToggle={v => onChange({ zapsis_enabled: v })}
      >
        {data.zapsis_enabled && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Clé API ZAPSIS</label>
            <input
              value={data.zapsis_api_key}
              onChange={e => onChange({ zapsis_api_key: e.target.value })}
              placeholder="sk-zapsis-..."
              type="password"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </IntegrationCard>

      {/* BLE Rondes */}
      <IntegrationCard
        icon={Cpu}
        iconColor="text-violet-400"
        iconBg="bg-violet-500/10 border-violet-500/20"
        title="Balises BLE — Rondes"
        description="Balises Bluetooth pour traçage des rondes de sécurité"
        enabled={data.ble_rondes_enabled}
        onToggle={v => onChange({ ble_rondes_enabled: v })}
      >
        {data.ble_rondes_enabled && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nombre de balises</label>
            <input
              type="number"
              min={1}
              value={data.ble_rondes_nombre}
              onChange={e => onChange({ ble_rondes_nombre: e.target.value ? parseInt(e.target.value) : '' })}
              placeholder="10"
              className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </IntegrationCard>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-all">
          <ChevronLeft className="w-4 h-4" />Retour
        </button>
        <button onClick={() => onNext({})} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all">
          <ChevronRight className="w-4 h-4" />Récapitulatif
        </button>
      </div>
    </div>
  );
}

interface CardProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}

function IntegrationCard({ icon: Icon, iconColor, iconBg, title, description, enabled, onToggle, children }: CardProps) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${enabled ? 'border-slate-600 bg-slate-800/60' : 'border-slate-700/50 bg-slate-800/20'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${iconBg} border flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{title}</div>
            <div className="text-xs text-slate-400">{description}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-blue-500' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      {children && <div className="mt-4 pt-4 border-t border-slate-700">{children}</div>}
    </div>
  );
}
