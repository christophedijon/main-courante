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
          {/* Octagon avatar */}
          <div className="shrink-0 relative w-14 h-14 flex items-center justify-center">
            <svg viewBox="0 0 56 56" className="absolute inset-0 w-full h-full">
              <polygon
                points="16,2 40,2 54,16 54,40 40,54 16,54 2,40 2,16"
                fill="rgba(30,64,175,0.18)"
                stroke="rgba(96,165,250,0.4)"
                strokeWidth="1.5"
              />
            </svg>
            <Shield className="w-6 h-6 text-blue-400 relative z-10" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-500 text-[11px] leading-tight tracking-[0.12em] uppercase font-medium">Bonjour</p>
            <p className="text-white font-bold text-[17px] leading-tight truncate mt-0.5">{fullName}</p>
          </div>
          <RoleBadge fonction={userFonction} isSuperAdmin={isSuperAdmin} />
        </div>

        {/* Logo/nom entreprise + stat card */}
        <div className="mt-5 flex items-stretch gap-3">
          <div className="flex-1 flex items-center gap-3 rounded-2xl px-4 py-3 min-h-[72px]"
            style={{ background: 'rgba(20,20,20,0.92)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {logo_url && (
              <img src={logo_url} alt={entrepriseNom ?? 'Logo'}
                className="h-11 w-auto max-w-[56px] object-contain rounded-lg shrink-0" />
            )}
            {entrepriseNom && (
              <p className="text-white text-sm font-bold leading-tight">{entrepriseNom}</p>
            )}
            {!logo_url && !entrepriseNom && (
              <Shield className="w-8 h-8 text-slate-700" />
            )}
          </div>

          <div className="flex flex-col justify-center min-w-[130px] rounded-2xl px-4 py-3 min-h-[72px]"
            style={{ background: 'rgba(20,20,20,0.92)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] tracking-wide">Aujourd'hui</span>
            </div>
            <p className="text-white font-black text-4xl mt-0.5 leading-none">{todayCount}</p>
          </div>
        </div>
      </div>

      {/* Saisie rapide */}
      <div className="px-5 pt-1 pb-8">
        <button
          type="button"
          onClick={() => setSaisieOpen((v) => !v)}
          className="w-full flex items-center justify-between mb-6 px-1"
        >
          <span className="text-[11px] font-bold text-slate-400 tracking-[0.2em] uppercase">Saisie rapide</span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${saisieOpen ? 'rotate-180' : ''}`} />
        </button>
        {saisieOpen && (
          <div className="flex items-start justify-center gap-4" style={{ paddingTop: 8, paddingBottom: 16 }}>
            {/* SSI — plus haut (décalé vers le haut) */}
            <QuickActionCard
              variant="ssi"
              title="SSI"
              subtitle="Sécurité Incendie"
              Icon={Flame}
              onClick={() => start('ssi')}
              offsetTop={0}
            />
            {/* Gestion client — décalé vers le bas */}
            <QuickActionCard
              variant="personnes"
              title="Gestion client"
              subtitle="Sécurité des personnes"
              Icon={Users}
              onClick={() => start('securite_personnes')}
              offsetTop={48}
            />
          </div>
        )}
      </div>
    </div>
  );
}
