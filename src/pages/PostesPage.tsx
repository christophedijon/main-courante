import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Plus, Pencil, Trash2, Save, X, AlertCircle, CheckCircle,
  Users, Loader2, ChevronDown, Building2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import Toast, { type ToastType } from '../components/Toast';

type Poste = {
  id: string;
  nom: string;
  fonction: string;
  description: string;
  actif: boolean;
  ordre: number;
  etablissement_id: string;
  created_at: string;
};

type Assignation = {
  id: string;
  poste_id: string;
  agent_nom: string;
  agent_fonction: string;
  actif: boolean;
};

type Etab = { id: string; nom: string };

const FONCTIONS = ['Agent de Sécurité', 'Serveur', 'Direction', 'Chef de poste', 'Tous'];

const FONCTION_BADGE: Record<string, string> = {
  'Agent de Sécurité': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Serveur':           'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Direction':         'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Chef de poste':     'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'Tous':              'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const inputCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white
  placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
  focus:border-transparent transition-all`;

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-all shrink-0
        ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all
        ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

const EMPTY_FORM = { nom: '', fonction: 'Agent de Sécurité', description: '', ordre: 0, actif: true };
type Form = typeof EMPTY_FORM;

export default function PostesPage() {
  const { signOut, isSuperAdmin, session } = useAuth();
  const navigate = useNavigate();

  // ── Établissement selector ──────────────────────────────────────────────────
  const [etablissements, setEtablissements] = useState<Etab[]>([]);
  const [etablissementId, setEtablissementId] = useState<string | null>(null);
  const [etabLoading, setEtabLoading] = useState(true);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [postes, setPostes] = useState<Poste[]>([]);
  const [assignations, setAssignations] = useState<Assignation[]>([]);
  const [loading, setLoading] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Poste | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Poste | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Initialisation établissement ───────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setEtabLoading(true);
      if (isSuperAdmin) {
        const { data } = await supabase
          .from('etablissements')
          .select('id, nom')
          .order('nom');
        setEtablissements((data ?? []) as Etab[]);
        if (data && data.length > 0) setEtablissementId(data[0].id);
      } else if (session?.user.id) {
        const { data } = await supabase
          .from('managed_users')
          .select('etablissement_id')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();
        setEtablissementId(data?.etablissement_id ?? null);
      }
      setEtabLoading(false);
    }
    init();
  }, [isSuperAdmin, session?.user.id]);

  // ── Chargement des postes ─────────────────────────────────────────────────
  useEffect(() => {
    if (!etablissementId) return;
    loadData();
  }, [etablissementId]);

  async function loadData() {
    if (!etablissementId) return;
    setLoading(true);
    const [postesRes, assignRes] = await Promise.all([
      supabase.from('postes').select('*')
        .eq('etablissement_id', etablissementId)
        .order('ordre').order('nom'),
      supabase.from('assignations').select('id, poste_id, agent_nom, agent_fonction, actif')
        .eq('etablissement_id', etablissementId)
        .eq('actif', true),
    ]);
    setPostes((postesRes.data ?? []) as Poste[]);
    setAssignations((assignRes.data ?? []) as Assignation[]);
    setLoading(false);
  }

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!etablissementId) return;
    const channel = supabase
      .channel('postes-backoffice-' + etablissementId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignations' }, () => {
        supabase.from('assignations').select('id, poste_id, agent_nom, agent_fonction, actif')
          .eq('etablissement_id', etablissementId).eq('actif', true)
          .then(({ data }) => setAssignations((data ?? []) as Assignation[]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [etablissementId]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditTarget(null);
    const maxOrdre = postes.length > 0 ? Math.max(...postes.map((p) => p.ordre)) + 1 : 0;
    setForm({ ...EMPTY_FORM, ordre: maxOrdre });
    setFormMsg(null);
    setModalOpen(true);
  }

  function openEdit(p: Poste) {
    setEditTarget(p);
    setForm({ nom: p.nom, fonction: p.fonction, description: p.description, ordre: p.ordre, actif: p.actif });
    setFormMsg(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) { setFormMsg({ type: 'error', text: 'Le nom du poste est requis.' }); return; }
    if (!etablissementId) { setFormMsg({ type: 'error', text: 'Aucun établissement sélectionné.' }); return; }
    setFormLoading(true);
    setFormMsg(null);

    if (editTarget) {
      const { error } = await supabase.from('postes').update({
        nom: form.nom.trim(),
        fonction: form.fonction,
        description: form.description.trim(),
        ordre: form.ordre,
        actif: form.actif,
        updated_at: new Date().toISOString(),
      }).eq('id', editTarget.id);
      if (error) { setFormMsg({ type: 'error', text: `Erreur : ${error.message}` }); setFormLoading(false); return; }
      setPostes((prev) => prev.map((p) => p.id === editTarget.id
        ? { ...p, nom: form.nom.trim(), fonction: form.fonction, description: form.description.trim(), ordre: form.ordre, actif: form.actif }
        : p
      ).sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)));
      setToast({ message: 'Poste modifié.', type: 'success' });
    } else {
      const { data, error } = await supabase.from('postes').insert({
        nom: form.nom.trim(),
        fonction: form.fonction,
        description: form.description.trim(),
        ordre: form.ordre,
        actif: form.actif,
        etablissement_id: etablissementId,
      }).select().maybeSingle();
      if (error) { setFormMsg({ type: 'error', text: `Erreur : ${error.message}` }); setFormLoading(false); return; }
      if (data) setPostes((prev) => [...prev, data as Poste].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)));
      setToast({ message: 'Poste créé.', type: 'success' });
    }
    setFormLoading(false);
    setModalOpen(false);
  }

  async function toggleActif(p: Poste) {
    const { error } = await supabase.from('postes').update({ actif: !p.actif, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) { setToast({ message: 'Erreur lors de la mise à jour.', type: 'error' }); return; }
    setPostes((prev) => prev.map((x) => x.id === p.id ? { ...x, actif: !p.actif } : x));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error } = await supabase.from('postes').delete().eq('id', deleteTarget.id);
    if (error) { setToast({ message: 'Erreur lors de la suppression.', type: 'error' }); setDeleteLoading(false); return; }
    setPostes((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setToast({ message: `"${deleteTarget.nom}" supprimé.`, type: 'success' });
    setDeleteLoading(false);
    setDeleteTarget(null);
  }

  const etabNom = isSuperAdmin
    ? etablissements.find((e) => e.id === etablissementId)?.nom ?? ''
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={async () => { await signOut(); navigate('/'); }} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-400" />
              Postes
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Configuration des postes opérationnels — pris par les agents en début de service
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Sélecteur établissement (superadmin uniquement) */}
            {isSuperAdmin && (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <select
                  value={etablissementId ?? ''}
                  onChange={(e) => setEtablissementId(e.target.value || null)}
                  className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-sm text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all appearance-none cursor-pointer"
                >
                  {etablissements.map((e) => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
            )}

            <button
              onClick={openCreate}
              disabled={!etablissementId}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
                disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-xl text-sm
                transition-all shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-4 h-4" />
              Nouveau poste
            </button>
          </div>
        </div>

        {/* ── État de chargement initial ── */}
        {etabLoading ? (
          <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement…
          </div>
        ) : !etablissementId ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500">
            <Building2 className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Sélectionnez un établissement pour voir ses postes.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement…
          </div>
        ) : postes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500">
            <MapPin className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm mb-3">Aucun poste configuré{etabNom ? ` pour ${etabNom}` : ''}.</p>
            <button
              onClick={openCreate}
              className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors"
            >
              Créer le premier poste
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              {postes.filter((p) => p.actif).length} actif{postes.filter((p) => p.actif).length !== 1 ? 's' : ''}
              {' · '}
              {postes.length} au total
              {' · '}
              {assignations.length} agent{assignations.length !== 1 ? 's' : ''} en poste
            </p>

            {/* ── Grid des cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {postes.map((poste) => {
                const posteAssigns = assignations.filter((a) => a.poste_id === poste.id);
                const badgeCls = FONCTION_BADGE[poste.fonction] ?? FONCTION_BADGE['Tous'];

                return (
                  <div
                    key={poste.id}
                    className={`bg-slate-900 border rounded-2xl overflow-hidden flex flex-col transition-all
                      ${poste.actif ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`}
                  >
                    {/* Card body */}
                    <div className="p-5 flex-1">
                      {/* Titre + badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-white font-bold text-base leading-snug">{poste.nom}</h3>
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeCls}`}>
                          {poste.fonction}
                        </span>
                      </div>

                      {/* Description tronquée */}
                      {poste.description && (
                        <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 mb-3">
                          {poste.description}
                        </p>
                      )}

                      {/* Agents assignés */}
                      {posteAssigns.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {posteAssigns.slice(0, 3).map((a) => (
                            <span key={a.id}
                              className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] text-slate-300">
                              <div className="w-3.5 h-3.5 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                                <span className="text-[7px] font-bold text-white">{a.agent_nom.charAt(0).toUpperCase()}</span>
                              </div>
                              {a.agent_nom}
                            </span>
                          ))}
                          {posteAssigns.length > 3 && (
                            <span className="text-[11px] text-slate-500 flex items-center">+{posteAssigns.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card footer */}
                    <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
                      {/* Indicateurs gauche */}
                      <div className="flex items-center gap-3">
                        {/* Toggle actif */}
                        <div className="flex items-center gap-2">
                          <Toggle checked={poste.actif} onChange={() => toggleActif(poste)} />
                          <span className={`text-xs font-medium ${poste.actif ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {poste.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </div>

                        {/* Ordre */}
                        <span className="text-[10px] text-slate-600 border border-slate-800 rounded-lg px-1.5 py-0.5 font-mono">
                          #{poste.ordre}
                        </span>

                        {/* Nb agents */}
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {posteAssigns.length}
                        </span>
                      </div>

                      {/* Actions droite */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(poste)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(poste)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ── Modal création / édition ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-white font-semibold">
                  {editTarget ? 'Modifier le poste' : 'Nouveau poste'}
                </h3>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formMsg && (
                <div className={`flex items-center gap-2 rounded-xl p-3 text-sm border
                  ${formMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {formMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {formMsg.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom du poste <span className="text-red-400">*</span></label>
                <input type="text" required value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex : Entrée principale, Bar VIP, Parking B2"
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Fonction <span className="text-red-400">*</span></label>
                <select value={form.fonction}
                  onChange={(e) => setForm((f) => ({ ...f, fonction: e.target.value }))}
                  className={`${inputCls} appearance-none`}>
                  {FONCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description / consignes</label>
                <textarea rows={4} value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ex : Contrôle des accès, vérification des invitations, refus des mineurs…"
                  className={`${inputCls} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Ordre d'affichage</label>
                  <input type="number" min={0} value={form.ordre}
                    onChange={(e) => setForm((f) => ({ ...f, ordre: parseInt(e.target.value) || 0 }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Statut</label>
                  <div className="flex items-center gap-3 mt-3">
                    <Toggle checked={form.actif} onChange={() => setForm((f) => ({ ...f, actif: !f.actif }))} />
                    <span className={`text-sm font-medium ${form.actif ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {form.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all">
                  Annuler
                </button>
                <button type="submit" disabled={formLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed transition-all">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {formLoading ? 'Enregistrement…' : editTarget ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm suppression ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-white font-semibold text-center text-base mb-1">Supprimer le poste</h3>
            <p className="text-slate-400 text-sm text-center mb-6">
              "<span className="text-white">{deleteTarget.nom}</span>" sera définitivement supprimé ainsi que toutes ses assignations.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">
                Annuler
              </button>
              <button onClick={confirmDelete} disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {deleteLoading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60]">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
}
