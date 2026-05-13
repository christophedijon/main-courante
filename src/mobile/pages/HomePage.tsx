import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, Flame, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEntreprise } from '../../hooks/useEntreprise';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useTodayEventsCount } from '../hooks/useEvenements';
import { useSaisie } from '../saisie/SaisieContext';
import RoleBadge from '../components/RoleBadge';
import QuickActionCard from '../components/QuickActionCard';

export default function HomePage() {
  const navigate = useNavigate();
  const { userFonction, isSuperAdmin } = useAuth();
  const { profile } = useCurrentProfile();
  const { nom: entrepriseNom, logo_url } = useEntreprise();
  const todayCount = useTodayEventsCount() ?? 0;
  const { startType } = useSaisie();
  const [saisieOpen, setSaisieOpen] = useState(true);

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
    || profile?.email
    || 'Utilisateur';

  function start(type: 'ssi' | 'securite_personnes') {
    if (type === 'ssi') {
      startType('ssi');
      navigate('/mobile/saisie/ssi/ssi-zone');
      return;
    }
    startType(type);
    navigate(`/mobile/saisie/${type}/localisation`);
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="px-5 pt-8 pb-5">
        <div className="flex items-center gap-4">
          {/* Octagon avatar — style maquette */}
          <div className="shrink-0 relative flex items-center justify-center" style={{ width: 60, height: 60 }}>
            <svg viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="oct-grad" x1="0.3" y1="0" x2="0.7" y2="1">
                  <stop offset="0%" stopColor="#1a2035" />
                  <stop offset="100%" stopColor="#0a0e18" />
                </linearGradient>
                <linearGradient id="oct-rim" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stopColor="rgba(200,215,240,0.6)" />
                  <stop offset="55%" stopColor="rgba(100,120,180,0.3)" />
                  <stop offset="100%" stopColor="rgba(10,15,30,0.7)" />
                </linearGradient>
              </defs>
              <polygon
                points="17,2 43,2 58,17 58,43 43,58 17,58 2,43 2,17"
                fill="url(#oct-grad)"
                stroke="url(#oct-rim)"
                strokeWidth="2"
              />
            </svg>
            <Shield className="relative z-10" style={{ width: 26, height: 26, color: '#60a5fa', filter: 'drop-shadow(0 0 6px rgba(96,165,250,0.7))' }} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-500 text-[11px] leading-tight tracking-[0.12em] uppercase font-medium">Bonjour</p>
            <p className="text-white font-bold text-[17px] leading-tight truncate mt-0.5">{fullName}</p>
          </div>
          <RoleBadge fonction={userFonction} isSuperAdmin={isSuperAdmin} />
        </div>

        {/* Logo/nom entreprise + stat card */}
        <div className="mt-5 flex items-stretch gap-3">
          <div className="flex-1 flex items-center gap-3 rounded-2xl px-4 py-3 min-h-[76px]"
            style={{
              background: 'rgba(15,20,30,0.75)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
            {logo_url && (
              <img src={logo_url} alt={entrepriseNom ?? 'Logo'}
                className="h-12 w-auto max-w-[60px] object-contain rounded-xl shrink-0" />
            )}
            {entrepriseNom && (
              <p className="text-white text-[15px] font-bold leading-tight">{entrepriseNom}</p>
            )}
            {!logo_url && !entrepriseNom && (
              <Shield className="w-8 h-8 text-slate-600" />
            )}
          </div>

          <div className="flex flex-col justify-center min-w-[136px] rounded-2xl px-4 py-3 min-h-[76px]"
            style={{
              background: 'rgba(15,20,30,0.75)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
            <div className="flex items-center gap-1.5" style={{ color: 'rgba(180,190,210,0.7)' }}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] tracking-wide">Aujourd'hui</span>
            </div>
            <p className="text-white font-black text-4xl mt-1 leading-none">{todayCount}</p>
          </div>
        </div>
      </div>

      {/* Saisie rapide — fond graph_mc.png */}
      <div className="relative overflow-hidden" style={{ minHeight: 380 }}>
        {/* Background image for this section */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'url(/graph_mc.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }} />
        {/* Overlay to blend with rest of page */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(8,12,20,0.45)' }} />

        <div className="relative z-10 px-5 pt-5 pb-10">
          <button
            type="button"
            onClick={() => setSaisieOpen((v) => !v)}
            className="w-full flex items-center justify-between mb-6 px-1"
          >
            <span className="text-[11px] font-bold tracking-[0.22em] uppercase" style={{ color: 'rgba(200,210,230,0.85)' }}>Saisie rapide</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${saisieOpen ? 'rotate-180' : ''}`} style={{ color: 'rgba(180,190,210,0.6)' }} />
          </button>
          {saisieOpen && (
            <div className="flex items-start justify-center gap-5" style={{ paddingBottom: 8 }}>
              <QuickActionCard
                variant="ssi"
                title="SSI"
                subtitle="Sécurité Incendie"
                Icon={Flame}
                onClick={() => start('ssi')}
                offsetTop={0}
              />
              <QuickActionCard
                variant="personnes"
                title="Gestion client"
                subtitle="Sécurité des personnes"
                Icon={Users}
                onClick={() => start('securite_personnes')}
                offsetTop={52}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
