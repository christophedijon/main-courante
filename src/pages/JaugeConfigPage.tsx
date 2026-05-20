import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, ArrowRight, Users, RotateCcw, CheckCircle,
  AlertCircle, ExternalLink, Gauge, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

type ModeJauge = 'entree_sortie' | 'sortie';

type EntrepriseJauge = {
  id: string;
  mode_jauge: ModeJauge;
  effectif_public_maximum: number;
};

type JaugeEtat = {
  count_actuel: number;
};

type Toast = { msg: string; type: 'success' | 'error' };

export default function JaugeConfigPage() {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();

  const [entreprise, setEntreprise] = useState<EntrepriseJauge | null>(null);
  const [jaugeEtat, setJaugeEtat] = useState<JaugeEtat | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadData() {
    const [entrepriseRes, etatRes] = await Promise.all([
      supabase
        .from('entreprise')
        .select('id, mode_jauge, effectif_public_maximum')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('jauge_etat')
        .select('count_actuel')
        .eq('date_soiree', new Date().toISOString().slice(0, 10))
        .maybeSingle(),
    ]);

    if (entrepriseRes.data) setEntreprise(entrepriseRes.data as EntrepriseJauge);
    setJaugeEtat(etatRes.data ?? { count_actuel: 0 });
    setLoading(false);
  }

  useEffect(() => {
    loadData();

    // Subscribe to realtime updates on jauge_etat
    const channel = supabase
      .channel('jauge_etat_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jauge_etat' }, () => {
        supabase
          .from('jauge_etat')
          .select('count_actuel')
          .eq('date_soiree', new Date().toISOString().slice(0, 10))
          .maybeSingle()
          .then(({ data }) => setJaugeEtat(data ?? { count_actuel: 0 }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleModeChange(mode: ModeJauge) {
    if (!entreprise || savingMode) return;
    setSavingMode(true);
    const prev = entreprise.mode_jauge;
    setEntreprise({ ...entreprise, mode_jauge: mode });

    const { error } = await supabase
      .from('entreprise')
      .update({ mode_jauge: mode })
      .eq('id', entreprise.id);

    if (error) {
      setEntreprise({ ...entreprise, mode_jauge: prev });
      showToast('Erreur lors de la sauvegarde', 'error');
    } else {
      showToast('Mode de comptage mis à jour', 'success');
    }
    setSavingMode(false);
  }

  async function handleReset() {
    if (!entreprise || !session?.user) return;
    setResetting(true);
    setShowConfirm(false);

    const { error } = await supabase.rpc('reset_jauge', {
      p_entreprise_id: entreprise.id,
      p_user_id: session.user.id,
    });

    if (error) {
      showToast('Erreur lors de la remise à zéro', 'error');
    } else {
      setJaugeEtat({ count_actuel: 0 });
      showToast('Compteur remis à zéro', 'success');
    }
    setResetting(false);
  }

  const count = jaugeEtat?.count_actuel ?? 0;
  const max = entreprise?.effectif_public_maximum ?? 0;
  const occupancyPct = max > 0 ? Math.min(100, (count / max) * 100) : 0;
  const occupancyColor =
    occupancyPct >= 90 ? 'bg-red-500' :
    occupancyPct >= 70 ? 'bg-amber-500' :
    'bg-emerald-500';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AppHeader onSignOut={signOut} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium
          ${toast.type === 'success'
            ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
            : 'bg-red-950 border-red-700 text-red-300'}`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-red-400" />
              </div>
              <button onClick={() => setShowConfirm(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <h3 className="text-white font-semibold text-base mb-1">Confirmer la remise à zéro</h3>
            <p className="text-slate-400 text-sm mb-6">
              Le compteur de la soirée en cours sera remis à zéro. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {resetting ? 'Remise à zéro…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Page header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Gauge className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Jauge</h1>
            <p className="text-slate-400 text-sm">Configuration du comptage d'affluence</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <>
            {/* Section 1 — Mode de comptage */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-base mb-1">Mode de comptage</h2>
              <p className="text-slate-500 text-sm mb-5">
                Définit comment les dispositifs de comptage (Flic) incrémentent la jauge.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Card A — Entrée / Sortie */}
                <button
                  onClick={() => handleModeChange('entree_sortie')}
                  disabled={savingMode}
                  className={`relative text-left rounded-xl border-2 p-5 transition-all focus:outline-none
                    ${entreprise?.mode_jauge === 'entree_sortie'
                      ? 'border-blue-500 bg-blue-500/5'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                >
                  {entreprise?.mode_jauge === 'entree_sortie' && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400" />
                  )}
                  <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center mb-3">
                    <ArrowLeftRight className="w-5 h-5 text-slate-200" />
                  </div>
                  <p className="text-white font-semibold text-sm mb-1">Entrée / Sortie</p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Flic Duo — bouton gauche +1 entrée, bouton droit −1 sortie
                  </p>
                </button>

                {/* Card B — Sortie uniquement */}
                <button
                  onClick={() => handleModeChange('sortie')}
                  disabled={savingMode}
                  className={`relative text-left rounded-xl border-2 p-5 transition-all focus:outline-none
                    ${entreprise?.mode_jauge === 'sortie'
                      ? 'border-blue-500 bg-blue-500/5'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                >
                  {entreprise?.mode_jauge === 'sortie' && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400" />
                  )}
                  <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center mb-3">
                    <ArrowRight className="w-5 h-5 text-slate-200" />
                  </div>
                  <p className="text-white font-semibold text-sm mb-1">Sortie uniquement</p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Flic Single ou bouton droit Duo — chaque pression = −1 sortie. Entrées saisies manuellement.
                  </p>
                </button>
              </div>
            </section>

            {/* Section 2 — Capacité maximum */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-base mb-1">Capacité maximum (Ep)</h2>
              <p className="text-slate-500 text-sm mb-5">
                L'effectif public maximum autorisé dans l'établissement.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-white tabular-nums">
                    {max > 0 ? max.toLocaleString('fr-FR') : '—'}
                    {max > 0 && <span className="text-lg font-medium text-slate-400 ml-2">personnes</span>}
                  </p>
                  {max === 0 && (
                    <p className="text-slate-500 text-sm">Non défini</p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-2">
                <p className="text-slate-500 text-xs">Modifiable dans les paramètres de l'entreprise</p>
                <button
                  onClick={() => navigate('/entreprise')}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                >
                  Accéder <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </section>

            {/* Section 3 — Soirée en cours */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-white font-semibold text-base mb-1">Soirée en cours</h2>
              <p className="text-slate-500 text-sm mb-6">
                Compteur en temps réel pour la date d'aujourd'hui.
              </p>

              {/* Count display */}
              <div className="flex items-end gap-4 mb-5">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1 font-medium">Présents</p>
                  <p className="text-5xl font-bold tabular-nums text-white">{count.toLocaleString('fr-FR')}</p>
                </div>
                {max > 0 && (
                  <div className="pb-1.5">
                    <p className="text-slate-500 text-sm">/ {max.toLocaleString('fr-FR')}</p>
                  </div>
                )}
              </div>

              {/* Occupancy bar */}
              {max > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Taux d'occupation</span>
                    <span className={
                      occupancyPct >= 90 ? 'text-red-400 font-semibold' :
                      occupancyPct >= 70 ? 'text-amber-400 font-semibold' :
                      'text-emerald-400'
                    }>{Math.round(occupancyPct)} %</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${occupancyColor}`}
                      style={{ width: `${occupancyPct}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowConfirm(true)}
                disabled={resetting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600/15 border border-red-600/30 text-red-400
                  hover:bg-red-600/25 hover:border-red-500/50 hover:text-red-300 transition-all text-sm font-medium disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Remettre à zéro
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
