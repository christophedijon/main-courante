import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Shield, LayoutDashboard, User, Building2, MapPin, Bot, ShieldAlert, Smartphone, FileText } from 'lucide-react';
import { useEntreprise } from '../hooks/useEntreprise';
import { useAuth } from '../context/AuthContext';

interface Props {
  onSignOut: () => void;
}

export default function AppHeader({ onSignOut }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { nom, logo_url } = useEntreprise();
  const { isSuperAdmin, isDirection, hasAdminAccess } = useAuth();

  const allTabs = [
    { path: '/dashboard',     label: 'Utilisateurs',    icon: LayoutDashboard, superOnly: true,  adminOnly: false },
    { path: '/profile',       label: 'Mon Profil',      icon: User,            superOnly: false, adminOnly: false },
    { path: '/postes',        label: 'Postes',          icon: MapPin,          superOnly: false, adminOnly: true  },
    { path: '/entreprise',    label: 'Entreprise',      icon: Building2,       superOnly: true,  adminOnly: false },
    { path: '/espaces-zones', label: 'Espaces & Zones', icon: MapPin,          superOnly: true,  adminOnly: false },
    { path: '/ia',            label: 'IA',              icon: Bot,             superOnly: true,  adminOnly: false },
    { path: '/motifs',        label: 'Motifs',          icon: ShieldAlert,     superOnly: true,  adminOnly: false },
    { path: '/documents',     label: 'Documents',       icon: FileText,        superOnly: true,  adminOnly: false },
  ];

  const tabs = allTabs.filter((t) => {
    if (t.superOnly && !isSuperAdmin) return false;
    if (t.adminOnly && !hasAdminAccess) return false;
    return true;
  });

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

      {/* Nav tabs */}
      <div className="border-t border-slate-800 bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-11">
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            const active = pathname === tab.path;
            return (
              <div key={tab.path} className="flex items-center gap-1">
                {i > 0 && <div className="h-4 w-px bg-slate-700 mx-1" />}
                <button
                  onClick={() => !active && navigate(tab.path)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${active
                      ? 'text-white bg-slate-800 cursor-default'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-blue-400' : ''}`} />
                  {tab.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
