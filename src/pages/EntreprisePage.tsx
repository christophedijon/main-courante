import { useEffect, useState, FormEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Save, CheckCircle, AlertCircle, Upload, X,
  Image as ImageIcon, Phone, MapPin, ChevronDown,
  ShieldAlert, Users, Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import { invalidateEntrepriseCache } from '../hooks/useEntreprise';

const TYPES_ERP = [
  { value: 'J', label: 'J — Structures d\'accueil pour personnes âgées ou handicapées' },
  { value: 'L', label: 'L — Salles de spectacles, cinémas, salles de conférences' },
  { value: 'M', label: 'M — Magasins et centres commerciaux' },
  { value: 'N', label: 'N — Restaurants et débits de boissons' },
  { value: 'O', label: 'O — Hôtels et pensions de famille' },
  { value: 'P', label: 'P — Salles de danse et salles de jeux (discothèques, dancings, bals)' },
  { value: 'R', label: 'R — Établissements d\'enseignement' },
  { value: 'S', label: 'S — Bibliothèques et centres de documentation' },
  { value: 'T', label: 'T — Salles d\'expositions' },
  { value: 'U', label: 'U — Établissements sanitaires' },
  { value: 'V', label: 'V — Établissements de culte' },
  { value: 'W', label: 'W — Administrations et banques' },
  { value: 'X', label: 'X — Établissements sportifs couverts' },
  { value: 'Y', label: 'Y — Musées' },
  { value: 'PA', label: 'PA — Établissements de plein air' },
  { value: 'CTS', label: 'CTS — Chapiteaux, tentes et structures' },
  { value: 'SG', label: 'SG — Structures gonflables' },
  { value: 'OA', label: 'OA — Hôtels-restaurants d\'altitude' },
  { value: 'GA', label: 'GA — Gares accessibles au public' },
  { value: 'EF', label: 'EF — Établissements flottants' },
  { value: 'REF', label: 'REF — Refuges de montagne' },
];

const CATEGORIES_ERP = [
  {
    value: 1,
    label: 'Catégorie 1',
    description: 'Plus de 1 500 personnes',
    info: 'Établissements de très grande capacité — obligations maximales',
  },
  {
    value: 2,
    label: 'Catégorie 2',
    description: 'De 701 à 1 500 personnes',
    info: 'Grandes capacités — contrôle tous les 3 ans',
  },
  {
    value: 3,
    label: 'Catégorie 3',
    description: 'De 301 à 700 personnes',
    info: 'Capacités moyennes — contrôle tous les 5 ans',
  },
  {
    value: 4,
    label: 'Catégorie 4',
    description: '300 personnes et moins',
    info: '1er groupe — hors 5e catégorie',
  },
  {
    value: 5,
    label: 'Catégorie 5',
    description: 'En dessous des seuils réglementaires',
    info: 'Petit établissement — réglementation allégée. Pour type P : moins de 120 personnes au total, moins de 20 en sous-sol, moins de 100 en étages',
  },
];

const CATEGORIE_COLORS: Record<number, string> = {
  1: 'text-red-400 bg-red-500/10 border-red-500/30',
  2: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  3: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  4: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  5: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};

type EntrepriseData = {
  id?: string;
  nom: string;
  adresse: string;
  telephone: string;
  logo_url: string | null;
  type_erp: string;
  categorie_erp: number;
  effectif_public: number;
  effectif_personnel: number;
};

const EMPTY: EntrepriseData = {
  nom: '', adresse: '', telephone: '', logo_url: null,
  type_erp: 'P', categorie_erp: 4,
  effectif_public: 0, effectif_personnel: 0,
};

function CollapseCard({
  title,
  subtitle,
  icon,
  accentClass,
  preview,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentClass: string;
  preview?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${accentClass}`} />
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">{title}</p>
            {subtitle && !open && (
              <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>
            )}
            {!open && preview && (
              <div className="mt-0.5">{preview}</div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
            hover:border-slate-600 transition-all shrink-0"
        >
          {open ? 'Réduire' : 'Modifier'}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-800 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

const selectCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white
  text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  transition-all appearance-none cursor-pointer`;

const inputNumCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white
  text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`;

export default function EntreprisePage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<EntrepriseData>(EMPTY);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoMsg, setLogoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [erpTypeMsg, setErpTypeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [erpCatMsg, setErpCatMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [effectifMsg, setEffectifMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [openInfo, setOpenInfo] = useState(false);
  const [openLogo, setOpenLogo] = useState(false);
  const [openErpType, setOpenErpType] = useState(false);
  const [openErpCat, setOpenErpCat] = useState(false);
  const [openEffectif, setOpenEffectif] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) { navigate('/'); return; }
    fetchData();
  }, [session]);

  async function fetchData() {
    setLoading(true);
    const { data: rows } = await supabase.from('entreprise').select('*').limit(1).maybeSingle();
    if (rows) {
      setData({
        nom: rows.nom,
        adresse: rows.adresse,
        telephone: rows.telephone,
        logo_url: rows.logo_url,
        type_erp: rows.type_erp ?? 'P',
        categorie_erp: rows.categorie_erp ?? 4,
        effectif_public: rows.effectif_public ?? 0,
        effectif_personnel: rows.effectif_personnel ?? 0,
      });
      setRowId(rows.id);
    }
    setLoading(false);
  }

  function handleFile(file: File) {
    const allowed = ['image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setLogoMsg({ type: 'error', text: 'Format non supporté. Utilisez PNG ou PDF.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoMsg({ type: 'error', text: 'Fichier trop volumineux (max 5 Mo).' });
      return;
    }
    setLogoFile(file);
    setLogoPreview(file.type === 'image/png' ? URL.createObjectURL(file) : null);
    setLogoMsg(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function uploadLogo(): Promise<string | null | undefined> {
    if (!logoFile) return undefined;
    setUploadLoading(true);
    const ext = logoFile.type === 'application/pdf' ? 'pdf' : 'png';
    const path = `logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, logoFile, { upsert: true });
    setUploadLoading(false);
    if (error) { setLogoMsg({ type: 'error', text: "Erreur lors de l'upload du logo." }); return null; }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function saveField(payload: Record<string, unknown>, setMsg: (m: { type: 'success' | 'error'; text: string } | null) => void, closePanel: () => void) {
    setSaveLoading(true);
    setMsg(null);
    const full = { ...payload, updated_at: new Date().toISOString() };
    let error;
    if (rowId) {
      ({ error } = await supabase.from('entreprise').update(full).eq('id', rowId));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('entreprise').insert({ nom: data.nom, adresse: data.adresse, telephone: data.telephone, logo_url: null, ...full }).select('id').single();
      error = insertError;
      if (inserted) setRowId(inserted.id);
    }
    setSaveLoading(false);
    if (error) {
      setMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
    } else {
      invalidateEntrepriseCache();
      setMsg({ type: 'success', text: 'Enregistré avec succès.' });
      closePanel();
    }
  }

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    await saveField(
      { nom: data.nom.trim(), adresse: data.adresse.trim(), telephone: data.telephone.trim() },
      setInfoMsg,
      () => setOpenInfo(false),
    );
  }

  async function handleSaveLogo(e: FormEvent) {
    e.preventDefault();
    if (!logoFile && data.logo_url !== null) { setOpenLogo(false); return; }
    setSaveLoading(true);
    setLogoMsg(null);
    const logoUrl = await uploadLogo();
    if (logoFile && logoUrl === null) { setSaveLoading(false); return; }
    const finalUrl = logoUrl === undefined ? data.logo_url : logoUrl;
    let error;
    if (rowId) {
      ({ error } = await supabase.from('entreprise').update({ logo_url: finalUrl, updated_at: new Date().toISOString() }).eq('id', rowId));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('entreprise').insert({ nom: data.nom, adresse: data.adresse, telephone: data.telephone, logo_url: finalUrl }).select('id').single();
      error = insertError;
      if (inserted) setRowId(inserted.id);
    }
    setSaveLoading(false);
    if (error) {
      setLogoMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
    } else {
      if (finalUrl !== undefined) setData((d) => ({ ...d, logo_url: finalUrl }));
      setLogoFile(null);
      setLogoPreview(null);
      invalidateEntrepriseCache();
      setLogoMsg({ type: 'success', text: 'Logo enregistré avec succès.' });
      setOpenLogo(false);
    }
  }

  async function handleSaveErpType(e: FormEvent) {
    e.preventDefault();
    await saveField({ type_erp: data.type_erp }, setErpTypeMsg, () => setOpenErpType(false));
  }

  async function handleSaveErpCat(e: FormEvent) {
    e.preventDefault();
    await saveField({ categorie_erp: data.categorie_erp }, setErpCatMsg, () => setOpenErpCat(false));
  }

  async function handleSaveEffectif(e: FormEvent) {
    e.preventDefault();
    await saveField(
      { effectif_public: data.effectif_public, effectif_personnel: data.effectif_personnel },
      setEffectifMsg,
      () => setOpenEffectif(false),
    );
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setData((d) => ({ ...d, logo_url: null }));
  }

  const currentLogoSrc = logoPreview ?? (data.logo_url?.match(/\.(png|jpe?g|gif|webp)$/i) ? data.logo_url : null);
  const hasPdfLogo = !logoPreview && data.logo_url && data.logo_url.endsWith('.pdf');

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const infoPreview = (
    <p className="text-slate-500 text-xs truncate max-w-[280px]">
      {data.nom || <span className="italic">Nom non renseigné</span>}
      {data.adresse ? ` · ${data.adresse.split('\n')[0]}` : ''}
    </p>
  );

  const logoPreviewCollapsed = currentLogoSrc ? (
    <img src={currentLogoSrc} alt="Logo" className="h-5 w-auto object-contain rounded" />
  ) : hasPdfLogo ? (
    <p className="text-slate-500 text-xs">logo.pdf</p>
  ) : (
    <p className="text-slate-500 text-xs italic">Aucun logo</p>
  );

  const selectedErpType = TYPES_ERP.find((t) => t.value === data.type_erp);
  const erpTypePreview = (
    <p className="text-slate-500 text-xs">
      {selectedErpType ? `Type ${selectedErpType.value}` : 'Non renseigné'}
    </p>
  );

  const selectedCat = CATEGORIES_ERP.find((c) => c.value === data.categorie_erp);
  const catColorCls = CATEGORIE_COLORS[data.categorie_erp] ?? 'text-slate-400 bg-slate-800 border-slate-700';
  const erpCatPreview = selectedCat ? (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${catColorCls}`}>
      {selectedCat.label} · {selectedCat.description}
    </span>
  ) : null;

  const effectifTotal = data.effectif_public + data.effectif_personnel;
  const effectifPreview = (
    <p className="text-slate-500 text-xs">
      {effectifTotal > 0 ? `${effectifTotal} personnes (${data.effectif_public} public + ${data.effectif_personnel} personnel)` : 'Non renseigné'}
    </p>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={handleSignOut} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-400" />
                Entreprise
              </h1>
              <p className="text-slate-400 text-sm mt-1">Informations de votre établissement</p>
            </div>

            {/* ── Section label ── */}
            <SectionLabel>Informations générales</SectionLabel>

            {/* ---- Informations générales ---- */}
            <CollapseCard
              title="Coordonnées"
              subtitle="Nom, adresse et téléphone de l'établissement"
              icon={<Building2 className="w-4 h-4 shrink-0 text-blue-400" />}
              accentClass="from-blue-500 to-cyan-400"
              preview={infoPreview}
              open={openInfo}
              onToggle={() => { setOpenInfo((v) => !v); setInfoMsg(null); }}
            >
              <form onSubmit={handleSaveInfo} className="space-y-4">
                <MsgBanner msg={infoMsg} />

                <Field label="Nom de l'entreprise">
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={data.nom}
                      onChange={(e) => setData((d) => ({ ...d, nom: e.target.value }))}
                      placeholder="Ex : Le Grand Hôtel"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white
                        placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                        focus:border-transparent transition-all"
                    />
                  </div>
                </Field>

                <Field label="Adresse">
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-slate-500" />
                    <textarea
                      rows={3}
                      value={data.adresse}
                      onChange={(e) => setData((d) => ({ ...d, adresse: e.target.value }))}
                      placeholder="12 rue de la Paix, 75001 Paris"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white
                        placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                        focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </Field>

                <Field label="Téléphone">
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="tel"
                      value={data.telephone}
                      onChange={(e) => setData((d) => ({ ...d, telephone: e.target.value }))}
                      placeholder="+33 1 23 45 67 89"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white
                        placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                        focus:border-transparent transition-all"
                    />
                  </div>
                </Field>

                <SaveRow loading={saveLoading} />
              </form>
            </CollapseCard>

            {/* ---- Type ERP ---- */}
            <CollapseCard
              title="Type d'établissement (ERP)"
              subtitle="Nomenclature selon l'activité exercée — Arrêté du 25 juin 1980"
              icon={<ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />}
              accentClass="from-amber-500 to-orange-400"
              preview={erpTypePreview}
              open={openErpType}
              onToggle={() => { setOpenErpType((v) => !v); setErpTypeMsg(null); }}
            >
              <form onSubmit={handleSaveErpType} className="space-y-4">
                <MsgBanner msg={erpTypeMsg} />

                <Field label="Type d'établissement">
                  <div className="relative">
                    <select
                      value={data.type_erp}
                      onChange={(e) => setData((d) => ({ ...d, type_erp: e.target.value }))}
                      className={selectCls}
                    >
                      {TYPES_ERP.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </Field>

                {/* Encadré informatif contextuel */}
                {data.type_erp === 'P' && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-amber-300 text-xs leading-relaxed">
                      Votre établissement est soumis aux dispositions particulières du <strong>Type P</strong> (Arrêté du 25 juin 1980, articles P1 à P24).
                      Effectif calculé : <strong>4 personnes pour 3 m²</strong> de surface de salle.
                    </p>
                  </div>
                )}
                {data.type_erp === 'N' && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <p className="text-blue-300 text-xs leading-relaxed">
                      Votre établissement est soumis aux dispositions particulières du <strong>Type N</strong>.
                      Seuil 5e catégorie : <strong>moins de 200 personnes</strong> (moins de 100 en sous-sol).
                    </p>
                  </div>
                )}
                {data.type_erp === 'L' && (
                  <div className="rounded-xl border border-slate-600/30 bg-slate-800/60 p-4">
                    <p className="text-slate-300 text-xs leading-relaxed">
                      <strong>Type L</strong> — Salles de spectacles et conférences. Capacité calculée par nombre de sièges ou par surface
                      (1 personne/m² en salle debout). Seuil 5e catégorie : moins de 200 personnes.
                    </p>
                  </div>
                )}
                {!['P', 'N', 'L'].includes(data.type_erp) && (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Établissement classé <strong>Type {data.type_erp}</strong> selon la nomenclature officielle des ERP.
                      Consultez les dispositions particulières applicables à ce type dans l'arrêté du 25 juin 1980.
                    </p>
                  </div>
                )}

                <SaveRow loading={saveLoading} />
              </form>
            </CollapseCard>

            {/* ---- Catégorie ERP ---- */}
            <CollapseCard
              title="Catégorie ERP"
              subtitle="Classement selon la capacité d'accueil — Article R143-19 du CCH"
              icon={<Layers className="w-4 h-4 shrink-0 text-blue-400" />}
              accentClass="from-blue-500 to-blue-400"
              preview={erpCatPreview}
              open={openErpCat}
              onToggle={() => { setOpenErpCat((v) => !v); setErpCatMsg(null); }}
            >
              <form onSubmit={handleSaveErpCat} className="space-y-4">
                <MsgBanner msg={erpCatMsg} />

                <Field label="Catégorie">
                  <div className="relative">
                    <select
                      value={data.categorie_erp}
                      onChange={(e) => setData((d) => ({ ...d, categorie_erp: Number(e.target.value) }))}
                      className={selectCls}
                    >
                      {CATEGORIES_ERP.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label} — {c.description}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </Field>

                {/* Badge + info catégorie */}
                {selectedCat && (
                  <div className={`rounded-xl border p-4 flex items-start gap-3 ${catColorCls}`}>
                    <div className="shrink-0 mt-0.5">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold border ${catColorCls}`}>
                        {selectedCat.value}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{selectedCat.label} · {selectedCat.description}</p>
                      <p className="text-xs mt-1 opacity-80">{selectedCat.info}</p>
                    </div>
                  </div>
                )}

                <SaveRow loading={saveLoading} />
              </form>
            </CollapseCard>

            {/* ---- Effectif admissible ---- */}
            <CollapseCard
              title="Effectif admissible"
              subtitle="Fixé par l'autorité administrative lors de la dernière visite de la commission de sécurité"
              icon={<Users className="w-4 h-4 shrink-0 text-emerald-400" />}
              accentClass="from-emerald-500 to-teal-400"
              preview={effectifPreview}
              open={openEffectif}
              onToggle={() => { setOpenEffectif((v) => !v); setEffectifMsg(null); }}
            >
              <form onSubmit={handleSaveEffectif} className="space-y-4">
                <MsgBanner msg={effectifMsg} />

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Effectif public (Ep)">
                    <input
                      type="number"
                      min={0}
                      value={data.effectif_public}
                      onChange={(e) => setData((d) => ({ ...d, effectif_public: Math.max(0, Number(e.target.value)) }))}
                      className={inputNumCls}
                    />
                    <p className="text-xs text-slate-500 mt-1">Personnes accueillies (hors personnel)</p>
                  </Field>

                  <Field label="Effectif personnel (Ep)">
                    <input
                      type="number"
                      min={0}
                      value={data.effectif_personnel}
                      onChange={(e) => setData((d) => ({ ...d, effectif_personnel: Math.max(0, Number(e.target.value)) }))}
                      className={inputNumCls}
                    />
                    <p className="text-xs text-slate-500 mt-1">Personnel permanent présent</p>
                  </Field>
                </div>

                {/* Total */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-between">
                  <span className="text-slate-300 text-sm font-medium">Effectif total admissible</span>
                  <span className="text-emerald-400 text-xl font-bold">
                    {data.effectif_public + data.effectif_personnel}
                    <span className="text-sm font-normal text-slate-500 ml-1">personnes</span>
                  </span>
                </div>

                {/* Alerte cohérence catégorie vs effectif */}
                {(() => {
                  const total = data.effectif_public + data.effectif_personnel;
                  const cat = data.categorie_erp;
                  if (cat === 1 && total <= 1500) return <EffectifAlert text="L'effectif déclaré semble insuffisant pour une catégorie 1 (> 1 500 personnes)." />;
                  if (cat === 2 && (total < 701 || total > 1500)) return <EffectifAlert text="La catégorie 2 correspond à un effectif de 701 à 1 500 personnes." />;
                  if (cat === 3 && (total < 301 || total > 700)) return <EffectifAlert text="La catégorie 3 correspond à un effectif de 301 à 700 personnes." />;
                  if (cat === 4 && total > 300) return <EffectifAlert text="La catégorie 4 est limitée à 300 personnes maximum." />;
                  return null;
                })()}

                <SaveRow loading={saveLoading} />
              </form>
            </CollapseCard>

            {/* ── Section label ── */}
            <SectionLabel>Identité visuelle</SectionLabel>

            {/* ---- Logo ---- */}
            <CollapseCard
              title="Logo"
              subtitle="Format PNG ou PDF — Taille max 5 Mo"
              icon={<ImageIcon className="w-4 h-4 shrink-0 text-slate-400" />}
              accentClass="from-slate-600 to-slate-500"
              preview={logoPreviewCollapsed}
              open={openLogo}
              onToggle={() => { setOpenLogo((v) => !v); setLogoMsg(null); }}
            >
              <form onSubmit={handleSaveLogo} className="space-y-4">
                <MsgBanner msg={logoMsg} />

                <p className="text-xs text-slate-500">Formats acceptés : PNG, PDF — Taille max : 5 Mo</p>

                {(currentLogoSrc || hasPdfLogo) && (
                  <div className="relative inline-flex items-center gap-4 p-4 bg-slate-800 border border-slate-700 rounded-xl">
                    {currentLogoSrc ? (
                      <img src={currentLogoSrc} alt="Logo" className="h-16 w-auto max-w-[180px] object-contain rounded-lg" />
                    ) : (
                      <div className="flex items-center gap-3 text-slate-300">
                        <ImageIcon className="w-7 h-7 text-slate-500" />
                        <span className="text-sm">logo.pdf</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500
                        text-white flex items-center justify-center transition-colors"
                      title="Supprimer le logo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex items-center gap-4 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all
                    ${dragOver
                      ? 'border-blue-400 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/40'}`}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-300 font-medium">
                      {logoFile ? logoFile.name : 'Glissez-déposez ou cliquez pour choisir'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">PNG ou PDF, max 5 Mo</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,image/png,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={saveLoading || uploadLoading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
                      disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors
                      shadow-lg shadow-blue-900/30"
                  >
                    <Save className="w-4 h-4" />
                    {saveLoading || uploadLoading ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </CollapseCard>

          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em] pt-2 pb-1">
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SaveRow({ loading }: { loading: boolean }) {
  return (
    <div className="flex justify-end pt-1">
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
          disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors
          shadow-lg shadow-blue-900/30"
      >
        <Save className="w-4 h-4" />
        {loading ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  );
}

function MsgBanner({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={`flex items-start gap-3 rounded-xl p-3.5 text-xs border
      ${msg.type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
    >
      {msg.type === 'success'
        ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
      <span>{msg.text}</span>
    </div>
  );
}

function EffectifAlert({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3.5">
      <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-300">{text}</p>
    </div>
  );
}
