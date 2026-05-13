import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, Flame, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEntreprise } from '../../hooks/useEntreprise';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useTodayEventsCount } from '../hooks/useEvenements';
import { useSaisie } from '../saisie/SaisieContext';
import RoleBadge from '../components/RoleBadge';
import SectionLabel from '../components/SectionLabel';
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
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-blue-400" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[13px] leading-tight">Bonjour</p>
            <p className="text-white font-bold text-lg leading-tight truncate">{fullName}</p>
          </div>
          <RoleBadge fonction={userFonction} isSuperAdmin={isSuperAdmin} />
        </div>

        {/* Logo/nom entreprise + stat card côte à côte */}
        <div className="mt-4 flex items-center justify-between gap-3">
          {/* Logo + nom entreprise */}
          <div className="flex-1 flex items-center justify-start">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 min-h-[72px]">
              {logo_url && (
                <img
                  src={logo_url}
                  alt={entrepriseNom ?? 'Logo'}
                  className="h-12 w-auto max-w-[60px] object-contain rounded-lg shrink-0"
                />
              )}
              {entrepriseNom && (
                <p className="text-slate-200 text-sm font-bold leading-tight">{entrepriseNom}</p>
              )}
              {!logo_url && !entrepriseNom && (
                <Shield className="w-8 h-8 text-slate-600" />
              )}
            </div>
          </div>

          {/* Stat card réduite */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 min-w-[130px] min-h-[72px] flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px]">Aujourd'hui</span>
            </div>
            <p className="text-white font-extrabold text-3xl mt-1 leading-none">{todayCount}</p>
          </div>
        </div>
      </div>

      {/* Saisie rapide */}
      <div className="px-5 pt-2 pb-4">
        <button
          type="button"
          onClick={() => setSaisieOpen((v) => !v)}
          className="w-full flex items-center justify-between mb-3"
        >
          <SectionLabel>Saisie rapide</SectionLabel>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${saisieOpen ? 'rotate-180' : ''}`} />
        </button>
        {saisieOpen && (
          <div className="space-y-3">
            <QuickActionCard
              variant="ssi"
              title="SSI"
              subtitle="Sécurité Incendie"
              Icon={Flame}
              onClick={() => start('ssi')}
            />
            <QuickActionCard
              variant="personnes"
              title="Gestion client"
              subtitle="Sécurité des personnes"
              Icon={Users}
              onClick={() => start('securite_personnes')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
