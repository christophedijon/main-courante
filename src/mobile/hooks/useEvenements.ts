import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { EventItem } from '../components/EventCard';

export function useRecentEvents(limit = 5) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('evenements')
      .select('id, numero, type, espace_nom, zone_nom, niveau_label, date_evenement, created_by_email')
      .order('date_evenement', { ascending: false })
      .limit(limit);
    setEvents((data ?? []) as EventItem[]);
    setLoading(false);
  }, [limit]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
}

export function useTodayEventsCount() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    supabase
      .from('evenements')
      .select('id', { count: 'exact', head: true })
      .gte('date_evenement', start.toISOString())
      .then(({ count: c }) => setCount(c ?? 0));
  }, []);

  return count;
}
