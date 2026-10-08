import { useNavigate } from 'react-router-dom';
import { Zap, Sparkles, FileText, BookOpen, PenLine } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import EntrepriseBadge from '../components/EntrepriseBadge';

const colorMap: Record<string, { wrap: string; icon: string }> = {
  blue:  { wrap: 'bg-blue-500/15 border-blue-500/30',   icon: 'text-blue-400' },
  cyan:  { wrap: 'bg-cyan-500/15 border-cyan-500/30',   icon: 'text-cyan-400' },
  amber: { wrap: 'bg-amber-500/15 border-amber-500/30', icon: 'text-amber-400' },
  teal:  { wrap: 'bg-teal-500/15 border-teal-500/30',   icon: 'text-teal-400' },
  red:   { wrap: 'bg-red-500/15 border-red-500/30',     icon: 'text-red-400' },
};

type HistoryCard = {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent: 'blue' | 'cyan' | 'amber' | 'teal' | 'red';
  route: string;
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const { isDirection, isChefDePoste, isSuperAdmin } = useAuth();
  const canSeeRapports = isDirection || isChefDePoste || isSuperAdmin;
  const canSeeRegistre = isDirection || isChefDePoste || isSuperAdmin;
  const canSeeSignatures = isDirection || isChefDePoste;

  const cards: HistoryCard[] = [
    { Icon: Zap,       title: 'Événements',     desc: 'Tous les événements enregistrés',       accent: 'blue',  route: '/mobile/historique/evenements' },
    { Icon: Sparkles,  title: 'Historique IA',  desc: 'Conversations avec l\'assistant',        accent: 'cyan',  route: '/mobile/historique/ia' },
    ...(canSeeRapports   ? [{ Icon: FileText, title: 'Rapports',   desc: 'Rapports de soirée',                  accent: 'teal'  as const, route: '/mobile/historique/rapports' }]   : []),
    ...(canSeeRegistre   ? [{ Icon: BookOpen, title: 'Registre',   desc: 'Historique des vérifications',        accent: 'amber' as const, route: '/mobile/historique/registre' }]   : []),
    ...(canSeeSignatures ? [{ Icon: PenLine,  title: 'Signatures', desc: 'Suivi des documents signés',          accent: 'red'   as const, route: '/mobile/historique/signatures' }] : []),
  ];

  return (
    <div>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-2xl font-bold truncate">Historique</h1>
            <p className="text-slate-500 text-sm">Consultez les archives</p>
          </div>
          <EntrepriseBadge />
        </div>
      </div>

      <div className="px-5 py-5 grid grid-cols-2 gap-3">
        {cards.map(({ Icon, title, desc, accent, route }) => {
          const c = colorMap[accent];
          return (
            <button
              key={title}
              type="button"
              onClick={() => navigate(route)}
              className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 transition-all active:scale-[0.98] min-h-[128px] flex flex-col"
            >
              <div className="relative w-fit mb-3">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${c.wrap}`}>
                  <Icon className={`w-5 h-5 ${c.icon}`} strokeWidth={2.3} />
                </div>
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
