import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, ArrowRight, Users, RotateCcw, CheckCircle,
  AlertCircle, ExternalLink, Gauge, X, Wifi, FlaskConical, Power,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import { useSessionActive } from '../hooks/useSessionActive';

type ModeJauge = 'entree_sortie' | 'sortie' | 'automatique';

type EntrepriseJauge = {
  id: string;
  mode_jauge: ModeJauge;
  effectif_public: number;
  url_billetterie: string;
  frequence_billetterie: number;
};

type JaugeEtat = {
  count_actuel: number;
};

type Toast = { msg: string; type: 'success' | 'error' };

export default function JaugeConfigPage() {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const sessionState = useSessionActive();

  const [entreprise, setEntreprise] = useState<EntrepriseJauge | null>(null);
  const [jaugeEtat, setJaugeEtat] = useState<JaugeEtat | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [togglingTest, setTogglingTest] = useState(false);

  const [countdown, setCountdown] = useState<number>(0);
  const [dernierAjout, setDernierAjout] = useState<{ delta: number; heure: string } | null>(null);
  const [totalSorties, setTotalSorties] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadData() {
    const [entrepriseRes, etatRes] = await Promise.all([
      supabase
        .from('etablissements')
        .select('id, mode_jauge, effectif_public, url_billetterie, frequence_billetterie')
        .order('enseigne', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('jauge_etat')
        .select('count_actuel')
        .eq('date_soiree', new Date().toISOString().slice(0, 10))
        .eq('is_test', false)
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
          .eq('is_test', false)
          .maybeSingle()
          .then(({ data }) => setJaugeEtat(data ?? { count_actuel: 0 }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (entreprise?.mode_jauge !== 'automatique') return;

    async function loadSorties() {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('jauge_actions')
        .select('delta')
        .eq('etablissement_id', entreprise!.id)
        .eq('action', 'sortie')
        .eq('is_test', false)
        .gte('created_at', startOfDay.toISOString());
      if (!error) {
        const total = (data ?? []).reduce((sum, r) => sum + Math.abs(r.delta), 0);
        setTotalSorties(total);
      }
    }

    async function loadDernierAjout() {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('jauge_actions')
        .select('delta, created_at')
        .eq('etablissement_id', entreprise!.id)
        .eq('action', 'entree')
        .in('source', ['app', 'manuel'])
        .eq('is_test', false)
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const heure = new Date(data.created_at)
          .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        setDernierAjout({ delta: data.delta, heure });
      }
    }

    const freqSec = (entreprise?.frequence_billetterie ?? 10) * 60;
    setCountdown(freqSec);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          loadSorties();
          loadDernierAjout();
          return freqSec;
        }
        return prev - 1;
      });
    }, 1000);

    loadSorties();
    loadDernierAjout();

    const actionsChannel = supabase
      .channel('jauge_actions_monitoring')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jauge_actions' }, () => {
        loadSorties();
        loadDernierAjout();
      })
      .subscribe();

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      supabase.removeChannel(actionsChannel);
    };
  }, [entreprise?.mode_jauge, entreprise?.frequence_billetterie, entreprise?.id]);

  async function handleModeChange(mode: ModeJauge) {
    if (!entreprise || savingMode) return;
    setSavingMode(true);
    const prev = entreprise.mode_jauge;
    setEntreprise({ ...entreprise, mode_jauge: mode });

    const { error } = await supabase
      .from('etablissements')
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
      p_etablissement_id: entreprise.id,
      p_user_id: session.user.id,
      p_is_test: false,
    });

    if (error) {
      showToast('Erreur lors de la remise à zéro', 'error');
    } else {
      setJaugeEtat({ count_actuel: 0 });
      showToast('Compteur remis à zéro', 'success');
    }
    setResetting(false);
  }

  async function handleToggleTest() {
    if (togglingTest) return;
    setTogglingTest(true);
    try {
      if (sessionState.sessionType === 'test') {
        await sessionState.requestCloseTestSession();
        showToast('Session de test fermée — rapport envoyé', 'success');
      } else {
        await sessionState.openTestSession();
        showToast('Session de test ouverte', 'success');
      }
    } catch {
      showToast('Erreur lors du changement de mode', 'error');
    } finally {
      setTogglingTest(false);
    }
  }

  const isTestActive = sessionState.sessionType === 'test';
  const isRealSessionActive = sessionState.sessionType === 'normale' || sessionState.sessionType === 'exceptionnelle';

  const count = jaugeEtat?.count_actuel ?? 0;
  const max = entreprise?.effectif_public ?? 0;
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

                {/* Card C — Flux billetterie automatique */}
                <button
                  onClick={() => handleModeChange('automatique')}
                  disabled={savingMode}
                  className={`relative text-left rounded-xl border-2 p-5 transition-all focus:outline-none col-span-1 sm:col-span-2
                    ${entreprise?.mode_jauge === 'automatique'
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                >
                  {entreprise?.mode_jauge === 'automatique' && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                  <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center mb-3">
                    <Wifi className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-white font-semibold text-sm mb-1">
                    Flux billetterie automatique
                  </p>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">
                    La jauge se met à jour automatiquement depuis votre logiciel de billetterie ZAPSIS.
                  </p>
                  {entreprise?.mode_jauge === 'automatique' && (
                    <div className="mt-2 space-y-4">
                      {/* URL field */}
                      <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wide">
                          URL du flux billetterie
                        </label>
                        <input
                          type="text"
                          value={entreprise.url_billetterie ?? ''}
                          onChange={(e) => setEntreprise({
                            ...entreprise, url_billetterie: e.target.value
                          })}
                          onBlur={async (e) => {
                            await supabase.from('etablissements')
                              .update({ url_billetterie: e.target.value })
                              .eq('id', entreprise.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="https://zapsisweb.com/result/resultNbTicket?disco=..."
                          className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl
                                     px-3 py-2 text-white text-sm focus:outline-none
                                     focus:border-emerald-500"
                        />
                      </div>
                      {/* Frequency selector */}
                      <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wide">
                          Fréquence d'interrogation
                        </label>
                        <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          {([3, 5, 10] as const).map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={async () => {
                                setEntreprise({ ...entreprise, frequence_billetterie: val });
                                await supabase.from('etablissements')
                                  .update({ frequence_billetterie: val })
                                  .eq('id', entreprise.id);
                              }}
                              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors
                                ${(entreprise.frequence_billetterie ?? 10) === val
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                            >
                              {val} min
                            </button>
                          ))}
                        </div>
                        <p className="text-emerald-400 text-xs mt-2">
                          ✓ Prochaine mise à jour dans {entreprise.frequence_billetterie ?? 10} min
                        </p>
                      </div>

                      {/* Monitoring temps réel */}
                      <div className="mt-4 grid grid-cols-3 gap-3" onClick={(e) => e.stopPropagation()}>
                        {/* Compte à rebours */}
                        <div className="bg-slate-900/80 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
                            Prochaine lecture
                          </p>
                          <p className="text-emerald-400 font-mono font-bold text-lg leading-none">
                            {String(Math.floor(countdown / 60)).padStart(2, '0')}:
                            {String(countdown % 60).padStart(2, '0')}
                          </p>
                        </div>
                        {/* Dernier ajout ZAPSIS */}
                        <div className="bg-slate-900/80 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
                            Dernier ajout
                          </p>
                          {dernierAjout ? (
                            <>
                              <p className="text-white font-bold text-lg leading-none">
                                +{dernierAjout.delta}
                              </p>
                              <p className="text-slate-500 text-[10px] mt-0.5">
                                à {dernierAjout.heure}
                              </p>
                            </>
                          ) : (
                            <p className="text-slate-600 text-sm">—</p>
                          )}
                        </div>
                        {/* Total sorties */}
                        <div className="bg-slate-900/80 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">
                            Sorties Flic
                          </p>
                          <p className="text-orange-400 font-bold text-lg leading-none">
                            {totalSorties}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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

            {/* Section 4 — Session de test */}
            <section className={`border rounded-2xl p-6 transition-colors ${
              isTestActive
                ? 'bg-amber-950/40 border-amber-700/60'
                : isRealSessionActive
                  ? 'bg-slate-900/50 border-slate-800 opacity-60'
                  : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isTestActive ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-800 border border-slate-700'
                  }`}>
                    <FlaskConical className={`w-5 h-5 ${isTestActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-base">Session de test</h2>
                    <p className="text-slate-500 text-sm mt-0.5">
                      {isTestActive
                        ? `Active depuis ${sessionState.sessionOpenedAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) ?? '—'} — fermeture auto à 08h00`
                        : isRealSessionActive
                          ? 'Indisponible — session réelle en cours'
                          : 'Ouvre une session fictive pour tester le Flic et la saisie'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleToggleTest}
                  disabled={togglingTest || isRealSessionActive}
                  className={`relative shrink-0 w-12 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                    isTestActive ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isTestActive ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {isTestActive && (
                <div className="mt-4 p-3 rounded-xl bg-amber-900/30 border border-amber-700/40">
                  <div className="flex items-start gap-2">
                    <Power className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-300 leading-relaxed space-y-1">
                      <p className="font-semibold">Mode test actif — données non opérationnelles</p>
                      <p>Le Flic enregistre les appuis sur une ligne isolée. Ces données seront purgées et un rapport de test sera envoyé par mail à la fermeture.</p>
                      <p>La session se ferme automatiquement à 08h00 ou dès l'ouverture d'une vraie session.</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
