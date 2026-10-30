import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle, Activity, CalendarDays, Loader2, Minus, ShieldAlert, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  JOURS,
  availablePeriods,
  categories,
  ecart,
  filterSoirees,
  formatPeriod,
  formatPic,
  joursPresents,
  moyenneParJour,
  previousPeriod,
  profilHoraire,
  resume,
  type HeureStat,
  type Mode,
  type SoireeStat,
} from '../lib/statistiques';

const JOUR_LIBELLE_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function formatDateCourte(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function formatDateLongue(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

function formatNombre(n: number, decimales = 0) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function formatHeure(h: number) {
  return `${String(h).padStart(2, '0')}h`;
}

function Delta({ actuel, precedent }: { actuel: number; precedent: number }) {
  const { valeur, pourcent } = ecart(actuel, precedent);
  const Icone = valeur > 0 ? TrendingUp : valeur < 0 ? TrendingDown : Minus;
  const couleur = valeur > 0 ? 'text-emerald-400' : valeur < 0 ? 'text-rose-400' : 'text-slate-400';
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${couleur}`}>
      <Icone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        {valeur > 0 ? '+' : ''}{formatNombre(valeur, Number.isInteger(valeur) ? 0 : 2)}
        {pourcent !== null && ` (${pourcent > 0 ? '+' : ''}${formatNombre(pourcent, 1)} %)`}
      </span>
    </div>
  );
}

function StatCard({ titre, valeur, icone: Icone, delta }: {
  titre: string;
  valeur: string;
  icone: typeof Users;
  delta: ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-colors hover:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm text-slate-400 font-medium leading-tight">{titre}</span>
        <Icone className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
      </div>
      <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums leading-none">{valeur}</span>
      {delta}
    </div>
  );
}

function BarChart({ items, minWidthParBarre }: {
  items: { key: string; label: string; value: number; title: string }[];
  minWidthParBarre: number;
}) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-end gap-1.5 h-44" style={{ minWidth: items.length * minWidthParBarre }}>
        {items.map(item => (
          <div key={item.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5 min-w-0">
            <span className="text-[10px] text-slate-400 tabular-nums">{item.value > 0 ? formatNombre(item.value) : ''}</span>
            <div
              title={item.title}
              className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-500 hover:from-blue-500 hover:to-blue-300"
              style={{ height: `${Math.max(item.value > 0 ? 3 : 0, (item.value / max) * 100)}%` }}
            />
            <span className="text-[10px] text-slate-500 whitespace-nowrap">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panneau({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
      <h2 className="text-sm sm:text-base font-semibold text-white mb-4">{titre}</h2>
      {children}
    </section>
  );
}

export default function StatistiquesPage() {
  const { isDirection, isSuperAdmin, loading: authLoading, userMetaReady } = useAuth();
  const autorise = isDirection && !isSuperAdmin;

  const [soirees, setSoirees] = useState<SoireeStat[]>([]);
  const [heures, setHeures] = useState<HeureStat[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [rechargement, setRechargement] = useState(0);
  const [mode, setMode] = useState<Mode>('mois');
  const [periodeChoisie, setPeriodeChoisie] = useState<string | null>(null);
  const [joursChoisis, setJoursChoisis] = useState<Set<number> | null>(null);

  useEffect(() => {
    if (!autorise) return;
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(false);
      const [resSoirees, resHeures] = await Promise.all([
        supabase
          .from('stats_soiree')
          .select('date_soiree, jour_semaine, visiteurs, pic_debut, pic_fin, nb_evenements, evenements_par_categorie, saut_detecte, mode_jauge')
          .order('date_soiree', { ascending: true }),
        supabase
          .from('stats_soiree_heures')
          .select('date_soiree, heure_paris, entrees'),
      ]);
      if (annule) return;
      if (resSoirees.error || resHeures.error || !Array.isArray(resSoirees.data) || !Array.isArray(resHeures.data)) {
        setSoirees([]);
        setHeures([]);
        setErreur(true);
      } else {
        setSoirees(resSoirees.data as SoireeStat[]);
        setHeures(resHeures.data as HeureStat[]);
      }
      setChargement(false);
    })();
    return () => { annule = true; };
  }, [autorise, rechargement]);

  if (authLoading || !userMetaReady) {
    return <EcranChargement />;
  }
  if (!autorise) {
    return <Navigate to="/mobile" replace />;
  }

  const periodes = availablePeriods(soirees, mode);
  const periode = periodeChoisie && periodes.includes(periodeChoisie) ? periodeChoisie : (periodes[0] ?? null);
  const joursPresent = joursPresents(soirees);
  const jours = joursChoisis ?? new Set(joursPresent);
  const precedente = periode ? previousPeriod(periode, mode) : null;

  const courantes = periode ? filterSoirees(soirees, periode, mode, jours) : [];
  const precedentes = precedente ? filterSoirees(soirees, precedente, mode, jours) : [];
  const comptees = courantes.filter(s => s.visiteurs > 0);
  const rCourant = resume(comptees);
  const rPrec = resume(precedentes.filter(s => s.visiteurs > 0));
  const profil = profilHoraire(heures, new Set(comptees.map(s => s.date_soiree)));
  const cats = categories(comptees);
  const moyJours = moyenneParJour(comptees, jours);

  function changerMode(nouveau: Mode) {
    setMode(nouveau);
    setPeriodeChoisie(null);
  }

  function basculerJour(jour: number) {
    const suivant = new Set(jours);
    if (suivant.has(jour)) suivant.delete(jour);
    else suivant.add(jour);
    setJoursChoisis(suivant);
  }

  const libellePrec = precedente ? formatPeriod(precedente, mode) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-3xl font-bold text-white">Statistiques</h1>
          <p className="text-sm text-slate-400">Fréquentation et événements de vos soirées</p>
        </header>

        {chargement && <EcranChargement />}

        {!chargement && erreur && (
          <div className="bg-rose-950/40 border border-rose-900 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />
              <p className="text-sm text-rose-100">Les statistiques n'ont pas pu être chargées. Vérifiez votre connexion puis réessayez.</p>
            </div>
            <button
              onClick={() => setRechargement(v => v + 1)}
              className="self-start sm:self-auto text-sm font-semibold px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-400 transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}

        {!chargement && !erreur && soirees.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <CalendarDays className="w-8 h-8 text-slate-500 mx-auto mb-3" aria-hidden="true" />
            <p className="text-white font-semibold">Aucune soirée enregistrée</p>
            <p className="text-sm text-slate-400 mt-1">Les statistiques apparaîtront ici dès la première soirée clôturée.</p>
          </div>
        )}

        {!chargement && !erreur && soirees.length > 0 && (
          <>
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-400 font-medium">Période</span>
                  <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800">
                    {(['mois', 'annee'] as Mode[]).map(m => (
                      <button
                        key={m}
                        onClick={() => changerMode(m)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${mode === m ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      >
                        {m === 'mois' ? 'Mois' : 'Année'}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex flex-col gap-1.5 sm:min-w-[220px]">
                  <span className="text-xs text-slate-400 font-medium">{mode === 'mois' ? 'Mois' : 'Année'}</span>
                  <select
                    value={periode ?? ''}
                    onChange={e => setPeriodeChoisie(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white capitalize focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  >
                    {periodes.map(p => (
                      <option key={p} value={p}>{formatPeriod(p, mode)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Jours d'ouverture</span>
                <div className="flex flex-wrap gap-2">
                  {joursPresent.map(jour => {
                    const actif = jours.has(jour);
                    return (
                      <button
                        key={jour}
                        onClick={() => basculerJour(jour)}
                        aria-pressed={actif}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${actif ? 'bg-blue-500/15 border-blue-500/50 text-blue-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
                      >
                        {JOUR_LIBELLE_COURT[jour - 1]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {periode && courantes.length === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
                <p className="text-white font-semibold">Aucune soirée sur cette période</p>
                <p className="text-sm text-slate-400 mt-1">Essayez de cocher davantage de jours d'ouverture.</p>
              </div>
            )}

            {courantes.length > 0 && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <StatCard
                    titre="Visiteurs totaux"
                    valeur={formatNombre(rCourant.visiteurs)}
                    icone={Users}
                    delta={libellePrec && <Delta actuel={rCourant.visiteurs} precedent={rPrec.visiteurs} />}
                  />
                  <StatCard
                    titre="Soirées"
                    valeur={formatNombre(rCourant.soirees)}
                    icone={CalendarDays}
                    delta={libellePrec && <Delta actuel={rCourant.soirees} precedent={rPrec.soirees} />}
                  />
                  <StatCard
                    titre="Moyenne par soirée"
                    valeur={formatNombre(rCourant.moyenne)}
                    icone={Users}
                    delta={libellePrec && <Delta actuel={rCourant.moyenne} precedent={rPrec.moyenne} />}
                  />
                  <StatCard
                    titre="Événements"
                    valeur={formatNombre(rCourant.evenements)}
                    icone={AlertTriangle}
                    delta={libellePrec && <Delta actuel={rCourant.evenements} precedent={rPrec.evenements} />}
                  />
                  <StatCard
                    titre="Événements pour 1 000 visiteurs"
                    valeur={formatNombre(rCourant.pour1000, 2)}
                    icone={Activity}
                    delta={libellePrec && <Delta actuel={rCourant.pour1000} precedent={rPrec.pour1000} />}
                  />
                </div>
                {libellePrec && (
                  <p className="text-xs text-slate-500 -mt-4">Écarts comparés à {libellePrec}{precedentes.length === 0 ? ' (aucune donnée)' : ''}.</p>
                )}

                <Panneau titre="Visiteurs par soirée">
                  <BarChart
                    minWidthParBarre={28}
                    items={comptees.map(s => ({
                      key: s.date_soiree,
                      label: formatDateCourte(s.date_soiree),
                      value: s.visiteurs,
                      title: `${formatDateLongue(s.date_soiree)} : ${formatNombre(s.visiteurs)} visiteurs`,
                    }))}
                  />
                </Panneau>

                <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
                  <Panneau titre="Moyenne par jour d'ouverture">
                    <ul className="flex flex-col divide-y divide-slate-800">
                      {moyJours.map(j => (
                        <li key={j.jour} className="flex items-center justify-between py-2.5 gap-3">
                          <span className="text-sm text-slate-300">{JOURS[j.jour - 1]}</span>
                          <span className="text-sm text-slate-500 tabular-nums">{j.nb} soirée{j.nb > 1 ? 's' : ''}</span>
                          <span className="text-sm font-semibold text-white tabular-nums w-20 text-right">
                            {j.nb > 0 ? formatNombre(j.moyenne) : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Panneau>

                  <Panneau titre="Événements par catégorie">
                    <ul className="flex flex-col gap-4">
                      <li className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">Sécurité des personnes</span>
                          <span className="font-semibold text-white tabular-nums">{formatNombre(cats.securite_personnes)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${rCourant.evenements ? (cats.securite_personnes / rCourant.evenements) * 100 : 0}%` }} />
                        </div>
                      </li>
                      <li className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-300">SSI</span>
                          <span className="font-semibold text-white tabular-nums">{formatNombre(cats.ssi)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-sky-300 transition-all duration-500" style={{ width: `${rCourant.evenements ? (cats.ssi / rCourant.evenements) * 100 : 0}%` }} />
                        </div>
                      </li>
                    </ul>
                  </Panneau>
                </div>

                <Panneau titre="Profil horaire des arrivées (18h à 08h)">
                  <BarChart
                    minWidthParBarre={24}
                    items={profil.map(p => ({
                      key: String(p.heure),
                      label: formatHeure(p.heure),
                      value: p.entrees,
                      title: `${formatHeure(p.heure)} : ${formatNombre(p.entrees)} entrées`,
                    }))}
                  />
                </Panneau>

                <Panneau titre="Détail des soirées">
                  <div className="overflow-x-auto -mx-4 sm:-mx-6">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                          <th className="px-4 sm:px-6 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Jour</th>
                          <th className="px-3 py-2 font-medium text-right">Visiteurs</th>
                          <th className="px-3 py-2 font-medium">Pic</th>
                          <th className="px-4 sm:px-6 py-2 font-medium text-right">Événements</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...courantes].reverse().map(s => (
                          <tr key={s.date_soiree} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 sm:px-6 py-3 text-white tabular-nums">
                              <span className="inline-flex items-center gap-2">
                                {formatDateLongue(s.date_soiree)}
                                {s.saut_detecte && (
                                  <AlertTriangle
                                    className="w-3.5 h-3.5 text-amber-400"
                                    aria-label="Saut de comptage détecté"
                                    role="img"
                                  />
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-400">{JOURS[s.jour_semaine - 1]}</td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {s.visiteurs > 0 ? <span className="text-white">{formatNombre(s.visiteurs)}</span> : <span className="text-slate-500 italic text-xs">aucune entrée</span>}
                            </td>
                            <td className="px-3 py-3 text-slate-400 tabular-nums">{formatPic(s)}</td>
                            <td className="px-4 sm:px-6 py-3 text-right text-white tabular-nums">{formatNombre(s.nb_evenements)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panneau>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EcranChargement() {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">Chargement des statistiques…</span>
    </div>
  );
}
