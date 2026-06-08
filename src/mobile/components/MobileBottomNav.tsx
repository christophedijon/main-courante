import { NavLink } from 'react-router-dom';
import { Home, Briefcase, Clock, Search, User, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUnsignedDocs } from '../hooks/useUnsignedDocs';

const baseTabs = [
  { to: '/mobile',            label: 'Accueil',        Icon: Home,        end: true  },
  { to: '/mobile/outils',     label: 'Boîte à outils', Icon: Briefcase,   end: false },
  { to: '/mobile/historique', label: 'Historique',     Icon: Clock,       end: false },
  { to: '/mobile/recherche',  label: 'Recherche',      Icon: Search,      end: false },
  { to: '/mobile/profil',     label: 'Profil',         Icon: User,        end: false },
];

export default function MobileBottomNav() {
  const { hasAdminAccess } = useAuth();
  const { unsignedCount } = useUnsignedDocs();

  const tabs = hasAdminAccess
    ? [...baseTabs, { to: '/mobile/admin', label: 'Admin', Icon: Settings, end: false }]
    : baseTabs;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] font-exo"
      style={{
        background: 'rgba(13,17,23,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <div className="max-w-xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ to, label, Icon, end }) => {
          const isOutils = to === '/mobile/outils';
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 py-3 px-1 transition-all duration-150
                 ${isActive ? 'text-[#3b8fe8]' : 'text-slate-600 hover:text-slate-400'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#3b8fe8]" />
                  )}
                  <span className="relative">
                    <Icon className={`w-[22px] h-[22px] transition-all ${isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                    {isOutils && unsignedCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 rounded-full bg-[#e84040] text-white text-[9px] font-bold flex items-center justify-center shadow-lg shadow-red-900/50 leading-none">
                        {unsignedCount > 9 ? '9+' : unsignedCount}
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] leading-tight tracking-wide text-center transition-all ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
