import { Flame, Radio, Sparkles, Shield, FileText } from 'lucide-react';

const TOOLS = [
  { Icon: Shield,    title: 'Ronde',          desc: 'Suivi de ronde',      accent: 'blue' },
  { Icon: Flame,     title: 'Consignes SSI',  desc: 'Évacuation, alarmes', accent: 'red' },
  { Icon: FileText,  title: 'Procédure',      desc: 'Fiches',              accent: 'slate' },
  { Icon: Radio,     title: 'Radio',          desc: 'Codes & phonétique',  accent: 'teal' },
] as const;

const colorMap: Record<string, { wrap: string; icon: string }> = {
  blue:  { wrap: 'bg-blue-500/15 border-blue-500/30',   icon: 'text-blue-400' },
  red:   { wrap: 'bg-red-500/15 border-red-500/30',     icon: 'text-red-400' },
  slate: { wrap: 'bg-slate-600/25 border-slate-500/30', icon: 'text-slate-300' },
  teal:  { wrap: 'bg-teal-500/15 border-teal-500/30',   icon: 'text-teal-400' },
};

export default function ToolboxPage() {
  return (
    <div>
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-white text-2xl font-bold">Boîte à outils</h1>
        <p className="text-slate-500 text-sm">Procédures & aide IA terrain</p>
      </div>

      {/* IA banner */}
      <div className="mx-5 rounded-2xl bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border border-blue-500/30 p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-500/30 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-blue-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[15px]">Assistant IA</p>
          <p className="text-blue-200/80 text-xs">Bientôt disponible : posez vos questions terrain</p>
        </div>
      </div>

      <div className="px-5 py-5 grid grid-cols-2 gap-3">
        {TOOLS.map(({ Icon, title, desc, accent }) => {
          const c = colorMap[accent];
          return (
            <button
              key={title}
              type="button"
              className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 transition-all active:scale-[0.98] min-h-[128px] flex flex-col"
            >
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-3 ${c.wrap}`}>
                <Icon className={`w-5 h-5 ${c.icon}`} strokeWidth={2.3} />
              </div>
              <p className="text-white font-semibold text-[14px] leading-tight">{title}</p>
              <p className="text-slate-500 text-[11px] mt-0.5">{desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
