import { NavLink } from 'react-router-dom';
import { Home, ShieldAlert, Clock, Search, User, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const baseTabs = [
  { to: '/mobile',            label: 'Accueil',       Icon: Home,         end: true  },
  { to: '/mobile/outils',     label: 'Boite à Outils', Icon: ShieldAlert, end: false },
  { to: '/mobile/historique', label: 'Historique',    Icon: Clock,        end: false },
  { to: '/mobile/recherche',  label: 'Recherche',     Icon: Search,       end: false },
  { to: '/mobile/profil',     label: 'Profil',        Icon: User,         end: false },
];

export default function MobileBottomNav() {
  const { hasAdminAccess } = useAuth();
  const tabs = hasAdminAccess
    ? [...baseTabs, { to: '/mobile/admin', label: 'Admin', Icon: Settings, end: false }]
    : baseTabs;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur
        border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-colors
               ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-blue-400" />
                )}
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : ''}`} />
                <span className={`text-[10.5px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
