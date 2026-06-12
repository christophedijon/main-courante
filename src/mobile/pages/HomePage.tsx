import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, Flame, Users, ChevronDown, Radio, X, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEntreprise } from '../../hooks/useEntreprise';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useTodayEventsCount } from '../hooks/useEvenements';
import { useSaisie } from '../saisie/SaisieContext';
import QuickActionCard from '../components/QuickActionCard';
import HexagonJauge from '../components/HexagonJauge';
import CarteJauge from '../components/CarteJauge';
import { BeaconScannerBanner } from '../components/BeaconScannerBanner';
import { useBeaconScanner } from '../../hooks/useBeaconScanner';
import { useJauge } from '../../hooks/useJauge';
import { useSessionActive } from '../../hooks/useSessionActive';
import { supabase } from '../../lib/supabase';
import { computeConformite, type ConformiteResult, type RegistreItemMin } from '../../lib/registreStatut';
import ConformiteDonut from '../components/ConformiteDonut';

export default function HomePage() {
  const navigate = useNavigate();
  const { userFonction, isSuperAdmin } = useAuth();
  const { profile } = useCurrentProfile();
  const { nom: entrepriseNom, logo_url, loading: entrepriseLoading } = useEntreprise();
  const [logoError, setLogoError] = useState(false);
  const todayCount = useTodayEventsCount() ?? 0;
  const { startType } = useSaisie();
  const [saisieOpen, setSaisieOpen] = useState(true);
  const { isActive, startRonde, scanError } = useBeaconScanner();
  const sessionState = useSessionActive();
  const { count, Ep, taux, niveau, loading: jaugeLoading, mode_jauge, entrepriseId } = useJauge(sessionState.isTest);

  const isAgent = !isSuperAdmin && userFonction === 'Agent de Sécurité';

  const canSeeRegistre =
    isSuperAdmin ||
    userFonction === 'Direction' ||
    userFonction === 'Chef de poste';

  const [registreConformite, setRegistreConformite] = useState<ConformiteResult | null>(null);
  const [registreItems, setRegistreItems] = useState<RegistreItemMin[]>([]);
  const [jaugeModalOpen, setJaugeModalOpen] = useState(false);
  const [jaugeCount, setJaugeCount] = useState<number | null>(null);
  const [exceptionnelleModalOpen, setExceptionnelleModalOpen] = useState(false);
  const [openingExceptionnelle, setOpeningExceptionnelle] = useState(false);

  const showJaugeAction = !jaugeLoading && (mode_jauge === 'sortie' || mode_jauge === 'automatique') && entrepriseId !== null && Ep > 0;

  const [lastFlicAction, setLastFlicAction] = useState<{
    action: string;
    delta: number;
    time: string;
  } | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('flic_debug')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jauge_actions'
      }, (payload) => {
        const row = payload.new as any;
        setLastFlicAction({
          action: row.action,
          delta: row.delta,
          time: new Date().toLocaleTimeString('fr-FR')
        });
        setTimeout(() => setLastFlicAction(null), 10000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!canSeeRegistre) return;
    supabase
      .from('registre_securite')
      .select('applicable, periodicite, date_verification')
      .then(({ data }) => {
        if (data) {
          setRegistreItems(data as RegistreItemMin[]);
          setRegistreConformite(computeConformite(data));
        }
      });
  }, [canSeeRegistre]);

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
    <div className="min-h-full font-exo">
      {/* ── Header ── */}
      <div className="px-5 pt-8 pb-5">
        <div className="flex items-center gap-4">
          {/* Octagon avatar */}
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

          <div
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider"
            style={{ border: '1px solid #f5a623', color: '#f5a623' }}
          >
            {isSuperAdmin ? 'Admin' : (userFonction ?? 'Agent')}
          </div>
        </div>

        {/* ── Info cards row ── */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 min-h-[76px]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {entrepriseLoading ? (
              <div className="h-10 w-[52px] rounded-xl bg-white/10 shrink-0 animate-pulse" />
            ) : logo_url && !logoError ? (
              <div className="bg-white rounded-xl p-1 shrink-0">
                <img
                  src={logo_url}
                  alt={entrepriseNom ?? 'Logo'}
                  className="h-10 w-auto max-w-[52px] object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; setLogoError(true); }}
                />
              </div>
            ) : !entrepriseNom ? (
              <Shield className="w-8 h-8 text-slate-600" />
            ) : null}
            {entrepriseNom && (
              <p className="text-white text-[14px] font-bold leading-tight">{entrepriseNom}</p>
            )}
          </div>

          <div
            className="w-full flex flex-col justify-center rounded-2xl px-4 py-3 min-h-[76px]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/mobile/historique')}
          >
            <div className="flex items-center gap-1.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] tracking-wide font-medium">Aujourd'hui</span>
            </div>
            <p className="text-white font-black text-4xl mt-1 leading-none">{todayCount}</p>
          </div>

          {canSeeRegistre && registreConformite && (
              <button
                onClick={() => navigate('/mobile/registre-securite')}
                className="w-full flex flex-col items-center justify-center rounded-2xl px-3 py-3 min-h-[76px] active:scale-95 transition-transform"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                <ConformiteDonut items={registreItems} size={72} />
              </button>
          )}
        </div>

        {/* ── Démarrer la ronde button (Agent de Sécurité only) ── */}
        {isAgent && !isActive && (
          <div className="mt-4">
            <button
              onClick={startRonde}
              className="w-full flex items-center justify-center gap-3 rounded-2xl px-5 py-4 font-bold text-sm transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.12) 100%)',
                border: '1px solid rgba(16,185,129,0.4)',
                color: '#34d399',
                boxShadow: '0 0 18px rgba(16,185,129,0.12)',
              }}
            >
              <Radio size={18} />
              Démarrer la ronde
            </button>
            {scanError && (
              <p className="mt-2 text-xs text-red-400 text-center px-2">{scanError}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Saisie rapide section ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 380 }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(20,27,39,0.6) 30%, rgba(20,27,39,0.85) 100%)' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,44 28,58 2,44 2,16' fill='none' stroke='rgba(59%2C143%2C232%2C0.09)' stroke-width='1'/%3E%3Cpolygon points='28,52 54,66 54,94 28,108 2,94 2,66' fill='none' stroke='rgba(59%2C143%2C232%2C0.09)' stroke-width='1'/%3E%3C/svg%3E")`,
            backgroundSize: '56px 100px',
            backgroundRepeat: 'repeat',
          }}
        />

        <div className="relative z-10 px-5 pt-5 pb-10">
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: 8 }}>
              {/* Top row */}
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '8px' }}>
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
                  offsetTop={0}
                />
              </div>
              {/* Bottom center — honeycomb overlap */}
              <div style={{ marginTop: '-62px' }}>
                <HexagonJauge
                  count={count}
                  Ep={Ep}
                  taux={taux}
                  niveau={niveau}
                  loading={jaugeLoading}
                  offsetTop={0}
                  onDoubleClick={showJaugeAction ? () => setJaugeModalOpen(true) : undefined}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <BeaconScannerBanner />

      {lastFlicAction && (
        <div className="mx-4 mt-3 bg-emerald-900/60 border border-emerald-500/40
                        rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <p className="text-emerald-300 text-sm font-semibold">
              Signal Flic reçu — {lastFlicAction.time}
            </p>
            <p className="text-emerald-400 text-xs">
              Action : {lastFlicAction.action} | Delta : {lastFlicAction.delta > 0 ? '+' : ''}{lastFlicAction.delta}
            </p>
          </div>
        </div>
      )}

      {/* Ouverture Exceptionnelle button — shown only when no session is active */}
      {!sessionState.isActive && (
        <div className="mx-4 mt-4">
          <button
            onClick={() => setExceptionnelleModalOpen(true)}
            className="w-full flex items-center justify-center gap-3 rounded-2xl px-5 py-3.5 font-bold text-sm transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.10) 100%)',
              border: '1px solid rgba(245,158,11,0.35)',
              color: '#f59e0b',
            }}
          >
            <Zap size={16} />
            Ouverture Exceptionnelle
          </button>
        </div>
      )}

      {/* Exceptionnelle session confirmation modal */}
      {exceptionnelleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) setExceptionnelleModalOpen(false); }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-t-2xl p-6 pb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <button
                onClick={() => setExceptionnelleModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Ouverture Exceptionnelle</h3>
            <p className="text-slate-400 text-sm mb-1">
              Ouvre une session de soirée hors horaires habituels.
            </p>
            <p className="text-amber-400 text-sm font-medium mb-6">
              Fermeture automatique demain à 08h00.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setExceptionnelleModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setOpeningExceptionnelle(true);
                  await sessionState.openExceptionnelleSession();
                  setOpeningExceptionnelle(false);
                  setExceptionnelleModalOpen(false);
                }}
                disabled={openingExceptionnelle}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {openingExceptionnelle ? 'Ouverture…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJaugeAction && jaugeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setJaugeModalOpen(false); }}
        >
          <div className="w-full max-w-sm bg-slate-900 rounded-t-2xl p-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold text-base">Jauge billetterie</p>
              <button onClick={() => setJaugeModalOpen(false)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <CarteJauge
              count={jaugeCount ?? count}
              Ep={Ep}
              entrepriseId={entrepriseId!}
              isTest={sessionState.isTest}
              onCountUpdate={(n) => { setJaugeCount(n); setJaugeModalOpen(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
