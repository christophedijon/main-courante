import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Plus, Pencil, Trash2, Save, X, AlertCircle, CheckCircle,
  Users, ChevronDown, GripVertical, Eye, EyeOff,
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
  created_at: string;
};

type Assignation = {
  id: string;
  poste_id: string;
  agent_id: string;
  agent_nom: string;
  agent_fonction: string;
  assigned_at: string;
  actif: boolean;
};

type ManagedUser = {
  id: string;
  email: string;
  fonction: string;
  auth_user_id: string | null;
};

type UserProfile = { id: string; first_name: string; last_name: string };

const FONCTIONS_POSTE = ['Tous', 'Agent de Sécurité', 'Serveur', 'Chef de poste', 'Direction'];

const FONCTION_BADGE: Record<string, string> = {
  'Agent de Sécurité': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Serveur':           'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Direction':         'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Chef de poste':     'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'Tous':              'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const EMPTY_FORM = { nom: '', fonction: 'Tous', description: '', ordre: 0 };

export default function PostesPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [postes, setPostes] = useState<Poste[]>([]);
  const [assignations, setAssignations] = useState<Assignation[]>([]);
  const [agents, setAgents] = useState<ManagedUser[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Poste form
  const [editingPoste, setEditingPoste] = useState<Poste | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Assignation
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Filter
  const [showInactif, setShowInactif] = useState(false);

  async function load() {
    setLoading(true);
    const [postesRes, assignRes, agentsRes] = await Promise.all([
      supabase.from('postes').select('*').order('ordre').order('nom'),
      supabase.from('assignations').select('*').eq('actif', true),
      supabase.from('managed_users').select('id, email, fonction, auth_user_id').order('email'),
    ]);
    setPostes((postesRes.data ?? []) as Poste[]);
    setAssignations((assignRes.data ?? []) as Assignation[]);
    setAgents((agentsRes.data ?? []) as ManagedUser[]);

    // Load profiles for display names
    const authIds = ((agentsRes.data ?? []) as ManagedUser[])
      .map((u) => u.auth_user_id)
      .filter(Boolean) as string[];
    if (authIds.length > 0) {
      const { data: profs } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', authIds);
      const map: Record<string, UserProfile> = {};
      (profs ?? []).forEach((p: UserProfile) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Realtime assignations
  useEffect(() => {
    const channel = supabase
      .channel('assignations-backoffice')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignations' }, () => {
        supabase.from('assignations').select('*').eq('actif', true)
          .then(({ data }) => setAssignations((data ?? []) as Assignation[]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function agentDisplayName(agent: ManagedUser): string {
    if (agent.auth_user_id) {
      const p = profiles[agent.auth_user_id];
      if (p) {
        const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
        if (full) return full;
      }
    }
    return agent.email;
  }

  function openCreate() {
    setEditingPoste(null);
    setForm(EMPTY_FORM);
    setFormMsg(null);
    setShowCreate(true);
  }

  function openEdit(p: Poste) {
    setEditingPoste(p);
    setForm({ nom: p.nom, fonction: p.fonction, description: p.description, ordre: p.ordre });
    setFormMsg(null);
    setShowCreate(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) { setFormMsg({ type: 'error', text: 'Le nom du poste est requis.' }); return; }
    setFormLoading(true);
    setFormMsg(null);

    if (editingPoste) {
      const { error } = await supabase.from('postes').update({
        nom: form.nom.trim(),
        fonction: form.fonction,
        description: form.description.trim(),
        ordre: form.ordre,
        updated_at: new Date().toISOString(),
      }).eq('id', editingPoste.id);
      if (error) { setFormMsg({ type: 'error', text: 'Erreur lors de la modification.' }); setFormLoading(false); return; }
      setPostes((prev) => prev.map((p) => p.id === editingPoste.id ? { ...p, ...form, nom: form.nom.trim(), description: form.description.trim(), updated_at: new Date().toISOString() } : p));
      setToast({ message: 'Poste modifié avec succès.', type: 'success' });
    } else {
      const { data, error } = await supabase.from('postes').insert({
        nom: form.nom.trim(),
        fonction: form.fonction,
        description: form.description.trim(),
        ordre: form.ordre,
      }).select().maybeSingle();
      if (error || !data) { setFormMsg({ type: 'error', text: 'Erreur lors de la création.' }); setFormLoading(false); return; }
      setPostes((prev) => [...prev, data as Poste].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)));
      setToast({ message: 'Poste créé avec succès.', type: 'success' });
    }
    setFormLoading(false);
    setShowCreate(false);
  }

  async function toggleActif(p: Poste) {
    const { error } = await supabase.from('postes').update({ actif: !p.actif, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) { setToast({ message: 'Erreur lors de la mise à jour.', type: 'error' }); return; }
    setPostes((prev) => prev.map((x) => x.id === p.id ? { ...x, actif: !p.actif } : x));
  }

  async function deletePoste(p: Poste) {
    const { error } = await supabase.from('postes').delete().eq('id', p.id);
    if (error) { setToast({ message: 'Erreur lors de la suppression.', type: 'error' }); return; }
    setPostes((prev) => prev.filter((x) => x.id !== p.id));
    setToast({ message: `Poste "${p.nom}" supprimé.`, type: 'success' });
  }

  async function handleAssign(posteId: string) {
    if (!selectedAgent) return;
    setAssignLoading(true);
    const agent = agents.find((a) => a.id === selectedAgent);
    if (!agent?.auth_user_id) {
      setToast({ message: 'Cet agent n\'a pas encore de compte actif.', type: 'error' });
      setAssignLoading(false);
      return;
    }
    // Désactiver l'assignation active existante de cet agent
    await supabase.from('assignations').update({ actif: false }).eq('agent_id', agent.auth_user_id).eq('actif', true);

    const displayName = agentDisplayName(agent);
    const { error } = await supabase.from('assignations').insert({
      poste_id: posteId,
      agent_id: agent.auth_user_id,
      agent_nom: displayName,
      agent_fonction: agent.fonction,
    });
    if (error) { setToast({ message: 'Erreur lors de l\'assignation.', type: 'error' }); setAssignLoading(false); return; }

    // Refresh
    const { data } = await supabase.from('assignations').select('*').eq('actif', true);
    setAssignations((data ?? []) as Assignation[]);
    setAssignOpen(null);
    setSelectedAgent('');
    setToast({ message: `${displayName} assigné au poste.`, type: 'success' });
    setAssignLoading(false);
  }

  async function handleUnassign(assignation: Assignation) {
    const { error } = await supabase.from('assignations').update({ actif: false }).eq('id', assignation.id);
    if (error) { setToast({ message: 'Erreur lors du retrait.', type: 'error' }); return; }
    setAssignations((prev) => prev.filter((a) => a.id !== assignation.id));
    setToast({ message: `${assignation.agent_nom} retiré du poste.`, type: 'success' });
  }

  const displayed = postes.filter((p) => showInactif || p.actif);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={async () => { await signOut(); navigate('/'); }} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-400" />
              Postes
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {postes.filter((p) => p.actif).length} poste{postes.filter((p) => p.actif).length !== 1 ? 's' : ''} actif{postes.filter((p) => p.actif).length !== 1 ? 's' : ''}
              {' · '}
              {assignations.length} agent{assignations.length !== 1 ? 's' : ''} assigné{assignations.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInactif((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all
                ${showInactif ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
            >
              {showInactif ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showInactif ? 'Masquer inactifs' : 'Voir inactifs'}
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30"
            >
              <Plus className="w-4 h-4" />
              Nouveau poste
            </button>
          </div>
        </div>

        {/* Liste des postes */}
        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500">
            <MapPin className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Aucun poste configuré. Créez votre premier poste.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((poste) => {
              const posteAssigns = assignations.filter((a) => a.poste_id === poste.id);
              const isAssignOpen = assignOpen === poste.id;
              const availableAgents = agents.filter((ag) => {
                if (!ag.auth_user_id) return false;
                const alreadyHere = posteAssigns.some((a) => a.agent_id === ag.auth_user_id);
                if (alreadyHere) return false;
                if (poste.fonction !== 'Tous' && ag.fonction !== poste.fonction) return false;
                return true;
              });

              return (
                <div
                  key={poste.id}
                  className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all
                    ${poste.actif ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`}
                >
                  {/* Poste header */}
                  <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <GripVertical className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-semibold text-sm ${poste.actif ? 'text-white' : 'text-slate-400'}`}>
                            {poste.nom}
                          </p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${FONCTION_BADGE[poste.fonction] ?? FONCTION_BADGE['Tous']}`}>
                            {poste.fonction}
                          </span>
                          {!poste.actif && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-600/20 text-slate-500 border-slate-600/30">
                              Inactif
                            </span>
                          )}
                        </div>
                        {poste.description && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{poste.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-slate-500 flex items-center gap-1 mr-2">
                        <Users className="w-3.5 h-3.5" />
                        {posteAssigns.length}
                      </span>
                      <button
                        onClick={() => openEdit(poste)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActif(poste)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                        title={poste.actif ? 'Désactiver' : 'Activer'}
                      >
                        {poste.actif ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deletePoste(poste)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Agents assignés */}
                  {(posteAssigns.length > 0 || poste.actif) && (
                    <div className="border-t border-slate-800 px-5 py-3 space-y-2">
                      {posteAssigns.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {posteAssigns.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5"
                            >
                              <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-slate-300">
                                  {a.agent_nom.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs text-white font-medium">{a.agent_nom}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${FONCTION_BADGE[a.agent_fonction] ?? FONCTION_BADGE['Tous']}`}>
                                {a.agent_fonction}
                              </span>
                              <button
                                onClick={() => handleUnassign(a)}
                                className="w-4 h-4 rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400 flex items-center justify-center transition-all"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 italic">Aucun agent assigné</p>
                      )}

                      {/* Assign panel */}
                      {poste.actif && (
                        isAssignOpen ? (
                          <div className="flex items-center gap-2 mt-2">
                            <select
                              value={selectedAgent}
                              onChange={(e) => setSelectedAgent(e.target.value)}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                            >
                              <option value="">Choisir un agent…</option>
                              {availableAgents.map((ag) => (
                                <option key={ag.id} value={ag.id}>{agentDisplayName(ag)} — {ag.fonction}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssign(poste.id)}
                              disabled={!selectedAgent || assignLoading}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white text-sm rounded-xl font-medium transition-colors"
                            >
                              {assignLoading ? '…' : 'Assigner'}
                            </button>
                            <button
                              onClick={() => { setAssignOpen(null); setSelectedAgent(''); }}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm rounded-xl transition-colors"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAssignOpen(poste.id); setSelectedAgent(''); }}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors mt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Assigner un agent
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal création/édition poste */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    {editingPoste ? 'Modifier le poste' : 'Nouveau poste'}
                  </h2>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formMsg && (
                <div className={`flex items-start gap-3 rounded-xl p-3 mb-4 text-sm border
                  ${formMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {formMsg.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom du poste *</label>
                  <input
                    type="text"
                    required
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex : Entrée principale, Parking B2…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Fonction</label>
                    <select
                      value={form.fonction}
                      onChange={(e) => setForm((f) => ({ ...f, fonction: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    >
                      {FONCTIONS_POSTE.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Ordre</label>
                    <input
                      type="number"
                      min={0}
                      value={form.ordre}
                      onChange={(e) => setForm((f) => ({ ...f, ordre: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Instructions, localisation…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl py-2.5 text-sm transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={formLoading} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-xl py-2.5 text-sm transition-colors">
                    <Save className="w-4 h-4" />
                    {formLoading ? 'Enregistrement…' : editingPoste ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
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
