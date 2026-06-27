import { useEffect, useState } from 'react';
import { X, Loader2, User, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  etablissementId: string;
  etablissementNom: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

type DirectionData = {
  managed_id: string;
  auth_user_id: string;
  email: string;
  first_login_at: string | null;
  first_name: string;
  last_name: string;
  telephone: string;
};

export default function EditDirectionModal({ etablissementId, etablissementNom, onClose, onSaved, onError }: Props) {
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [original, setOriginal]     = useState<DirectionData | null>(null);

  const [prenom, setPrenom]         = useState('');
  const [nom, setNom]               = useState('');
  const [email, setEmail]           = useState('');
  const [telephone, setTelephone]   = useState('');
  const [errors, setErrors]         = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: managed } = await supabase
        .from('managed_users')
        .select('id, auth_user_id, email, first_login_at')
        .eq('etablissement_id', etablissementId)
        .eq('fonction', 'Direction')
        .maybeSingle();

      if (!managed) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, telephone')
        .eq('id', managed.auth_user_id)
        .maybeSingle();

      const d: DirectionData = {
        managed_id: managed.id,
        auth_user_id: managed.auth_user_id,
        email: managed.email,
        first_login_at: managed.first_login_at,
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? '',
        telephone: profile?.telephone ?? '',
      };
      setOriginal(d);
      setPrenom(d.first_name);
      setNom(d.last_name);
      setEmail(d.email);
      setTelephone(d.telephone);
      setLoading(false);
    })();
  }, [etablissementId]);

  function validate() {
    const e: Record<string, string> = {};
    if (!prenom.trim()) e.prenom = 'Prénom requis';
    if (!nom.trim()) e.nom = 'Nom requis';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'Email valide requis';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate() || !original) return;
    setSaving(true);

    const emailChanged = email.trim().toLowerCase() !== original.email.toLowerCase();

    try {
      if (emailChanged) {
        // Re-invite with new email via edge function (deletes old auth user, creates new)
        const { data, error } = await supabase.functions.invoke('resend-invitation', {
          body: {
            etablissement_id: etablissementId,
            action: 'change_email',
            new_email: email.trim().toLowerCase(),
            first_name: prenom.trim(),
            last_name: nom.trim(),
            telephone: telephone.trim(),
          },
        });
        if (error || data?.error) {
          onError(data?.error ?? "Erreur lors du changement d'email");
          setSaving(false);
          return;
        }
        // managed_users.email updated by edge function; update profile fields here
        // The edge function also creates a new user_profiles row
        onSaved(`Email modifié → nouvelle invitation envoyée à ${email.trim()}`);
      } else {
        // Only profile fields changed
        const { error: profileErr } = await supabase
          .from('user_profiles')
          .update({
            first_name: prenom.trim(),
            last_name: nom.trim(),
            telephone: telephone.trim(),
          })
          .eq('id', original.auth_user_id);

        if (profileErr) {
          onError('Erreur lors de la mise à jour du profil');
          setSaving(false);
          return;
        }
        onSaved('Informations Direction mises à jour');
      }
    } catch {
      onError('Erreur inattendue');
    }
    setSaving(false);
    onClose();
  }

  const emailChanged = email.trim().toLowerCase() !== (original?.email ?? '').toLowerCase();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Modifier Direction</h2>
              <p className="text-xs text-slate-400">{etablissementNom}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-slate-400 text-sm">Chargement…</span>
            </div>
          ) : !original ? (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Aucun utilisateur Direction trouvé pour cet établissement.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={prenom}
                    onChange={e => setPrenom(e.target.value)}
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.prenom ? 'border-red-500' : 'border-slate-700'}`}
                  />
                  {errors.prenom && <p className="mt-1 text-xs text-red-400">{errors.prenom}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nom</label>
                  <input
                    type="text"
                    value={nom}
                    onChange={e => setNom(e.target.value)}
                    className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.nom ? 'border-red-500' : 'border-slate-700'}`}
                  />
                  {errors.nom && <p className="mt-1 text-xs text-red-400">{errors.nom}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${errors.email ? 'border-red-500' : emailChanged ? 'border-amber-500' : 'border-slate-700'}`}
                />
                {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                {emailChanged && !errors.email && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-400">
                    <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    L'ancien email sera désactivé et une nouvelle invitation sera envoyée.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={telephone}
                  onChange={e => setTelephone(e.target.value)}
                  placeholder="06 00 00 00 00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {original.first_login_at && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Compte activé le {new Date(original.first_login_at).toLocaleDateString('fr-FR')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && original && (
          <div className="flex gap-3 px-6 pb-5">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Enregistrement…</> : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
