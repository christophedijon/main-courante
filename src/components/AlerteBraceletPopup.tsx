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

function beep(times: number) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void ctx.resume();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.6;
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    }
    setTimeout(() => void ctx.close(), times * 600 + 1000);
  } catch {
    // le son est bloqué avant la première interaction navigateur : l'alerte reste visible
  }
}

export default function AlerteBraceletPopup() {
  const { session } = useAuth();
  const { id: etabId } = useEntreprise();
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const etabIdRef = useRef(etabId);
  etabIdRef.current = etabId;

  const fermer = useCallback((id: string) => {
    setAlertes((list) => list.filter((a) => a.id !== id));
  }, []);

  const prendreEnCharge = useCallback(async (a: Alerte) => {
    await supabase.from('alertes_bracelet').update({ statut: 'prise en charge' }).eq('id', a.id);
    fermer(a.id);
  }, [fermer]);

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
        beep(1);
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
    };
  }, [session, etabId, handleInsert]);

  const sonRépété = alertes.some((a) => !styleFor(a.code).annulation);

  const nbAlertes = alertes.length;

  useEffect(() => {
    if (nbAlertes === 0) return;
    beep(sonRépété ? 2 : 1);
    if (!sonRépété) return;
    const interval = setInterval(() => beep(2), 3000);
    return () => clearInterval(interval);
  }, [nbAlertes, sonRépété]);

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
              <button
                type="button"
                onClick={() => void prendreEnCharge(a)}
                className="mt-5 w-full py-3 rounded-2xl bg-white/95 text-slate-900 font-bold flex items-center justify-center gap-2 hover:bg-white transition-colors"
              >
                <Hand className="w-5 h-5" /> Prendre en charge
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
