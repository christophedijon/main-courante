import { Flame, Users, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export type EventItem = {
  id: string;
  numero: string;
  type: 'ssi' | 'securite_personnes';
  espace_nom: string;
  zone_nom: string;
  niveau_label: string;
  date_evenement: string;
  created_by_email: string;
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function EventCard({ ev }: { ev: EventItem }) {
  const ssi = ev.type === 'ssi';
  const Icon = ssi ? Flame : Users;

  return (
    <Link
      to={`/mobile/evenement/${ev.id}`}
      className="block rounded-2xl border border-slate-800 bg-slate-900 hover:border-slate-700
        transition-colors p-3.5 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0
            ${ssi ? 'bg-red-600/90' : 'bg-sky-500/30 border border-sky-500/40'}`}
        >
          <Icon className={`w-5 h-5 ${ssi ? 'text-amber-300' : 'text-sky-300'}`} strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm truncate">
              {ev.espace_nom || '—'}
              {ev.zone_nom ? ` · ${ev.zone_nom}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <span>{formatDate(ev.date_evenement)}</span>
            {ev.niveau_label && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-700" />
                <span className="truncate">{ev.niveau_label}</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">#{ev.numero}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
      </div>
    </Link>
  );
}
