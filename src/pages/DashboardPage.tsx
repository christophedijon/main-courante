import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Search, Trash2,
  ChevronUp, ChevronDown, RefreshCw, Mail, Pencil,
  X, Copy, CheckCircle, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ManagedUser } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import CreateUserModal from '../components/CreateUserModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import Toast, { type ToastType } from '../components/Toast';
import AppHeader from '../components/AppHeader';

type SortKey = keyof Pick<ManagedUser, 'email' | 'fonction' | 'status' | 'created_at'>;
type SortDir = 'asc' | 'desc';

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive:  'bg-slate-500/10  text-slate-400  border-slate-500/20',
  suspended: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Actif', inactive: 'Inactif', suspended: 'Suspendu',
};
const FONCTION_STYLES: Record<string, string> = {
  'Agent de Sécurité': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Serveur':           'bg-cyan-500/10  text-cyan-400  border-cyan-500/20',
  'Direction':         'bg-rose-500/10  text-rose-400  border-rose-500/20',
  'Chef de poste':     'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function avatarLetter(email: string) {
  return email.charAt(0).toUpperCase();
}

export default function DashboardPage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statsOpen, setStatsOpen] = useState(true);
  const [fonctionOpen, setFonctionOpen] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteFonction, setInviteFonction] = useState('Agent de Sécurité');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<{ email: string; password: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('managed_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setUsers(data as ManagedUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) {
      navigate('/');
    } else {
      fetchUsers();
    }
  }, [session, navigate, fetchUsers]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    // Delete the auth user via edge function if linked
    if (deleteTarget.auth_user_id) {
      const { data: { session: s } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-managed-user`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s?.access_token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ auth_user_id: deleteTarget.auth_user_id }),
        }
      );
    }

    const { error } = await supabase.from('managed_users').delete().eq('id', deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    if (error) {
      setToast({ message: 'Erreur lors de la suppression.', type: 'error' });
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setToast({ message: `${deleteTarget.email} a été supprimé.`, type: 'success' });
    }
  }

  function handleCreated(user: ManagedUser) {
    setUsers((prev) => [user, ...prev]);
    setShowCreate(false);
    setToast({ message: `${user.email} a été créé avec succès.`, type: 'success' });
  }

  function generatePassword() {
    return Math.random().toString(36).slice(-8);
  }

  function openInvite() {
    setInviteEmail('');
    setInvitePassword(generatePassword());
    setInviteFonction('Agent de Sécurité');
    setInviteError(null);
    setInviteSuccess(null);
    setCopiedCredentials(false);
    setShowInvite(true);
  }

  function closeInvite() {
    setShowInvite(false);
    setInviteSuccess(null);
    setInviteError(null);
    if (inviteSuccess) fetchUsers();
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteLoading(true);
    const { data: { session: s } } = await supabase.auth.getSession();
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s?.access_token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: inviteEmail,
            password: invitePassword,
            fonction: inviteFonction,
            invited_by: s?.user.id,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        setInviteError(json.error ?? 'Erreur inconnue');
      } else {
        setInviteSuccess({ email: inviteEmail, password: invitePassword });
      }
    } catch {
      setInviteError('Erreur réseau. Réessayez.');
    }
    setInviteLoading(false);
  }

  function copyCredentials() {
    if (!inviteSuccess) return;
    navigator.clipboard.writeText(`Email : ${inviteSuccess.email}\nMot de passe : ${inviteSuccess.password}`);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2000);
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.fonction.toLowerCase().includes(q) ||
      u.status.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    return sortDir === 'asc'
      ? av < bv ? -1 : av > bv ? 1 : 0
      : av > bv ? -1 : av < bv ? 1 : 0;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={handleSignOut} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-white">Utilisateurs</h2>
            <p className="text-slate-400 text-sm mt-1">
              {users.length} compte{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchUsers}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
              title="Rafraîchir"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={openInvite}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-medium
                px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/30"
            >
              <UserPlus className="w-4 h-4" />
              Inviter un utilisateur
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium
                px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30"
            >
              <UserPlus className="w-4 h-4" />
              Nouvel utilisateur
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-4">
          <button
            type="button"
            onClick={() => setStatsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors"
          >
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              Statistiques
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${statsOpen ? 'rotate-180' : ''}`} />
          </button>
          {statsOpen && (
            <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total',     value: users.length,                                          color: 'text-white' },
                { label: 'Actifs',    value: users.filter((u) => u.status === 'active').length,     color: 'text-emerald-400' },
                { label: 'Inactifs',  value: users.filter((u) => u.status === 'inactive').length,   color: 'text-slate-400' },
                { label: 'Suspendus', value: users.filter((u) => u.status === 'suspended').length,  color: 'text-amber-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fonction breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => setFonctionOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors"
          >
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              Par fonction
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${fonctionOpen ? 'rotate-180' : ''}`} />
          </button>
          {fonctionOpen && (
            <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['Agent de Sécurité', 'Serveur', 'Chef de poste', 'Direction'] as const).map((f) => (
                <div key={f} className={`rounded-xl p-4 border ${FONCTION_STYLES[f]}`}>
                  <p className="text-xs opacity-70 mb-1">{f}</p>
                  <p className="text-2xl font-bold">{users.filter((u) => u.fonction === f).length}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white
                  placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Users className="w-3.5 h-3.5" />
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Chargement…
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">{search ? 'Aucun résultat pour cette recherche.' : 'Aucun utilisateur pour le moment.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    {([
                      { key: 'email',      label: 'E-mail' },
                      { key: 'fonction',   label: 'Fonction' },
                      { key: 'status',     label: 'Statut' },
                      { key: 'created_at', label: 'Créé le' },
                    ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="px-5 py-3 text-left font-medium uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none"
                      >
                        <span className="flex items-center gap-1.5">
                          {label}
                          <SortIcon col={key} />
                        </span>
                      </th>
                    ))}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((user, i) => (
                    <tr
                      key={user.id}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group
                        ${i % 2 === 0 ? '' : 'bg-slate-800/10'}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-slate-300">
                              {avatarLetter(user.email)}
                            </span>
                          </div>
                          <span className="text-slate-200 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            {user.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${FONCTION_STYLES[user.fonction] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                          {user.fonction}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[user.status] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                          {STATUS_LABELS[user.status] ?? user.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => navigate(`/dashboard/users/${user.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                            title="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(user)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          userName={deleteTarget.email}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
      {/* Modale invitation */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeInvite} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="text-white font-bold text-lg">Inviter un utilisateur</h3>
                <p className="text-slate-400 text-xs mt-0.5">Compte provisoire — valable 48h</p>
              </div>
              <button type="button" onClick={closeInvite}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              {inviteSuccess ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <p className="font-semibold">Compte provisoire créé.</p>
                  </div>
                  <p className="text-slate-400 text-sm">Communiquez ces identifiants à l'agent :</p>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-slate-400 text-xs w-24 shrink-0">Email</span>
                      <span className="text-white text-sm font-mono">{inviteSuccess.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-slate-400 text-xs w-24 shrink-0">Mot de passe</span>
                      <span className="text-white text-sm font-mono">{inviteSuccess.password}</span>
                    </div>
                  </div>
                  <button type="button" onClick={copyCredentials}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all
                      ${copiedCredentials ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
                    {copiedCredentials ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedCredentials ? 'Copié !' : 'Copier les identifiants'}
                  </button>
                  <button type="button" onClick={closeInvite}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all">
                    Fermer
                  </button>
                </div>
              ) : (
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  {inviteError && (
                    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {inviteError}
                    </div>
                  )}

                  <InviteField label="Email *">
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="adresse@email.com"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </InviteField>

                  <InviteField label="Mot de passe provisoire *">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        placeholder="Mot de passe à communiquer"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <button type="button" onClick={() => setInvitePassword(generatePassword())}
                        className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-xs font-medium transition-colors whitespace-nowrap">
                        Générer
                      </button>
                    </div>
                  </InviteField>

                  <InviteField label="Fonction *">
                    <select
                      value={inviteFonction}
                      onChange={(e) => setInviteFonction(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                    >
                      <option>Direction</option>
                      <option>Chef de poste</option>
                      <option>Agent de Sécurité</option>
                      <option>Serveur</option>
                    </select>
                  </InviteField>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeInvite}
                      className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all">
                      Annuler
                    </button>
                    <button type="submit" disabled={inviteLoading}
                      className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                      {inviteLoading
                        ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Création…</>
                        : 'Créer le compte provisoire'
                      }
                    </button>
                  </div>
                </form>
              )}
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

function InviteField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}
