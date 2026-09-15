import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Agent = {
  managed_id: string;
  auth_user_id: string;
  email: string;
  fonction: string;
};

type Profile = {
  first_name: string;
  last_name: string;
  nationalite: string;
  carte_pro_numero: string;
  carte_pro_validite: string | null;
};

type Formation = {
  id: string;
  type_formation: string;
  date_formation: string;
  date_fin_validite: string | null;
};

type EtabInfo = {
  nom: string;
  enseigne: string | null;
  logo_url: string | null;
};

const FONCTION_BADGE: Record<string, string> = {
  'Agent de Sécurité': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Chef de poste': 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  'Direction': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isExpired(d: string | null): boolean {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

export default function CarteProPage() {
  const navigate = useNavigate();
  const { session, userFonction, isSuperAdmin } = useAuth();
  const myAuthId = session?.user.id;

  const isManager = userFonction === 'Direction' || userFonction === 'Chef de poste';

  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [etabInfo, setEtabInfo] = useState<EtabInfo | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // For agents: load their own profile directly
  // For managers: load list of agents, then load selected agent's profile

  useEffect(() => {
    if (!myAuthId) return;
    if (isManager) {
      loadAgentList();
    } else {
      // Agent: load own data directly
      loadAgentDetail(myAuthId);
    }
  }, [myAuthId, isManager]);

  async function loadAgentList() {
    setLoading(true);
    const { data } = await supabase
      .from('managed_users')
      .select('id, auth_user_id, email, fonction')
      .not('auth_user_id', 'is', null)
      .in('fonction', ['Agent de Sécurité', 'Chef de poste'])
      .order('fonction', { ascending: true })
      .order('email', { ascending: true });

    setAgents((data ?? []) as Agent[]);

    // Load etablissement info
    const { data: mu } = await supabase
      .from('managed_users')
      .select('etablissement_id')
      .eq('auth_user_id', myAuthId!)
      .maybeSingle();

    if (mu?.etablissement_id) {
      const { data: etab } = await supabase
        .from('etablissements')
        .select('nom, enseigne, logo_url')
        .eq('id', mu.etablissement_id)
        .maybeSingle();
      if (etab) setEtabInfo(etab as EtabInfo);
    }

    setLoading(false);
  }

  async function loadAgentDetail(authUserId: string) {
    setDetailLoading(true);
    setProfile(null);
    setFormations([]);

    const [profRes, formRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('first_name, last_name, nationalite, carte_pro_numero, carte_pro_validite')
        .eq('id', authUserId)
        .maybeSingle(),
      supabase
        .from('user_formations')
        .select('id, type_formation, date_formation, date_fin_validite')
        .eq('user_id', authUserId)
        .order('date_formation', { ascending: false }),
    ]);

    // If date_fin_validite column doesn't exist yet, retry without it
    if (formRes.error && formRes.error.message.includes('date_fin_validite')) {
      const fallback = await supabase
        .from('user_formations')
        .select('id, type_formation, date_formation')
        .eq('user_id', authUserId)
        .order('date_formation', { ascending: false });
      formRes.data = fallback.data;
      formRes.error = fallback.error;
    }

    if (profRes.data) {
      setProfile({
        first_name: profRes.data.first_name ?? '',
        last_name: profRes.data.last_name ?? '',
        nationalite: profRes.data.nationalite ?? '',
        carte_pro_numero: profRes.data.carte_pro_numero ?? '',
        carte_pro_validite: profRes.data.carte_pro_validite ?? null,
      });
    }
    setFormations((formRes.data ?? []) as Formation[]);

    // Load etab info if not already loaded (agent viewing own card)
    if (!etabInfo) {
      const { data: mu } = await supabase
        .from('managed_users')
        .select('etablissement_id')
        .eq('auth_user_id', myAuthId!)
        .maybeSingle();
      if (mu?.etablissement_id) {
        const { data: etab } = await supabase
          .from('etablissements')
          .select('nom, enseigne, logo_url')
          .eq('id', mu.etablissement_id)
          .maybeSingle();
        if (etab) setEtabInfo(etab as EtabInfo);
      }
    }

    setDetailLoading(false);
  }

  function handleSelectAgent(agent: Agent) {
    setSelectedAgent(agent);
    loadAgentDetail(agent.auth_user_id);
  }

  function handleBack() {
    setSelectedAgent(null);
    setProfile(null);
    setFormations([]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  // ── Manager: list view ──
  if (isManager && !selectedAgent) {
    return (
      <div className="pb-6">
        <div className="px-5 pt-6 pb-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/mobile/outils')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-xl font-bold">Carte PRO</h1>
            <p className="text-slate-500 text-xs">Cartes professionnelles de l'équipe</p>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <ShieldCheck className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Aucun agent trouvé.</p>
          </div>
        ) : (
          <div className="px-5 space-y-2">
            {agents.map((agent) => {
              const badge = FONCTION_BADGE[agent.fonction] ?? 'bg-slate-600/25 text-slate-300 border-slate-500/30';
              return (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all active:scale-[0.99] text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-slate-300">
                      {(agent.email.charAt(0) || '?').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{agent.email}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge}`}>
                      {agent.fonction}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Detail view (agent's own card, or manager viewing a selected agent) ──
  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || selectedAgent?.email || '—'
    : selectedAgent?.email || '—';

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        {isManager && selectedAgent ? (
          <button
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => navigate('/mobile/outils')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-white text-xl font-bold">Carte PRO</h1>
          <p className="text-slate-500 text-xs">{isManager ? 'Fiche détaillée' : 'Ma carte professionnelle'}</p>
        </div>
      </div>

      {detailLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement…
        </div>
      ) : (
        <div className="px-5">
          {/* Card */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 overflow-hidden">
            {/* Header with logo */}
            <div className="px-5 pt-5 pb-4 border-b border-slate-800 flex items-center gap-3">
              {etabInfo?.logo_url ? (
                <img
                  src={etabInfo.logo_url}
                  alt="Logo"
                  className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-slate-500" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-bold text-base truncate">
                  {etabInfo?.enseigne || etabInfo?.nom || '—'}
                </p>
                {selectedAgent && (
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${FONCTION_BADGE[selectedAgent.fonction] ?? 'bg-slate-600/25 text-slate-300 border-slate-500/30'}`}>
                    {selectedAgent.fonction}
                  </span>
                )}
              </div>
            </div>

            {/* Identity */}
            <div className="px-5 py-4 space-y-3.5">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Nom complet</span>
                <span className="text-white text-sm font-medium">{displayName}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Nationalité</span>
                <span className="text-white text-sm">{profile?.nationalite || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">N° carte professionnelle CNAPS</span>
                <span className="text-white text-sm font-mono">{profile?.carte_pro_numero || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Fin de validité (carte)</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isExpired(profile?.carte_pro_validite ?? null) ? 'text-red-400' : 'text-white'}`}>
                    {formatDate(profile?.carte_pro_validite ?? null)}
                  </span>
                  {isExpired(profile?.carte_pro_validite ?? null) && (
                    <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold">
                      <AlertCircle className="w-3 h-3" />
                      Expirée
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Formations table */}
            <div className="border-t border-slate-800">
              <div className="px-5 pt-4 pb-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Formations</span>
              </div>
              {formations.length === 0 ? (
                <div className="px-5 pb-5">
                  <p className="text-slate-600 text-xs italic">Aucune formation enregistrée.</p>
                </div>
              ) : (
                <div className="px-5 pb-5">
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-2 bg-slate-800/50">
                      <div className="px-3 py-2 text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Formation</div>
                      <div className="px-3 py-2 text-[10px] text-slate-400 uppercase font-semibold tracking-wider text-right">Fin de validité</div>
                    </div>
                    {formations.map((f, i) => {
                      const expired = isExpired(f.date_fin_validite);
                      return (
                        <div key={f.id} className={`grid grid-cols-2 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}`}>
                          <div className="px-3 py-2.5 text-sm text-white">{f.type_formation}</div>
                          <div className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className={`text-sm ${expired ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                                {formatDate(f.date_fin_validite)}
                              </span>
                              {expired && (
                                <span className="flex items-center gap-0.5 text-[10px] text-red-400 font-semibold">
                                  <AlertCircle className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Read-only notice */}
          <p className="text-center text-[11px] text-slate-600 mt-4">
            Fiche en lecture seule. Pour modifier, rendez-vous sur votre profil.
          </p>
        </div>
      )}
    </div>
  );
}
