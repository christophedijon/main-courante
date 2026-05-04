import { Outlet, useLocation } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';

export default function MobileLayout() {
  const { pathname } = useLocation();
  const inSaisie = pathname.includes('/mobile/saisie/');

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="flex-1 max-w-xl w-full mx-auto pb-[calc(68px+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      {!inSaisie && <MobileBottomNav />}
    </div>
  );
}
