import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Map, ShieldAlert, Cpu, Users,
  TrendingUp, Flame, ChevronRight, ChevronDown, Monitor,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import EntrepriseBadge from '../components/EntrepriseBadge';

const SHORTCUTS = [
  { to: '/dashboard',    label: 'Utilisateurs',  Icon: Users,           accent: 'blue' },
  { to: '/entreprise',   label: 'Entreprise',    Icon: Building2,       accent: 'emerald' },
  { to: '/espaces-zones',label: 'Espaces & Zones',Icon: Map,            accent: 'cyan' },
  { to: '/motifs',       label: 'Motifs',        Icon: ShieldAlert,     accent: 'amber' },
  { to: '/ia',           label: 'Paramètres IA', Icon: Cpu,             accent: 'sky' },
] as const;

const accents: Record<string, string> = {
  blue: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  cyan: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
  amber: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  sky: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
};

export default function MobileAdminPage() {
  const { hasAdminAccess } = useAuth();
  const [stats, setStats] = useState({ total: 0, today: 0, ssi: 0, personnes: 0 });
  const [kpisOpen, setKpisOpen] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(true);

  useEffect(() => {
    if (!hasAdminAccess) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    (async () => {
      const [allRes, todayRes, ssiRes, pRes] = await Promise.all([
        supabase.from('evenements').select('id', { count: 'exact', head: true }),
        supabase.from('evenements').select('id', { count: 'exact', head: true }).gte('date_evenement', start.toISOString()),
        supabase.from('evenements').select('id', { count: 'exact', head: true }).eq('type', 'ssi'),
        supabase.from('evenements').select('id', { count: 'exact', head: true }).eq('type', 'securite_personnes'),
      ]);
      setStats({
        total: allRes.count ?? 0,
        today: todayRes.count ?? 0,
        ssi: ssiRes.count ?? 0,
        personnes: pRes.count ?? 0,
      });
    })();
  }, [hasAdminAccess]);

  if (!hasAdminAccess) return <Navigate to="/mobile" replace />;

  return (
    <div>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-2xl font-bold truncate">Administration</h1>
            <p className="text-slate-500 text-sm">Accès rapide back-office</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { window.location.href = '/dashboard'; }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all"
            >
              <Monitor className="w-4 h-4" />
              <span className="text-xs font-medium">Back-office</span>
            </button>
            <EntrepriseBadge />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-5">
        <button
          type="button"
          onClick={() => setKpisOpen((v) => !v)}
          className="w-full flex items-center justify-between py-2 mb-2"
        >
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em]">Statistiques</p>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${kpisOpen ? 'rotate-180' : ''}`} />
        </button>
        {kpisOpen && (
          <div className="grid grid-cols-2 gap-3">
            <Kpi Icon={TrendingUp} label="Total" value={stats.total} accent="blue" />
            <Kpi Icon={LayoutDashboard} label="Aujourd'hui" value={stats.today} accent="emerald" />
            <Kpi Icon={Flame} label="SSI" value={stats.ssi} accent="red" />
            <Kpi Icon={Users} label="Personnes" value={stats.personnes} accent="sky" />
          </div>
        )}
      </div>

      {/* Shortcuts */}
      <div className="px-5 mt-5">
        <button
          type="button"
          onClick={() => setShortcutsOpen((v) => !v)}
          className="w-full flex items-center justify-between py-2 mb-2"
        >
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em]">Raccourcis</p>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${shortcutsOpen ? 'rotate-180' : ''}`} />
        </button>
        {shortcutsOpen && (
          <div className="space-y-2.5">
            {SHORTCUTS.map(({ to, label, Icon, accent }) => (
              <button
                key={to}
                onClick={() => { window.location.href = to; }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${accents[accent]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="flex-1 text-left text-white font-semibold text-sm">{label}</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ Icon, label, value, accent }: { Icon: any; label: string; value: number; accent: string }) {
  const map: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    red: 'text-red-400 bg-red-500/15 border-red-500/30',
    sky: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
  };
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${map[accent]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-white font-extrabold text-2xl mt-2 leading-none">{value}</p>
      <p className="text-slate-500 text-xs mt-1">{label}</p>
    </div>
  );
}
