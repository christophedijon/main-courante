import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserCheck, Plus, X, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Poste = {
  id: string;
  nom: string;
  fonction: string;
  description: string;
  actif: boolean;
  ordre: number;
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

type Agent = {
  id: string;
  email: string;
  fonction: string;
  auth_user_id: string | null;
};

type Profile = { id: string; first_name: string; last_name: string };

const FONCTION_COLOR: Record<string, string> = {
  'Agent de Sécurité': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'Chef de poste':     'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
};

export default function AssignationPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [postes, setPostes] = useState<Poste[]>([]);
  const [assignations, setAssignations] = useState<Assignation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openPosteId, setOpenPosteId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [postesRes, assignRes, agentsRes] = await Promise.all([
      supabase.from('postes').select('*').eq('actif', true).order('ordre').order('nom'),
      supabase.from('assignations').select('*').eq('actif', true),
      supabase.from('managed_users')
        .select('id, email, fonction, auth_user_id')
        .in('fonction', ['Agent de Sécurité', 'Chef de poste'])
        .order('email'),
    ]);

    if (postesRes.error) { setError(postesRes.error.message); setLoading(false); return; }

    setPostes((postesRes.data ?? []) as Poste[]);
    setAssignations((assignRes.data ?? []) as Assignation[]);
    setAgents((agentsRes.data ?? []) as Agent[]);

    const authIds = ((agentsRes.data ?? []) as Agent[])
      .map((u) => u.auth_user_id)
      .filter(Boolean) as string[];
    if (authIds.length > 0) {
      const { data: profs } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', authIds);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: Profile) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('assignations-mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignations' }, () => {
        supabase.from('assignations').select('*').eq('actif', true)
          .then(({ data }) => setAssignations((data ?? []) as Assignation[]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function agentLabel(agent: Agent): string {
    if (agent.auth_user_id) {
      const p = profiles[agent.auth_user_id];
      if (p) {
        const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
        if (full) return full;
      }
    }
    return agent.email;
  }

  const assignedAgentIds = new Set(assignations.map((a) => a.agent_id));

  function availableFor(_posteId: string): Agent[] {
    return agents.filter((ag) => {
      if (!ag.auth_user_id) return false;
      return !assignedAgentIds.has(ag.auth_user_id);
    });
  }

  async function handleAssign(posteId: string) {
    if (!selectedAgentId || !session?.user) return;
    setSaving(true);
    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent?.auth_user_id) { setSaving(false); return; }

    // Désactiver toute assignation active existante de cet agent
    await supabase.from('assignations')
      .update({ actif: false })
      .eq('agent_id', agent.auth_user_id)
      .eq('actif', true);

    const { error } = await supabase.from('assignations').insert({
      poste_id: posteId,
      agent_id: agent.auth_user_id,
      agent_nom: agentLabel(agent),
      agent_fonction: agent.fonction,
      assigned_by: session.user.id,
    });

    if (error) {
      showToast('Erreur : ' + error.message);
      setSaving(false);
      return;
    }

    const { data } = await supabase.from('assignations').select('*').eq('actif', true);
    setAssignations((data ?? []) as Assignation[]);
    setOpenPosteId(null);
    setSelectedAgentId('');
    showToast(`${agentLabel(agent)} assigné avec succès.`);
    setSaving(false);
  }

  async function handleUnassign(a: Assignation) {
    const { error } = await supabase.from('assignations').update({ actif: false }).eq('id', a.id);
    if (error) { showToast('Erreur : ' + error.message); return; }
    setAssignations((prev) => prev.filter((x) => x.id !== a.id));
    showToast(`${a.agent_nom} retiré du poste.`);
  }

  return (
    <div className="min-h-full pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-[16px] leading-tight">Assignation</h1>
          <p className="text-slate-500 text-[11px]">
            {postes.length} poste{postes.length !== 1 ? 's' : ''} actif{postes.length !== 1 ? 's' : ''}
            {' · '}
            {assignations.length} agent{assignations.length !== 1 ? 's' : ''} assigné{assignations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <UserCheck className="w-4 h-4 text-emerald-400" />
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Chargement…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        ) : postes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
            <UserCheck className="w-10 h-10 opacity-25" />
            <p className="text-sm text-center">Aucun poste actif.<br />Activez des postes dans le back-office.</p>
          </div>
        ) : (
          postes.map((poste) => {
            const posteAssigns = assignations.filter((a) => a.poste_id === poste.id);
            const available = availableFor(poste.id);
            const isOpen = openPosteId === poste.id;

            return (
              <div
                key={poste.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
              >
                {/* Poste header */}
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-white font-bold text-base leading-snug">{poste.nom}</p>
                    <span className="inline-block mt-1 text-slate-300 text-xs font-medium bg-slate-700 px-2 py-0.5 rounded-lg">{poste.fonction}</span>
                    {poste.description ? (
                      <p className="text-slate-300 text-sm leading-relaxed mt-1">{poste.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      {posteAssigns.length}
                    </span>
                    <button
                      onClick={() => {
                        if (isOpen) { setOpenPosteId(null); setSelectedAgentId(''); }
                        else { setOpenPosteId(poste.id); setSelectedAgentId(''); }
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-semibold transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Assigner
                    </button>
                  </div>
                </div>

                {/* Agents assignés */}
                {posteAssigns.length > 0 && (
                  <div className="border-t border-slate-800 px-4 py-3 flex flex-wrap gap-2">
                    {posteAssigns.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5"
                      >
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-slate-300">
                            {a.agent_nom.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[12px] text-white font-medium leading-none">{a.agent_nom}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${FONCTION_COLOR[a.agent_fonction] ?? 'bg-slate-600/20 text-slate-400 border-slate-600/30'}`}>
                          {a.agent_fonction}
                        </span>
                        <button
                          onClick={() => handleUnassign(a)}
                          className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-red-400 rounded-full hover:bg-red-500/15 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Panel assignation */}
                {isOpen && (
                  <div className="border-t border-slate-800 px-4 py-3 space-y-2">
                    {available.length === 0 ? (
                      <p className="text-slate-500 text-[12px] italic">Aucun agent disponible.</p>
                    ) : (
                      <>
                        <select
                          value={selectedAgentId}
                          onChange={(e) => setSelectedAgentId(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                        >
                          <option value="">Choisir un agent…</option>
                          {available.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {agentLabel(ag)} — {ag.fonction}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAssign(poste.id)}
                            disabled={!selectedAgentId || saving}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
                          >
                            {saving ? 'Assignation…' : 'Confirmer'}
                          </button>
                          <button
                            onClick={() => { setOpenPosteId(null); setSelectedAgentId(''); }}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-[13px] transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-white text-[13px] font-medium shadow-2xl max-w-[90vw] text-center">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
