import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, X, ChevronUp as ChevronUpIcon, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEntreprise } from '../../hooks/useEntreprise';
import EventCard, { EventItem } from '../components/EventCard';
import EmptyState from '../components/EmptyState';

type Filters = {
  type: 'all' | 'ssi' | 'securite_personnes';
  date: 'all' | 'today' | '7d' | '30d' | 'custom';
  dateFrom: string;
  dateTo: string;
};

type TableRow = {
  date: string;
  entrees_max: number;
  nb_ssi: number;
  nb_personnes: number;
};

const INITIAL: Filters = { type: 'all', date: 'today', dateFrom: '', dateTo: '' };

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getDateRange(filters: Filters, drillDate: string | null, lastSoireeDate: string | null) {
  if (drillDate) {
    return { fromISO: drillDate + 'T00:00:00.000Z', toISO: drillDate + 'T23:59:59.999Z', fromDate: drillDate, toDate: drillDate };
  }
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);
  switch (filters.date) {
    case 'today': {
      const d = lastSoireeDate ?? toDateStr(now);
      from = new Date(d + 'T00:00:00');
      to = new Date(d + 'T23:59:59');
      break;
    }
    case '7d':
      from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0); break;
    case '30d':
      from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0); break;
    case 'custom':
      from = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
      to = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : to; break;
    default:
      from.setDate(from.getDate() - 89); from.setHours(0, 0, 0, 0);
  }
  return { fromISO: from.toISOString(), toISO: to.toISOString(), fromDate: toDateStr(from), toDate: toDateStr(to) };
}

function formatDateFR(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function HistoryEvenementsPage() {
  const navigate = useNavigate();
  const { id: etabId } = useEntreprise();

  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drillDate, setDrillDate] = useState<string | null>(null);
  const [lastSoireeDate, setLastSoireeDate] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const showTable = drillDate === null && filters.type === 'all' && filters.date !== 'today';

  useEffect(() => {
    if (!etabId) return;
    supabase
      .from('jauge_etat')
      .select('date_soiree')
      .eq('etablissement_id', etabId)
      .eq('is_test', false)
      .gt('count_actuel', 0)
      .order('date_soiree', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data?.date_soiree) setLastSoireeDate(data.date_soiree as string); });
  }, [etabId]);

  useEffect(() => {
    if (showTable) return;
    (async () => {
      setLoading(true);
      const { fromISO, toISO } = getDateRange(filters, drillDate, lastSoireeDate);
      let q = supabase
        .from('evenements')
        .select('id, numero, type, espace_nom, zone_nom, niveau_label, date_evenement, created_by_email')
        .order('date_evenement', { ascending: false })
        .limit(100);
      if (drillDate) {
        q = q.gte('date_evenement', fromISO).lte('date_evenement', toISO);
      } else if (filters.date === 'custom') {
        if (filters.dateFrom) q = q.gte('date_evenement', filters.dateFrom + 'T00:00:00.000Z');
        if (filters.dateTo) q = q.lte('date_evenement', filters.dateTo + 'T23:59:59.999Z');
        if (filters.type !== 'all') q = q.eq('type', filters.type);
      } else {
        if (filters.type !== 'all') q = q.eq('type', filters.type);
        if (filters.date !== 'all') q = q.gte('date_evenement', fromISO);
      }
      const { data } = await q;
      setEvents((data ?? []) as EventItem[]);
      setLoading(false);
    })();
  }, [filters, showTable, drillDate, lastSoireeDate]);

  useEffect(() => {
    if (!showTable || !etabId) return;
    (async () => {
      setTableLoading(true);
      const { fromISO, toISO, fromDate, toDate } = getDateRange(filters, null, lastSoireeDate);
      const [jaugeRes, evRes] = await Promise.all([
        supabase.from('jauge_etat').select('date_soiree, count_actuel').eq('etablissement_id', etabId).eq('is_test', false).gte('date_soiree', fromDate).lte('date_soiree', toDate),
        supabase.from('evenements').select('date_evenement, type').eq('etablissement_id', etabId).gte('date_evenement', fromISO).lte('date_evenement', toISO),
      ]);
      const jaugeByDate: Record<string, number> = {};
      for (const row of jaugeRes.data ?? []) { const d = row.date_soiree as string; jaugeByDate[d] = Math.max(jaugeByDate[d] ?? 0, (row.count_actuel as number) ?? 0); }
      const evByDate: Record<string, { ssi: number; personnes: number }> = {};
      for (const row of evRes.data ?? []) { const d = new Date(row.date_evenement as string).toISOString().split('T')[0]; if (!evByDate[d]) evByDate[d] = { ssi: 0, personnes: 0 }; if (row.type === 'ssi') evByDate[d].ssi++; if (row.type === 'securite_personnes') evByDate[d].personnes++; }
      const allDates = new Set([...Object.keys(jaugeByDate), ...Object.keys(evByDate)]);
      const rows: TableRow[] = Array.from(allDates).sort((a, b) => b.localeCompare(a)).map((date) => ({ date, entrees_max: jaugeByDate[date] ?? 0, nb_ssi: evByDate[date]?.ssi ?? 0, nb_personnes: evByDate[date]?.personnes ?? 0 }));
      setTableRows(rows);
      setTableLoading(false);
    })();
  }, [filters, etabId, showTable, lastSoireeDate]);

  const activeFiltersCount =
    Number(filters.type !== 'all') + Number(filters.date !== 'today') + Number(!!filters.dateFrom || !!filters.dateTo);

  const totalRow = tableRows.reduce(
    (acc, r) => ({ date: 'TOTAL', entrees_max: acc.entrees_max + r.entrees_max, nb_ssi: acc.nb_ssi + r.nb_ssi, nb_personnes: acc.nb_personnes + r.nb_personnes }),
    { date: 'TOTAL', entrees_max: 0, nb_ssi: 0, nb_personnes: 0 }
  );

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/mobile/historique')} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px]">Événements</p>
          <p className="text-slate-500 text-xs">Tous les événements enregistrés</p>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="relative w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-colors"
        >
          <Filter className="w-5 h-5 text-slate-300" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">{activeFiltersCount}</span>
          )}
        </button>
      </div>

      <div className="px-5 py-4">
        {drillDate && (
          <button type="button" onClick={() => setDrillDate(null)} className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-4 hover:text-blue-300 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour au tableau — {formatDateFR(drillDate)}
          </button>
        )}

        {showTable ? (
          <>
            {tableLoading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
            {!tableLoading && tableRows.length === 0 && <EmptyState text="Aucune donnée" hint="Aucun événement ni entrée de jauge sur cette période" />}
            {!tableLoading && tableRows.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Date</th>
                        <th className="text-center py-3 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Entrées max</th>
                        <th className="text-center py-3 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">SSI</th>
                        <th className="text-center py-3 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Personnes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, i) => (
                        <tr key={row.date} onClick={() => setDrillDate(row.date)} className={`border-b border-slate-800/50 cursor-pointer transition-colors active:bg-slate-700/50 hover:bg-slate-800/50 ${i % 2 === 1 ? 'bg-slate-800/20' : ''}`}>
                          <td className="py-3 px-3 text-slate-200 font-medium whitespace-nowrap">{formatDateFR(row.date)}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{row.entrees_max > 0 ? row.entrees_max : <span className="text-slate-700">—</span>}</td>
                          <td className={`py-3 px-2 text-center font-semibold ${row.nb_ssi > 0 ? 'text-orange-400' : 'text-slate-700'}`}>{row.nb_ssi > 0 ? row.nb_ssi : '—'}</td>
                          <td className={`py-3 px-2 text-center font-semibold ${row.nb_personnes > 0 ? 'text-blue-400' : 'text-slate-700'}`}>{row.nb_personnes > 0 ? row.nb_personnes : '—'}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-800/60 border-t border-slate-600">
                        <td className="py-3 px-3 text-white font-bold text-[11px] uppercase tracking-wide">TOTAL</td>
                        <td className="py-3 px-2 text-center text-white font-bold">{totalRow.entrees_max || <span className="text-slate-600">—</span>}</td>
                        <td className={`py-3 px-2 text-center font-bold ${totalRow.nb_ssi > 0 ? 'text-orange-400' : 'text-slate-600'}`}>{totalRow.nb_ssi || '—'}</td>
                        <td className={`py-3 px-2 text-center font-bold ${totalRow.nb_personnes > 0 ? 'text-blue-400' : 'text-slate-600'}`}>{totalRow.nb_personnes || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-slate-600 text-[11px] text-center py-2">Appuyez sur une ligne pour voir le détail</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2.5">
            {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
            {!loading && events.length === 0 && <EmptyState text="Aucun événement trouvé" hint={drillDate ? `Aucun événement le ${formatDateFR(drillDate)}` : "Essayez d'ajuster vos filtres"} />}
            {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
          </div>
        )}
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setSheetOpen(false)}>
          <div className="w-full max-w-xl mx-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-28 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Filtres</h2>
              <button onClick={() => setSheetOpen(false)} className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center"><X className="w-4 h-4 text-slate-300" /></button>
            </div>
            <div className="space-y-5">
              <FilterGroup label="Type" options={[{ v: 'all', l: 'Tous' }, { v: 'ssi', l: 'SSI' }, { v: 'securite_personnes', l: 'Personnes' }]} value={filters.type} onChange={(v) => { setDrillDate(null); setFilters((f) => ({ ...f, type: v as Filters['type'] })); }} />
              <FilterGroup label="Période" options={[{ v: 'all', l: 'Tout' }, { v: 'today', l: "Aujourd'hui" }, { v: '7d', l: '7 jours' }, { v: '30d', l: '30 jours' }, { v: 'custom', l: 'Période' }]} value={filters.date} onChange={(v) => { setDrillDate(null); setFilters((f) => ({ ...f, date: v as Filters['date'] })); }} />
              {filters.date === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Du</label>
                    <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Au</label>
                    <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setFilters(INITIAL); setDrillDate(null); setSheetOpen(false); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors">Réinitialiser</button>
              <button onClick={() => setSheetOpen(false)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors">Appliquer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: { label: string; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void; }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.v} onClick={() => onChange(o.v)} className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${value === o.v ? 'bg-blue-500/15 border-blue-500/50 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'}`}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}
