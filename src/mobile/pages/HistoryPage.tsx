import { useEffect, useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EventCard, { EventItem } from '../components/EventCard';
import EmptyState from '../components/EmptyState';
import EntrepriseBadge from '../components/EntrepriseBadge';

type Filters = {
  type: 'all' | 'ssi' | 'securite_personnes';
  date: 'all' | 'today' | '7d' | '30d';
};

type IaRecord = {
  id: string;
  question: string;
  sections: { title: string; content: string }[];
  created_at: string;
  agent_nom: string;
};

const INITIAL: Filters = { type: 'all', date: 'all' };

function IaRecordSections({ sections }: { sections: { title: string; content: string }[] }) {
  const [open, setOpen] = useState(false);
  const COLORS = ['text-blue-400', 'text-red-400', 'text-amber-400', 'text-cyan-400'];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-slate-400 text-xs font-semibold py-1"
      >
        <span>Voir la réponse IA ({sections.length} sections)</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 mt-2">
          {sections.map((s, i) => (
            <div key={i} className="bg-slate-950 rounded-xl p-3">
              <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${COLORS[i % COLORS.length]}`}>
                {i + 1}. {s.title}
              </p>
              <p className="text-slate-400 text-[12px] leading-relaxed whitespace-pre-line">
                {s.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'ia'>('events');

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [iaHistory, setIaHistory] = useState<IaRecord[]>([]);
  const [iaLoading, setIaLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'events') return;
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
  }, [filters, activeTab]);

  useEffect(() => {
    if (activeTab !== 'ia') return;
    (async () => {
      setIaLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIaLoading(false); return; }
      const { data } = await supabase
        .from('ia_historique')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setIaHistory((data ?? []) as IaRecord[]);
      setIaLoading(false);
    })();
  }, [activeTab]);

  const activeFiltersCount = Number(filters.type !== 'all') + Number(filters.date !== 'all');

  return (
    <div>
      <div className="px-5 pt-6 pb-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-white text-2xl font-bold truncate">Historique</h1>
          <p className="text-slate-500 text-sm">Tous les événements enregistrés</p>
        </div>
        <EntrepriseBadge />
        {activeTab === 'events' && (
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
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 pb-3">
        <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${activeTab === 'events' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Événements
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ia')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${activeTab === 'ia' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Historique IA
          </button>
        </div>
      </div>

      {/* Events tab */}
      {activeTab === 'events' && (
        <div className="px-5 py-4 space-y-2.5">
          {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
          {!loading && events.length === 0 && <EmptyState text="Aucun événement trouvé" hint="Essayez d'ajuster vos filtres" />}
          {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}

      {/* IA tab */}
      {activeTab === 'ia' && (
        <div className="px-5 py-4 space-y-3">
          {iaLoading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
          {!iaLoading && iaHistory.length === 0 && (
            <EmptyState text="Aucune consultation IA" hint="Vos questions à l'assistant apparaîtront ici" />
          )}
          {!iaLoading && iaHistory.map((record) => (
            <div key={record.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">
                  {new Date(record.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg">
                  IA
                </span>
              </div>
              <div className="bg-slate-950 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Question</p>
                <p className="text-slate-300 text-sm leading-relaxed">{record.question}</p>
              </div>
              <IaRecordSections sections={record.sections} />
            </div>
          ))}
        </div>
      )}

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
                  { v: 'today', l: "Aujourd'hui" },
                  { v: '7d', l: '7 jours' },
                  { v: '30d', l: '30 jours' },
                ]}
                value={filters.date}
                onChange={(v) => setFilters((f) => ({ ...f, date: v as Filters['date'] }))}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setFilters(INITIAL)}
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
