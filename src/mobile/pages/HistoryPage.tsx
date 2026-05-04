import { useEffect, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EventCard, { EventItem } from '../components/EventCard';
import EmptyState from '../components/EmptyState';

type Filters = {
  type: 'all' | 'ssi' | 'securite_personnes';
  date: 'all' | 'today' | '7d' | '30d';
};

const INITIAL: Filters = { type: 'all', date: 'all' };

export default function HistoryPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from('evenements')
        .select('id, numero, type, espace_nom, zone_nom, niveau_label, date_evenement, created_by_email')
        .order('date_evenement', { ascending: false })
        .limit(100);

      if (filters.type !== 'all') q = q.eq('type', filters.type);
      if (filters.date !== 'all') {
        const d = new Date();
        if (filters.date === 'today') d.setHours(0, 0, 0, 0);
        if (filters.date === '7d') d.setDate(d.getDate() - 7);
        if (filters.date === '30d') d.setDate(d.getDate() - 30);
        q = q.gte('date_evenement', d.toISOString());
      }

      const { data } = await q;
      setEvents((data ?? []) as EventItem[]);
      setLoading(false);
    })();
  }, [filters]);

  const activeFiltersCount = Number(filters.type !== 'all') + Number(filters.date !== 'all');

  return (
    <div>
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Historique</h1>
          <p className="text-slate-500 text-sm">Tous les événements enregistrés</p>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="relative w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-colors"
        >
          <Filter className="w-5 h-5 text-slate-300" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      <div className="px-5 py-4 space-y-2.5">
        {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!loading && events.length === 0 && <EmptyState text="Aucun événement trouvé" hint="Essayez d'ajuster vos filtres" />}
        {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      </div>

      {/* Filter sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 animate-fade-in" onClick={() => setSheetOpen(false)}>
          <div
            className="w-full max-w-xl mx-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Filtres</h2>
              <button onClick={() => setSheetOpen(false)} className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <div className="space-y-5">
              <FilterGroup
                label="Type"
                options={[
                  { v: 'all', l: 'Tous' },
                  { v: 'ssi', l: 'SSI' },
                  { v: 'securite_personnes', l: 'Personnes' },
                ]}
                value={filters.type}
                onChange={(v) => setFilters((f) => ({ ...f, type: v as Filters['type'] }))}
              />
              <FilterGroup
                label="Période"
                options={[
                  { v: 'all', l: 'Tout' },
                  { v: 'today', l: 'Aujourd\'hui' },
                  { v: '7d', l: '7 jours' },
                  { v: '30d', l: '30 jours' },
                ]}
                value={filters.date}
                onChange={(v) => setFilters((f) => ({ ...f, date: v as Filters['date'] }))}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setFilters(INITIAL); }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors"
              >
                Réinitialiser
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: {
  label: string;
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
              ${value === o.v
                ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
