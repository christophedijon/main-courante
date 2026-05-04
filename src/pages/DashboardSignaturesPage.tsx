import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PenLine, Shield, Flame, FileText, Radio, ChevronDown, ChevronUp,
  CheckCircle, Clock, Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

type Categorie = 'RONDE' | 'SSI' | 'PROCEDURE' | 'RADIO';

type Doc = {
  id: string;
  titre: string;
  categorie: Categorie;
  destinataires: string[];
  content_version: number;
};

type Signature = {
  id: string;
  document_id: string;
  agent_id: string;
  agent_nom: string;
  agent_role: string;
  signed_at: string;
  content_version: number;
};

type Agent = {
  id: string;
  email: string;
  fonction: string;
  auth_user_id: string | null;
};

type Profile = { id: string; first_name: string; last_name: string };

const CAT_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; accent: string; badge: string }> = {
  RONDE:     { label: 'Rôle',          icon: Shield,   accent: 'text-blue-400',  badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  SSI:       { label: 'Consignes SSI', icon: Flame,    accent: 'text-red-400',   badge: 'bg-red-500/15 text-red-400 border-red-500/20' },
  PROCEDURE: { label: 'Info & Doc',    icon: FileText, accent: 'text-slate-300', badge: 'bg-slate-600/25 text-slate-300 border-slate-500/30' },
  RADIO:     { label: 'Radio',         icon: Radio,    accent: 'text-teal-400',  badge: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DashboardSignaturesPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'complete' | 'pending'>('all');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [docsRes, sigsRes, agentsRes] = await Promise.all([
      supabase.from('toolbox_documents').select('id, titre, categorie, destinataires, content_version').eq('actif', true).eq('signature_requise', true),
      supabase.from('signatures').select('*'),
      supabase.from('managed_users').select('id, email, fonction, auth_user_id').order('email'),
    ]);

    const agentList = (agentsRes.data ?? []) as Agent[];
    setDocs((docsRes.data ?? []) as Doc[]);
    setSignatures((sigsRes.data ?? []) as Signature[]);
    setAgents(agentList);

    const authIds = agentList.map((u) => u.auth_user_id).filter(Boolean) as string[];
    if (authIds.length > 0) {
      const { data: profs } = await supabase.from('user_profiles').select('id, first_name, last_name').in('id', authIds);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: Profile) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
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

  function getDocSignatures(doc: Doc) {
    return signatures.filter((s) => s.document_id === doc.id && s.content_version === doc.content_version);
  }

  function getExpectedAgents(doc: Doc): Agent[] {
    if (!doc.destinataires || doc.destinataires.length === 0) return agents.filter((a) => a.auth_user_id);
    return agents.filter((a) => a.auth_user_id && doc.destinataires.includes(a.fonction));
  }

  const filteredDocs = docs.filter((doc) => {
    if (filterCat !== 'all' && doc.categorie !== filterCat) return false;
    const signed = getDocSignatures(doc);
    const expected = getExpectedAgents(doc);
    const complete = expected.length > 0 && signed.length >= expected.length;
    if (filterStatus === 'complete' && !complete) return false;
    if (filterStatus === 'pending' && complete) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={async () => { await signOut(); navigate('/'); }} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <PenLine className="w-6 h-6 text-amber-400" />
              Suivi des signatures
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {docs.length} document{docs.length !== 1 ? 's' : ''} avec signature requise
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter className="w-4 h-4" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[{ v: 'all', l: 'Toutes catégories' }, ...Object.entries(CAT_META).map(([v, m]) => ({ v, l: m.label }))].map(({ v, l }) => (
              <button key={v} onClick={() => setFilterCat(v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                  ${filterCat === v ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-slate-700 hidden sm:block" />
          <div className="flex gap-2">
            {([['all', 'Tous'], ['pending', 'En attente'], ['complete', 'Complets']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                  ${filterStatus === v ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-500">
            <PenLine className="w-10 h-10 mb-3 opacity-25" />
            <p className="text-sm">Aucun document avec signature requise.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map((doc) => {
              const docSigs = getDocSignatures(doc);
              const expectedAgents = getExpectedAgents(doc);
              const total = expectedAgents.length;
              const done = docSigs.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const complete = total > 0 && done >= total;
              const isOpen = expandedId === doc.id;
              const meta = CAT_META[doc.categorie];
              const Icon = meta?.icon ?? FileText;

              const signedIds = new Set(docSigs.map((s) => s.agent_id));
              const unsigned = expectedAgents.filter((a) => !signedIds.has(a.auth_user_id!));

              return (
                <div key={doc.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : doc.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-800/40 transition-all text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta?.badge ?? ''}`}>
                      <Icon className={`w-4 h-4 ${meta?.accent ?? ''}`} strokeWidth={2.3} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-sm">{doc.titre}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${meta?.badge ?? ''}`}>
                          {meta?.label}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold
                          ${complete ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border-amber-500/20'}`}>
                          {complete ? 'Complet' : 'En attente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                          {done} / {total}
                        </span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-800 px-5 py-4 space-y-4">
                      {/* Ont signé */}
                      {docSigs.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Ont signé ({docSigs.length})
                          </p>
                          <div className="space-y-2">
                            {docSigs.map((sig) => (
                              <div key={sig.id} className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2.5">
                                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-emerald-400">
                                    {sig.agent_nom.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-[13px] font-medium">{sig.agent_nom}</p>
                                  <p className="text-slate-500 text-[11px]">{sig.agent_role}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                                    <CheckCircle className="w-3 h-3" />
                                    Signé
                                  </span>
                                  <p className="text-slate-600 text-[10px] mt-0.5">{fmtDate(sig.signed_at)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* N'ont pas signé */}
                      {unsigned.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            En attente ({unsigned.length})
                          </p>
                          <div className="space-y-2">
                            {unsigned.map((agent) => (
                              <div key={agent.id} className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {agentLabel(agent).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-slate-300 text-[13px] font-medium">{agentLabel(agent)}</p>
                                  <p className="text-slate-500 text-[11px]">{agent.fonction}</p>
                                </div>
                                <span className="flex items-center gap-1 text-amber-400 text-[11px] font-semibold shrink-0">
                                  <Clock className="w-3 h-3" />
                                  En attente
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {total === 0 && (
                        <p className="text-slate-500 text-sm italic">Aucun destinataire configuré pour ce document.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
