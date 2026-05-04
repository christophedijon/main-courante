import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, Flame, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEntreprise } from '../../hooks/useEntreprise';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useRecentEvents, useTodayEventsCount } from '../hooks/useEvenements';
import { useSaisie } from '../saisie/SaisieContext';
import RoleBadge from '../components/RoleBadge';
import SectionLabel from '../components/SectionLabel';
import QuickActionCard from '../components/QuickActionCard';
import EmptyState from '../components/EmptyState';
import EventCard from '../components/EventCard';

export default function HomePage() {
  const navigate = useNavigate();
  const { userFonction, isSuperAdmin } = useAuth();
  const { profile } = useCurrentProfile();
  const { nom: entrepriseNom } = useEntreprise();
  const { events } = useRecentEvents(4);
  const todayCount = useTodayEventsCount();
  const { startType } = useSaisie();
  const [saisieOpen, setSaisieOpen] = useState(true);
  const [recentsOpen, setRecentsOpen] = useState(true);

  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
    || profile.email
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

        {entrepriseNom && (
          <p className="text-slate-500 text-xs mt-3 pl-[60px]">{entrepriseNom}</p>
        )}

        {/* Stat card */}
        <div className="mt-5 rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>Événements aujourd'hui</span>
          </div>
          <p className="text-white font-extrabold text-4xl mt-1.5 leading-none">{todayCount}</p>
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

      {/* Récents */}
      <div className="px-5 pb-8">
        <button
          type="button"
          onClick={() => setRecentsOpen((v) => !v)}
          className="w-full flex items-center justify-between mb-3"
        >
          <SectionLabel
            action={
              recentsOpen ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate('/mobile/historique'); }}
                  className="text-blue-400 text-[13px] font-semibold hover:text-blue-300"
                >
                  Tout voir
                </button>
              ) : undefined
            }
          >
            Récents
          </SectionLabel>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ml-2 ${recentsOpen ? 'rotate-180' : ''}`} />
        </button>
        {recentsOpen && (
          events.length === 0 ? (
            <EmptyState text="Aucun événement pour le moment" />
          ) : (
            <div className="space-y-2.5">
              {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}
