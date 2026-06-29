import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type JourHoraire = { ouvert: boolean; ouverture: string; fermeture: string };
type HorairesOuverture = Record<string, JourHoraire>;

export type SessionType = 'normale' | 'exceptionnelle' | 'test' | null;

export type SessionState = {
  isActive: boolean;
  sessionType: SessionType;
  dateSoiree: string;
  isTest: boolean;
  expiresAt: Date | null;
  entrepriseId: string | null;
  sessionOpenedAt: Date | null;
};

export type UseSessionActiveReturn = SessionState & {
  openTestSession: () => Promise<void>;
  requestCloseTestSession: () => Promise<void>;
  openExceptionnelleSession: () => Promise<void>;
};

type EntrepriseSession = {
  id: string;
  horaires_ouverture: HorairesOuverture | null;
  force_session_active: boolean;
  force_session_type: string | null;
  force_session_opened_at: string | null;
  force_session_expires_at: string | null;
};

const JOURS_MAP: Record<number, string> = {
  0: 'dimanche', 1: 'lundi', 2: 'mardi', 3: 'mercredi',
  4: 'jeudi', 5: 'vendredi', 6: 'samedi',
};

function parseTime(timeStr: string): { h: number; m: number } | null {
  const match = timeStr?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return { h: parseInt(match[1]), m: parseInt(match[2]) };
}

function computeNormalSession(horaires: HorairesOuverture | null): { active: boolean; dateSoiree: string } {
  if (!horaires) return { active: false, dateSoiree: new Date().toISOString().slice(0, 10) };

  const now = new Date();
  const dayIdx = now.getDay();
  const yesterdayIdx = (dayIdx + 6) % 7;
  const todayKey = JOURS_MAP[dayIdx];
  const yesterdayKey = JOURS_MAP[yesterdayIdx];
  const currentMin = now.getHours() * 60 + now.getMinutes();

  // Check if current time is within today's scheduled window (post-midnight leg)
  const ySchedule = horaires[yesterdayKey];
  if (ySchedule?.ouvert && ySchedule.ouverture && ySchedule.fermeture) {
    const s = parseTime(ySchedule.ouverture);
    const e = parseTime(ySchedule.fermeture);
    if (s && e) {
      const sMin = s.h * 60 + s.m;
      const eMin = e.h * 60 + e.m;
      if (eMin < sMin && currentMin < eMin) {
        // We're in the post-midnight portion of yesterday's session
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { active: true, dateSoiree: yesterday.toISOString().slice(0, 10) };
      }
    }
  }

  // Check today's opening hour forward
  const tSchedule = horaires[todayKey];
  if (tSchedule?.ouvert && tSchedule.ouverture && tSchedule.fermeture) {
    const s = parseTime(tSchedule.ouverture);
    const e = parseTime(tSchedule.fermeture);
    if (s && e) {
      const sMin = s.h * 60 + s.m;
      const eMin = e.h * 60 + e.m;
      if (eMin > sMin) {
        // Same-day window
        if (currentMin >= sMin && currentMin < eMin) {
          return { active: true, dateSoiree: now.toISOString().slice(0, 10) };
        }
      } else {
        // Crosses midnight — we're in the pre-midnight portion
        if (currentMin >= sMin) {
          return { active: true, dateSoiree: now.toISOString().slice(0, 10) };
        }
      }
    }
  }

  return { active: false, dateSoiree: now.toISOString().slice(0, 10) };
}

function getTomorrow8h(): Date {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(8, 0, 0, 0);
  return t;
}

function resolveState(ent: EntrepriseSession | null): SessionState {
  if (!ent) {
    return {
      isActive: false, sessionType: null,
      dateSoiree: new Date().toISOString().slice(0, 10),
      isTest: false, expiresAt: null, entrepriseId: null, sessionOpenedAt: null,
    };
  }

  const normal = computeNormalSession(ent.horaires_ouverture);

  if (normal.active) {
    return {
      isActive: true, sessionType: 'normale',
      dateSoiree: normal.dateSoiree,
      isTest: false, expiresAt: null,
      entrepriseId: ent.id, sessionOpenedAt: null,
    };
  }

  if (ent.force_session_active && ent.force_session_type === 'exceptionnelle') {
    const expires = ent.force_session_expires_at ? new Date(ent.force_session_expires_at) : null;
    if (!expires || expires > new Date()) {
      return {
        isActive: true, sessionType: 'exceptionnelle',
        dateSoiree: new Date().toISOString().slice(0, 10),
        isTest: false, expiresAt: expires,
        entrepriseId: ent.id,
        sessionOpenedAt: ent.force_session_opened_at ? new Date(ent.force_session_opened_at) : null,
      };
    }
  }

  if (ent.force_session_active && ent.force_session_type === 'test') {
    const expires = ent.force_session_expires_at ? new Date(ent.force_session_expires_at) : null;
    if (!expires || expires > new Date()) {
      return {
        isActive: true, sessionType: 'test',
        dateSoiree: new Date().toISOString().slice(0, 10),
        isTest: true, expiresAt: expires,
        entrepriseId: ent.id,
        sessionOpenedAt: ent.force_session_opened_at ? new Date(ent.force_session_opened_at) : null,
      };
    }
  }

  return {
    isActive: false, sessionType: null,
    dateSoiree: new Date().toISOString().slice(0, 10),
    isTest: false, expiresAt: null,
    entrepriseId: ent?.id ?? null, sessionOpenedAt: null,
  };
}

export function useSessionActive(): UseSessionActiveReturn {
  const [entreprise, setEntreprise] = useState<EntrepriseSession | null>(null);
  const [state, setState] = useState<SessionState>(resolveState(null));
  const prevSessionTypeRef = useRef<SessionType>(null);
  const closingRef = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('etablissements')
      .select('id, horaires_ouverture, force_session_active, force_session_type, force_session_opened_at, force_session_expires_at')
      .order('enseigne', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    setEntreprise(data as EntrepriseSession | null);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('session_etablissement_watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'etablissements' }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Recompute state every 30 seconds to catch horaire-based transitions
  useEffect(() => {
    const timer = setInterval(() => {
      setState(resolveState(entreprise));
    }, 30_000);
    return () => clearInterval(timer);
  }, [entreprise]);

  useEffect(() => {
    const newState = resolveState(entreprise);
    setState(newState);
  }, [entreprise]);

  // Auto-close test session when a real session opens
  useEffect(() => {
    const prevType = prevSessionTypeRef.current;
    const curType = state.sessionType;
    prevSessionTypeRef.current = curType;

    if (
      prevType === 'test' &&
      (curType === 'normale' || curType === 'exceptionnelle') &&
      !closingRef.current &&
      state.entrepriseId
    ) {
      closingRef.current = true;
      const id = state.entrepriseId;
      const openedAt = entreprise?.force_session_opened_at ?? null;
      triggerCloseTestSession(id, openedAt).finally(() => { closingRef.current = false; });
    }
  }, [state.sessionType, state.entrepriseId, entreprise]);

  async function triggerCloseTestSession(entrepriseId: string, openedAt: string | null) {
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rapport-session-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ entreprise_id: entrepriseId, session_opened_at: openedAt }),
      });
    } catch (e) {
      console.warn('[SessionActive] rapport-session-test failed:', e);
    }
    await supabase.rpc('close_test_session', { p_entreprise_id: entrepriseId });
  }

  async function openTestSession() {
    if (!entreprise) return;
    const expires = getTomorrow8h();
    await supabase
      .from('etablissements')
      .update({
        force_session_active: true,
        force_session_type: 'test',
        force_session_opened_at: new Date().toISOString(),
        force_session_expires_at: expires.toISOString(),
      })
      .eq('id', entreprise.id);
    await load();
  }

  async function requestCloseTestSession() {
    if (!entreprise || closingRef.current) return;
    closingRef.current = true;
    try {
      await triggerCloseTestSession(entreprise.id, entreprise.force_session_opened_at);
    } finally {
      closingRef.current = false;
    }
    await load();
  }

  async function openExceptionnelleSession() {
    if (!entreprise) return;
    // Close test session first if active
    if (entreprise.force_session_active && entreprise.force_session_type === 'test') {
      await triggerCloseTestSession(entreprise.id, entreprise.force_session_opened_at);
    }
    const expires = getTomorrow8h();
    await supabase
      .from('etablissements')
      .update({
        force_session_active: true,
        force_session_type: 'exceptionnelle',
        force_session_opened_at: new Date().toISOString(),
        force_session_expires_at: expires.toISOString(),
      })
      .eq('id', entreprise.id);
    await load();
  }

  return {
    ...state,
    openTestSession,
    requestCloseTestSession,
    openExceptionnelleSession,
  };
}
