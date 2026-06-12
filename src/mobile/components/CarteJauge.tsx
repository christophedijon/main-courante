import { useEffect, useRef, useState } from 'react';
import { Gauge, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Props = {
  count: number;
  Ep: number;
  entrepriseId: string;
  isTest?: boolean;
  onCountUpdate: (newCount: number) => void;
};

type Toast = { msg: string; type: 'success' | 'warning' };

const TODAY = () => new Date().toISOString().split('T')[0];

export default function CarteJauge({ count, Ep, entrepriseId, isTest = false, onCountUpdate }: Props) {
  const { session } = useAuth();
  // inputValue represents total tickets sold (cumulative entries), not current occupancy
  const [inputValue, setInputValue] = useState('');
  const [lastEntrees, setLastEntrees] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocused = useRef(false);

  // On mount: fetch the last manual entry total for today so the input is pre-filled
  useEffect(() => {
    supabase
      .from('jauge_actions')
      .select('delta')
      .eq('entreprise_id', entrepriseId)
      .eq('action', 'entree')
      .eq('source', 'manuel')
      .eq('is_test', isTest)
      .gte('created_at', TODAY() + 'T00:00:00Z')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const val = data?.delta ?? null;
        setLastEntrees(val);
        if (!isFocused.current) {
          setInputValue(val !== null ? String(val) : '');
        }
      });
  }, [entrepriseId]);

  function showToast(msg: string, type: Toast['type']) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function handleSubmit() {
    const entrees = parseInt(inputValue, 10);
    if (isNaN(entrees) || entrees < 0) return;
    if (!session?.user) return;

    setSaving(true);

    const { data, error } = await supabase.rpc('set_entrees_manuelles', {
      p_entreprise_id: entrepriseId,
      p_entrees: entrees,
      p_user_id: session.user.id,
      p_is_test: isTest,
    });

    setSaving(false);

    if (error) {
      showToast('Erreur lors de la mise à jour', 'warning');
      return;
    }

    const newCount = data as number;
    setLastEntrees(entrees);
    onCountUpdate(newCount);

    if (Ep > 0 && newCount > Ep) {
      showToast(`Attention : dépasse l'Ep (${Ep} personnes)`, 'warning');
    } else {
      showToast(`Jauge mise à jour : ${newCount} présents`, 'success');
    }
  }

  const parsedValue = parseInt(inputValue, 10);
  const overCapacity = Ep > 0 && !isNaN(parsedValue) && parsedValue > Ep;
  const unchanged = lastEntrees !== null && parsedValue === lastEntrees;

  return (
    <div className="mx-5 mb-4 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b
          ${toast.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-300'
            : 'bg-amber-950/80 border-amber-800/60 text-amber-300'}`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
          <Gauge className="w-4.5 h-4.5 text-blue-400" strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-white font-semibold text-[15px] leading-tight">Jauge billetterie</p>
          <p className="text-slate-500 text-xs">Entrées manuelles — mode sortie</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-3">
        {/* Input */}
        <div>
          <label className="block text-slate-400 text-xs font-medium mb-1.5 tracking-wide">
            Total billets vendus (cumulatif)
          </label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputValue}
            placeholder="0"
            onFocus={() => { isFocused.current = true; }}
            onBlur={() => { isFocused.current = false; }}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); handleSubmit(); } }}
            className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white text-3xl font-bold tabular-nums text-center
              focus:outline-none focus:ring-2 transition-all
              ${overCapacity
                ? 'border-amber-500/50 focus:ring-amber-500/30'
                : 'border-slate-700 focus:ring-blue-500/30 focus:border-blue-500/50'}`}
          />
          {overCapacity && (
            <p className="flex items-center gap-1.5 text-amber-400 text-xs mt-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Attention : dépasse l'Ep ({Ep} personnes)
            </p>
          )}
        </div>

        {/* Current occupancy */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <span className="text-slate-400 text-sm">En salle</span>
          <span className="text-white font-bold text-lg tabular-nums">
            {count.toLocaleString('fr-FR')}
            <span className="text-slate-400 font-normal text-sm ml-1">personnes</span>
          </span>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || isNaN(parsedValue) || parsedValue < 0 || unchanged}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-[15px] transition-all disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Valider'}
        </button>

        <p className="text-center text-slate-600 text-xs">La valeur est modifiable à tout moment</p>
      </div>
    </div>
  );
}
