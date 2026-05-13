import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';

export default function MobileLayout() {
  const { pathname } = useLocation();
  const inSaisie = pathname.includes('/mobile/saisie/');

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden" style={{ background: '#0d0d0d' }}>
      {/* Hexagonal background pattern */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104' viewBox='0 0 60 104'%3E%3Cpath d='M30 2 L58 18 L58 50 L30 66 L2 50 L2 18 Z' fill='none' stroke='%23ffffff07' stroke-width='1'/%3E%3Cpath d='M30 38 L58 54 L58 86 L30 102 L2 86 L2 54 Z' fill='none' stroke='%23ffffff05' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 104px',
      }} />
      {/* Red accent glow top-right */}
      <div className="fixed top-0 right-0 w-72 h-72 pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 100% 0%, rgba(200,30,30,0.14) 0%, transparent 65%)' }} />
      {/* Subtle green accent bottom-left */}
      <div className="fixed bottom-20 left-0 w-48 h-48 pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 0% 100%, rgba(34,197,94,0.06) 0%, transparent 70%)' }} />

      <div className="flex-1 max-w-xl w-full mx-auto pb-[calc(68px+env(safe-area-inset-bottom))] relative z-10">
        <Outlet />
      </div>
      {!inSaisie && <MobileBottomNav />}
    </div>
  );
}
