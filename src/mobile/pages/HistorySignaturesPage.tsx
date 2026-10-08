import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp as ChevronUpIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEntreprise } from '../../hooks/useEntreprise';
import EmptyState from '../components/EmptyState';

type SignatureUser = {
  id: string;
  email: string;
  fonction: string;
  auth_user_id: string | null;
  unsigned: { id: string; titre: string }[];
  signed: { id: string; titre: string; signed_at: string }[];
  allSigned: boolean;
};

export default function HistorySignaturesPage() {
  const navigate = useNavigate();
  const { id: etabId } = useEntreprise();
  const [sigUsers, setSigUsers] = useState<SignatureUser[]>([]);
  const [sigLoading, setSigLoading] = useState(false);
  const [expandedSigUser, setExpandedSigUser] = useState<string | null>(null);
  const [rappelLoading, setRappelLoading] = useState<string | null>(null);
  const [rappelConfirm, setRappelConfirm] = useState<string | null>(null);
  const [sigToast, setSigToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!etabId) return;
    (async () => {
      setSigLoading(true);
      const [usersRes, docsRes] = await Promise.all([
        supabase.from('managed_users').select('id, email, fonction, auth_user_id').eq('etablissement_id', etabId).neq('status', 'suspended'),
        supabase.from('toolbox_documents').select('id, titre, destinataires, content_version').eq('actif', true).eq('signature_requise', true),
      ]);
      const users = (usersRes.data ?? []) as { id: string; email: string; fonction: string; auth_user_id: string | null }[];
      const docs = (docsRes.data ?? []) as { id: string; titre: string; destinataires: string[] | null; content_version: number }[];
      const authIds = users.map((u) => u.auth_user_id).filter(Boolean) as string[];
      let allSigs: { document_id: string; content_version: number; agent_id: string; signed_at: string }[] = [];
      if (authIds.length > 0) {
        const { data: sigsData } = await supabase.from('signatures').select('document_id, content_version, agent_id, signed_at').in('agent_id', authIds);
        allSigs = (sigsData ?? []) as { document_id: string; content_version: number; agent_id: string; signed_at: string }[];
      }
      const result: SignatureUser[] = users.map((user) => {
        const userDocs = docs.filter((d) => !d.destinataires || d.destinataires.length === 0 || d.destinataires.includes(user.fonction));
        const userSigs = allSigs.filter((s) => s.agent_id === user.auth_user_id);
        const signedSet = new Set(userSigs.map((s) => `${s.document_id}:${s.content_version}`));
        const unsigned = userDocs.filter((d) => !signedSet.has(`${d.id}:${d.content_version}`)).map((d) => ({ id: d.id, titre: d.titre }));
        const signed = userDocs.filter((d) => signedSet.has(`${d.id}:${d.content_version}`)).map((d) => {
          const sig = userSigs.find((s) => s.document_id === d.id && s.content_version === d.content_version);
          return { id: d.id, titre: d.titre, signed_at: sig?.signed_at ?? '' };
        });
        return { id: user.id, email: user.email, fonction: user.fonction, auth_user_id: user.auth_user_id, unsigned, signed, allSigned: unsigned.length === 0 };
      });
      setSigUsers(result);
      setSigLoading(false);
    })();
  }, [etabId]);

  async function handleRappel(user: SignatureUser) {
    setRappelLoading(user.id);
    setSigToast(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-signature-rappel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s?.access_token}`, 'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ target_email: user.email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSigToast({ msg: data.error ?? 'Erreur lors de l\'envoi.', type: 'error' });
      } else {
        setSigToast({ msg: `Rappel envoyé à ${user.email}`, type: 'success' });
      }
    } catch {
      setSigToast({ msg: 'Erreur réseau.', type: 'error' });
    }
    setRappelLoading(null);
    setRappelConfirm(null);
    setTimeout(() => setSigToast(null), 4000);
  }

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/mobile/historique')} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px]">Signatures</p>
          <p className="text-slate-500 text-xs">Suivi des documents signés</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {sigLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement…</span></div>
        )}
        {!sigLoading && sigUsers.length === 0 && <EmptyState text="Aucun utilisateur" hint="Les agents de votre établissement apparaîtront ici" />}
        {sigToast && (
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${sigToast.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {sigToast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}{sigToast.msg}
          </div>
        )}
        {!sigLoading && sigUsers.map((user) => {
          const isExpanded = expandedSigUser === user.id;
          const hasUnsigned = user.unsigned.length > 0;
          return (
            <div key={user.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <button type="button" onClick={() => setExpandedSigUser(isExpanded ? null : user.id)} className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasUnsigned ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm truncate ${hasUnsigned ? 'text-red-400' : 'text-emerald-400'}`}>{user.email}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">{user.fonction}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!hasUnsigned && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">{user.signed.length} signé{user.signed.length > 1 ? 's' : ''}</span>}
                  {hasUnsigned && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">{user.unsigned.length} manquant{user.unsigned.length > 1 ? 's' : ''}</span>}
                  {hasUnsigned && (
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setRappelConfirm(rappelConfirm === user.id ? null : user.id); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer" title="Envoyer un rappel">
                      {rappelLoading === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    </span>
                  )}
                  {isExpanded ? <ChevronUpIcon className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </button>
              {rappelConfirm === user.id && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <button type="button" onClick={() => handleRappel(user)} disabled={rappelLoading === user.id} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all">Confirmer l'envoi du rappel</button>
                  <button type="button" onClick={() => setRappelConfirm(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium">Annuler</button>
                </div>
              )}
              {isExpanded && (
                <div className="border-t border-slate-800 px-4 py-3 space-y-2">
                  {user.signed.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 py-1.5"><CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /><span className="text-slate-300 text-sm flex-1 truncate">{doc.titre}</span><span className="text-slate-500 text-[11px] whitespace-nowrap">{new Date(doc.signed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></div>
                  ))}
                  {user.unsigned.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 py-1.5"><AlertCircle className="w-4 h-4 text-red-500 shrink-0" /><span className="text-red-400 text-sm flex-1 truncate">{doc.titre}</span><span className="text-red-400/60 text-[11px]">Non signé</span></div>
                  ))}
                  {user.signed.length === 0 && user.unsigned.length === 0 && <p className="text-slate-500 text-xs py-2">Aucun document à signer pour cet utilisateur.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
