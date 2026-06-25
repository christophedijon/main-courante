import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Building2, AlertCircle, Loader2,
  MoreHorizontal, Play, Zap, Pause, CheckCircle2,
  Trash2, RefreshCw, ChevronDown, ChevronUp,
  Users, Clock, XCircle, FlaskConical,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import AppHeader from '../components/AppHeader';
import Toast, { type ToastType } from '../components/Toast';

type Etablissement = {
  id: string;
  nom: string;
  plan: 'testeur' | 'light' | 'base' | 'premium';
  statut: 'brouillon' | 'essai' | 'actif' | 'suspendu' | 'resilie';
  date_activation: string | null;
  date_debut_essai: string | null;
  date_fin_essai: string | null;
  onboarding_complete: boolean;
  onboarding_etape: number;
  created_at: string;
  partenaire_id: string | null;
  partenaires?: { nom: string } | null;
};

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  testeur: { label: 'Testeur', className: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  light:   { label: 'Light',   className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  base:    { label: 'Base',    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  premium: { label: 'Premium', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

const STATUT_BADGE: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  brouillon: { label: 'Brouillon',  className: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Clock },
  essai:     { label: 'Essai',      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: FlaskConical },
  actif:     { label: 'Actif',      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  suspendu:  { label: 'Suspendu',   className: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: Pause },
  resilie:   { label: 'Résilié',    className: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: XCircle },
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysDiff(d: string | null): number | null {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [sortKey, setSortKey] = useState<'nom' | 'created_at' | 'date_fin_essai'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const [toast, setToast] = useState<{ type: ToastType; msg: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!actionMenu) return;
    function close() { setActionMenu(null); setMenuAnchor(null); }
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [actionMenu]);

  const showToast = (type: ToastType, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('etablissements')
      .select('id, nom, plan, statut, date_activation, date_debut_essai, date_fin_essai, onboarding_complete, onboarding_etape, created_at, partenaire_id, partenaires(nom)')
      .order('created_at', { ascending: false });
    if (error) {
      showToast('error', 'Erreur de chargement');
    } else {
      setEtablissements((data ?? []) as Etablissement[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatut(id: string, statut: string) {
    setActionLoading(id);
    const { error } = await supabase.from('etablissements').update({ statut }).eq('id', id);
    if (error) showToast('error', 'Erreur lors de la mise à jour');
    else { showToast('success', 'Statut mis à jour'); load(); }
    setActionMenu(null); setMenuAnchor(null);
    setActionLoading(null);
  }

  async function changePlan(id: string, plan: string) {
    setActionLoading(id);
    const { error } = await supabase.from('etablissements').update({ plan }).eq('id', id);
    if (error) showToast('error', 'Erreur lors de la mise à jour');
    else { showToast('success', 'Plan mis à jour'); load(); }
    setActionMenu(null); setMenuAnchor(null);
    setActionLoading(null);
  }

  async function activerEtablissement(etab: Etablissement) {
    setActionLoading(etab.id);
    const { error } = await supabase.rpc('activer_client', {
      p_etab_id: etab.id,
      p_plan: etab.plan,
    });
    if (error) showToast('error', "Erreur lors de l'activation");
    else { showToast('success', `${etab.nom} activé`); load(); }
    setActionMenu(null); setMenuAnchor(null);
    setActionLoading(null);
  }

  async function supprimerEtablissement(id: string) {
    setActionLoading(id);
    const { data, error } = await supabase.functions.invoke('delete-etablissement', {
      body: { etablissement_id: id },
    });
    if (error || data?.error) {
      let msg = data?.error ?? "Impossible de supprimer l'établissement.";
      if (!data?.error && error) {
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch {}
      }
      showToast('error', msg);
    } else {
      showToast('success', `${data?.nom ?? 'Établissement'} supprimé définitivement`);
      load();
    }
    setConfirmDelete(null);
    setActionMenu(null); setMenuAnchor(null);
    setActionLoading(null);
  }

  // Filtered + sorted
  const filtered = etablissements
    .filter(e => {
      if (search && !e.nom.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPlan && e.plan !== filterPlan) return false;
      if (filterStatut && e.statut !== filterStatut) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'nom') return dir * a.nom.localeCompare(b.nom);
      if (sortKey === 'date_fin_essai') {
        const av = a.date_fin_essai ?? '';
        const bv = b.date_fin_essai ?? '';
        return dir * av.localeCompare(bv);
      }
      return dir * a.created_at.localeCompare(b.created_at);
    });

  const stats = {
    total:     etablissements.length,
    actifs:    etablissements.filter(e => e.statut === 'actif').length,
    essai:     etablissements.filter(e => e.statut === 'essai').length,
    brouillon: etablissements.filter(e => e.statut === 'brouillon').length,
  };

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k
      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ChevronDown className="w-3 h-3 opacity-30" />;

  return (
    <div className="min-h-screen bg-slate-950">
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Mes Clients</h1>
            <p className="text-sm text-slate-400 mt-0.5">Gérez vos établissements et leurs plans</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all" title="Rafraîchir">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/onboarding')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Nouveau client
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: Building2, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
            { label: 'Actifs', value: stats.actifs, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'En essai', value: stats.essai, icon: FlaskConical, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Brouillons', value: stats.brouillon, icon: Clock, color: 'text-slate-500', bg: 'bg-slate-800/50 border-slate-700/50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${bg}`}>
              <div className={`w-8 h-8 rounded-lg bg-slate-900/50 flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un établissement…"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterPlan}
            onChange={e => setFilterPlan(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les plans</option>
            <option value="testeur">Testeur</option>
            <option value="light">Light</option>
            <option value="base">Base</option>
            <option value="premium">Premium</option>
          </select>
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="essai">Essai</option>
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
            <option value="resilie">Résilié</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-slate-400 text-sm">Chargement…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Building2 className="w-10 h-10 text-slate-700" />
              <div>
                <p className="text-slate-400 font-medium">Aucun établissement</p>
                <p className="text-slate-500 text-sm mt-1">
                  {search || filterPlan || filterStatut
                    ? 'Modifiez les filtres ou'
                    : 'Commencez par'}{' '}
                  <button onClick={() => navigate('/onboarding')} className="text-blue-400 hover:underline">créer un nouveau client</button>
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-800">
                  {[
                    { key: 'nom' as const, label: 'Établissement' },
                    { key: null, label: 'Plan' },
                    { key: null, label: 'Statut' },
                    { key: 'date_fin_essai' as const, label: 'Fin essai' },
                    { key: 'created_at' as const, label: 'Créé le' },
                    { key: null, label: '' },
                  ].map(({ key, label }, i) => (
                    <th
                      key={i}
                      onClick={key ? () => toggleSort(key) : undefined}
                      className={`px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider ${key ? 'cursor-pointer hover:text-slate-200 select-none' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        {key && <SortIcon k={key} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map(etab => {
                  const plan = PLAN_BADGE[etab.plan] ?? PLAN_BADGE.light;
                  const statut = STATUT_BADGE[etab.statut] ?? STATUT_BADGE.brouillon;
                  const StatutIcon = statut.icon;
                  const joursRestants = daysDiff(etab.date_fin_essai);
                  const isExpiringSoon = joursRestants !== null && joursRestants <= 7 && joursRestants >= 0;
                  const isExpired = joursRestants !== null && joursRestants < 0;

                  return (
                    <tr key={etab.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Nom */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{etab.nom}</div>
                            {etab.partenaires && (
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" />
                                {etab.partenaires.nom}
                              </div>
                            )}
                            {etab.statut === 'brouillon' && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <div className="w-20 h-1 bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${(etab.onboarding_etape / 6) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500">Étape {Math.min(etab.onboarding_etape, 6)}/6</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${plan.className}`}>
                          {plan.label}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statut.className}`}>
                          <StatutIcon className="w-3 h-3" />
                          {statut.label}
                        </span>
                      </td>

                      {/* Fin essai */}
                      <td className="px-4 py-3">
                        {etab.date_fin_essai ? (
                          <div>
                            <div className={`text-sm ${isExpired ? 'text-rose-400' : isExpiringSoon ? 'text-amber-400' : 'text-slate-300'}`}>
                              {formatDate(etab.date_fin_essai)}
                            </div>
                            {joursRestants !== null && (
                              <div className={`text-xs ${isExpired ? 'text-rose-500' : isExpiringSoon ? 'text-amber-500' : 'text-slate-500'}`}>
                                {isExpired ? `Expiré il y a ${Math.abs(joursRestants)}j` : `J-${joursRestants}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Créé le */}
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {formatDate(etab.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {actionLoading === etab.id ? (
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin ml-auto" />
                        ) : (
                          <button
                            onClick={(e) => {
                              if (actionMenu === etab.id) {
                                setActionMenu(null); setMenuAnchor(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setActionMenu(etab.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-slate-500 mt-3 text-right">
            {filtered.length} établissement{filtered.length > 1 ? 's' : ''}
            {(search || filterPlan || filterStatut) ? ` sur ${etablissements.length}` : ''}
          </p>
        )}
      </div>

      {/* Action dropdown — fixed positioning to escape overflow:hidden */}
      {actionMenu && menuAnchor && (() => {
        const etab = etablissements.find(e => e.id === actionMenu);
        if (!etab) return null;
        return (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => { setActionMenu(null); setMenuAnchor(null); }} />
            <div
              className="fixed w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[101] py-1 overflow-hidden"
              style={{ top: menuAnchor.top, right: menuAnchor.right }}
            >
              {etab.statut === 'brouillon' && (
                <MenuItem icon={Play} onClick={() => { navigate(`/onboarding?etabId=${etab.id}`); setActionMenu(null); setMenuAnchor(null); }}>
                  Reprendre l'onboarding
                </MenuItem>
              )}
              {etab.statut === 'brouillon' && (
                <MenuItem icon={Zap} onClick={() => activerEtablissement(etab)}>
                  Activer maintenant
                </MenuItem>
              )}
              {etab.plan !== 'testeur' && etab.statut !== 'brouillon' && (
                <MenuItem icon={FlaskConical} onClick={() => changePlan(etab.id, 'testeur')}>
                  Passer en Testeur
                </MenuItem>
              )}
              {etab.statut === 'essai' && (
                <MenuItem icon={CheckCircle2} onClick={() => changeStatut(etab.id, 'actif')}>
                  Marquer actif
                </MenuItem>
              )}
              {['actif', 'essai'].includes(etab.statut) && (
                <MenuItem icon={Pause} onClick={() => changeStatut(etab.id, 'suspendu')}>
                  Suspendre
                </MenuItem>
              )}
              {etab.statut === 'suspendu' && (
                <MenuItem icon={Play} onClick={() => changeStatut(etab.id, 'actif')}>
                  Réactiver
                </MenuItem>
              )}
              {etab.statut === 'resilie' && (
                <MenuItem icon={Play} onClick={() => changeStatut(etab.id, 'actif')}>
                  Réactiver
                </MenuItem>
              )}
              {!['brouillon', 'resilie'].includes(etab.statut) && (
                <MenuItem icon={XCircle} className="text-rose-400 hover:bg-rose-500/10" onClick={() => changeStatut(etab.id, 'resilie')}>
                  Résilier
                </MenuItem>
              )}
              <>
                <div className="h-px bg-slate-700 my-1" />
                <MenuItem icon={Trash2} className="text-rose-400 hover:bg-rose-500/10" onClick={() => { setConfirmDelete(etab.id); setActionMenu(null); setMenuAnchor(null); }}>
                  Supprimer définitivement
                </MenuItem>
              </>
            </div>
          </>
        );
      })()}

      {/* Delete confirmation */}
      {confirmDelete && (() => {
        const etab = etablissements.find(e => e.id === confirmDelete);
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Supprimer définitivement</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Action irréversible</p>
                </div>
              </div>
              {etab && (
                <p className="text-sm font-medium text-white mb-2">{etab.nom}</p>
              )}
              <p className="text-sm text-slate-300 mb-2">
                Toutes les données associées seront <strong className="text-rose-400">définitivement supprimées</strong> :
              </p>
              <ul className="text-xs text-slate-400 mb-5 space-y-0.5 list-disc list-inside">
                <li>Événements, rapports, rondes</li>
                <li>Comptes utilisateurs (Direction, agents…)</li>
                <li>Registre de sécurité et signatures</li>
                <li>Postes, espaces, zones, documents</li>
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => supprimerEtablissement(confirmDelete)}
                  disabled={actionLoading === confirmDelete}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all"
                >
                  {actionLoading === confirmDelete
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Suppression…</>
                    : 'Supprimer'
                  }
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.msg}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  onClick,
  children,
  className = '',
}: {
  icon: React.ElementType;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors ${className}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {children}
    </button>
  );
}
