import { useEffect, useState, FormEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Save, CheckCircle, AlertCircle, Upload, X,
  Image as ImageIcon, Phone, MapPin, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import { invalidateEntrepriseCache } from '../hooks/useEntreprise';

type EntrepriseData = {
  id?: string;
  nom: string;
  adresse: string;
  telephone: string;
  logo_url: string | null;
};

const EMPTY: EntrepriseData = { nom: '', adresse: '', telephone: '', logo_url: null };

function CollapseCard({
  title,
  icon,
  accentClass,
  preview,
  open,
  onToggle,
  children,
}: {
  title: string;
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

export default function EntreprisePage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<EntrepriseData>(EMPTY);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoMsg, setLogoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [openInfo, setOpenInfo] = useState(false);
  const [openLogo, setOpenLogo] = useState(false);

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
      setData({ nom: rows.nom, adresse: rows.adresse, telephone: rows.telephone, logo_url: rows.logo_url });
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
    if (!logoFile) return undefined; // no change
    setUploadLoading(true);
    const ext = logoFile.type === 'application/pdf' ? 'pdf' : 'png';
    const path = `logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, logoFile, { upsert: true });
    setUploadLoading(false);
    if (error) { setLogoMsg({ type: 'error', text: "Erreur lors de l'upload du logo." }); return null; }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    setSaveLoading(true);
    setInfoMsg(null);

    const payload = {
      nom: data.nom.trim(),
      adresse: data.adresse.trim(),
      telephone: data.telephone.trim(),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (rowId) {
      ({ error } = await supabase.from('entreprise').update(payload).eq('id', rowId));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('entreprise').insert({ ...payload, logo_url: null }).select('id').single();
      error = insertError;
      if (inserted) setRowId(inserted.id);
    }

    setSaveLoading(false);
    if (error) {
      setInfoMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
    } else {
      invalidateEntrepriseCache();
      setInfoMsg({ type: 'success', text: 'Informations enregistrées avec succès.' });
      setOpenInfo(false);
    }
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

  // Previews for collapsed state
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

            {/* ---- Informations générales ---- */}
            <CollapseCard
              title="Informations générales"
              icon={<Building2 className="w-4 h-4 shrink-0 text-blue-400" />}
              accentClass="from-blue-500 to-cyan-400"
              preview={infoPreview}
              open={openInfo}
              onToggle={() => { setOpenInfo((v) => !v); setInfoMsg(null); }}
            >
              <form onSubmit={handleSaveInfo} className="space-y-4">
                {infoMsg && (
                  <div className={`flex items-start gap-3 rounded-xl p-3.5 text-xs border
                    ${infoMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                  >
                    {infoMsg.type === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                    <span>{infoMsg.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Nom de l'entreprise</label>
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
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Adresse</label>
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
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Téléphone</label>
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
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
                      disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors
                      shadow-lg shadow-blue-900/30"
                  >
                    <Save className="w-4 h-4" />
                    {saveLoading ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </CollapseCard>

            {/* ---- Logo ---- */}
            <CollapseCard
              title="Logo"
              icon={<ImageIcon className="w-4 h-4 shrink-0 text-slate-400" />}
              accentClass="from-slate-600 to-slate-500"
              preview={logoPreviewCollapsed}
              open={openLogo}
              onToggle={() => { setOpenLogo((v) => !v); setLogoMsg(null); }}
            >
              <form onSubmit={handleSaveLogo} className="space-y-4">
                {logoMsg && (
                  <div className={`flex items-start gap-3 rounded-xl p-3.5 text-xs border
                    ${logoMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                  >
                    {logoMsg.type === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                    <span>{logoMsg.text}</span>
                  </div>
                )}

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
