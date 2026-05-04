import { useEffect, useState, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Phone, User as UserIcon, Briefcase, GraduationCap,
  LogOut, Shield, ChevronRight, Pencil, X, Globe, CreditCard,
  Calendar, Upload, Image as ImageIcon, Plus, Trash2, KeyRound,
  Eye, EyeOff, AlertCircle, CheckCircle, ShieldCheck, Save, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import RoleBadge from '../components/RoleBadge';
import ImageViewer from '../components/ImageViewer';
import CnapsInput, { isValidCnaps } from '../../components/CnapsInput';
import {
  NATIONALITIES, EXEMPT_NATIONALITIES, TYPES_FORMATION,
  normalizeStr, isExpired, formatDateFR,
} from '../../lib/profileConstants';

type CarteSejour = {
  carte_sejour_numero: string;
  carte_sejour_validite: string;
  carte_sejour_recto_url: string | null;
  carte_sejour_verso_url: string | null;
};

type Formation = { id: string; type_formation: string; date_formation: string };
type FormationDraft = { type_formation: string; date_formation: string };
type PhotoSide = 'recto' | 'verso';
type Msg = { type: 'success' | 'error'; text: string };
type Tab = 'info' | 'cartepro' | 'formations' | 'password';

type FullProfile = {
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

const EMPTY_PROFILE: FullProfile = {
  first_name: '', last_name: '', telephone: '', nationalite: '',
  carte_sejour_numero: '', carte_sejour_validite: '',
  carte_sejour_recto_url: null, carte_sejour_recto_path: null,
  carte_sejour_verso_url: null, carte_sejour_verso_path: null,
  carte_pro_numero: '', carte_pro_validite: '',
};

// ── Shared styles ──
const iCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`;
const bCls = `w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 text-white`;

export default function MobileProfilePage() {
  const { session, userFonction, isSuperAdmin, signOut, hasAdminAccess } = useAuth();
  const navigate = useNavigate();
  const { profile: basicProfile } = useCurrentProfile();
  const [formations, setFormations] = useState<Formation[]>([]);
  const [carteSejour, setCarteSejour] = useState<CarteSejour | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [managedUserId, setManagedUserId] = useState<string | null>(null);

  // Drawer
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [profLoading, setProfLoading] = useState(false);
  const [prof, setProf] = useState<FullProfile>(EMPTY_PROFILE);

  // Nationalité autocomplete
  const [natQuery, setNatQuery] = useState('');
  const [natSuggestions, setNatSuggestions] = useState<string[]>([]);

  // Photos carte séjour
  const [photoFiles, setPhotoFiles] = useState<{ recto: File | null; verso: File | null }>({ recto: null, verso: null });
  const [photoPreviews, setPhotoPreviews] = useState<{ recto: string | null; verso: string | null }>({ recto: null, verso: null });
  const [photoLoading, setPhotoLoading] = useState<{ recto: boolean; verso: boolean }>({ recto: false, verso: false });
  const rectoRef = useRef<HTMLInputElement>(null);
  const versoRef = useRef<HTMLInputElement>(null);

  // Messages par onglet
  const [infoMsg, setInfoMsg] = useState<Msg | null>(null);
  const [infoSaving, setInfoSaving] = useState(false);
  const [carteProMsg, setCarteProMsg] = useState<Msg | null>(null);
  const [carteProSaving, setCarteProSaving] = useState(false);
  const [formationsMsg, setFormationsMsg] = useState<Msg | null>(null);
  const [formationsSaving, setFormationsSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<Msg | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // Formations drafts
  const [drafts, setDrafts] = useState<FormationDraft[]>([{ type_formation: TYPES_FORMATION[0], date_formation: '' }]);

  // Lightbox for carte de séjour
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Password
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    fetchFormations(uid);
    supabase
      .from('user_profiles')
      .select('carte_sejour_numero, carte_sejour_validite, carte_sejour_recto_url, carte_sejour_verso_url')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCarteSejour(data as CarteSejour);
      });
    supabase
      .from('managed_users')
      .select('id')
      .eq('auth_user_id', uid)
      .maybeSingle()
      .then(({ data }) => { if (data) setManagedUserId(data.id); });
  }, [session?.user.id]);

  function fetchFormations(uid: string) {
    supabase
      .from('user_formations')
      .select('id, type_formation, date_formation')
      .eq('user_id', uid)
      .order('date_formation', { ascending: false })
      .then(({ data }) => setFormations(data ?? []));
  }

  async function openEdit() {
    const uid = session?.user.id;
    setEditOpen(true);
    setActiveTab('info');
    setInfoMsg(null); setCarteProMsg(null); setFormationsMsg(null); setPwdMsg(null);
    setDrafts([{ type_formation: TYPES_FORMATION[0], date_formation: '' }]);
    if (!uid) return;
    // Recharger formations à l'ouverture
    fetchFormations(uid);
    // Charger le profil complet
    setProfLoading(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (data) {
      setProf({
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        telephone: data.telephone ?? '',
        nationalite: data.nationalite ?? '',
        carte_sejour_numero: data.carte_sejour_numero ?? '',
        carte_sejour_validite: data.carte_sejour_validite ?? '',
        carte_sejour_recto_url: data.carte_sejour_recto_url ?? null,
        carte_sejour_recto_path: data.carte_sejour_recto_path ?? null,
        carte_sejour_verso_url: data.carte_sejour_verso_url ?? null,
        carte_sejour_verso_path: data.carte_sejour_verso_path ?? null,
        carte_pro_numero: data.carte_pro_numero ?? '',
        carte_pro_validite: data.carte_pro_validite ?? '',
      });
      setNatQuery(data.nationalite ?? '');
    }
    setProfLoading(false);
  }

  function closeEdit() {
    setEditOpen(false);
    setPhotoFiles({ recto: null, verso: null });
    setPhotoPreviews({ recto: null, verso: null });
    setNatSuggestions([]);
    if (session?.user.id) fetchFormations(session.user.id);
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setInfoMsg(null); setCarteProMsg(null); setFormationsMsg(null); setPwdMsg(null);
  }

  // ── Nationalité ──
  function handleNatInput(val: string) {
    setNatQuery(val);
    setProf((p) => ({ ...p, nationalite: val }));
    if (val.length < 3) { setNatSuggestions([]); return; }
    const q = normalizeStr(val);
    setNatSuggestions(NATIONALITIES.filter((n) => normalizeStr(n).includes(q)).slice(0, 6));
  }
  function selectNat(nat: string) {
    setNatQuery(nat);
    setProf((p) => ({ ...p, nationalite: nat }));
    setNatSuggestions([]);
  }

  // ── Photos ──
  function handlePhotoFile(side: PhotoSide, file: File) {
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) return;
    if (file.size > 10 * 1024 * 1024) return;
    setPhotoFiles((p) => ({ ...p, [side]: file }));
    setPhotoPreviews((p) => ({ ...p, [side]: URL.createObjectURL(file) }));
  }
  async function uploadPhoto(side: PhotoSide): Promise<{ url: string; path: string } | null> {
    const file = photoFiles[side];
    if (!file || !session?.user.id) return null;
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${session.user.id}/${side}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('carte-sejour').upload(path, file, { upsert: true });
    if (error) return null;
    const { data: sd } = await supabase.storage.from('carte-sejour').createSignedUrl(path, 60 * 60 * 24 * 365);
    return sd ? { url: sd.signedUrl, path } : null;
  }

  // ── Sauvegardes ──
  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    if (!session?.user.id) return;
    setInfoSaving(true); setInfoMsg(null);
    const needsCarte = !EXEMPT_NATIONALITIES.has(prof.nationalite) && prof.nationalite.trim() !== '';
    let rectoUrl = prof.carte_sejour_recto_url;
    let rectoPath = prof.carte_sejour_recto_path;
    let versoUrl = prof.carte_sejour_verso_url;
    let versoPath = prof.carte_sejour_verso_path;
    if (needsCarte) {
      if (photoFiles.recto) {
        setPhotoLoading((p) => ({ ...p, recto: true }));
        const r = await uploadPhoto('recto');
        setPhotoLoading((p) => ({ ...p, recto: false }));
        if (r) { rectoUrl = r.url; rectoPath = r.path; }
      }
      if (photoFiles.verso) {
        setPhotoLoading((p) => ({ ...p, verso: true }));
        const r = await uploadPhoto('verso');
        setPhotoLoading((p) => ({ ...p, verso: false }));
        if (r) { versoUrl = r.url; versoPath = r.path; }
      }
    }
    const { error } = await supabase.from('user_profiles').upsert({
      id: session.user.id,
      first_name: prof.first_name.trim(),
      last_name: prof.last_name.trim(),
      telephone: prof.telephone.trim(),
      nationalite: prof.nationalite.trim(),
      carte_sejour_numero: needsCarte ? prof.carte_sejour_numero.trim() : '',
      carte_sejour_validite: needsCarte && prof.carte_sejour_validite ? prof.carte_sejour_validite : null,
      carte_sejour_recto_url: needsCarte ? rectoUrl : null,
      carte_sejour_recto_path: needsCarte ? rectoPath : null,
      carte_sejour_verso_url: needsCarte ? versoUrl : null,
      carte_sejour_verso_path: needsCarte ? versoPath : null,
      updated_at: new Date().toISOString(),
    });
    setInfoSaving(false);
    if (error) { setInfoMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }
    setProf((p) => ({
      ...p,
      carte_sejour_recto_url: needsCarte ? rectoUrl : null,
      carte_sejour_recto_path: needsCarte ? rectoPath : null,
      carte_sejour_verso_url: needsCarte ? versoUrl : null,
      carte_sejour_verso_path: needsCarte ? versoPath : null,
    }));
    setPhotoFiles({ recto: null, verso: null });
    setInfoMsg({ type: 'success', text: 'Profil enregistré.' });
  }

  async function handleSaveCartePro(e: FormEvent) {
    e.preventDefault();
    if (!session?.user.id) return;
    if (!isValidCnaps(prof.carte_pro_numero)) {
      setCarteProMsg({ type: 'error', text: 'Numéro de carte professionnelle incomplet.' });
      return;
    }
    setCarteProSaving(true); setCarteProMsg(null);
    const { error } = await supabase.from('user_profiles').upsert({
      id: session.user.id,
      carte_pro_numero: prof.carte_pro_numero,
      carte_pro_validite: prof.carte_pro_validite || null,
      updated_at: new Date().toISOString(),
    });
    setCarteProSaving(false);
    setCarteProMsg(error
      ? { type: 'error', text: 'Erreur lors de la sauvegarde.' }
      : { type: 'success', text: 'Carte professionnelle enregistrée.' }
    );
  }

  async function handleSaveFormations(e: FormEvent) {
    e.preventDefault();
    if (!session?.user.id) return;
    const valid = drafts.filter((d) => d.type_formation && d.date_formation);
    if (valid.length === 0) {
      setFormationsMsg({ type: 'error', text: 'Veuillez renseigner au moins une date.' });
      return;
    }
    setFormationsSaving(true); setFormationsMsg(null);
    const rows = valid.map((d) => ({ user_id: session.user.id, type_formation: d.type_formation, date_formation: d.date_formation }));
    const { data, error } = await supabase.from('user_formations').insert(rows).select();
    setFormationsSaving(false);
    if (error) { setFormationsMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }
    setFormations((prev) => [...(data as Formation[]), ...prev]);
    setDrafts([{ type_formation: TYPES_FORMATION[0], date_formation: '' }]);
    setFormationsMsg({ type: 'success', text: `${valid.length} formation${valid.length > 1 ? 's' : ''} ajoutée${valid.length > 1 ? 's' : ''}.` });
  }

  async function deleteFormation(fid: string) {
    await supabase.from('user_formations').delete().eq('id', fid);
    setFormations((prev) => prev.filter((x) => x.id !== fid));
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== confirmPwd) { setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' }); return; }
    if (newPwd.length < 6) { setPwdMsg({ type: 'error', text: 'Au moins 6 caractères requis.' }); return; }
    setPwdSaving(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: session!.user.email!, password: currentPwd });
    if (signInErr) { setPwdSaving(false); setPwdMsg({ type: 'error', text: 'Mot de passe actuel incorrect.' }); return; }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPwd });
    setPwdSaving(false);
    if (updErr) { setPwdMsg({ type: 'error', text: updErr.message }); return; }
    setPwdMsg({ type: 'success', text: 'Mot de passe modifié.' });
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
  }

  async function handleSignOut() { await signOut(); navigate('/'); }

  const fullName = [basicProfile.first_name, basicProfile.last_name].filter(Boolean).join(' ').trim() || 'Profil';
  const needsCarte = !EXEMPT_NATIONALITIES.has(prof.nationalite) && prof.nationalite.trim() !== '';
  const carteExpired = needsCarte && isExpired(prof.carte_sejour_validite);
  const carteProExpired = isExpired(prof.carte_pro_validite);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Profil' },
    ...(userFonction === 'Agent de Sécurité' || userFonction === 'Chef de poste' ? [{ id: 'cartepro' as Tab, label: 'Carte pro' }] : []),
    { id: 'formations', label: 'Formations' },
    { id: 'password', label: 'Mot de passe' },
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <h1 className="text-white text-2xl font-bold">Mon profil</h1>
        <button onClick={openEdit}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white text-sm font-semibold">
          <Pencil className="w-3.5 h-3.5" />
          Modifier
        </button>
      </div>

      {/* Identity card */}
      <div className="mx-5 rounded-2xl bg-slate-900 border border-slate-800 p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <UserIcon className="w-7 h-7 text-blue-400" strokeWidth={2.3} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg truncate">{fullName}</p>
            <div className="mt-1.5">
              <RoleBadge fonction={userFonction} isSuperAdmin={isSuperAdmin} />
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="px-5 mt-4">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-2">Contact</p>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
          <InfoRow icon={UserIcon} label="Prénom" value={basicProfile.first_name || '—'} />
          <InfoRow icon={UserIcon} label="Nom" value={basicProfile.last_name || '—'} />
          <InfoRow icon={Mail} label="Email" value={basicProfile.email || '—'} />
          <InfoRow icon={Phone} label="Téléphone" value={basicProfile.telephone || '—'} />
          <InfoRow icon={Globe} label="Nationalité" value={basicProfile.nationalite || '—'} />
          <InfoRow icon={Briefcase} label="Fonction" value={userFonction || '—'} />
        </div>
      </div>

      {/* Carte de séjour — visible uniquement si nationalité hors UE */}
      {carteSejour && !EXEMPT_NATIONALITIES.has(basicProfile.nationalite) && basicProfile.nationalite.trim() !== '' && (
        <div className="px-5 mt-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-2">Carte de séjour</p>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
            {/* Numéro */}
            <div className="flex items-center gap-3 px-4 py-3">
              <CreditCard className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Numéro</p>
                <p className="text-white text-sm font-medium truncate">
                  {carteSejour.carte_sejour_numero || '—'}
                </p>
              </div>
            </div>

            {/* Validité */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Validité</p>
                {carteSejour.carte_sejour_validite ? (
                  <p className={`text-sm font-medium flex items-center gap-1.5 ${isExpired(carteSejour.carte_sejour_validite) ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {formatDateFR(carteSejour.carte_sejour_validite)}
                    {isExpired(carteSejour.carte_sejour_validite) && <span className="text-xs font-bold">· Expirée</span>}
                  </p>
                ) : (
                  <p className="text-white text-sm font-medium">—</p>
                )}
              </div>
            </div>

            {/* Photos recto / verso — repliables */}
            {(carteSejour.carte_sejour_recto_url || carteSejour.carte_sejour_verso_url) && (
              <div>
                <button
                  type="button"
                  onClick={() => setPhotosOpen((v) => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />
                  <p className="flex-1 text-[11px] uppercase tracking-wider font-semibold text-slate-500 text-left">
                    Photos de la carte
                  </p>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${photosOpen ? 'rotate-180' : ''}`} />
                </button>
                {photosOpen && (
                  <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                    {(['recto', 'verso'] as const).map((side) => {
                      const url = side === 'recto' ? carteSejour.carte_sejour_recto_url : carteSejour.carte_sejour_verso_url;
                      return (
                        <div key={side} className="rounded-xl overflow-hidden border border-slate-700">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 bg-slate-800">
                            {side === 'recto' ? 'Recto' : 'Verso'}
                          </p>
                          {url ? (
                            <div
                              className="cursor-zoom-in"
                              onClick={() => setLightboxSrc(url)}
                            >
                              <img
                                src={url}
                                alt={`Carte de séjour ${side}`}
                                className="w-full h-24 object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            </div>
                          ) : (
                            <div className="h-24 flex items-center justify-center bg-slate-800/50">
                              <p className="text-slate-600 text-xs">Non fourni</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formations */}
      <div className="px-5 mt-4">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-2">Formations</p>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          {formations.length === 0 ? (
            <p className="text-slate-500 text-sm">Aucune formation renseignée.</p>
          ) : (
            <div className="space-y-2.5">
              {formations.map((f) => (
                <div key={f.id} className="flex items-center gap-3">
                  <GraduationCap className="w-4 h-4 text-blue-400" />
                  <span className="text-white text-sm font-medium flex-1">{f.type_formation}</span>
                  <span className="text-xs text-slate-500">{new Date(f.date_formation).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 mt-4 space-y-2.5">
        {hasAdminAccess && (
          <button
            onClick={() => managedUserId
              ? navigate(`/dashboard/users/${managedUserId}`, { state: { from: 'mobile' } })
              : navigate('/profile')
            }
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="flex-1 text-left text-white font-semibold text-sm">Modifier mon profil (desktop)</span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        )}
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-red-950/40 border border-red-700/40 hover:bg-red-950/60 transition-colors">
          <LogOut className="w-5 h-5 text-red-400" />
          <span className="flex-1 text-left text-red-300 font-semibold text-sm">Se déconnecter</span>
        </button>
      </div>

      {/* Lightbox — z-[70] to float above the drawer (z-50) */}
      <ImageViewer
        src={lightboxSrc ?? ''}
        isOpen={!!lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />

      {/* ════════════════ EDIT DRAWER ════════════════ */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEdit} />

          <div className="relative bg-slate-900 rounded-t-3xl border-t border-slate-700 flex flex-col" style={{ maxHeight: '92vh' }}>
            {/* Handle + titre */}
            <div className="flex-shrink-0 px-5 pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-white font-bold text-lg">Modifier mon profil</p>
                <button type="button" onClick={closeEdit}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs — scroll horizontal sans scrollbar visible */}
            <div className="flex-shrink-0 pb-3">
              <div className="flex gap-2 px-5 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                {TABS.map((tab) => (
                  <button key={tab.id} type="button" onClick={() => switchTab(tab.id)}
                    className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
                      ${activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Contenu scrollable ── */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 pb-12 pt-1 space-y-4">

                {/* ══ ONGLET PROFIL ══ */}
                {activeTab === 'info' && (
                  profLoading
                    ? (
                      <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Chargement…
                      </div>
                    )
                    : (
                      <form onSubmit={handleSaveInfo} className="space-y-4">
                        {infoMsg && <MsgBanner msg={infoMsg} />}

                        <div className="grid grid-cols-2 gap-3">
                          <MField label="Prénom">
                            <input type="text" value={prof.first_name}
                              onChange={(e) => setProf((p) => ({ ...p, first_name: e.target.value }))}
                              placeholder="Jean" className={iCls} />
                          </MField>
                          <MField label="Nom">
                            <input type="text" value={prof.last_name}
                              onChange={(e) => setProf((p) => ({ ...p, last_name: e.target.value }))}
                              placeholder="Dupont" className={iCls} />
                          </MField>
                        </div>

                        <MField label="Téléphone">
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input type="tel" inputMode="numeric" maxLength={10} value={prof.telephone}
                              onChange={(e) => setProf((p) => ({ ...p, telephone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                              placeholder="0600000000" className={`${iCls} pl-9`} />
                          </div>
                        </MField>

                        <MField label="Email">
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input type="email" value={session?.user.email ?? ''} readOnly
                              className={`${iCls} pl-9 opacity-50 cursor-default`} />
                          </div>
                        </MField>

                        {/* Nationalité avec autocomplétion */}
                        <div className="relative">
                          <MField label="Nationalité">
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input type="text" value={natQuery}
                                onChange={(e) => handleNatInput(e.target.value)}
                                placeholder="Ex : Française, Sénégalaise…"
                                autoComplete="off"
                                className={`${iCls} pl-9`} />
                            </div>
                          </MField>
                          {natSuggestions.length > 0 && (
                            <ul className="absolute z-30 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                              {natSuggestions.map((nat) => (
                                <li key={nat}>
                                  <button type="button" onMouseDown={() => selectNat(nat)}
                                    className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors">
                                    {nat}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Carte de séjour — uniquement hors UE */}
                        {needsCarte && (
                          <div className="bg-slate-950 border border-orange-500/20 rounded-2xl overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
                            <div className="p-4 space-y-3">
                              <p className="text-sm font-semibold text-white flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-orange-400" />
                                Carte de séjour
                              </p>

                              <MField label="N° Carte de séjour">
                                <div className="relative">
                                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                  <input type="text" value={prof.carte_sejour_numero}
                                    onChange={(e) => setProf((p) => ({ ...p, carte_sejour_numero: e.target.value }))}
                                    placeholder="123456789012"
                                    className={`${iCls} pl-9 focus:ring-orange-500`} />
                                </div>
                              </MField>

                              <MField label="Date fin de validité">
                                <div className="relative">
                                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                                  <input type="date" value={prof.carte_sejour_validite}
                                    onChange={(e) => setProf((p) => ({ ...p, carte_sejour_validite: e.target.value }))}
                                    className={`w-full bg-slate-800 border rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${carteExpired ? 'border-red-500/60 focus:ring-red-500' : 'border-slate-700 focus:ring-orange-500'}`} />
                                </div>
                                {carteExpired && <p className="mt-1 text-xs font-semibold text-red-400">Validité expirée</p>}
                              </MField>

                              {/* Photos recto / verso */}
                              <div className="grid grid-cols-2 gap-2">
                                {(['recto', 'verso'] as PhotoSide[]).map((side) => {
                                  const inputRef = side === 'recto' ? rectoRef : versoRef;
                                  const preview = photoPreviews[side];
                                  const existing = side === 'recto' ? prof.carte_sejour_recto_url : prof.carte_sejour_verso_url;
                                  const src = preview ?? existing;
                                  return (
                                    <div key={side} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                                      <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                                          <ImageIcon className="w-3 h-3 text-orange-400" />
                                          {side === 'recto' ? 'Recto' : 'Verso'}
                                        </span>
                                        {src && (
                                          <button type="button" onClick={() => {
                                            setPhotoFiles((p) => ({ ...p, [side]: null }));
                                            setPhotoPreviews((p) => ({ ...p, [side]: null }));
                                            setProf((p) => ({ ...p, [`carte_sejour_${side}_url`]: null, [`carte_sejour_${side}_path`]: null }));
                                          }} className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                      <div onClick={() => inputRef.current?.click()} className="cursor-pointer">
                                        {src ? (
                                          <div className="relative">
                                            <img src={src} alt="" className="w-full h-20 object-cover"
                                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); setLightboxSrc(src); }}
                                              className="absolute inset-0 flex items-center justify-center bg-black/0 active:bg-black/30 transition-all"
                                            >
                                              <span className="opacity-0 active:opacity-100 transition-opacity text-white text-xs font-medium bg-black/60 px-2 py-1 rounded-lg">
                                                Voir
                                              </span>
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center gap-1.5 h-20 border-2 border-dashed border-slate-700 m-1.5 rounded-lg">
                                            {photoLoading[side]
                                              ? <svg className="animate-spin w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                              : <><Upload className="w-4 h-4 text-slate-500" /><span className="text-[10px] text-slate-500">Importer</span></>
                                            }
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

                        <button type="submit" disabled={infoSaving} className={bCls}>
                          <Save className="w-4 h-4" />
                          {infoSaving ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                      </form>
                    )
                )}

                {/* ══ ONGLET CARTE PRO ══ */}
                {activeTab === 'cartepro' && (
                  <form onSubmit={handleSaveCartePro} className="space-y-4">
                    {carteProMsg && <MsgBanner msg={carteProMsg} />}
                    <p className="text-xs text-slate-400">
                      Format : <span className="font-mono text-slate-300">CAR-XX-XXXX-XX-XX-XXXXXXXX</span>
                    </p>
                    <MField label="N° Carte professionnelle CNAPS">
                      <CnapsInput
                        value={prof.carte_pro_numero || 'CAR'}
                        onChange={(val) => setProf((p) => ({ ...p, carte_pro_numero: val }))}
                      />
                    </MField>
                    <MField label="Date fin de validité">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        <input type="date" value={prof.carte_pro_validite}
                          onChange={(e) => setProf((p) => ({ ...p, carte_pro_validite: e.target.value }))}
                          className={`w-full bg-slate-800 border rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${carteProExpired ? 'border-red-500/60 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'}`} />
                      </div>
                      {carteProExpired && <p className="mt-1 text-xs font-semibold text-red-400">Validité expirée</p>}
                      {prof.carte_pro_validite && !carteProExpired && (
                        <p className="mt-1 text-xs text-slate-500">Expire le {formatDateFR(prof.carte_pro_validite)}</p>
                      )}
                    </MField>
                    <button type="submit" disabled={carteProSaving} className={bCls}>
                      <ShieldCheck className="w-4 h-4" />
                      {carteProSaving ? 'Enregistrement…' : 'Enregistrer la carte'}
                    </button>
                  </form>
                )}

                {/* ══ ONGLET FORMATIONS ══ */}
                {activeTab === 'formations' && (
                  <div className="space-y-5">
                    {formationsMsg && <MsgBanner msg={formationsMsg} />}

                    {/* Liste existante */}
                    {formations.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Formations enregistrées</p>
                        {formations.map((f) => (
                          <div key={f.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3">
                            <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-sm font-medium text-white flex-1">{f.type_formation}</span>
                            <span className="text-xs text-slate-400">{formatDateFR(f.date_formation)}</span>
                            <button type="button" onClick={() => deleteFormation(f.id)}
                              className="w-8 h-8 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm text-center py-4">Aucune formation enregistrée.</p>
                    )}

                    {/* Séparateur */}
                    <div className="border-t border-slate-800" />

                    {/* Formulaire ajout */}
                    <form onSubmit={handleSaveFormations} className="space-y-3">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ajouter une formation</p>

                      {drafts.map((draft, idx) => (
                        <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-300">Formation {idx + 1}</p>
                            {drafts.length > 1 && (
                              <button type="button" onClick={() => setDrafts((d) => d.filter((_, i) => i !== idx))}
                                className="w-6 h-6 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                            <select value={draft.type_formation}
                              onChange={(e) => setDrafts((d) => d.map((x, i) => i === idx ? { ...x, type_formation: e.target.value } : x))}
                              className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none">
                              {TYPES_FORMATION.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                            <input type="date" value={draft.date_formation}
                              onChange={(e) => setDrafts((d) => d.map((x, i) => i === idx ? { ...x, date_formation: e.target.value } : x))}
                              className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <button type="button"
                          onClick={() => setDrafts((d) => [...d, { type_formation: TYPES_FORMATION[0], date_formation: '' }])}
                          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all">
                          <Plus className="w-4 h-4" /> Ajouter
                        </button>
                        <button type="submit" disabled={formationsSaving}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 rounded-xl transition-colors">
                          <Save className="w-4 h-4" />
                          {formationsSaving ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ══ ONGLET MOT DE PASSE ══ */}
                {activeTab === 'password' && (
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    {pwdMsg && <MsgBanner msg={pwdMsg} />}

                    <MField label="Mot de passe actuel">
                      <div className="relative">
                        <input type={showCurrent ? 'text' : 'password'} required value={currentPwd}
                          onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••"
                          className={`${iCls} pr-11`} />
                        <button type="button" tabIndex={-1} onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                          {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </MField>

                    <MField label="Nouveau mot de passe">
                      <div className="relative">
                        <input type={showNew ? 'text' : 'password'} required minLength={6} value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••"
                          className={`${iCls} pr-11`} />
                        <button type="button" tabIndex={-1} onClick={() => setShowNew(!showNew)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                          {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </MField>

                    <MField label="Confirmer le mot de passe">
                      <div className="relative">
                        <input type={showConfirm ? 'text' : 'password'} required minLength={6} value={confirmPwd}
                          onChange={(e) => setConfirmPwd(e.target.value)} placeholder="••••••••"
                          className={`w-full bg-slate-800 border rounded-xl px-4 py-2.5 pr-11 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${confirmPwd && confirmPwd !== newPwd ? 'border-red-500/50' : 'border-slate-700'}`} />
                        <button type="button" tabIndex={-1} onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {confirmPwd && confirmPwd !== newPwd && (
                        <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas.</p>
                      )}
                    </MField>

                    <button type="submit" disabled={pwdSaving} className={bCls}>
                      <KeyRound className="w-4 h-4" />
                      {pwdSaving ? 'Modification…' : 'Modifier le mot de passe'}
                    </button>
                  </form>
                )}

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──
function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-slate-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
        <p className="text-white text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function MsgBanner({ msg }: { msg: Msg }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl p-3 text-sm border
      ${msg.type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
      {msg.type === 'success'
        ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
        : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
}
