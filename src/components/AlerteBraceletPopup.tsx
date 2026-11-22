import { useCallback, useEffect, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntreprise } from '../hooks/useEntreprise';

type Alerte = {
  id: string;
  bracelet_id: string | null;
  code: string | null;
  batterie: number | null;
  rssi: number | null;
  passerelle: string | null;
  created_at: string;
};

type AlerteStyle = {
  bg: string;
  ring: string;
  blink: boolean;
  label: string;
  annulation: boolean;
};

function styleFor(code: string | null): AlerteStyle {
  const c = (code ?? '').toUpperCase();
  if (c.includes('ANNUL')) {
    return { bg: 'bg-green-600', ring: 'ring-green-300', blink: false, label: 'ANNULATION', annulation: true };
  }
  if (c.includes('CODE 3')) {
    return { bg: 'bg-red-800', ring: 'ring-red-400', blink: true, label: c, annulation: false };
  }
  if (c.includes('CODE 2')) {
    return { bg: 'bg-red-600', ring: 'ring-red-300', blink: false, label: c, annulation: false };
  }
  return { bg: 'bg-orange-500', ring: 'ring-orange-300', blink: false, label: c || 'ALERTE', annulation: false };
}

function créerContexteAudio(): AudioContext | null {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void ctx.resume();
    return ctx;
  } catch {
    // le son est bloqué avant la première interaction navigateur : l'alerte reste visible
    return null;
  }
}

function bipAnnulation() {
  const ctx = créerContexteAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
  setTimeout(() => void ctx.close(), 1000);
}

// Un cycle d'alarme type FR-Alert : 2 s son, 0,5 s silence, 1 s son, 0,5 s silence, 1 s son, puis 1 s de silence (6 s au total)
function jouerCycleAlarme(ctx: AudioContext) {
  const segments: Array<[number, boolean]> = [[2, true], [0.5, false], [1, true], [0.5, false], [1, true]];
  let t = ctx.currentTime + 0.05;
  for (const [durée, actif] of segments) {
    if (actif) {
      for (const fréquence of [853, 960]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = fréquence;
        gain.gain.setValueAtTime(0.5, t);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + durée);
      }
    }
    t += durée;
  }
}

function BoutonVu({ id, fermer }: { id: string; fermer: (id: string) => void }) {
  const [restant, setRestant] = useState(15);

  useEffect(() => {
    if (restant <= 0) {
      fermer(id);
      return;
    }
    const t = setTimeout(() => setRestant((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restant, id, fermer]);

  return (
    <button
      type="button"
      onClick={() => fermer(id)}
      className="mt-5 w-full py-3 rounded-2xl bg-white/95 text-slate-900 font-bold flex items-center justify-center gap-2 hover:bg-white transition-colors"
    >
      VU <span className="text-slate-500 font-semibold">({restant} s)</span>
    </button>
  );
}

export default function AlerteBraceletPopup() {
  const { session } = useAuth();
  const { id: etabId } = useEntreprise();
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const etabIdRef = useRef(etabId);
  etabIdRef.current = etabId;

  const alarmeCtxRef = useRef<AudioContext | null>(null);
  const alarmeTimerRef = useRef<number | null>(null);

  const arrêterAlarme = useCallback(() => {
    if (alarmeTimerRef.current !== null) {
      clearInterval(alarmeTimerRef.current);
      alarmeTimerRef.current = null;
    }
    if (alarmeCtxRef.current) {
      void alarmeCtxRef.current.close();
      alarmeCtxRef.current = null;
    }
  }, []);

  const démarrerAlarme = useCallback(() => {
    arrêterAlarme();
    const ctx = créerContexteAudio();
    if (!ctx) return;
    alarmeCtxRef.current = ctx;
    jouerCycleAlarme(ctx);
    alarmeTimerRef.current = window.setInterval(() => jouerCycleAlarme(ctx), 6000);
  }, [arrêterAlarme]);

  const fermer = useCallback((id: string) => {
    setAlertes((list) => list.filter((a) => a.id !== id));
  }, []);

  const prendreEnCharge = useCallback(async (a: Alerte) => {
    arrêterAlarme();
    await supabase.from('alertes_bracelet').update({ statut: 'prise en charge' }).eq('id', a.id);
    fermer(a.id);
  }, [fermer, arrêterAlarme]);

  const handleInsert = useCallback((row: Alerte) => {
    if (etabIdRef.current && row) {
      const st = styleFor(row.code);
      if (st.annulation) {
        setAlertes((list) => {
          const memeBracelet = list.filter((o) => o.bracelet_id !== null && o.bracelet_id === row.bracelet_id && !styleFor(o.code).annulation);
          for (const o of memeBracelet) {
            void supabase.from('alertes_bracelet').update({ statut: 'annulée' }).eq('id', o.id);
          }
          return [{ ...row }, ...list.filter((o) => !memeBracelet.some((m) => m.id === o.id))];
        });
        bipAnnulation();
        arrêterAlarme();
      } else {
        setAlertes((list) => [{ ...row }, ...list.filter((o) => o.id !== row.id)]);
      }
    }
  }, []);

  useEffect(() => {
    if (!session || !etabId) return;
    const channel = supabase
      .channel(`alertes-bracelet-${etabId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alertes_bracelet', filter: `etablissement_id=eq.${etabId}` },
        (payload) => handleInsert(payload.new as Alerte)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      setAlertes([]);
      arrêterAlarme();
    };
  }, [session, etabId, handleInsert, arrêterAlarme]);

  const sonRépété = alertes.some((a) => !styleFor(a.code).annulation);

  useEffect(() => {
    if (!sonRépété) return;
    démarrerAlarme();
    return () => arrêterAlarme();
  }, [sonRépété, démarrerAlarme, arrêterAlarme]);

  if (!session || !etabId || alertes.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 pointer-events-none">
      <style>{`@keyframes ab-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.35; } }`}</style>
      <div className="w-full max-w-md space-y-3 pointer-events-auto">
        {alertes.map((a) => {
          const st = styleFor(a.code);
          return (
            <div
              key={a.id}
              role="alertdialog"
              aria-label={`Alerte bracelet ${st.label}`}
              className={`rounded-3xl ring-4 ${st.bg} ${st.ring} shadow-2xl text-white p-6 text-center`}
              style={st.blink ? { animation: 'ab-blink 0.8s step-end infinite' } : undefined}
            >
              <p className="text-5xl font-black tracking-wide leading-tight">{st.label}</p>
              <p className="mt-3 text-xl font-bold">{a.bracelet_id ?? 'Bracelet inconnu'}</p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-white/90">
                <span>Passerelle : {a.passerelle ?? '—'}</span>
                <span>Batterie : {a.batterie !== null ? `${a.batterie} %` : '—'}</span>
                <span className="col-span-2">{new Date(a.created_at).toLocaleTimeString('fr-FR')}</span>
              </div>
              {st.annulation ? (
                <BoutonVu id={a.id} fermer={fermer} />
              ) : (
                <button
                  type="button"
                  onClick={() => void prendreEnCharge(a)}
                  className="mt-5 w-full py-3 rounded-2xl bg-white/95 text-slate-900 font-bold flex items-center justify-center gap-2 hover:bg-white transition-colors"
                >
                  <Hand className="w-5 h-5" /> Prendre en charge
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
