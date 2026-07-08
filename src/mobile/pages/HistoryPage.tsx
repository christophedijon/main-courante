import { useEffect, useState } from 'react';
import {
  Filter, X, ChevronDown, ChevronUp as ChevronUpIcon,
  FileText, Calendar, ArrowLeft,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useEntreprise } from '../../hooks/useEntreprise';
import EventCard, { EventItem } from '../components/EventCard';
import EmptyState from '../components/EmptyState';
import EntrepriseBadge from '../components/EntrepriseBadge';

type Filters = {
  type: 'all' | 'ssi' | 'securite_personnes';
  date: 'all' | 'today' | '7d' | '30d' | 'custom';
  dateFrom: string;
  dateTo: string;
};

type TableRow = {
  date: string; // YYYY-MM-DD
  entrees_max: number;
  nb_ssi: number;
  nb_personnes: number;
};

type Rapport = {
  id: string;
  date_soiree: string;
  debut_soiree: string;
  fin_soiree: string;
  nb_evenements: number;
  nb_agents: number;
  contenu_html: string | null;
  created_at: string;
};

type IaRecord = {
  id: string;
  question: string;
  sections: { title: string; content: string }[];
  created_at: string;
  agent_nom: string;
};

type RegistreHistoriqueEntry = {
  id: string;
  registre_id: string;
  date_verification: string;
  nom_verificateur: string;
  rapport_url: string;
  observations: string;
  observations_levees: string;
  created_at: string;
  registre_securite?: { installation: string };
};

const INITIAL: Filters = { type: 'all', date: '7d', dateFrom: '', dateTo: '' };

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getDateRange(filters: Filters, drillDate: string | null) {
  if (drillDate) {
    return {
      fromISO: drillDate + 'T00:00:00.000Z',
      toISO: drillDate + 'T23:59:59.999Z',
      fromDate: drillDate,
      toDate: drillDate,
    };
  }
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);
  to.setHours(23, 59, 59, 999);

  switch (filters.date) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      break;
    case '7d':
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    case '30d':
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      break;
    case 'custom':
      from = filters.dateFrom
        ? new Date(filters.dateFrom + 'T00:00:00')
        : new Date(now.getFullYear(), now.getMonth(), 1);
      to = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : to;
      break;
    default: // 'all'
      from.setDate(from.getDate() - 89);
      from.setHours(0, 0, 0, 0);
  }
  return {
    fromISO: from.toISOString(),
    toISO: to.toISOString(),
    fromDate: toDateStr(from),
    toDate: toDateStr(to),
  };
}

function formatDateFR(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

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
              <p className="text-slate-400 text-[12px] leading-relaxed whitespace-pre-line">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const { isDirection, isChefDePoste, isSuperAdmin } = useAuth();
  const { id: etabId } = useEntreprise();
  const canSeeRapports = isDirection || isChefDePoste || isSuperAdmin;
  const canSeeRegistre = isDirection || isChefDePoste || isSuperAdmin;

  const [activeTab, setActiveTab] = useState<'events' | 'ia' | 'rapports' | 'registre'>('events');
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drillDate, setDrillDate] = useState<string | null>(null);

  // List mode state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Table mode state
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  // Other tabs
  const [iaHistory, setIaHistory] = useState<IaRecord[]>([]);
  const [iaLoading, setIaLoading] = useState(false);
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [rapportsLoading, setRapportsLoading] = useState(false);
  const [openRapportId, setOpenRapportId] = useState<string | null>(null);
  const [registreHistory, setRegistreHistory] = useState<RegistreHistoriqueEntry[]>([]);
  const [registreLoading, setRegistreLoading] = useState(false);

  // Show table when: no drill-down, type=all, date≠today
  const showTable = drillDate === null && filters.type === 'all' && filters.date !== 'today';

  // Load events list (list mode or drill-down)
  useEffect(() => {
    if (activeTab !== 'events') return;
    if (showTable) return;
    (async () => {
      setLoading(true);
      const { fromISO, toISO } = getDateRange(filters, drillDate);
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
  }, [filters, activeTab, showTable, drillDate]);

  // Load table data
  useEffect(() => {
    if (activeTab !== 'events') return;
    if (!showTable) return;
    if (!etabId) return;
    (async () => {
      setTableLoading(true);
      const { fromISO, toISO, fromDate, toDate } = getDateRange(filters, null);

      const [jaugeRes, evRes] = await Promise.all([
        supabase
          .from('jauge_etat')
          .select('date_soiree, count_actuel')
          .eq('etablissement_id', etabId)
          .eq('is_test', false)
          .gte('date_soiree', fromDate)
          .lte('date_soiree', toDate),
        supabase
          .from('evenements')
          .select('date_evenement, type')
          .eq('etablissement_id', etabId)
          .gte('date_evenement', fromISO)
          .lte('date_evenement', toISO),
      ]);

      // Max count_actuel per date_soiree
      const jaugeByDate: Record<string, number> = {};
      for (const row of jaugeRes.data ?? []) {
        const d = row.date_soiree as string;
        jaugeByDate[d] = Math.max(jaugeByDate[d] ?? 0, (row.count_actuel as number) ?? 0);
      }

      // Count events by date and type
      const evByDate: Record<string, { ssi: number; personnes: number }> = {};
      for (const row of evRes.data ?? []) {
        const d = new Date(row.date_evenement as string).toISOString().split('T')[0];
        if (!evByDate[d]) evByDate[d] = { ssi: 0, personnes: 0 };
        if (row.type === 'ssi') evByDate[d].ssi++;
        if (row.type === 'securite_personnes') evByDate[d].personnes++;
      }

      const allDates = new Set([...Object.keys(jaugeByDate), ...Object.keys(evByDate)]);
      const rows: TableRow[] = Array.from(allDates)
        .sort((a, b) => b.localeCompare(a))
        .map((date) => ({
          date,
          entrees_max: jaugeByDate[date] ?? 0,
          nb_ssi: evByDate[date]?.ssi ?? 0,
          nb_personnes: evByDate[date]?.personnes ?? 0,
        }));

      setTableRows(rows);
      setTableLoading(false);
    })();
  }, [activeTab, filters, etabId, showTable]);

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

  useEffect(() => {
    if (activeTab !== 'rapports') return;
    (async () => {
      setRapportsLoading(true);
      const { data } = await supabase
        .from('rapports_soiree')
        .select('id, date_soiree, debut_soiree, fin_soiree, nb_evenements, nb_agents, contenu_html, created_at')
        .order('date_soiree', { ascending: false })
        .limit(30);
      setRapports((data ?? []) as Rapport[]);
      setRapportsLoading(false);
    })();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'registre') return;
    (async () => {
      setRegistreLoading(true);
      const { data } = await supabase
        .from('registre_historique')
        .select('*, registre_securite(installation)')
        .order('date_verification', { ascending: false })
        .limit(100);
      setRegistreHistory((data ?? []) as RegistreHistoriqueEntry[]);
      setRegistreLoading(false);
    })();
  }, [activeTab]);

  const activeFiltersCount = Number(filters.type !== 'all') + Number(filters.date !== 'all');

  const totalRow = tableRows.reduce(
    (acc, r) => ({
      date: 'TOTAL',
      entrees_max: acc.entrees_max + r.entrees_max,
      nb_ssi: acc.nb_ssi + r.nb_ssi,
      nb_personnes: acc.nb_personnes + r.nb_personnes,
    }),
    { date: 'TOTAL', entrees_max: 0, nb_ssi: 0, nb_personnes: 0 }
  );

  return (
    <div>
      {/* Header */}
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
        {activeTab !== 'events' && <div className="w-11 h-11" />}
      </div>

      {/* Tabs */}
      <div className="px-5 pb-3">
        <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1">
          <button type="button" onClick={() => setActiveTab('events')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'events' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            Événements
          </button>
          <button type="button" onClick={() => setActiveTab('ia')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'ia' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            Historique IA
          </button>
          {canSeeRapports && (
            <button type="button" onClick={() => setActiveTab('rapports')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'rapports' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              Rapports
            </button>
          )}
          {canSeeRegistre && (
            <button type="button" onClick={() => setActiveTab('registre')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'registre' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              Registre
            </button>
          )}
        </div>
      </div>

      {/* Events tab */}
      {activeTab === 'events' && (
        <div className="px-5 py-4">
          {/* Drill-down back button */}
          {drillDate && (
            <button
              type="button"
              onClick={() => setDrillDate(null)}
              className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-4 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au tableau — {formatDateFR(drillDate)}
            </button>
          )}

          {/* Table view */}
          {showTable && (
            <>
              {tableLoading && (
                <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>
              )}
              {!tableLoading && tableRows.length === 0 && (
                <EmptyState text="Aucune donnée" hint="Aucun événement ni entrée de jauge sur cette période" />
              )}
              {!tableLoading && tableRows.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left py-3 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                            Date
                          </th>
                          <th className="text-center py-3 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                            Entrées max
                          </th>
                          <th className="text-center py-3 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            SSI
                          </th>
                          <th className="text-center py-3 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Personnes
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row, i) => (
                          <tr
                            key={row.date}
                            onClick={() => setDrillDate(row.date)}
                            className={`border-b border-slate-800/50 cursor-pointer transition-colors active:bg-slate-700/50 hover:bg-slate-800/50 ${i % 2 === 1 ? 'bg-slate-800/20' : ''}`}
                          >
                            <td className="py-3 px-3 text-slate-200 font-medium whitespace-nowrap">
                              {formatDateFR(row.date)}
                            </td>
                            <td className="py-3 px-2 text-center text-slate-300">
                              {row.entrees_max > 0 ? row.entrees_max : <span className="text-slate-700">—</span>}
                            </td>
                            <td className={`py-3 px-2 text-center font-semibold ${row.nb_ssi > 0 ? 'text-orange-400' : 'text-slate-700'}`}>
                              {row.nb_ssi > 0 ? row.nb_ssi : '—'}
                            </td>
                            <td className={`py-3 px-2 text-center font-semibold ${row.nb_personnes > 0 ? 'text-blue-400' : 'text-slate-700'}`}>
                              {row.nb_personnes > 0 ? row.nb_personnes : '—'}
                            </td>
                          </tr>
                        ))}
                        {/* Total row */}
                        <tr className="bg-slate-800/60 border-t border-slate-600">
                          <td className="py-3 px-3 text-white font-bold text-[11px] uppercase tracking-wide">
                            TOTAL
                          </td>
                          <td className="py-3 px-2 text-center text-white font-bold">
                            {totalRow.entrees_max || <span className="text-slate-600">—</span>}
                          </td>
                          <td className={`py-3 px-2 text-center font-bold ${totalRow.nb_ssi > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                            {totalRow.nb_ssi || '—'}
                          </td>
                          <td className={`py-3 px-2 text-center font-bold ${totalRow.nb_personnes > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                            {totalRow.nb_personnes || '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-slate-600 text-[11px] text-center py-2">
                    Appuyez sur une ligne pour voir le détail
                  </p>
                </div>
              )}
            </>
          )}

          {/* List view */}
          {!showTable && (
            <div className="space-y-2.5">
              {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
              {!loading && events.length === 0 && (
                <EmptyState
                  text="Aucun événement trouvé"
                  hint={drillDate ? `Aucun événement le ${formatDateFR(drillDate)}` : "Essayez d'ajuster vos filtres"}
                />
              )}
              {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
            </div>
          )}
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

      {/* Rapports tab */}
      {activeTab === 'rapports' && (
        <div className="px-5 py-4 space-y-3">
          {rapportsLoading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
          {!rapportsLoading && rapports.length === 0 && (
            <EmptyState text="Aucun rapport disponible" hint="Les rapports sont générés automatiquement chaque matin à 8h00" />
          )}
          {!rapportsLoading && rapports.map((rapport) => {
            const isOpen = openRapportId === rapport.id;
            const dateSoiree = new Date(rapport.date_soiree + 'T12:00:00').toLocaleDateString('fr-FR', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            });
            const heureDebut = new Date(rapport.debut_soiree).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const heureFin = new Date(rapport.fin_soiree).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={rapport.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenRapportId(isOpen ? null : rapport.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-[14px] capitalize truncate">{dateSoiree}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">{heureDebut} → {heureFin}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-white font-bold text-base leading-none">{rapport.nb_evenements}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">évén.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold text-base leading-none">{rapport.nb_agents}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">agents</p>
                    </div>
                    {isOpen
                      ? <ChevronUpIcon className="w-4 h-4 text-slate-500" />
                      : <ChevronDown className="w-4 h-4 text-slate-500" />
                    }
                  </div>
                </button>
                {isOpen && rapport.contenu_html && (
                  <div className="border-t border-slate-800 overflow-auto bg-white rounded-b-2xl" style={{ maxHeight: '75vh' }}>
                    <div dangerouslySetInnerHTML={{ __html: rapport.contenu_html }} />
                  </div>
                )}
                {isOpen && !rapport.contenu_html && (
                  <div className="border-t border-slate-800 px-4 py-4 flex items-center gap-3 text-slate-500">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="text-sm">Aucun contenu disponible.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Registre tab */}
      {activeTab === 'registre' && (
        <div className="px-5 py-4 space-y-3">
          {registreLoading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
          {!registreLoading && registreHistory.length === 0 && (
            <EmptyState text="Aucun historique de registre" hint="Les vérifications archivées apparaîtront ici" />
          )}
          {!registreLoading && registreHistory.map((entry) => (
            <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm leading-snug">
                    {entry.registre_securite?.installation ?? '—'}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {new Date(entry.date_verification + 'T12:00:00').toLocaleDateString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </p>
                </div>
                {entry.rapport_url && (
                  <a href={entry.rapport_url} target="_blank" rel="noreferrer"
                    className="flex-shrink-0 flex items-center gap-1 text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                    <FileText className="w-3 h-3" />Voir
                  </a>
                )}
              </div>
              {entry.nom_verificateur && (
                <p className="text-slate-400 text-xs">Vérificateur : <span className="text-slate-300">{entry.nom_verificateur}</span></p>
              )}
              {entry.observations && (
                <p className="text-slate-400 text-xs">Observations : <span className="text-slate-300">{entry.observations}</span></p>
              )}
              {entry.observations_levees && (
                <p className="text-xs text-emerald-400">Levée : {entry.observations_levees}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filter bottom sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-xl mx-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-28 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Filtres</h2>
              <button
                onClick={() => setSheetOpen(false)}
                className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center"
              >
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
                onChange={(v) => {
                  setDrillDate(null);
                  setFilters((f) => ({ ...f, type: v as Filters['type'] }));
                }}
              />
              <FilterGroup
                label="Période"
                options={[
                  { v: 'all', l: 'Tout' },
                  { v: 'today', l: "Aujourd'hui" },
                  { v: '7d', l: '7 jours' },
                  { v: '30d', l: '30 jours' },
                  { v: 'custom', l: 'Période' },
                ]}
                value={filters.date}
                onChange={(v) => {
                  setDrillDate(null);
                  setFilters((f) => ({ ...f, date: v as Filters['date'] }));
                }}
              />
              {filters.date === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Du
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Au
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setFilters(INITIAL); setDrillDate(null); }}
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

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
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
