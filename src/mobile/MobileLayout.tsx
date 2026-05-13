import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';

export default function MobileLayout() {
  const { pathname } = useLocation();
  const inSaisie = pathname.includes('/mobile/saisie/');

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden" style={{ background: '#141414' }}>
      {/* Hexagonal background pattern — visible 3D hex grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='121' viewBox='0 0 70 121'%3E%3Cpolygon points='35,2 67,19 67,54 35,71 3,54 3,19' fill='%23222222' stroke='%23333333' stroke-width='1.5'/%3E%3Cpolygon points='35,62 67,79 67,114 35,131 3,114 3,79' fill='%23222222' stroke='%23333333' stroke-width='1.5'/%3E%3Cpolygon points='70,32 102,49 102,84 70,101 38,84 38,49' fill='%23222222' stroke='%232a2a2a' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '70px 121px',
      }} />
      {/* Highlight on hex faces — subtle inner glow */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='121' viewBox='0 0 70 121'%3E%3Cpolygon points='35,2 67,19 67,54 35,71 3,54 3,19' fill='none' stroke='%23383838' stroke-width='0.5'/%3E%3Cpolygon points='35,62 67,79 67,114 35,131 3,114 3,79' fill='none' stroke='%23383838' stroke-width='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: '70px 121px',
        opacity: 0.6,
      }} />
      {/* Red accent glow top-right */}
      <div className="fixed top-0 right-0 w-80 h-80 pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 100% 0%, rgba(200,30,30,0.18) 0%, transparent 60%)' }} />
      {/* Subtle green accent bottom-left */}
      <div className="fixed bottom-20 left-0 w-64 h-64 pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 0% 100%, rgba(34,197,94,0.08) 0%, transparent 65%)' }} />

      <div className="flex-1 max-w-xl w-full mx-auto pb-[calc(68px+env(safe-area-inset-bottom))] relative z-10">
        <Outlet />
      </div>
      {!inSaisie && <MobileBottomNav />}
    </div>
  );
}
