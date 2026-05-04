import { useEffect, useState, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Save, KeyRound, CheckCircle, AlertCircle, Eye, EyeOff,
  Phone, Mail, Globe, X, CreditCard, Upload, Calendar,
  Image as ImageIcon, ChevronDown, GraduationCap, Plus, Trash2, ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import CnapsInput, { isValidCnaps } from '../components/CnapsInput';

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

type Formation = {
  id: string;
  type_formation: string;
  date_formation: string;
};

type FormationDraft = {
  type_formation: string;
  date_formation: string;
};

type Fonction = 'Agent de Sécurité' | 'Serveur' | 'Direction' | null;
type PhotoSide = 'recto' | 'verso';

const FONCTION_STYLES: Record<string, string> = {
  'Agent de Sécurité': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Serveur':           'bg-cyan-500/10  text-cyan-400  border-cyan-500/20',
  'Direction':         'bg-rose-500/10  text-rose-400  border-rose-500/20',
};

const EXEMPT_NATIONALITIES = new Set([
  'Française',
  'Allemande', 'Autrichienne', 'Belge', 'Bulgare', 'Chypriote', 'Croate', 'Danoise',
  'Espagnole', 'Estonienne', 'Finlandaise', 'Grecque', 'Hongroise', 'Irlandaise',
  'Italienne', 'Lettone', 'Lituanienne', 'Luxembourgeoise', 'Maltaise', 'Néerlandaise',
  'Polonaise', 'Portugaise', 'Roumaine', 'Slovaque', 'Slovène', 'Suédoise', 'Tchèque',
  'Islandaise', 'Liechtensteinoise', 'Norvégienne',
  'Suisse',
]);

const TYPES_FORMATION = ['Extincteur', 'SST', 'Habili Elec', 'SIAPP1', 'SIAPP2'];

function normalize(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const NATIONALITIES = [
  'Afghane', 'Albanaise', 'Algérienne', 'Allemande', 'Américaine', 'Andorrane', 'Angolaise',
  'Antiguaise', 'Argentine', 'Arménienne', 'Australienne', 'Autrichienne', 'Azerbaïdjanaise',
  'Bahamienne', 'Bahreïnienne', 'Bangladaise', 'Barbadienne', 'Bélarusse', 'Belge', 'Bélizienne',
  'Béninoise', 'Bhoutanaise', 'Bolivienne', 'Bosnienne', 'Botswanaise', 'Brésilienne', 'Britannique',
  'Bruneïenne', 'Bulgare', 'Burkinabè', 'Burundaise', 'Cambodgienne', 'Camerounaise', 'Canadienne',
  'Cap-verdienne', 'Centrafricaine', 'Chilienne', 'Chinoise', 'Chypriote', 'Colombienne', 'Comorienne',
  'Congolaise', 'Costaricienne', 'Croate', 'Cubaine', 'Danoise', 'Djiboutienne', 'Dominicaine',
  'Égyptienne', 'Émiratie', 'Équatorienne', 'Érythréenne', 'Espagnole', 'Est-timoraise', 'Estonienne',
  'Éthiopienne', 'Fidjienne', 'Finlandaise', 'Française', 'Gabonaise', 'Gambienne', 'Géorgienne',
  'Ghanéenne', 'Grecque', 'Grenadienne', 'Guatemaltèque', 'Guinéenne', 'Guyanienne', 'Haïtienne',
  'Hondurienne', 'Hongroise', 'Indienne', 'Indonésienne', 'Irakienne', 'Iranienne', 'Irlandaise',
  'Islandaise', 'Israélienne', 'Italienne', 'Ivoirienne', 'Jamaïcaine', 'Japonaise', 'Jordanienne',
  'Kazakhstanaise', 'Kenyane', 'Kirghize', 'Kiribatienne', 'Koweïtienne', 'Laotienne', 'Lesothane',
  'Lettone', 'Libanaise', 'Libérienne', 'Libyenne', 'Liechtensteinoise', 'Lituanienne', 'Luxembourgeoise',
  'Macédonienne', 'Malgache', 'Malaisienne', 'Malawienne', 'Maldivienne', 'Malienne', 'Maltaise',
  'Marocaine', 'Mauritanienne', 'Mauricienne', 'Mexicaine', 'Micronésienne', 'Moldave', 'Monégasque',
  'Mongole', 'Monténégrine', 'Mozambicaine', 'Namibienne', 'Néo-zélandaise', 'Népalaise', 'Nicaraguayenne',
  'Nigériane', 'Nigérienne', 'Nord-coréenne', 'Norvégienne', 'Omanaise', 'Ougandaise', 'Ouzbèque',
  'Pakistanaise', 'Palestinienne', 'Panaméenne', 'Papouasienne', 'Paraguayenne', 'Péruvienne',
  'Philippine', 'Polonaise', 'Portugaise', 'Qatarienne', 'Roumaine', 'Russe', 'Rwandaise',
  'Saint-lucienne', 'Salvadorienne', 'Saoudienne', 'Sénégalaise', 'Serbe', 'Seychelloise',
  'Sierra-léonaise', 'Singapourienne', 'Slovaque', 'Slovène', 'Somalienne', 'Soudanaise',
  'Sri-lankaise', 'Suédoise', 'Suisse', 'Surinamaise', 'Swazie', 'Syrienne', 'Tadjike',
  'Tanzanienne', 'Tchadienne', 'Tchèque', 'Thaïlandaise', 'Togolaise', 'Trinidadienne', 'Tunisienne',
  'Turkmène', 'Turque', 'Ukrainienne', 'Uruguayenne', 'Vanuataise', 'Vénézuélienne', 'Vietnamienne',
  'Yéménite', 'Zambienne', 'Zimbabwéenne',
];

const EMPTY_PROFILE: Profile = {
  first_name: '', last_name: '', telephone: '', nationalite: '',
  carte_sejour_numero: '', carte_sejour_validite: '',
  carte_sejour_recto_url: null, carte_sejour_recto_path: null,
  carte_sejour_verso_url: null, carte_sejour_verso_path: null,
  carte_pro_numero: '', carte_pro_validite: '',
};

const EMPTY_DRAFT: FormationDraft = { type_formation: TYPES_FORMATION[0], date_formation: '' };

function CollapseSection({
  title, icon, accentClass, borderColor, collapsed, onToggle, preview, children,
}: {
  title: string;
  icon: React.ReactNode;
  accentClass: string;
  borderColor: string;
  collapsed: boolean;
  onToggle: () => void;
  preview?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-slate-950 border rounded-2xl overflow-hidden ${borderColor}`}>
      <div className={`h-1 bg-gradient-to-r ${accentClass}`} />
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{title}</p>
            {collapsed && preview && <div className="mt-0.5">{preview}</div>}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
            hover:border-slate-600 transition-all shrink-0"
        >
          {collapsed ? 'Modifier' : 'Réduire'}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>
      {!collapsed && (
        <div className="border-t border-slate-800 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [fonction, setFonction] = useState<Fonction>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Nationalité autocomplete
  const [natQuery, setNatQuery] = useState('');
  const [natSuggestions, setNatSuggestions] = useState<string[]>([]);
  const natRef = useRef<HTMLDivElement>(null);

  // Carte de séjour collapse
  const [carteCollapsed, setCarteCollapsed] = useState(true);

  // Carte professionnelle collapse
  const [carteProCollapsed, setCarteProCollapsed] = useState(true);
  const [carteProSaving, setCarteProSaving] = useState(false);
  const [carteProMsg, setCarteProMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Photo upload
  const [photoFiles, setPhotoFiles] = useState<{ recto: File | null; verso: File | null }>({ recto: null, verso: null });
  const [photoPreviews, setPhotoPreviews] = useState<{ recto: string | null; verso: string | null }>({ recto: null, verso: null });
  const [photoLoading, setPhotoLoading] = useState<{ recto: boolean; verso: boolean }>({ recto: false, verso: false });
  const rectoRef = useRef<HTMLInputElement>(null);
  const versoRef = useRef<HTMLInputElement>(null);

  // Formations
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationsCollapsed, setFormationsCollapsed] = useState(true);
  const [drafts, setDrafts] = useState<FormationDraft[]>([{ ...EMPTY_DRAFT }]);
  const [formationsLoading, setFormationsLoading] = useState(false);
  const [formationsMsg, setFormationsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password modal
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!session) { navigate('/'); return; }
    fetchAll();
  }, [session]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (natRef.current && !natRef.current.contains(e.target as Node)) {
        setNatSuggestions([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchAll() {
    setLoadingProfile(true);
    const [profileRes, managedRes, formationsRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', session!.user.id).maybeSingle(),
      supabase.from('managed_users').select('fonction').eq('auth_user_id', session!.user.id).maybeSingle(),
      supabase.from('user_formations').select('*').eq('user_id', session!.user.id).order('date_formation', { ascending: false }),
    ]);
    if (profileRes.data) {
      const d = profileRes.data;
      const p: Profile = {
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
      };
      setProfile(p);
      setNatQuery(d.nationalite ?? '');
      // Auto-collapse carte de séjour only if all fields filled
      const needsCarte = !EXEMPT_NATIONALITIES.has(p.nationalite) && p.nationalite.trim() !== '';
      if (needsCarte) {
        const allFilled = p.carte_sejour_numero.trim() !== ''
          && p.carte_sejour_validite !== ''
          && p.carte_sejour_recto_url !== null
          && p.carte_sejour_verso_url !== null;
        setCarteCollapsed(allFilled);
      }
    }
    if (managedRes.data) setFonction(managedRes.data.fonction as Fonction);
    if (formationsRes.data) {
      setFormations(formationsRes.data as Formation[]);
      setFormationsCollapsed(formationsRes.data.length > 0);
    }
    setLoadingProfile(false);
  }

  function handleNatInput(val: string) {
    setNatQuery(val);
    setProfile((p) => ({ ...p, nationalite: val }));
    if (val.length < 3) { setNatSuggestions([]); return; }
    const q = normalize(val);
    setNatSuggestions(NATIONALITIES.filter((n) => normalize(n).includes(q)).slice(0, 6));
  }

  function selectNat(nat: string) {
    setNatQuery(nat);
    setProfile((p) => ({ ...p, nationalite: nat }));
    setNatSuggestions([]);
    // If switching to exempt, open carte to let user see it will be cleared
    if (EXEMPT_NATIONALITIES.has(nat)) setCarteCollapsed(true);
  }

  function handlePhotoFile(side: PhotoSide, file: File) {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return;
    setPhotoFiles((p) => ({ ...p, [side]: file }));
    setPhotoPreviews((p) => ({ ...p, [side]: URL.createObjectURL(file) }));
  }

  async function uploadPhoto(side: PhotoSide): Promise<{ url: string; path: string } | null> {
    const file = photoFiles[side];
    if (!file) return null;
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${session!.user.id}/${side}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('carte-sejour').upload(path, file, { upsert: true });
    if (error) return null;
    const { data: signedData } = await supabase.storage.from('carte-sejour').createSignedUrl(path, 60 * 60 * 24 * 365);
    return signedData ? { url: signedData.signedUrl, path } : null;
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
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
      id: session!.user.id,
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
      // preserve existing carte_pro fields — saved via dedicated handler
      carte_pro_numero: profile.carte_pro_numero,
      carte_pro_validite: profile.carte_pro_validite || null,
      updated_at: new Date().toISOString(),
    });

    setSaveLoading(false);
    if (error) { setSaveMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }

    const updatedProfile = {
      ...profile,
      carte_sejour_recto_url: needsCarte ? rectoUrl : null,
      carte_sejour_recto_path: needsCarte ? rectoPath : null,
      carte_sejour_verso_url: needsCarte ? versoUrl : null,
      carte_sejour_verso_path: needsCarte ? versoPath : null,
    };
    setProfile(updatedProfile);
    setPhotoFiles({ recto: null, verso: null });

    // Auto-collapse if all carte fields now filled
    if (needsCarte) {
      const allFilled = updatedProfile.carte_sejour_numero.trim() !== ''
        && updatedProfile.carte_sejour_validite !== ''
        && updatedProfile.carte_sejour_recto_url !== null
        && updatedProfile.carte_sejour_verso_url !== null;
      if (allFilled) setCarteCollapsed(true);
    }

    setSaveMsg({ type: 'success', text: 'Profil mis à jour avec succès.' });
  }

  async function handleSaveCartePro(e: FormEvent) {
    e.preventDefault();
    if (!isValidCnaps(profile.carte_pro_numero)) {
      setCarteProMsg({ type: 'error', text: 'Numéro de carte professionnelle incomplet.' });
      return;
    }
    setCarteProSaving(true);
    setCarteProMsg(null);
    const { error } = await supabase.from('user_profiles').upsert({
      id: session!.user.id,
      carte_pro_numero: profile.carte_pro_numero,
      carte_pro_validite: profile.carte_pro_validite || null,
      updated_at: new Date().toISOString(),
    });
    setCarteProSaving(false);
    if (error) {
      setCarteProMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
      return;
    }
    const allFilled = isValidCnaps(profile.carte_pro_numero) && profile.carte_pro_validite !== '';
    if (allFilled) setCarteProCollapsed(true);
    setCarteProMsg({ type: 'success', text: 'Carte professionnelle enregistrée.' });
  }

  // Formations handlers
  function addDraft() {
    setDrafts((d) => [...d, { ...EMPTY_DRAFT }]);
  }

  function removeDraft(idx: number) {
    setDrafts((d) => d.filter((_, i) => i !== idx));
  }

  function updateDraft(idx: number, field: keyof FormationDraft, value: string) {
    setDrafts((d) => d.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function deleteFormation(id: string) {
    await supabase.from('user_formations').delete().eq('id', id);
    setFormations((f) => f.filter((x) => x.id !== id));
  }

  async function handleSaveFormations(e: FormEvent) {
    e.preventDefault();
    const valid = drafts.filter((d) => d.type_formation && d.date_formation);
    if (valid.length === 0) {
      setFormationsMsg({ type: 'error', text: 'Veuillez renseigner au moins une formation avec une date.' });
      return;
    }
    setFormationsLoading(true);
    setFormationsMsg(null);

    const rows = valid.map((d) => ({
      user_id: session!.user.id,
      type_formation: d.type_formation,
      date_formation: d.date_formation,
    }));

    const { data, error } = await supabase.from('user_formations').insert(rows).select();
    setFormationsLoading(false);

    if (error) {
      setFormationsMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
      return;
    }

    setFormations((f) => [...(data as Formation[]), ...f]);
    setDrafts([{ ...EMPTY_DRAFT }]);
    setFormationsMsg({ type: 'success', text: `${valid.length} formation${valid.length > 1 ? 's' : ''} ajoutée${valid.length > 1 ? 's' : ''}.` });
    setFormationsCollapsed(true);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword !== confirmPassword) { setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' }); return; }
    if (newPassword.length < 6) { setPwdMsg({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' }); return; }
    setPwdLoading(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: session!.user.email!, password: currentPassword });
    if (signInErr) { setPwdLoading(false); setPwdMsg({ type: 'error', text: 'Mot de passe actuel incorrect.' }); return; }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setPwdLoading(false);
    if (updateErr) {
      setPwdMsg({ type: 'error', text: updateErr.message });
    } else {
      setPwdMsg({ type: 'success', text: 'Mot de passe modifié avec succès.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
  }

  function closePwdModal() {
    setShowPwdModal(false);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setPwdMsg(null);
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
  }

  async function handleSignOut() { await signOut(); navigate('/'); }

  const initials = [profile.first_name, profile.last_name]
    .filter(Boolean).map((s) => s[0].toUpperCase()).join('')
    || session?.user.email?.charAt(0).toUpperCase() || '?';

  const needsCarte = !EXEMPT_NATIONALITIES.has(profile.nationalite) && profile.nationalite.trim() !== '';
  const expired = needsCarte && isExpired(profile.carte_sejour_validite);

  // Carte preview for collapsed state
  const cartePreview = (
    <p className="text-slate-500 text-xs truncate">
      {profile.carte_sejour_numero || '—'}
      {profile.carte_sejour_validite ? ` · expire le ${formatDate(profile.carte_sejour_validite)}` : ''}
      {expired && <span className="text-red-400 font-semibold animate-pulse ml-1">· Expirée</span>}
    </p>
  );

  const carteProExpired = isExpired(profile.carte_pro_validite);
  const carteProPreview = (
    <p className="text-slate-500 text-xs font-mono truncate">
      {isValidCnaps(profile.carte_pro_numero) ? profile.carte_pro_numero : <span className="italic font-sans">Non renseigné</span>}
      {profile.carte_pro_validite ? ` · expire le ${formatDate(profile.carte_pro_validite)}` : ''}
      {carteProExpired && <span className="text-red-400 font-semibold animate-pulse ml-1 font-sans">· Expirée</span>}
    </p>
  );

  // Formations preview for collapsed state
  const formationsPreview = formations.length > 0 ? (
    <p className="text-slate-500 text-xs truncate">
      {formations.length} formation{formations.length > 1 ? 's' : ''} enregistrée{formations.length > 1 ? 's' : ''}
    </p>
  ) : (
    <p className="text-slate-600 text-xs italic">Aucune formation</p>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={handleSignOut} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {loadingProfile ? (
          <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        ) : (
          <>
            {/* Identity card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
                <span className="text-2xl font-bold text-white">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-lg font-semibold text-white truncate">
                    {profile.first_name || profile.last_name
                      ? `${profile.first_name} ${profile.last_name}`.trim()
                      : 'Nom non renseigné'}
                  </p>
                  {fonction && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${FONCTION_STYLES[fonction]}`}>
                      {fonction}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 truncate mt-0.5">{session?.user.email}</p>
              </div>
            </div>

            {/* Profile form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
              <div className="p-6">
                <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" />
                  Informations personnelles
                </h2>

                {saveMsg && (
                  <div className={`flex items-start gap-3 rounded-xl p-3 mb-5 text-sm border
                    ${saveMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                  >
                    {saveMsg.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span>{saveMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Prénom / Nom */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Prénom</label>
                      <input
                        type="text"
                        value={profile.first_name}
                        onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))}
                        placeholder="Jean"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Nom</label>
                      <input
                        type="text"
                        value={profile.last_name}
                        onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))}
                        placeholder="Dupont"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Téléphone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        value={profile.telephone}
                        onChange={(e) => setProfile((p) => ({ ...p, telephone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        placeholder="0600000000"
                        inputMode="numeric"
                        maxLength={10}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Mail (readonly) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={session?.user.email ?? ''}
                        readOnly
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-slate-400 text-sm cursor-default select-all"
                      />
                    </div>
                  </div>

                  {/* Nationalité */}
                  <div ref={natRef} className="relative">
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nationalité</label>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={natQuery}
                        onChange={(e) => handleNatInput(e.target.value)}
                        placeholder="Ex : Française, Sénégalaise…"
                        autoComplete="off"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {natSuggestions.length > 0 && (
                      <ul className="absolute z-20 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                        {natSuggestions.map((nat) => (
                          <li key={nat}>
                            <button
                              type="button"
                              onMouseDown={() => selectNat(nat)}
                              className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                              {nat}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* ---- Carte de séjour (conditional + collapsible) ---- */}
                  {needsCarte && (
                    <div className="mt-2">
                      <CollapseSection
                        title="Carte de séjour"
                        icon={<CreditCard className="w-4 h-4 shrink-0 text-orange-400" />}
                        accentClass="from-orange-500 to-amber-400"
                        borderColor="border-orange-500/20"
                        collapsed={carteCollapsed}
                        onToggle={() => setCarteCollapsed((v) => !v)}
                        preview={cartePreview}
                      >
                        <div className="space-y-4">
                          {/* N° carte + date validité */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">N° Carte de séjour</label>
                              <div className="relative">
                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                <input
                                  type="text"
                                  value={profile.carte_sejour_numero}
                                  onChange={(e) => setProfile((p) => ({ ...p, carte_sejour_numero: e.target.value }))}
                                  placeholder="Ex : 123456789012"
                                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-sm
                                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">Date fin de validité</label>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                                <input
                                  type="date"
                                  value={profile.carte_sejour_validite}
                                  onChange={(e) => setProfile((p) => ({ ...p, carte_sejour_validite: e.target.value }))}
                                  className={`w-full bg-slate-800 border rounded-xl pl-9 pr-4 py-2.5 text-white text-sm
                                    focus:outline-none focus:ring-2 focus:border-transparent transition-all
                                    ${expired ? 'border-red-500/60 focus:ring-red-500' : 'border-slate-700 focus:ring-orange-500'}`}
                                />
                              </div>
                              {expired && (
                                <p className="mt-1.5 text-xs font-semibold text-red-400 animate-pulse flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  Validité expirée
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Photos recto / verso */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(['recto', 'verso'] as PhotoSide[]).map((side) => {
                              const inputRef = side === 'recto' ? rectoRef : versoRef;
                              const preview = photoPreviews[side];
                              const existingUrl = side === 'recto' ? profile.carte_sejour_recto_url : profile.carte_sejour_verso_url;
                              const displaySrc = preview ?? existingUrl;
                              const isLoading = photoLoading[side];
                              const label = side === 'recto' ? 'Recto' : 'Verso';

                              return (
                                <div key={side} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                                  <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <ImageIcon className="w-3 h-3 text-orange-400" />
                                      {label}
                                    </span>
                                    {displaySrc && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPhotoFiles((p) => ({ ...p, [side]: null }));
                                          setPhotoPreviews((p) => ({ ...p, [side]: null }));
                                          setProfile((p) => ({
                                            ...p,
                                            [`carte_sejour_${side}_url`]: null,
                                            [`carte_sejour_${side}_path`]: null,
                                          }));
                                        }}
                                        className="w-5 h-5 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors"
                                        title="Supprimer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                  <div
                                    onClick={() => inputRef.current?.click()}
                                    className="relative cursor-pointer group"
                                  >
                                    {displaySrc ? (
                                      <div className="relative">
                                        <img
                                          src={displaySrc}
                                          alt={`Carte de séjour ${label}`}
                                          className="w-full h-28 object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium bg-black/60 px-2 py-1 rounded-lg">
                                            Changer
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed border-slate-700
                                        hover:border-orange-500/50 hover:bg-orange-500/5 transition-all m-2 rounded-lg">
                                        {isLoading ? (
                                          <svg className="animate-spin w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                          </svg>
                                        ) : (
                                          <>
                                            <Upload className="w-5 h-5 text-slate-500 group-hover:text-orange-400 transition-colors" />
                                            <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                                              Importer une photo
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    ref={inputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(side, f); }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CollapseSection>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={saveLoading}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed
                        text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-900/30"
                    >
                      <Save className="w-4 h-4" />
                      {saveLoading ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* ---- Carte professionnelle (Agent de Sécurité only) ---- */}
            {fonction === 'Agent de Sécurité' && (
              <CollapseSection
                title="Carte professionnelle"
                icon={<ShieldCheck className="w-4 h-4 shrink-0 text-blue-400" />}
                accentClass="from-blue-500 to-cyan-400"
                borderColor="border-slate-800"
                collapsed={carteProCollapsed}
                onToggle={() => { setCarteProCollapsed((v) => !v); setCarteProMsg(null); }}
                preview={carteProPreview}
              >
                <form onSubmit={handleSaveCartePro} className="space-y-4">
                  {carteProMsg && (
                    <div className={`flex items-start gap-3 rounded-xl p-3 text-xs border
                      ${carteProMsg.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                    >
                      {carteProMsg.type === 'success'
                        ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      <span>{carteProMsg.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        N° Carte professionnelle CNAPS
                      </label>
                      <CnapsInput
                        value={profile.carte_pro_numero || 'CAR'}
                        onChange={(val) => setProfile((p) => ({ ...p, carte_pro_numero: val }))}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Date fin de validité</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        <input
                          type="date"
                          value={profile.carte_pro_validite}
                          onChange={(e) => setProfile((p) => ({ ...p, carte_pro_validite: e.target.value }))}
                          className={`w-full bg-slate-800 border rounded-xl pl-9 pr-4 py-2.5 text-white text-sm
                            focus:outline-none focus:ring-2 focus:border-transparent transition-all
                            ${carteProExpired ? 'border-red-500/60 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'}`}
                        />
                      </div>
                      {carteProExpired && (
                        <p className="mt-1.5 text-xs font-semibold text-red-400 animate-pulse flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          Validité expirée
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={carteProSaving}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed
                        text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-900/30"
                    >
                      <Save className="w-4 h-4" />
                      {carteProSaving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              </CollapseSection>
            )}

            {/* ---- Formations ---- */}
            <CollapseSection
              title="Formations"
              icon={<GraduationCap className="w-4 h-4 shrink-0 text-emerald-400" />}
              accentClass="from-emerald-500 to-teal-400"
              borderColor="border-slate-800"
              collapsed={formationsCollapsed}
              onToggle={() => { setFormationsCollapsed((v) => !v); setFormationsMsg(null); }}
              preview={formationsPreview}
            >
              <div className="space-y-4">
                {formationsMsg && (
                  <div className={`flex items-start gap-3 rounded-xl p-3 text-xs border
                    ${formationsMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                  >
                    {formationsMsg.type === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                    <span>{formationsMsg.text}</span>
                  </div>
                )}

                {/* Existing formations list */}
                {formations.length > 0 && (
                  <div className="space-y-2">
                    {formations.map((f) => (
                      <div key={f.id}
                        className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{f.type_formation}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatDate(f.date_formation)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteFormation(f.id)}
                          className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new formations */}
                <form onSubmit={handleSaveFormations} className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ajouter</p>

                  {drafts.map((draft, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="relative">
                          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                          <select
                            value={draft.type_formation}
                            onChange={(e) => updateDraft(idx, 'type_formation', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm
                              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none"
                          >
                            {TYPES_FORMATION.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                          <input
                            type="date"
                            value={draft.date_formation}
                            onChange={(e) => updateDraft(idx, 'date_formation', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm
                              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                      {drafts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDraft(idx)}
                          className="mt-1 w-9 h-9 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all shrink-0"
                          title="Supprimer cette ligne"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={addDraft}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white
                        bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter une ligne
                    </button>
                    <button
                      type="submit"
                      disabled={formationsLoading}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white
                        bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed
                        rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {formationsLoading ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              </div>
            </CollapseSection>

            {/* Password section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-slate-600 to-slate-500" />
              <div className="p-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    Mot de passe
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Modifiez votre mot de passe de connexion</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPwdModal(true)}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors whitespace-nowrap"
                >
                  <KeyRound className="w-4 h-4" />
                  Changer
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Password modal */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePwdModal} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                  Changer le mot de passe
                </h3>
                <button onClick={closePwdModal} className="text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {pwdMsg && (
                <div className={`flex items-start gap-3 rounded-xl p-3 mb-5 text-sm border
                  ${pwdMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                >
                  {pwdMsg.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{pwdMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe actuel</label>
                  <div className="relative">
                    <input type={showCurrent ? 'text' : 'password'} required value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-11 text-white placeholder-slate-500 text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                    <button type="button" tabIndex={-1} onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <input type={showNew ? 'text' : 'password'} required minLength={6} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-11 text-white placeholder-slate-500 text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                    <button type="button" tabIndex={-1} onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmer le nouveau mot de passe</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} required minLength={6} value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
                      className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 pr-11 text-white placeholder-slate-500 text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                        ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : 'border-slate-700'}`} />
                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas.</p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={closePwdModal}
                    className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                    Annuler
                  </button>
                  <button type="submit" disabled={pwdLoading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed
                      text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors">
                    <KeyRound className="w-4 h-4" />
                    {pwdLoading ? 'Modification…' : 'Modifier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
