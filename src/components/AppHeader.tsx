import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Shield, LayoutDashboard, User, Building2, MapPin, Bot, ShieldAlert, Smartphone, FileText, PenLine, Menu, ClipboardList, BarChart2 } from 'lucide-react';
import { useEntreprise } from '../hooks/useEntreprise';
import { useAuth } from '../context/AuthContext';

interface Props {
  onSignOut: () => void;
}

export default function AppHeader({ onSignOut }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { nom, logo_url } = useEntreprise();
  const { isSuperAdmin, hasAdminAccess } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const allTabs = [
    { path: '/dashboard',           label: 'Utilisateurs',    icon: LayoutDashboard, superOnly: true,  adminOnly: false },
    { path: '/profile',             label: 'Mon Profil',      icon: User,            superOnly: false, adminOnly: false },
    { path: '/entreprise',          label: 'Entreprise',      icon: Building2,       superOnly: false, adminOnly: true  },
    { path: '/espaces-zones',       label: 'Espaces & Zones', icon: MapPin,          superOnly: false, adminOnly: true  },
    { path: '/motifs',              label: 'Motifs',          icon: ShieldAlert,     superOnly: false, adminOnly: true  },
    { path: '/documents',           label: 'Documents',       icon: FileText,        superOnly: false, adminOnly: true  },
    { path: '/postes',              label: 'Postes',          icon: MapPin,          superOnly: false, adminOnly: true  },
    { path: '/rapports',            label: 'Rapports',        icon: BarChart2,       superOnly: false, adminOnly: true  },
    { path: '/registre-securite',   label: 'Registre',        icon: ClipboardList,   superOnly: false, adminOnly: true  },
    { path: '/ia',                  label: 'IA',              icon: Bot,             superOnly: true,  adminOnly: false },
    { path: '/dashboard-signatures',label: 'Signatures',      icon: PenLine,         superOnly: false, adminOnly: true  },
  ];

  const tabs = allTabs.filter((t) => {
    if (t.superOnly && !isSuperAdmin) return false;
    if (t.adminOnly && !hasAdminAccess) return false;
    return true;
  });

  const superTabs = tabs.filter(t => t.superOnly);
  const generalTabs = tabs.filter(t => !t.superOnly);
  const activeLabel = tabs.find(t => t.path === pathname)?.label ?? '';

  const isImageLogo = logo_url && logo_url.match(/\.(png|jpe?g|gif|webp)$/i);

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <span className="font-bold text-white text-sm sm:text-base whitespace-nowrap">Main Courante</span>

          {(nom || isImageLogo) && (
            <>
              <div className="hidden sm:block h-4 w-px bg-slate-700 mx-1 shrink-0" />
              <div className="hidden sm:flex items-center gap-2 min-w-0">
                {isImageLogo && (
                  <img
                    src={logo_url!}
                    alt="Logo entreprise"
                    className="h-7 w-auto max-w-[80px] object-contain rounded"
                  />
                )}
                {nom && (
                  <span className="text-sm text-slate-300 font-medium truncate max-w-[180px]">{nom}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Hamburger menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-all
                ${menuOpen ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">Menu</span>
              {activeLabel && (
                <span className="hidden sm:inline text-slate-500 text-xs">— {activeLabel}</span>
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50">

                {/* Groupe superAdmin */}
                {isSuperAdmin && superTabs.length > 0 && (
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2 mb-1">
                      Administration
                    </p>
                    {superTabs.map(tab => {
                      const Icon = tab.icon;
                      const active = pathname === tab.path;
                      return (
                        <button
                          key={tab.path}
                          onClick={() => { navigate(tab.path); setMenuOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                            ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : ''}`} />
                          {tab.label}
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Séparateur */}
                {isSuperAdmin && generalTabs.length > 0 && (
                  <div className="mx-3 my-1 border-t border-slate-800" />
                )}

                {/* Groupe général */}
                {generalTabs.length > 0 && (
                  <div className="px-3 pb-3 pt-1">
                    {!isSuperAdmin && (
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2 mb-1 pt-2">
                        Navigation
                      </p>
                    )}
                    {generalTabs.map(tab => {
                      const Icon = tab.icon;
                      const active = pathname === tab.path;
                      return (
                        <button
                          key={tab.path}
                          onClick={() => { navigate(tab.path); setMenuOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                            ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : ''}`} />
                          {tab.label}
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {hasAdminAccess && (
            <button
              onClick={() => navigate('/mobile')}
              className="flex items-center gap-2 text-slate-400 hover:text-blue-400 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Version mobile</span>
            </button>
          )}
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
}
