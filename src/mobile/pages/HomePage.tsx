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
import { BeaconScannerBanner } from '../components/BeaconScannerBanner';
import { useBeaconScanner } from '../../hooks/useBeaconScanner';

export default function HomePage() {
  const navigate = useNavigate();
  const { userFonction, isSuperAdmin } = useAuth();
  const { profile } = useCurrentProfile();
  const { nom: entrepriseNom, logo_url } = useEntreprise();
  const todayCount = useTodayEventsCount() ?? 0;
  const { startType } = useSaisie();
  const [saisieOpen, setSaisieOpen] = useState(true);
  const { isScanning, beaconsLoaded } = useBeaconScanner();
  const bluetoothAvailable = !!navigator?.bluetooth;

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
    <>
    <div className="min-h-full font-exo">
      {/* ── Header ── */}
      <div className="px-5 pt-8 pb-5">
        <div className="flex items-center gap-4">
          {/* Octagon avatar with hex blue shield */}
          <div className="shrink-0 relative flex items-center justify-center" style={{ width: 60, height: 60 }}>
            <svg viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="oct-grad-hex" x1="0.3" y1="0" x2="0.7" y2="1">
                  <stop offset="0%" stopColor="#1e2d45" />
                  <stop offset="100%" stopColor="#0d1421" />
                </linearGradient>
                <linearGradient id="oct-rim-hex" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stopColor="rgba(59,143,232,0.55)" />
                  <stop offset="55%" stopColor="rgba(59,143,232,0.18)" />
                  <stop offset="100%" stopColor="rgba(10,15,30,0.7)" />
                </linearGradient>
              </defs>
              <polygon
                points="17,2 43,2 58,17 58,43 43,58 17,58 2,43 2,17"
                fill="url(#oct-grad-hex)"
                stroke="url(#oct-rim-hex)"
                strokeWidth="2"
              />
            </svg>
            <Shield
              className="relative z-10"
              style={{
                width: 26, height: 26,
                color: '#3b8fe8',
                filter: 'drop-shadow(0 0 8px rgba(59,143,232,0.75)) drop-shadow(0 0 14px rgba(59,143,232,0.4))',
              }}
              strokeWidth={2.4}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] leading-tight tracking-[0.14em] uppercase font-semibold" style={{ color: 'rgba(148,163,184,0.65)' }}>Bonjour</p>
            <p className="text-white font-bold text-[17px] leading-tight truncate mt-0.5">{fullName}</p>
          </div>

          {/* Role badge — styled as gold outlined pill on mobile */}
          <div
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider"
            style={{ border: '1px solid #f5a623', color: '#f5a623' }}
          >
            {isSuperAdmin ? 'Admin' : (userFonction ?? 'Agent')}
          </div>
        </div>

        {/* ── Info cards row ── */}
        <div className="mt-5 flex items-stretch gap-3">
          {/* Company card */}
          <div
            className="flex-1 flex items-center gap-3 rounded-2xl px-4 py-3 min-h-[76px]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {logo_url && (
              <div className="bg-white rounded-xl p-1 shrink-0">
                <img src={logo_url} alt={entrepriseNom ?? 'Logo'}
                  className="h-10 w-auto max-w-[52px] object-contain" />
              </div>
            )}
            {entrepriseNom && (
              <p className="text-white text-[14px] font-bold leading-tight">{entrepriseNom}</p>
            )}
            {!logo_url && !entrepriseNom && (
              <Shield className="w-8 h-8 text-slate-600" />
            )}
          </div>

          {/* Today count card */}
          <div
            className="flex flex-col justify-center min-w-[130px] rounded-2xl px-4 py-3 min-h-[76px]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-1.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] tracking-wide font-medium">Aujourd'hui</span>
            </div>
            <p className="text-white font-black text-4xl mt-1 leading-none">{todayCount}</p>
          </div>
        </div>
      </div>

      {/* ── Saisie rapide section ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 380 }}>
        {/* Subtle hex-tinted surface for this section */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(20,27,39,0.6) 30%, rgba(20,27,39,0.85) 100%)' }}
        />
        {/* Hex grid pattern accent */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,44 28,58 2,44 2,16' fill='none' stroke='rgba(59%2C143%2C232%2C0.09)' stroke-width='1'/%3E%3Cpolygon points='28,52 54,66 54,94 28,108 2,94 2,66' fill='none' stroke='rgba(59%2C143%2C232%2C0.09)' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: '56px 100px',
            backgroundRepeat: 'repeat',
          }}
        />

        <div className="relative z-10 px-5 pt-5 pb-10">
          {/* Section header */}
          <button
            type="button"
            onClick={() => setSaisieOpen((v) => !v)}
            className="w-full flex items-center justify-between mb-6 px-1"
          >
            <span
              className="text-[11px] font-bold tracking-[0.28em] uppercase"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              Saisie rapide
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${saisieOpen ? 'rotate-180' : ''}`}
              style={{ color: 'rgba(148,163,184,0.6)' }}
            />
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
    <BeaconScannerBanner />

    {/* TEMP DEBUG PANEL */}
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', border: '1px solid #f59e0b',
      borderRadius: 10, padding: '8px 12px', fontSize: 12,
      color: '#fcd34d', lineHeight: 1.7, pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#f59e0b' }}>DEBUG</div>
      <div>bluetooth: <span style={{ color: bluetoothAvailable ? '#4ade80' : '#f87171' }}>{bluetoothAvailable ? 'yes' : 'no'}</span></div>
      <div>isScanning: <span style={{ color: isScanning ? '#4ade80' : '#f87171' }}>{isScanning ? 'true' : 'false'}</span></div>
      <div>role: <span style={{ color: '#93c5fd' }}>{isSuperAdmin ? 'SuperAdmin' : (userFonction ?? 'none')}</span></div>
      <div>beacons: <span style={{ color: '#93c5fd' }}>{beaconsLoaded ? 'loaded' : 'loading...'}</span></div>
    </div>

    </>
  );
}
