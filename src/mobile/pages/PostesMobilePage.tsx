import { useEffect, useState } from 'react';
import { MapPin, Users, X, Plus, ChevronRight, Check, Loader2 } from 'lucide-react';
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
};

const FONCTION_BADGE: Record<string, { text: string; bg: string }> = {
  'Agent de Sécurité': { text: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
  'Serveur':           { text: 'text-cyan-400',    bg: 'bg-cyan-500/15 border-cyan-500/30' },
  'Direction':         { text: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/30' },
  'Chef de poste':     { text: 'text-violet-400',  bg: 'bg-violet-500/15 border-violet-500/30' },
  'Tous':              { text: 'text-slate-400',   bg: 'bg-slate-600/25 border-slate-500/30' },
};

function badge(fonction: string) {
  return FONCTION_BADGE[fonction] ?? FONCTION_BADGE['Tous'];
}

export default function PostesMobilePage() {
  const { session, hasAdminAccess } = useAuth();
  const myAuthId = session?.user.id;

  const [postes, setPostes] = useState<Poste[]>([]);
  const [assignations, setAssignations] = useState<Assignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Pour chef/direction : panneau d'assignation rapide
  const [assignPanel, setAssignPanel] = useState<string | null>(null);
  const [availableAgents, setAvailableAgents] = useState<{ id: string; auth_user_id: string; nom: string; fonction: string }[]>([]);

  async function loadData() {
    setLoading(true);
    const [postesRes, assignRes] = await Promise.all([
      supabase.from('postes').select('*').eq('actif', true).order('ordre').order('nom'),
      supabase.from('assignations').select('*').eq('actif', true),
    ]);
    setPostes((postesRes.data ?? []) as Poste[]);
    setAssignations((assignRes.data ?? []) as Assignation[]);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

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

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const myAssignation = assignations.find((a) => a.agent_id === myAuthId);

  async function handleSelfAssign(posteId: string) {
    if (!myAuthId) return;
    setActionLoading(true);

    // Récupérer mon nom et ma fonction
    const { data: mu } = await supabase
      .from('managed_users')
      .select('fonction, email')
      .eq('auth_user_id', myAuthId)
      .maybeSingle();

    const { data: prof } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', myAuthId)
      .maybeSingle();

    const nom = prof
      ? [prof.first_name, prof.last_name].filter(Boolean).join(' ').trim() || mu?.email || ''
      : mu?.email || '';

    // Désactiver assignation active existante
    if (myAssignation) {
      await supabase.from('assignations').update({ actif: false }).eq('id', myAssignation.id);
    }

    if (myAssignation?.poste_id === posteId) {
      // Déjà sur ce poste → simple désassignation
      setAssignations((prev) => prev.filter((a) => a.id !== myAssignation.id));
      setToast('Vous avez quitté le poste.');
      setActionLoading(false);
      return;
    }

    const { error } = await supabase.from('assignations').insert({
      poste_id: posteId,
      agent_id: myAuthId,
      agent_nom: nom,
      agent_fonction: mu?.fonction ?? '',
    });

    if (!error) {
      const { data } = await supabase.from('assignations').select('*').eq('actif', true);
      setAssignations((data ?? []) as Assignation[]);
      setToast('Poste pris en charge.');
    } else {
      setToast('Erreur lors de la prise de poste.');
    }
    setActionLoading(false);
  }

  async function openAssignPanel(posteId: string) {
    setAssignPanel(posteId);
    const poste = postes.find((p) => p.id === posteId);
    const alreadyHere = new Set(assignations.filter((a) => a.poste_id === posteId).map((a) => a.agent_id));

    const { data: managed } = await supabase
      .from('managed_users')
      .select('id, email, fonction, auth_user_id')
      .not('auth_user_id', 'is', null);

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name');

    const profMap: Record<string, { first_name: string; last_name: string }> = {};
    (profiles ?? []).forEach((p: { id: string; first_name: string; last_name: string }) => { profMap[p.id] = p; });

    const list = ((managed ?? []) as { id: string; email: string; fonction: string; auth_user_id: string }[])
      .filter((u) => {
        if (alreadyHere.has(u.auth_user_id)) return false;
        if (poste && poste.fonction !== 'Tous' && u.fonction !== poste.fonction) return false;
        return true;
      })
      .map((u) => {
        const p = profMap[u.auth_user_id];
        const nom = p ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || u.email : u.email;
        return { id: u.id, auth_user_id: u.auth_user_id, nom, fonction: u.fonction };
      });

    setAvailableAgents(list);
  }

  async function handleAdminAssign(posteId: string, agent: { auth_user_id: string; nom: string; fonction: string }) {
    setActionLoading(true);
    await supabase.from('assignations').update({ actif: false }).eq('agent_id', agent.auth_user_id).eq('actif', true);
    await supabase.from('assignations').insert({
      poste_id: posteId,
      agent_id: agent.auth_user_id,
      agent_nom: agent.nom,
      agent_fonction: agent.fonction,
    });
    const { data } = await supabase.from('assignations').select('*').eq('actif', true);
    setAssignations((data ?? []) as Assignation[]);
    setAssignPanel(null);
    setToast(`${agent.nom} assigné.`);
    setActionLoading(false);
  }

  async function handleAdminUnassign(a: Assignation) {
    setActionLoading(true);
    await supabase.from('assignations').update({ actif: false }).eq('id', a.id);
    setAssignations((prev) => prev.filter((x) => x.id !== a.id));
    setToast(`${a.agent_nom} retiré du poste.`);
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-white text-2xl font-bold">Postes</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {assignations.length} agent{assignations.length !== 1 ? 's' : ''} en poste
        </p>
      </div>

      {/* Mon poste (si assigné) */}
      {myAssignation && (
        <div className="mx-5 mb-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-600/15 border border-blue-500/30 p-4">
          <p className="text-xs text-blue-300/70 font-semibold uppercase tracking-wider mb-1">Mon poste actuel</p>
          <p className="text-white font-bold text-[16px]">
            {postes.find((p) => p.id === myAssignation.poste_id)?.nom ?? '—'}
          </p>
          <button
            onClick={() => handleSelfAssign(myAssignation.poste_id)}
            disabled={actionLoading}
            className="mt-3 flex items-center gap-1.5 text-xs text-red-400/80 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Quitter ce poste
          </button>
        </div>
      )}

      {/* Liste des postes */}
      {postes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <MapPin className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">Aucun poste configuré.</p>
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {postes.map((poste) => {
            const posteAssigns = assignations.filter((a) => a.poste_id === poste.id);
            const amIHere = posteAssigns.some((a) => a.agent_id === myAuthId);
            const b = badge(poste.fonction);

            return (
              <div
                key={poste.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
              >
                {/* Poste info */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <p className="text-white font-semibold text-[15px]">{poste.nom}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${b.bg} ${b.text}`}>
                          {poste.fonction}
                        </span>
                      </div>
                      {poste.description && (
                        <p className="text-slate-500 text-xs">{poste.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-slate-500 text-xs">
                      <Users className="w-3.5 h-3.5" />
                      {posteAssigns.length}
                    </div>
                  </div>

                  {/* Agents assignés */}
                  {posteAssigns.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {posteAssigns.map((a) => (
                        <div key={a.id} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1">
                          <div className="w-4 h-4 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                            <span className="text-[8px] font-bold text-white">{a.agent_nom.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="text-xs text-white">{a.agent_nom}</span>
                          {a.agent_id === myAuthId && (
                            <span className="text-[9px] text-blue-400 font-bold">(moi)</span>
                          )}
                          {hasAdminAccess && (
                            <button
                              onClick={() => handleAdminUnassign(a)}
                              className="w-3.5 h-3.5 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-800 px-4 py-2.5 flex items-center gap-2">
                  {/* Prise de poste personnelle */}
                  <button
                    onClick={() => handleSelfAssign(poste.id)}
                    disabled={actionLoading}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all
                      ${amIHere
                        ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30'
                        : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                  >
                    {amIHere ? (
                      <><Check className="w-4 h-4" /> Je suis en poste</>
                    ) : (
                      <><ChevronRight className="w-4 h-4" /> Prendre ce poste</>
                    )}
                  </button>

                  {/* Assignation admin */}
                  {hasAdminAccess && (
                    <button
                      onClick={() => assignPanel === poste.id ? setAssignPanel(null) : openAssignPanel(poste.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-blue-400 hover:border-blue-500/40 transition-all"
                      title="Assigner un agent"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Panneau assignation admin */}
                {hasAdminAccess && assignPanel === poste.id && (
                  <div className="border-t border-slate-800 px-4 pb-3 pt-2">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Assigner un agent</p>
                    {availableAgents.length === 0 ? (
                      <p className="text-xs text-slate-600 italic">Aucun agent disponible.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {availableAgents.map((ag) => {
                          const ab = badge(ag.fonction);
                          return (
                            <button
                              key={ag.id}
                              onClick={() => handleAdminAssign(poste.id, ag)}
                              disabled={actionLoading}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all text-left"
                            >
                              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                <span className="text-[11px] font-bold text-slate-300">{ag.nom.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="flex-1 text-sm text-white truncate">{ag.nom}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ab.bg} ${ab.text}`}>{ag.fonction}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
