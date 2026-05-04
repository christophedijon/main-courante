import { useEffect, useState, useRef, FormEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, Globe, Briefcase, KeyRound,
  Save, AlertCircle, CheckCircle, Eye, EyeOff, CreditCard,
  Calendar, GraduationCap, Plus, Trash2, X, ShieldCheck, Upload, Image as ImageIcon,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import CnapsInput, { isValidCnaps } from '../components/CnapsInput';

type ManagedUserRow = {
  id: string;
  email: string;
  fonction: string;
  status: string;
  auth_user_id: string | null;
  created_at: string;
};

type Profile = {
  first_name: string;
  last_name: string;
  telephone: string;
  nationalite: string;
  carte_sejour_numero: string;
  carte_sejour_validite: string;
  carte_sejour_recto_url: string | null;
  carte_sejour_recto_path: string | null;
  carte_sejour_verso_url: string | null;
  carte_sejour_verso_path: string | null;
  carte_pro_numero: string;
  carte_pro_validite: string;
};

type Formation = { id: string; type_formation: string; date_formation: string };
type FormationDraft = { type_formation: string; date_formation: string };
type PhotoSide = 'recto' | 'verso';

const EMPTY_PROFILE: Profile = {
  first_name: '', last_name: '', telephone: '', nationalite: '',
  carte_sejour_numero: '', carte_sejour_validite: '',
  carte_sejour_recto_url: null, carte_sejour_recto_path: null,
  carte_sejour_verso_url: null, carte_sejour_verso_path: null,
  carte_pro_numero: '', carte_pro_validite: '',
};

const TYPES_FORMATION = ['Extincteur', 'SST', 'Habili Elec', 'SIAPP1', 'SIAPP2'];

const EXEMPT_NATIONALITIES = new Set([
  'Française', 'Allemande', 'Autrichienne', 'Belge', 'Bulgare', 'Chypriote', 'Croate', 'Danoise',
  'Espagnole', 'Estonienne', 'Finlandaise', 'Grecque', 'Hongroise', 'Irlandaise', 'Italienne',
  'Lettone', 'Lituanienne', 'Luxembourgeoise', 'Maltaise', 'Néerlandaise', 'Polonaise', 'Portugaise',
  'Roumaine', 'Slovaque', 'Slovène', 'Suédoise', 'Tchèque', 'Islandaise', 'Liechtensteinoise',
  'Norvégienne', 'Suisse',
]);

const NATIONALITIES = [
  'Afghane', 'Albanaise', 'Algérienne', 'Allemande', 'Américaine', 'Andorrane', 'Angolaise',
  'Argentine', 'Arménienne', 'Australienne', 'Autrichienne', 'Azerbaïdjanaise', 'Belge',
  'Bélarusse', 'Brésilienne', 'Britannique', 'Bulgare', 'Camerounaise', 'Canadienne',
  'Chypriote', 'Chinoise', 'Colombienne', 'Congolaise', 'Croate', 'Danoise', 'Égyptienne',
  'Espagnole', 'Estonienne', 'Finlandaise', 'Française', 'Gabonaise', 'Géorgienne', 'Ghanéenne',
  'Grecque', 'Hongroise', 'Indienne', 'Indonésienne', 'Irakienne', 'Iranienne', 'Irlandaise',
  'Islandaise', 'Israélienne', 'Italienne', 'Ivoirienne', 'Japonaise', 'Jordanienne',
  'Lettone', 'Libanaise', 'Lituanienne', 'Luxembourgeoise', 'Marocaine', 'Maltaise',
  'Mexicaine', 'Moldave', 'Monégasque', 'Mongole', 'Néo-zélandaise', 'Népalaise',
  'Nigériane', 'Norvégienne', 'Pakistanaise', 'Polonaise', 'Portugaise', 'Roumaine',
  'Russe', 'Rwandaise', 'Saoudienne', 'Sénégalaise', 'Serbe', 'Singapourienne',
  'Slovaque', 'Slovène', 'Somalienne', 'Soudanaise', 'Sri-lankaise', 'Suédoise', 'Suisse',
  'Syrienne', 'Tanzanienne', 'Tchadienne', 'Tchèque', 'Thaïlandaise', 'Togolaise',
  'Tunisienne', 'Turque', 'Ukrainienne', 'Vietnamienne', 'Yéménite', 'Zambienne',
];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isExpired(d: string) {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

function fmtDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const FONCTION_STYLES: Record<string, string> = {
  'Agent de Sécurité': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Serveur': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Direction': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Chef de poste': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  suspended: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};
const STATUS_LABELS: Record<string, string> = { active: 'Actif', inactive: 'Inactif', suspended: 'Suspendu' };

export default function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const fromMobile = (location.state as { from?: string } | null)?.from === 'mobile'
    || document.referrer.includes('/mobile/profil');

  const [user, setUser] = useState<ManagedUserRow | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // Nationalité autocomplete
  const [natQuery, setNatQuery] = useState('');
  const [natSuggestions, setNatSuggestions] = useState<string[]>([]);
  const natRef = useRef<HTMLDivElement>(null);

  // Profile save
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Photo upload
  const [photoFiles, setPhotoFiles] = useState<{ recto: File | null; verso: File | null }>({ recto: null, verso: null });
  const [photoPreviews, setPhotoPreviews] = useState<{ recto: string | null; verso: string | null }>({ recto: null, verso: null });
  const [photoLoading, setPhotoLoading] = useState<{ recto: boolean; verso: boolean }>({ recto: false, verso: false });
  const rectoRef = useRef<HTMLInputElement>(null);
  const versoRef = useRef<HTMLInputElement>(null);

  // Carte Pro save
  const [carteProSaving, setCarteProSaving] = useState(false);
  const [carteProMsg, setCarteProMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formations
  const [drafts, setDrafts] = useState<FormationDraft[]>([{ type_formation: TYPES_FORMATION[0], date_formation: '' }]);
  const [formationsLoading, setFormationsLoading] = useState(false);
  const [formationsMsg, setFormationsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    load();
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [id]);

  function handleOutsideClick(e: MouseEvent) {
    if (natRef.current && !natRef.current.contains(e.target as Node)) setNatSuggestions([]);
  }

  async function load() {
    setPageLoading(true);
    const [userRes, profileRes, formationsRes] = await Promise.all([
      supabase.from('managed_users').select('*').eq('id', id!).maybeSingle(),
      supabase.from('user_profiles').select('*').eq('id',
        // We join via auth_user_id — need to first get the managed user's auth_user_id
        // We'll handle this in a second pass after getting user data
        id! // placeholder, we'll refetch if needed
      ).maybeSingle(),
      supabase.from('user_formations').select('*').order('date_formation', { ascending: false }),
    ]);

    const u = userRes.data as ManagedUserRow | null;
    setUser(u);
    setNewEmail(u?.email ?? '');

    if (u?.auth_user_id) {
      const pRes = await supabase.from('user_profiles').select('*').eq('id', u.auth_user_id).maybeSingle();
      if (pRes.data) {
        const d = pRes.data;
        setProfile({
          first_name: d.first_name ?? '',
          last_name: d.last_name ?? '',
          telephone: d.telephone ?? '',
          nationalite: d.nationalite ?? '',
          carte_sejour_numero: d.carte_sejour_numero ?? '',
          carte_sejour_validite: d.carte_sejour_validite ?? '',
          carte_sejour_recto_url: d.carte_sejour_recto_url ?? null,
          carte_sejour_recto_path: d.carte_sejour_recto_path ?? null,
          carte_sejour_verso_url: d.carte_sejour_verso_url ?? null,
          carte_sejour_verso_path: d.carte_sejour_verso_path ?? null,
          carte_pro_numero: d.carte_pro_numero ?? '',
          carte_pro_validite: d.carte_pro_validite ?? '',
        });
        setNatQuery(d.nationalite ?? '');
      }

      const fRes = await supabase
        .from('user_formations')
        .select('*')
        .eq('user_id', u.auth_user_id)
        .order('date_formation', { ascending: false });
      setFormations((fRes.data ?? []) as Formation[]);
    }

    setPageLoading(false);
  }

  function handleNatInput(val: string) {
    setNatQuery(val);
    setProfile((p) => ({ ...p, nationalite: val }));
    if (val.length < 2) { setNatSuggestions([]); return; }
    const q = normalize(val);
    setNatSuggestions(NATIONALITIES.filter((n) => normalize(n).includes(q)).slice(0, 6));
  }

  function selectNat(nat: string) {
    setNatQuery(nat);
    setProfile((p) => ({ ...p, nationalite: nat }));
    setNatSuggestions([]);
  }

  function handlePhotoFile(side: PhotoSide, file: File) {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return;
    setPhotoFiles((p) => ({ ...p, [side]: file }));
    setPhotoPreviews((p) => ({ ...p, [side]: URL.createObjectURL(file) }));
  }

  async function uploadPhoto(side: PhotoSide): Promise<{ url: string; path: string } | null> {
    const file = photoFiles[side];
    if (!file || !user?.auth_user_id) return null;
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.auth_user_id}/${side}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('carte-sejour').upload(path, file, { upsert: true });
    if (error) return null;
    const { data: signedData } = await supabase.storage.from('carte-sejour').createSignedUrl(path, 60 * 60 * 24 * 365);
    return signedData ? { url: signedData.signedUrl, path } : null;
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user?.auth_user_id) {
      setSaveMsg({ type: 'error', text: 'Impossible de sauvegarder : cet utilisateur n\'a pas encore de compte de connexion actif. Veuillez d\'abord lui créer un accès depuis la liste des utilisateurs.' });
      setSaveLoading(false);
      return;
    }
    setSaveLoading(true);
    setSaveMsg(null);

    let rectoUrl = profile.carte_sejour_recto_url;
    let rectoPath = profile.carte_sejour_recto_path;
    let versoUrl = profile.carte_sejour_verso_url;
    let versoPath = profile.carte_sejour_verso_path;

    const needsCarte = !EXEMPT_NATIONALITIES.has(profile.nationalite) && profile.nationalite.trim() !== '';

    if (needsCarte) {
      if (photoFiles.recto) {
        setPhotoLoading((p) => ({ ...p, recto: true }));
        const res = await uploadPhoto('recto');
        setPhotoLoading((p) => ({ ...p, recto: false }));
        if (res) { rectoUrl = res.url; rectoPath = res.path; }
      }
      if (photoFiles.verso) {
        setPhotoLoading((p) => ({ ...p, verso: true }));
        const res = await uploadPhoto('verso');
        setPhotoLoading((p) => ({ ...p, verso: false }));
        if (res) { versoUrl = res.url; versoPath = res.path; }
      }
    }

    const { error } = await supabase.from('user_profiles').upsert({
      id: user.auth_user_id,
      first_name: profile.first_name.trim(),
      last_name: profile.last_name.trim(),
      telephone: profile.telephone.trim(),
      nationalite: profile.nationalite.trim(),
      carte_sejour_numero: needsCarte ? profile.carte_sejour_numero.trim() : '',
      carte_sejour_validite: needsCarte && profile.carte_sejour_validite ? profile.carte_sejour_validite : null,
      carte_sejour_recto_url: needsCarte ? rectoUrl : null,
      carte_sejour_recto_path: needsCarte ? rectoPath : null,
      carte_sejour_verso_url: needsCarte ? versoUrl : null,
      carte_sejour_verso_path: needsCarte ? versoPath : null,
      carte_pro_numero: profile.carte_pro_numero,
      carte_pro_validite: profile.carte_pro_validite || null,
      updated_at: new Date().toISOString(),
    });

    setSaveLoading(false);
    if (error) { setSaveMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }
    setProfile((p) => ({
      ...p,
      carte_sejour_recto_url: needsCarte ? rectoUrl : null,
      carte_sejour_recto_path: needsCarte ? rectoPath : null,
      carte_sejour_verso_url: needsCarte ? versoUrl : null,
      carte_sejour_verso_path: needsCarte ? versoPath : null,
    }));
    setPhotoFiles({ recto: null, verso: null });
    setSaveMsg({ type: 'success', text: 'Profil mis à jour avec succès.' });
    setTimeout(() => navigate(fromMobile ? '/mobile' : '/dashboard'), 1200);
  }

  async function handleSaveCartePro(e: FormEvent) {
    e.preventDefault();
    if (!user?.auth_user_id) {
      setCarteProMsg({ type: 'error', text: 'Impossible de sauvegarder : cet utilisateur n\'a pas encore de compte de connexion actif.' });
      return;
    }
    if (!isValidCnaps(profile.carte_pro_numero)) {
      setCarteProMsg({ type: 'error', text: 'Numéro de carte professionnelle incomplet.' });
      return;
    }
    setCarteProSaving(true);
    setCarteProMsg(null);
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.auth_user_id,
      carte_pro_numero: profile.carte_pro_numero,
      carte_pro_validite: profile.carte_pro_validite || null,
      updated_at: new Date().toISOString(),
    });
    setCarteProSaving(false);
    if (error) {
      setCarteProMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
    } else {
      setCarteProMsg({ type: 'success', text: 'Carte professionnelle enregistrée.' });
      setTimeout(() => navigate(fromMobile ? '/mobile' : '/dashboard'), 1200);
    }
  }

  async function handleSaveFormations(e: FormEvent) {
    e.preventDefault();
    if (!user?.auth_user_id) {
      setFormationsMsg({ type: 'error', text: 'Impossible de sauvegarder : cet utilisateur n\'a pas encore de compte de connexion actif.' });
      return;
    }
    const valid = drafts.filter((d) => d.type_formation && d.date_formation);
    if (valid.length === 0) {
      setFormationsMsg({ type: 'error', text: 'Veuillez renseigner au moins une formation avec une date.' });
      return;
    }
    setFormationsLoading(true);
    setFormationsMsg(null);
    const rows = valid.map((d) => ({ user_id: user.auth_user_id!, type_formation: d.type_formation, date_formation: d.date_formation }));
    const { data, error } = await supabase.from('user_formations').insert(rows).select();
    setFormationsLoading(false);
    if (error) { setFormationsMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }
    setFormations((f) => [...(data as Formation[]), ...f]);
    setDrafts([{ type_formation: TYPES_FORMATION[0], date_formation: '' }]);
    setFormationsMsg({ type: 'success', text: `${valid.length} formation${valid.length > 1 ? 's' : ''} ajoutée${valid.length > 1 ? 's' : ''}.` });
  }

  async function deleteFormation(fid: string) {
    await supabase.from('user_formations').delete().eq('id', fid);
    setFormations((f) => f.filter((x) => x.id !== fid));
  }

  async function handleChangeEmail(e: FormEvent) {
    e.preventDefault();
    if (!user?.auth_user_id || !newEmail.trim()) return;
    setEmailLoading(true);
    setEmailMsg(null);

    // Update auth email via admin API through edge function
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-managed-user`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ auth_user_id: user.auth_user_id, email: newEmail.trim() }),
      }
    );

    if (res.ok) {
      // Also update managed_users table
      await supabase.from('managed_users').update({ email: newEmail.trim() }).eq('id', user.id);
      setUser((u) => u ? { ...u, email: newEmail.trim() } : u);
      setEmailMsg({ type: 'success', text: 'Email mis à jour avec succès.' });
    } else {
      setEmailMsg({ type: 'error', text: 'Erreur lors de la mise à jour de l\'email.' });
    }
    setEmailLoading(false);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!user?.auth_user_id) return;
    if (newPassword !== confirmPassword) { setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' }); return; }
    if (newPassword.length < 6) { setPwdMsg({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' }); return; }
    setPwdLoading(true);
    setPwdMsg(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-managed-user`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ auth_user_id: user.auth_user_id, password: newPassword }),
      }
    );

    setPwdLoading(false);
    if (res.ok) {
      setPwdMsg({ type: 'success', text: 'Mot de passe modifié avec succès.' });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPwdMsg({ type: 'error', text: 'Erreur lors de la modification du mot de passe.' });
    }
  }

  async function handleSignOut() { await signOut(); navigate('/'); }

  const needsCarte = !EXEMPT_NATIONALITIES.has(profile.nationalite) && profile.nationalite.trim() !== '';
  const expired = needsCarte && isExpired(profile.carte_sejour_validite);
  const carteProExpired = isExpired(profile.carte_pro_validite);
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || user?.email || '—';
  const initials = [profile.first_name, profile.last_name].filter(Boolean).map((s) => s[0].toUpperCase()).join('')
    || user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={handleSignOut} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux utilisateurs
        </button>

        {pageLoading ? (
          <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        ) : !user ? (
          <div className="text-center py-32 text-slate-500">Utilisateur introuvable.</div>
        ) : (
          <>
            {/* Warning: no auth account linked */}
            {!user.auth_user_id && (
              <div className="flex items-start gap-3 rounded-2xl p-4 border bg-amber-500/10 border-amber-500/20 text-amber-300">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <p className="font-semibold text-sm">Compte de connexion non activé</p>
                  <p className="text-xs mt-1 text-amber-400/80">
                    Cet utilisateur n'a pas encore de compte de connexion actif. Les informations de profil, formations et carte professionnelle ne peuvent pas être sauvegardées tant qu'aucun accès n'est créé.
                  </p>
                </div>
              </div>
            )}

            {/* Identity card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
                <span className="text-2xl font-bold text-white">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-lg font-semibold text-white">{fullName}</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${FONCTION_STYLES[user.fonction] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                    {user.fonction}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[user.status] ?? ''}`}>
                    {STATUS_LABELS[user.status] ?? user.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">{user.email}</p>
              </div>
            </div>

            {/* Profile form */}
            <Section title="Informations personnelles" icon={<User className="w-4 h-4 text-blue-400" />} accent="from-blue-500 to-cyan-400">
              {saveMsg && <Feedback msg={saveMsg} />}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Prénom">
                    <input type="text" value={profile.first_name}
                      onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))}
                      placeholder="Jean" className={inputCls} />
                  </Field>
                  <Field label="Nom">
                    <input type="text" value={profile.last_name}
                      onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))}
                      placeholder="Dupont" className={inputCls} />
                  </Field>
                </div>

                <Field label="Téléphone">
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="tel" value={profile.telephone}
                      onChange={(e) => setProfile((p) => ({ ...p, telephone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      placeholder="0600000000" inputMode="numeric" maxLength={10}
                      className={`${inputCls} pl-10`} />
                  </div>
                </Field>

                <div ref={natRef} className="relative">
                  <Field label="Nationalité">
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type="text" value={natQuery}
                        onChange={(e) => handleNatInput(e.target.value)}
                        placeholder="Ex : Française, Sénégalaise…"
                        autoComplete="off"
                        className={`${inputCls} pl-10`} />
                    </div>
                  </Field>
                  {natSuggestions.length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                      {natSuggestions.map((nat) => (
                        <li key={nat}>
                          <button type="button" onMouseDown={() => selectNat(nat)}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors">
                            {nat}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Carte de séjour */}
                {needsCarte && (
                  <div className="bg-slate-950 border border-orange-500/20 rounded-2xl overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
                    <div className="p-4 space-y-4">
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-orange-400" /> Carte de séjour
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="N° Carte de séjour">
                          <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input type="text" value={profile.carte_sejour_numero}
                              onChange={(e) => setProfile((p) => ({ ...p, carte_sejour_numero: e.target.value }))}
                              placeholder="123456789012"
                              className={`${inputCls} pl-9 focus:ring-orange-500`} />
                          </div>
                        </Field>
                        <Field label="Date fin de validité">
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                            <input type="date" value={profile.carte_sejour_validite}
                              onChange={(e) => setProfile((p) => ({ ...p, carte_sejour_validite: e.target.value }))}
                              className={`w-full bg-slate-800 border rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${expired ? 'border-red-500/60 focus:ring-red-500' : 'border-slate-700 focus:ring-orange-500'}`} />
                          </div>
                          {expired && <p className="mt-1 text-xs text-red-400 font-semibold animate-pulse">Validité expirée</p>}
                        </Field>
                      </div>
                      {/* Photos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(['recto', 'verso'] as PhotoSide[]).map((side) => {
                          const inputRef = side === 'recto' ? rectoRef : versoRef;
                          const preview = photoPreviews[side];
                          const existingUrl = side === 'recto' ? profile.carte_sejour_recto_url : profile.carte_sejour_verso_url;
                          const displaySrc = preview ?? existingUrl;
                          return (
                            <div key={side} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <ImageIcon className="w-3 h-3 text-orange-400" />
                                  {side === 'recto' ? 'Recto' : 'Verso'}
                                </span>
                                {displaySrc && (
                                  <button type="button" onClick={() => {
                                    setPhotoFiles((p) => ({ ...p, [side]: null }));
                                    setPhotoPreviews((p) => ({ ...p, [side]: null }));
                                    setProfile((p) => ({ ...p, [`carte_sejour_${side}_url`]: null, [`carte_sejour_${side}_path`]: null }));
                                  }} className="w-5 h-5 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <div onClick={() => inputRef.current?.click()} className="relative cursor-pointer group">
                                {displaySrc ? (
                                  <div className="relative">
                                    <img src={displaySrc} alt="" className="w-full h-28 object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                      <span className="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/60 px-2 py-1 rounded-lg">Changer</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed border-slate-700 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all m-2 rounded-lg">
                                    {photoLoading[side] ? (
                                      <svg className="animate-spin w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                      </svg>
                                    ) : (
                                      <><Upload className="w-5 h-5 text-slate-500 group-hover:text-orange-400 transition-colors" /><span className="text-xs text-slate-500">Importer une photo</span></>
                                    )}
                                  </div>
                                )}
                              </div>
                              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(side, f); }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button type="submit" disabled={saveLoading} className={btnCls}>
                    <Save className="w-4 h-4" />
                    {saveLoading ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </Section>

            {/* Carte professionnelle */}
            {(user.fonction === 'Agent de Sécurité' || user.fonction === 'Chef de poste') && (
              <Section title="Carte professionnelle" icon={<ShieldCheck className="w-4 h-4 text-blue-400" />} accent="from-blue-500 to-cyan-400">
                {carteProMsg && <Feedback msg={carteProMsg} />}
                <form onSubmit={handleSaveCartePro} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="N° Carte professionnelle CNAPS">
                      <CnapsInput value={profile.carte_pro_numero || 'CAR'}
                        onChange={(val) => setProfile((p) => ({ ...p, carte_pro_numero: val }))} />
                    </Field>
                    <Field label="Date fin de validité">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        <input type="date" value={profile.carte_pro_validite}
                          onChange={(e) => setProfile((p) => ({ ...p, carte_pro_validite: e.target.value }))}
                          className={`w-full bg-slate-800 border rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${carteProExpired ? 'border-red-500/60 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'}`} />
                      </div>
                      {carteProExpired && <p className="mt-1 text-xs text-red-400 font-semibold animate-pulse">Validité expirée</p>}
                    </Field>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={carteProSaving} className={btnCls}>
                      <Save className="w-4 h-4" />
                      {carteProSaving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              </Section>
            )}

            {/* Formations */}
            <Section title="Formations" icon={<GraduationCap className="w-4 h-4 text-emerald-400" />} accent="from-emerald-500 to-teal-400">
              {formationsMsg && <Feedback msg={formationsMsg} />}
              {formations.length > 0 && (
                <div className="space-y-2 mb-4">
                  {formations.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                      <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-sm font-medium text-white flex-1">{f.type_formation}</span>
                      <span className="text-xs text-slate-500">{fmtDate(f.date_formation)}</span>
                      <button type="button" onClick={() => deleteFormation(f.id)}
                        className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleSaveFormations} className="space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ajouter</p>
                {drafts.map((draft, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        <select value={draft.type_formation}
                          onChange={(e) => setDrafts((d) => d.map((x, i) => i === idx ? { ...x, type_formation: e.target.value } : x))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none">
                          {TYPES_FORMATION.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        <input type="date" value={draft.date_formation}
                          onChange={(e) => setDrafts((d) => d.map((x, i) => i === idx ? { ...x, date_formation: e.target.value } : x))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                      </div>
                    </div>
                    {drafts.length > 1 && (
                      <button type="button" onClick={() => setDrafts((d) => d.filter((_, i) => i !== idx))}
                        className="mt-1 w-9 h-9 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <button type="button" onClick={() => setDrafts((d) => [...d, { type_formation: TYPES_FORMATION[0], date_formation: '' }])}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all">
                    <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                  </button>
                  <button type="submit" disabled={formationsLoading}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed rounded-xl transition-colors shadow-lg shadow-emerald-900/20">
                    <Save className="w-3.5 h-3.5" />
                    {formationsLoading ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </Section>

            {/* Email change */}
            {user.auth_user_id && (
              <Section title="Adresse e-mail" icon={<Mail className="w-4 h-4 text-blue-400" />} accent="from-slate-600 to-slate-500">
                {emailMsg && <Feedback msg={emailMsg} />}
                <form onSubmit={handleChangeEmail} className="space-y-4">
                  <Field label="Nouvelle adresse e-mail">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type="email" required value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className={`${inputCls} pl-10`} />
                    </div>
                  </Field>
                  <div className="flex justify-end">
                    <button type="submit" disabled={emailLoading} className={btnCls}>
                      <Save className="w-4 h-4" />
                      {emailLoading ? 'Mise à jour…' : 'Mettre à jour l\'email'}
                    </button>
                  </div>
                </form>
              </Section>
            )}

            {/* Password change */}
            {user.auth_user_id && (
              <Section title="Mot de passe" icon={<KeyRound className="w-4 h-4 text-slate-400" />} accent="from-slate-600 to-slate-500">
                {pwdMsg && <Feedback msg={pwdMsg} />}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <Field label="Nouveau mot de passe">
                    <div className="relative">
                      <input type={showNew ? 'text' : 'password'} required minLength={6} value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
                        className={`${inputCls} pr-11`} />
                      <button type="button" tabIndex={-1} onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirmer le nouveau mot de passe">
                    <div className="relative">
                      <input type={showConfirm ? 'text' : 'password'} required minLength={6} value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                        className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : 'border-slate-700'}`} />
                      <button type="button" tabIndex={-1} onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas.</p>
                    )}
                  </Field>
                  <div className="flex justify-end">
                    <button type="submit" disabled={pwdLoading} className={btnCls}>
                      <KeyRound className="w-4 h-4" />
                      {pwdLoading ? 'Modification…' : 'Modifier le mot de passe'}
                    </button>
                  </div>
                </form>
              </Section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const inputCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`;

const btnCls = `flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed
  text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-900/30`;

function Section({ title, icon, accent, children, defaultOpen = true }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/40 transition-colors"
      >
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          {icon}{title}
        </h2>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-6 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Feedback({ msg }: { msg: { type: 'success' | 'error'; text: string } }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl p-3 mb-4 text-sm border
      ${msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
      {msg.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
}
