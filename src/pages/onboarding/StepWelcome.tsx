import { FileText, FolderOpen, Building2, Clock, Loader2 } from 'lucide-react';

interface Props {
  onStart: () => Promise<void>;
  onLeave: () => void;
  saving: boolean;
}

const CHECKLIST = [
  {
    icon: FileText,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    label: 'Dernier avis de commission de sécurité',
    detail: 'Pour vérifier vos obligations réglementaires ERP',
  },
  {
    icon: FolderOpen,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    label: 'Registre de sécurité (ou références principales)',
    detail: 'Vérificateurs, dates de dernières visites',
  },
  {
    icon: Building2,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    label: 'Coordonnées administratives de votre société',
    detail: 'SIRET, adresse, capacité d\'accueil',
  },
];

export default function StepWelcome({ onStart, onLeave, saving }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {/* Hexagonal glow */}
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-500/40 flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <img src="/flamme.png" alt="Main Courante" className="w-10 h-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
              <span className="absolute text-2xl font-black text-white select-none" style={{ fontFamily: 'monospace', display:'none' }}>MC</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-3">
            Bienvenue dans Main Courante&nbsp;!
          </h1>
          <p className="text-slate-400 leading-relaxed">
            Nous allons vous accompagner dans la configuration de votre établissement.
            Comptez environ <span className="text-white font-medium">5 à 10 minutes</span>.
          </p>
        </div>

        {/* Checklist */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Pour aller au plus vite, ayez sous la main :
          </p>
          <div className="space-y-3">
            {CHECKLIST.map(({ icon: Icon, color, bg, label, detail }) => (
              <div key={label} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${bg} border flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-save note */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl mb-8">
          <Clock className="w-4 h-4 text-slate-500 shrink-0" />
          <p className="text-xs text-slate-500">
            Vous pouvez interrompre à tout moment et reprendre plus tard — votre progression est sauvegardée automatiquement.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onStart}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Chargement…</>
            ) : (
              'Commencer la configuration'
            )}
          </button>
          <button
            onClick={onLeave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-xl text-sm transition-all"
          >
            Je reviens plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
