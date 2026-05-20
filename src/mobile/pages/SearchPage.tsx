import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EventCard, { EventItem } from '../components/EventCard';
import EntrepriseBadge from '../components/EntrepriseBadge';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); setTouched(false); return; }
    setTouched(true);
    setLoading(true);
    const handle = setTimeout(async () => {
      // Keep exact case for short ALL-CAPS input (e.g. "SSI"), lowercase otherwise
      const normalizedQuery = trimmed.length <= 4 && trimmed === trimmed.toUpperCase()
        ? trimmed
        : trimmed.toLowerCase();
      const like = `%${normalizedQuery}%`;
      const { data } = await supabase
        .from('evenements')
        .select('id, numero, type, espace_nom, zone_nom, niveau_label, date_evenement, created_by_email')
        .or(
          `type.ilike.${like},` +
          `espace_nom.ilike.${like},` +
          `zone_nom.ilike.${like},` +
          `niveau_label.ilike.${like}`
        )
        .order('created_at', { ascending: false })
        .limit(50);
      setResults((data ?? []) as EventItem[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div>
      <div className="px-5 pt-6 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-2xl font-bold truncate">Recherche</h1>
            <p className="text-slate-500 text-sm">Numéro, utilisateur, mot-clé, espace…</p>
          </div>
          <EntrepriseBadge />
        </div>
      </div>

      <div className="px-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un événement"
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-white text-[15px]
              placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
        </div>
      </div>

      <div className="px-5 py-5 space-y-2.5">
        {loading && <p className="text-slate-500 text-sm text-center py-8">Recherche…</p>}
        {!loading && touched && results.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">Aucun résultat.</p>
        )}
        {results.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      </div>
    </div>
  );
}
