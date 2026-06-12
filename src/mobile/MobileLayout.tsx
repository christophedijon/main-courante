import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';
import { useSessionActive } from '../hooks/useSessionActive';

export default function MobileLayout() {
  const { pathname } = useLocation();
  const inSaisie = pathname.includes('/mobile/saisie/');
  const { isTest, sessionType } = useSessionActive();

  return (
    <div className="mobile-hex-root min-h-screen text-white flex flex-col relative overflow-hidden font-exo">
      {/* Hex design background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'linear-gradient(180deg, #0d1117 0%, #111827 55%, #1a2030 100%)' }}
      />
      {/* Subtle hex grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,44 28,58 2,44 2,16' fill='none' stroke='rgba(59%2C143%2C232%2C0.07)' stroke-width='1'/%3E%3Cpolygon points='28,52 54,66 54,94 28,108 2,94 2,66' fill='none' stroke='rgba(59%2C143%2C232%2C0.07)' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: '56px 100px',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'repeat-x',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 65%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 65%)',
        }}
      />
      {/* Radial glow */}
      <div
        className="fixed pointer-events-none z-0"
        style={{
          bottom: -80, left: '50%', transform: 'translateX(-50%)',
          width: 480, height: 320,
          background: 'radial-gradient(ellipse at center, rgba(59,143,232,0.10) 0%, transparent 70%)',
        }}
      />

      {/* Test mode banner */}
      {isTest && sessionType === 'test' && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest"
          style={{ background: '#92400e', color: '#fcd34d', letterSpacing: '0.12em' }}
        >
          <span style={{ opacity: 0.8 }}>&#9888;</span>
          MODE TEST — Donnees non operationnelles
          <span style={{ opacity: 0.8 }}>&#9888;</span>
        </div>
      )}

      <div
        className="flex-1 max-w-xl w-full mx-auto relative z-10"
        style={{
          paddingTop: isTest && sessionType === 'test' ? 32 : 0,
          paddingBottom: 'calc(68px + env(safe-area-inset-bottom))',
        }}
      >
        <Outlet />
      </div>
      {!inSaisie && <MobileBottomNav />}
    </div>
  );
}
