import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';

export default function MobileLayout() {
  const { pathname } = useLocation();
  const inSaisie = pathname.includes('/mobile/saisie/');

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden">
      {/* Full-screen background image */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: 'url(/fond_mc.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
      }} />
      {/* Slight dark overlay to keep text readable */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'rgba(0,0,0,0.25)' }} />

      <div className="flex-1 max-w-xl w-full mx-auto pb-[calc(68px+env(safe-area-inset-bottom))] relative z-10">
        <Outlet />
      </div>
      {!inSaisie && <MobileBottomNav />}
    </div>
  );
}
