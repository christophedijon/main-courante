import { useEffect, useState, FormEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Save, CheckCircle, AlertCircle, Upload, X,
  Image as ImageIcon, Phone, MapPin, ChevronDown,
  ShieldAlert, Users, Layers, Scale, Plus, Zap, Mail,
  FileText, Calendar, RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import { invalidateEntrepriseCache } from '../hooks/useEntreprise';

// ── ERP constants ────────────────────────────────────────────────────────────

const TYPES_ERP = [
  { value: 'J',   label: 'J — Structures d\'accueil personnes âgées/handicapées' },
  { value: 'L',   label: 'L — Salles de spectacles, cinémas, conférences' },
  { value: 'M',   label: 'M — Magasins et centres commerciaux' },
  { value: 'N',   label: 'N — Restaurants et débits de boissons' },
  { value: 'O',   label: 'O — Hôtels et établissements d\'hébergement' },
  { value: 'P',   label: 'P — Salles de danse et salles de jeux (discothèques, dancings)' },
  { value: 'R',   label: 'R — Établissements d\'enseignement' },
  { value: 'S',   label: 'S — Bibliothèques et centres de documentation' },
  { value: 'T',   label: 'T — Salles d\'expositions' },
  { value: 'U',   label: 'U — Établissements sanitaires' },
  { value: 'V',   label: 'V — Établissements de culte' },
  { value: 'W',   label: 'W — Administrations et banques' },
  { value: 'X',   label: 'X — Établissements sportifs couverts' },
  { value: 'Y',   label: 'Y — Musées' },
  { value: 'PA',  label: 'PA — Établissements de plein air' },
  { value: 'CTS', label: 'CTS — Chapiteaux, tentes et structures' },
  { value: 'GA',  label: 'GA — Gares accessibles au public' },
];

const LICENCES_BOISSONS = [
  { value: '',                 label: 'Non applicable' },
  { value: 'I',                label: 'Licence I — Boissons sans alcool uniquement' },
  { value: 'II',               label: 'Licence II — Bières, cidres, vins doux naturels (< 18°)' },
  { value: 'III',              label: 'Licence III — Vins, bières, cidres, poirés, hydromels (< 18°)' },
  { value: 'IV',               label: 'Licence IV — Tous alcools (la plus permissive)' },
  { value: 'restaurant',       label: 'Licence restaurant — Avec repas uniquement' },
  { value: 'petite_restaurant',label: 'Petite licence restaurant — Boissons fermentées avec repas' },
];

const CATEGORIES_ERP = [
  { value: 1, label: 'Catégorie 1', description: 'Plus de 1 500 personnes',          info: 'Établissements de très grande capacité — obligations maximales' },
  { value: 2, label: 'Catégorie 2', description: 'De 701 à 1 500 personnes',         info: 'Grandes capacités — contrôle tous les 3 ans' },
  { value: 3, label: 'Catégorie 3', description: 'De 301 à 700 personnes',           info: 'Capacités moyennes — contrôle tous les 5 ans' },
  { value: 4, label: 'Catégorie 4', description: '300 personnes et moins',           info: '1er groupe — hors 5e catégorie' },
  { value: 5, label: 'Catégorie 5', description: 'En dessous des seuils réglementaires', info: 'Petit établissement — réglementation allégée. Pour type P : moins de 120 personnes au total' },
];

const CATEGORIE_COLORS: Record<number, string> = {
  1: 'text-red-400 bg-red-500/10 border-red-500/30',
  2: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  3: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  4: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  5: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};

// Questions per type
type Question = {
  id: string;
  label: string;
  type: 'boolean' | 'number';
  placeholder?: string;
  info?: string;
  alert?: string;
};

const QUESTIONS: Record<string, Question[]> = {
  P: [
    { id: 'p_piste_danse',      label: 'L\'établissement dispose-t-il d\'une piste de danse aménagée ?', type: 'boolean' },
    { id: 'p_sous_sol_public',  label: 'Le sous-sol est-il accessible au public ?', type: 'boolean', info: 'Si oui : le sous-sol doit être désenfumé. (Source : Art. P5 — Arrêté 25 juin 1980)' },
    { id: 'p_mezzanine',        label: 'L\'établissement comporte-t-il des mezzanines ou niveaux partiels ?', type: 'boolean', info: 'Si oui : désenfumage obligatoire. (Source : Art. P5 — Arrêté 25 juin 1980)' },
    { id: 'p_musique_amplifiee',label: 'Diffusez-vous de la musique amplifiée ?', type: 'boolean' },
    { id: 'p_nb_soirees',       label: 'Organisez-vous 12 soirées avec musique amplifiée ou plus par an ?', type: 'boolean', info: 'Seuil déclenchant l\'obligation d\'étude d\'impact acoustique. (Source : Circulaire interministérielle 23/12/2011 — Décret 2017-1244)' },
    { id: 'p_limiteur_son',     label: 'Disposez-vous d\'un limiteur de son certifié NF-S 31-122-1 ?', type: 'boolean', info: 'Obligatoire si étude d\'impact acoustique préconise. (Source : Décret 2017-1244 du 7 août 2017)' },
    { id: 'p_effets_speciaux',  label: 'Utilisez-vous des effets spéciaux (brouillard, fumée, lasers) ?', type: 'boolean', info: 'Si oui : conformité à l\'instruction technique IT 246 obligatoire. (Source : Art. P19 — Arrêté 25 juin 1980)' },
  ],
  N: [
    { id: 'n_repas_table',  label: 'Servez-vous des repas à table ?', type: 'boolean', info: 'Conditionne le type de licence applicable.' },
    { id: 'n_alcool_fort',  label: 'Servez-vous des alcools forts (spiritueux > 18°) ?', type: 'boolean', info: 'Nécessite une Licence IV ou Licence restaurant.' },
    { id: 'n_terrasse',     label: 'Disposez-vous d\'une terrasse extérieure accessible au public ?', type: 'boolean' },
    { id: 'n_musique',      label: 'Diffusez-vous de la musique ou avez-vous un DJ régulièrement ?', type: 'boolean', alert: 'Si oui + plus de 12 soirées/an : activité complémentaire Type P probable. (Source : Art. GN1 — Arrêté 25 juin 1980)' },
  ],
  O: [
    { id: 'o_locaux_sommeil',      label: 'L\'établissement comporte-t-il des locaux à sommeil ?', type: 'boolean', info: 'Si oui : SSI de catégorie A obligatoire. (Source : Art. GE1 — Arrêté 25 juin 1980)' },
    { id: 'o_nb_chambres',         label: 'Combien de chambres comporte l\'établissement ?', type: 'number', placeholder: 'Ex : 20' },
    { id: 'o_restaurant_integre',  label: 'L\'hôtel dispose-t-il d\'un restaurant intégré ?', type: 'boolean', info: 'Si oui : activité complémentaire Type N applicable.' },
  ],
  L: [
    { id: 'l_scene',      label: 'L\'établissement comporte-t-il une scène ou estrade pour spectacles ?', type: 'boolean' },
    { id: 'l_projection', label: 'Des projections cinématographiques y sont-elles organisées ?', type: 'boolean' },
    { id: 'l_gradins',    label: 'L\'établissement comporte-t-il des gradins fixes ?', type: 'boolean' },
  ],
};

// ── Types ────────────────────────────────────────────────────────────────────

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
  // questionnaire fields
  activite_principale: string;
  activites_complementaires: string[];
  licence_boissons: string;
  questionnaire_reponses: Record<string, boolean | number | null>;
  derniere_visite_commission: string;
  document_obligations_html: string;
  document_obligations_updated_at: string | null;
};

const EMPTY: EntrepriseData = {
  nom: '', adresse: '', telephone: '', logo_url: null,
  type_erp: 'P', categorie_erp: 4, effectif_public: 0, effectif_personnel: 0,
  activite_principale: 'P', activites_complementaires: [], licence_boissons: '',
  questionnaire_reponses: {}, derniere_visite_commission: '',
  document_obligations_html: '', document_obligations_updated_at: null,
};

// ── Shared UI helpers ─────────────────────────────────────────────────────────

const selectCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white
  text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
  transition-all appearance-none cursor-pointer`;

const inputNumCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white
  text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`;

function CollapseCard({
  title, subtitle, icon, accentClass, preview, open, onToggle, children,
}: {
  title: string; subtitle?: string; icon: React.ReactNode; accentClass: string;
  preview?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${accentClass}`} />
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">{title}</p>
            {subtitle && !open && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
            {!open && preview && <div className="mt-0.5">{preview}</div>}
          </div>
        </div>
        <button
          type="button" onClick={onToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
            hover:border-slate-600 transition-all shrink-0"
        >
          {open ? 'Réduire' : 'Modifier'}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && <div className="border-t border-slate-800 px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.18em] pt-2 pb-1">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SaveRow({ loading, label = 'Enregistrer' }: { loading: boolean; label?: string }) {
  return (
    <div className="flex justify-end pt-1">
      <button type="submit" disabled={loading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
          disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors
          shadow-lg shadow-blue-900/30"
      >
        <Save className="w-4 h-4" />
        {loading ? 'Enregistrement…' : label}
      </button>
    </div>
  );
}

function MsgBanner({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) {
  if (!msg) return null;
  return (
    <div className={`flex items-start gap-3 rounded-xl p-3.5 text-xs border
      ${msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
    >
      {msg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
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

// Boolean toggle question widget
function BoolQuestion({
  q, value, onChange,
}: {
  q: Question;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
      <p className="text-sm text-slate-200 leading-snug">{q.label}</p>
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border
              ${value === v
                ? v ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-700/70 border-red-600 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
          >
            {v ? 'Oui' : 'Non'}
          </button>
        ))}
      </div>
      {q.info && (
        <p className="text-[11px] text-slate-500 leading-relaxed border-l-2 border-slate-600 pl-2">{q.info}</p>
      )}
      {q.alert && value === true && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-300 leading-relaxed">{q.alert}</p>
        </div>
      )}
    </div>
  );
}

// ── Next commission visit helper ──────────────────────────────────────────────

function computeNextVisit(lastVisit: string, categorie: number, hasLocauxSommeil: boolean): Date | null {
  if (!lastVisit) return null;
  const d = new Date(lastVisit);
  if (isNaN(d.getTime())) return null;
  if (categorie === 5 && !hasLocauxSommeil) return null; // aucune visite obligatoire
  const years = categorie <= 3 ? 3 : 5;
  return new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
}

// ── Format AI plain-text output as HTML ──────────────────────────────────────

function formatObligationsHtml(text: string): string {
  if (!text) return '';
  let html = text
    .replace(
      /^(\d+)\.\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÆŒÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÆŒÇa-z\s]+)$/gm,
      '<h2 style="color:#e2e8f0;font-size:15px;font-weight:700;margin:20px 0 8px;padding-bottom:6px;border-bottom:1px solid #334155;text-transform:uppercase;letter-spacing:.05em">$1. $2</h2>'
    )
    .replace(
      /^—\s+(.+)$/gm,
      '<h3 style="color:#94a3b8;font-size:13px;font-weight:600;margin:14px 0 6px"><span style="display:inline-block;width:3px;height:14px;background:#3b82f6;border-radius:2px;margin-right:6px;vertical-align:middle"></span>$1</h3>'
    )
    .replace(
      /\(Source\s*:\s*([^)]+)\)/g,
      '<span style="font-size:11px;color:#64748b;font-style:italic;display:inline-block;margin-top:2px">(Source : $1)</span>'
    )
    .replace(
      /^⚠\s*(.+)$/gm,
      '<div style="background:#78350f20;border:1px solid #f59e0b40;border-radius:8px;padding:10px 14px;margin:8px 0;color:#fde68a;font-size:13px">⚠ $1</div>'
    )
    .replace(
      /^(?!<[h2|h3|div])(.+)$/gm,
      '<p style="color:#cbd5e1;font-size:13px;line-height:1.7;margin:4px 0">$1</p>'
    )
    .replace(/\n{2,}/g, '<div style="height:8px"></div>');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:4px 0;color:#e2e8f0">${html}</div>`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EntreprisePage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<EntrepriseData>(EMPTY);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  const [infoMsg, setInfoMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoMsg, setLogoMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [erpTypeMsg, setErpTypeMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [erpCatMsg, setErpCatMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [effectifMsg, setEffectifMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profilMsg, setProfilMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [genMsg, setGenMsg]             = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [openInfo, setOpenInfo]         = useState(false);
  const [openLogo, setOpenLogo]         = useState(false);
  const [openErpType, setOpenErpType]   = useState(false);
  const [openErpCat, setOpenErpCat]     = useState(false);
  const [openEffectif, setOpenEffectif] = useState(false);
  const [openProfil, setOpenProfil]     = useState(false);

  const [logoFile, setLogoFile]         = useState<File | null>(null);
  const [logoPreview, setLogoPreview]   = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [dragOver, setDragOver]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Activity modal
  const [showActModal, setShowActModal] = useState(false);
  const [actModalSel, setActModalSel]   = useState('');

  // Generation
  const [generating, setGenerating]     = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (!session) { navigate('/'); return; }
    fetchData();
  }, [session]);

  async function fetchData() {
    setLoading(true);
    const { data: rows } = await supabase.from('entreprise').select('*').limit(1).maybeSingle();
    if (rows) {
      setData({
        nom: rows.nom ?? '',
        adresse: rows.adresse ?? '',
        telephone: rows.telephone ?? '',
        logo_url: rows.logo_url ?? null,
        type_erp: rows.type_erp ?? 'P',
        categorie_erp: rows.categorie_erp ?? 4,
        effectif_public: rows.effectif_public ?? 0,
        effectif_personnel: rows.effectif_personnel ?? 0,
        activite_principale: rows.activite_principale ?? 'P',
        activites_complementaires: rows.activites_complementaires ?? [],
        licence_boissons: rows.licence_boissons ?? '',
        questionnaire_reponses: rows.questionnaire_reponses ?? {},
        derniere_visite_commission: rows.derniere_visite_commission ?? '',
        document_obligations_html: rows.document_obligations_html ?? '',
        document_obligations_updated_at: rows.document_obligations_updated_at ?? null,
      });
      setRowId(rows.id);
    }
    setLoading(false);
  }

  // ── Logo helpers ────────────────────────────────────────────────────────────

  function handleFile(file: File) {
    if (!['image/png', 'application/pdf'].includes(file.type)) {
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

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setData((d) => ({ ...d, logo_url: null }));
  }

  // ── Generic save ────────────────────────────────────────────────────────────

  async function saveField(
    payload: Record<string, unknown>,
    setMsg: (m: { type: 'success' | 'error'; text: string } | null) => void,
    closePanel: () => void,
  ) {
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

  // ── Form handlers ───────────────────────────────────────────────────────────

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    await saveField({ nom: data.nom.trim(), adresse: data.adresse.trim(), telephone: data.telephone.trim() }, setInfoMsg, () => setOpenInfo(false));
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
      setLogoFile(null); setLogoPreview(null);
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
    await saveField({ effectif_public: data.effectif_public, effectif_personnel: data.effectif_personnel }, setEffectifMsg, () => setOpenEffectif(false));
  }

  async function handleSaveProfil(e: FormEvent) {
    e.preventDefault();
    await saveField({
      activite_principale: data.activite_principale,
      activites_complementaires: data.activites_complementaires,
      licence_boissons: data.licence_boissons,
      questionnaire_reponses: data.questionnaire_reponses,
      categorie_erp: data.categorie_erp,
      effectif_public: data.effectif_public,
      effectif_personnel: data.effectif_personnel,
      derniere_visite_commission: data.derniere_visite_commission || null,
    }, setProfilMsg, () => {});
  }

  // ── Questionnaire helpers ───────────────────────────────────────────────────

  const activeTypes = [data.activite_principale, ...data.activites_complementaires].filter(Boolean);
  const activeQuestions = activeTypes.flatMap((t) => QUESTIONS[t] ?? []);

  function setAnswer(id: string, val: boolean | number | null) {
    setData((d) => ({ ...d, questionnaire_reponses: { ...d.questionnaire_reponses, [id]: val } }));
  }

  function addActivity(type: string) {
    if (!type || data.activites_complementaires.includes(type) || type === data.activite_principale) return;
    setData((d) => ({ ...d, activites_complementaires: [...d.activites_complementaires, type] }));
    setShowActModal(false);
  }

  function removeActivity(type: string) {
    setData((d) => ({ ...d, activites_complementaires: d.activites_complementaires.filter((a) => a !== type) }));
  }

  // ── Regulatory alerts ───────────────────────────────────────────────────────

  const regAlerts: string[] = [];
  const r = data.questionnaire_reponses;

  if (activeTypes.includes('N') && r['n_musique'] === true && r['p_nb_soirees'] === true) {
    regAlerts.push('Votre activité de diffusion musicale régulière peut nécessiter un classement complémentaire en Type P. (Source : Art. GN1 — Arrêté 25 juin 1980) — Démarche : Contactez la mairie ou la préfecture pour déposer un dossier ERP modificatif.');
  }
  if (data.licence_boissons === 'petite_restaurant' && r['n_alcool_fort'] === true) {
    regAlerts.push('Votre licence ne vous autorise pas à servir des spiritueux. Une licence IV ou licence restaurant est nécessaire. (Source : Art. L3331-1 CSP)');
  }
  if (activeTypes.includes('P') && r['p_musique_amplifiee'] === true && r['p_nb_soirees'] === true && r['p_limiteur_son'] === false) {
    regAlerts.push('L\'absence de limiteur de son certifié peut constituer une infraction au Décret 2017-1244. Sanctions possibles : amende jusqu\'à 1 500€, fermeture administrative.');
  }

  // ── Next commission visit ───────────────────────────────────────────────────

  const hasLocauxSommeil = r['o_locaux_sommeil'] === true;
  const nextVisit = computeNextVisit(data.derniere_visite_commission, data.categorie_erp, hasLocauxSommeil);

  function nextVisitBadge() {
    if (data.categorie_erp === 5 && !hasLocauxSommeil) {
      return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-slate-700 border border-slate-600 text-slate-400">Aucune visite obligatoire</span>;
    }
    if (!nextVisit) return null;
    const now = new Date();
    const diffMs = nextVisit.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-semibold"><AlertCircle className="w-3 h-3" />Visite dépassée — {nextVisit.toLocaleDateString('fr-FR')}</span>;
    if (diffDays < 180) return <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold"><AlertCircle className="w-3 h-3" />Prochaine visite dans {diffDays} j — {nextVisit.toLocaleDateString('fr-FR')}</span>;
    return <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold"><CheckCircle className="w-3 h-3" />Prochaine visite : {nextVisit.toLocaleDateString('fr-FR')}</span>;
  }

  // ── Generate obligations ────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true);
    setGenMsg(null);
    try {
      const activitesLabel = activeTypes.map((t) => `Type ${t}`).join(', ');
      const licenceLabel = LICENCES_BOISSONS.find((l) => l.value === data.licence_boissons)?.label ?? 'Non applicable';
      const profileMessage = `Profil de l'établissement :
- Nom : ${data.nom}
- Activité principale : Type ${data.activite_principale}
- Activités complémentaires : ${data.activites_complementaires.length ? data.activites_complementaires.map((t) => `Type ${t}`).join(', ') : 'Aucune'}
- Licence : ${licenceLabel}
- Catégorie ERP : ${data.categorie_erp}
- Effectif public : ${data.effectif_public}
- Effectif personnel : ${data.effectif_personnel}
- Dernière visite commission : ${data.derniere_visite_commission || 'Non renseignée'}
- Activités totales : ${activitesLabel}

Réponses au questionnaire :
${JSON.stringify(data.questionnaire_reponses, null, 2)}

Génère le document "Mes obligations" organisé par thématiques pour cet établissement. Cite uniquement des références légales vérifiables.`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ia-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ message: profileMessage, mode: 'erp' }),
        }
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        setGenMsg({ type: 'error', text: json.error ?? 'Erreur lors de la génération.' });
      } else {
        const iaResponse: string = json.response;
        const nowIso = new Date().toISOString();
        const nowFR = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

        // Sauvegarde dans entreprise
        if (rowId) {
          await supabase.from('entreprise').update({
            document_obligations_html: iaResponse,
            document_obligations_updated_at: nowIso,
          }).eq('id', rowId);
        }

        // Sync vers toolbox_documents
        const { error: upsertError } = await supabase
          .from('toolbox_documents')
          .upsert(
            {
              titre: 'Mes obligations réglementaires',
              categorie: 'PROCEDURE',
              description: `Généré le ${nowFR} — Profil ${data.activite_principale || 'ERP'}`,
              contenu: formatObligationsHtml(iaResponse),
              destinataires: ['Direction', 'Chef de poste'],
              actif: true,
              ordre: 0,
              signature_requise: false,
            },
            { onConflict: 'titre' }
          );
        if (upsertError) {
          console.error('Sync toolbox:', upsertError);
        }

        setData((d) => ({ ...d, document_obligations_html: iaResponse, document_obligations_updated_at: nowIso }));
        setGenMsg({ type: 'success', text: 'Document généré et synchronisé avec la Boîte à outils.' });
      }
    } catch {
      setGenMsg({ type: 'error', text: 'Erreur réseau. Réessayez.' });
    }
    setGenerating(false);
  }

  async function handleSendEmail() {
    if (!data.document_obligations_html) return;
    setSendingEmail(true);
    setGenMsg(null);
    try {
      // Fetch direction users
      const { data: dirUsers } = await supabase
        .from('managed_users')
        .select('email')
        .eq('fonction', 'Direction');

      if (!dirUsers || dirUsers.length === 0) {
        setGenMsg({ type: 'error', text: 'Aucun utilisateur avec la fonction Direction trouvé.' });
        setSendingEmail(false);
        return;
      }

      // Fetch resend key from ia_settings
      const { data: iaSettings } = await supabase
        .from('ia_settings')
        .select('resend_api_key')
        .limit(1)
        .maybeSingle();

      if (!iaSettings?.resend_api_key) {
        setGenMsg({ type: 'error', text: 'Clé Resend non configurée dans les paramètres IA.' });
        setSendingEmail(false);
        return;
      }

      const emailPromises = dirUsers.map((u: { email: string }) =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${iaSettings.resend_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'noreply@resend.dev',
            to: u.email,
            subject: `Mes obligations réglementaires — ${data.nom}`,
            html: data.document_obligations_html,
          }),
        })
      );

      await Promise.all(emailPromises);
      setGenMsg({ type: 'success', text: `Document envoyé à ${dirUsers.length} destinataire${dirUsers.length > 1 ? 's' : ''}.` });
    } catch {
      setGenMsg({ type: 'error', text: 'Erreur lors de l\'envoi de l\'email.' });
    }
    setSendingEmail(false);
  }

  async function handleSignOut() { await signOut(); navigate('/'); }

  // ── Computed values for collapsed previews ───────────────────────────────────

  const currentLogoSrc = logoPreview ?? (data.logo_url?.match(/\.(png|jpe?g|gif|webp)$/i) ? data.logo_url : null);
  const hasPdfLogo = !logoPreview && data.logo_url && data.logo_url.endsWith('.pdf');

  const infoPreview = (
    <p className="text-slate-500 text-xs truncate max-w-[280px]">
      {data.nom || <span className="italic">Nom non renseigné</span>}
      {data.adresse ? ` · ${data.adresse.split('\n')[0]}` : ''}
    </p>
  );
  const logoPreviewCollapsed = currentLogoSrc
    ? <img src={currentLogoSrc} alt="Logo" className="h-5 w-auto object-contain rounded" />
    : hasPdfLogo ? <p className="text-slate-500 text-xs">logo.pdf</p>
    : <p className="text-slate-500 text-xs italic">Aucun logo</p>;

  const selectedErpType = TYPES_ERP.find((t) => t.value === data.type_erp);
  const erpTypePreview = <p className="text-slate-500 text-xs">{selectedErpType ? `Type ${selectedErpType.value}` : 'Non renseigné'}</p>;

  const selectedCat = CATEGORIES_ERP.find((c) => c.value === data.categorie_erp);
  const catColorCls = CATEGORIE_COLORS[data.categorie_erp] ?? 'text-slate-400 bg-slate-800 border-slate-700';
  const erpCatPreview = selectedCat ? (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${catColorCls}`}>
      {selectedCat.label} · {selectedCat.description}
    </span>
  ) : null;

  const effectifTotal = data.effectif_public + data.effectif_personnel;
  const effectifPreview = <p className="text-slate-500 text-xs">{effectifTotal > 0 ? `${effectifTotal} personnes (${data.effectif_public} public + ${data.effectif_personnel} personnel)` : 'Non renseigné'}</p>;

  const profilPreview = (
    <p className="text-slate-500 text-xs">
      {activeTypes.length ? `Type ${activeTypes.join(' + ')}` : 'Non configuré'}
      {data.derniere_visite_commission ? ` · Visite ${new Date(data.derniere_visite_commission).toLocaleDateString('fr-FR')}` : ''}
    </p>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

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

            <SectionLabel>Informations générales</SectionLabel>

            {/* ── Coordonnées ── */}
            <CollapseCard
              title="Coordonnées" subtitle="Nom, adresse et téléphone de l'établissement"
              icon={<Building2 className="w-4 h-4 shrink-0 text-blue-400" />}
              accentClass="from-blue-500 to-cyan-400" preview={infoPreview}
              open={openInfo} onToggle={() => { setOpenInfo((v) => !v); setInfoMsg(null); }}
            >
              <form onSubmit={handleSaveInfo} className="space-y-4">
                <MsgBanner msg={infoMsg} />
                <Field label="Nom de l'entreprise">
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input type="text" value={data.nom}
                      onChange={(e) => setData((d) => ({ ...d, nom: e.target.value }))}
                      placeholder="Ex : Le Grand Hôtel"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                </Field>
                <Field label="Adresse">
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-slate-500" />
                    <textarea rows={3} value={data.adresse}
                      onChange={(e) => setData((d) => ({ ...d, adresse: e.target.value }))}
                      placeholder="12 rue de la Paix, 75001 Paris"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none" />
                  </div>
                </Field>
                <Field label="Téléphone">
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input type="tel" value={data.telephone}
                      onChange={(e) => setData((d) => ({ ...d, telephone: e.target.value }))}
                      placeholder="+33 1 23 45 67 89"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                </Field>
                <SaveRow loading={saveLoading} />
              </form>
            </CollapseCard>

            {/* ── Type ERP ── */}
            <CollapseCard
              title="Type d'établissement (ERP)" subtitle="Nomenclature selon l'activité exercée — Arrêté du 25 juin 1980"
              icon={<ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />}
              accentClass="from-amber-500 to-orange-400" preview={erpTypePreview}
              open={openErpType} onToggle={() => { setOpenErpType((v) => !v); setErpTypeMsg(null); }}
            >
              <form onSubmit={handleSaveErpType} className="space-y-4">
                <MsgBanner msg={erpTypeMsg} />
                <Field label="Type d'établissement">
                  <div className="relative">
                    <select value={data.type_erp} onChange={(e) => setData((d) => ({ ...d, type_erp: e.target.value }))} className={selectCls}>
                      {TYPES_ERP.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </Field>
                {data.type_erp === 'P' && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-amber-300 text-xs leading-relaxed">Votre établissement est soumis aux dispositions particulières du <strong>Type P</strong> (Arrêté du 25 juin 1980, articles P1 à P24). Effectif calculé : <strong>4 personnes pour 3 m²</strong> de surface de salle.</p>
                  </div>
                )}
                {data.type_erp === 'N' && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <p className="text-blue-300 text-xs leading-relaxed">Votre établissement est soumis aux dispositions particulières du <strong>Type N</strong>. Seuil 5e catégorie : <strong>moins de 200 personnes</strong> (moins de 100 en sous-sol).</p>
                  </div>
                )}
                {!['P', 'N'].includes(data.type_erp) && (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                    <p className="text-slate-400 text-xs leading-relaxed">Établissement classé <strong>Type {data.type_erp}</strong>. Consultez les dispositions particulières applicables dans l'arrêté du 25 juin 1980.</p>
                  </div>
                )}
                <SaveRow loading={saveLoading} />
              </form>
            </CollapseCard>

            {/* ── Catégorie ERP ── */}
            <CollapseCard
              title="Catégorie ERP" subtitle="Classement selon la capacité d'accueil — Article R143-19 du CCH"
              icon={<Layers className="w-4 h-4 shrink-0 text-blue-400" />}
              accentClass="from-blue-500 to-blue-400" preview={erpCatPreview}
              open={openErpCat} onToggle={() => { setOpenErpCat((v) => !v); setErpCatMsg(null); }}
            >
              <form onSubmit={handleSaveErpCat} className="space-y-4">
                <MsgBanner msg={erpCatMsg} />
                <Field label="Catégorie">
                  <div className="relative">
                    <select value={data.categorie_erp} onChange={(e) => setData((d) => ({ ...d, categorie_erp: Number(e.target.value) }))} className={selectCls}>
                      {CATEGORIES_ERP.map((c) => <option key={c.value} value={c.value}>{c.label} — {c.description}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </Field>
                {selectedCat && (
                  <div className={`rounded-xl border p-4 flex items-start gap-3 ${catColorCls}`}>
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold border shrink-0 ${catColorCls}`}>{selectedCat.value}</span>
                    <div>
                      <p className="font-semibold text-sm">{selectedCat.label} · {selectedCat.description}</p>
                      <p className="text-xs mt-1 opacity-80">{selectedCat.info}</p>
                    </div>
                  </div>
                )}
                <SaveRow loading={saveLoading} />
              </form>
            </CollapseCard>

            {/* ── Effectif ── */}
            <CollapseCard
              title="Effectif admissible" subtitle="Fixé par l'autorité administrative lors de la dernière visite de la commission de sécurité"
              icon={<Users className="w-4 h-4 shrink-0 text-emerald-400" />}
              accentClass="from-emerald-500 to-teal-400" preview={effectifPreview}
              open={openEffectif} onToggle={() => { setOpenEffectif((v) => !v); setEffectifMsg(null); }}
            >
              <form onSubmit={handleSaveEffectif} className="space-y-4">
                <MsgBanner msg={effectifMsg} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Effectif public (Ep)">
                    <input type="number" min={0} value={data.effectif_public}
                      onChange={(e) => setData((d) => ({ ...d, effectif_public: Math.max(0, Number(e.target.value)) }))}
                      className={inputNumCls} />
                    <p className="text-xs text-slate-500 mt-1">Personnes accueillies (hors personnel)</p>
                  </Field>
                  <Field label="Effectif personnel">
                    <input type="number" min={0} value={data.effectif_personnel}
                      onChange={(e) => setData((d) => ({ ...d, effectif_personnel: Math.max(0, Number(e.target.value)) }))}
                      className={inputNumCls} />
                    <p className="text-xs text-slate-500 mt-1">Personnel permanent présent</p>
                  </Field>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-between">
                  <span className="text-slate-300 text-sm font-medium">Effectif total admissible</span>
                  <span className="text-emerald-400 text-xl font-bold">{effectifTotal}<span className="text-sm font-normal text-slate-500 ml-1">personnes</span></span>
                </div>
                {(() => {
                  const total = effectifTotal;
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

            {/* ════════════════════════════════════════════════════════
                PROFIL RÉGLEMENTAIRE ERP
            ════════════════════════════════════════════════════════ */}
            <SectionLabel>Profil réglementaire</SectionLabel>

            <CollapseCard
              title="Profil réglementaire ERP" subtitle="Questionnaire guidé pour générer vos obligations réglementaires"
              icon={<Scale className="w-4 h-4 shrink-0 text-blue-400" />}
              accentClass="from-blue-600 to-cyan-500" preview={profilPreview}
              open={openProfil} onToggle={() => { setOpenProfil((v) => !v); setProfilMsg(null); }}
            >
              <form onSubmit={handleSaveProfil} className="space-y-6">

                {/* ── Alertes réglementaires ── */}
                {regAlerts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Alertes réglementaires
                    </p>
                    {regAlerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-300 leading-relaxed">{alert}</p>
                      </div>
                    ))}
                  </div>
                )}

                <MsgBanner msg={profilMsg} />

                {/* ── A — Activités ── */}
                <div className="space-y-4">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                    A — Activités de l'établissement
                  </p>

                  <Field label="Activité principale">
                    <div className="relative">
                      <select value={data.activite_principale}
                        onChange={(e) => setData((d) => ({ ...d, activite_principale: e.target.value }))}
                        className={selectCls}>
                        {TYPES_ERP.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </Field>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">Activités complémentaires</label>
                    {data.activites_complementaires.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {data.activites_complementaires.map((type) => (
                          <span key={type} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
                            Type {type}
                            <button type="button" onClick={() => removeActivity(type)} className="text-blue-400/60 hover:text-blue-300 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => { setActModalSel(''); setShowActModal(true); }}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all">
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter une activité complémentaire
                    </button>
                  </div>

                  <Field label="Licence débit de boissons">
                    <div className="relative">
                      <select value={data.licence_boissons}
                        onChange={(e) => setData((d) => ({ ...d, licence_boissons: e.target.value }))}
                        className={selectCls}>
                        {LICENCES_BOISSONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </Field>

                  {data.licence_boissons === 'petite_restaurant' && (
                    <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-300 leading-relaxed">La petite licence restaurant autorise uniquement les boissons fermentées (bière, vin, cidre) servies obligatoirement avec un repas. Elle n'autorise pas les spiritueux ni la vente de boissons seules.</p>
                    </div>
                  )}
                  {data.licence_boissons === 'restaurant' && (
                    <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5">
                      <AlertCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-300 leading-relaxed">La licence restaurant permet de servir toutes les boissons alcoolisées mais uniquement pendant les repas.</p>
                    </div>
                  )}
                </div>

                {/* ── B — Questions dynamiques ── */}
                {activeQuestions.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                      B — Questions spécifiques à votre activité
                    </p>
                    {activeTypes.map((type) => {
                      const qs = QUESTIONS[type];
                      if (!qs || qs.length === 0) return null;
                      const typeLabel = TYPES_ERP.find((t) => t.value === type)?.label ?? `Type ${type}`;
                      return (
                        <div key={type} className="space-y-3">
                          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{typeLabel}</p>
                          {qs.map((q) => {
                            if (q.type === 'boolean') {
                              const val = r[q.id];
                              return (
                                <BoolQuestion
                                  key={q.id} q={q}
                                  value={val === true ? true : val === false ? false : null}
                                  onChange={(v) => setAnswer(q.id, v)}
                                />
                              );
                            }
                            if (q.type === 'number') {
                              return (
                                <div key={q.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-2">
                                  <p className="text-sm text-slate-200 leading-snug">{q.label}</p>
                                  <input type="number" min={0} placeholder={q.placeholder}
                                    value={typeof r[q.id] === 'number' ? (r[q.id] as number) : ''}
                                    onChange={(e) => setAnswer(q.id, e.target.value ? Number(e.target.value) : null)}
                                    className={inputNumCls} />
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── C — Classement & capacité ── */}
                <div className="space-y-4">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                    C — Classement et effectif admissible
                  </p>

                  <Field label="Catégorie ERP">
                    <div className="relative">
                      <select value={data.categorie_erp}
                        onChange={(e) => setData((d) => ({ ...d, categorie_erp: Number(e.target.value) }))}
                        className={selectCls}>
                        {CATEGORIES_ERP.map((c) => <option key={c.value} value={c.value}>{c.label} — {c.description}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Pour connaître votre catégorie, reportez-vous au compte-rendu de la dernière visite de la commission de sécurité ou contactez le SDIS de votre département.</p>
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Effectif public maximum">
                      <input type="number" min={0} value={data.effectif_public}
                        onChange={(e) => setData((d) => ({ ...d, effectif_public: Math.max(0, Number(e.target.value)) }))}
                        className={inputNumCls} />
                      <p className="text-xs text-slate-500 mt-1">Nombre de clients admis simultanément, fixé par l'autorité administrative.</p>
                    </Field>
                    <Field label="Effectif personnel">
                      <input type="number" min={0} value={data.effectif_personnel}
                        onChange={(e) => setData((d) => ({ ...d, effectif_personnel: Math.max(0, Number(e.target.value)) }))}
                        className={inputNumCls} />
                    </Field>
                  </div>

                  {/* Total */}
                  <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Effectif total</span>
                    <span className="text-white text-lg font-bold">{effectifTotal} <span className="text-sm font-normal text-slate-500">personnes</span></span>
                  </div>

                  {/* Alerte incohérence */}
                  {data.categorie_erp === 5 && activeTypes.includes('P') && effectifTotal > 120 && (
                    <EffectifAlert text="L'effectif dépasse le seuil de la 5e catégorie pour un ERP Type P (120 personnes max). (Source : Art. R143-19 CCH)" />
                  )}

                  <Field label="Date de la dernière visite de la commission de sécurité">
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                      <input type="date" value={data.derniere_visite_commission}
                        onChange={(e) => setData((d) => ({ ...d, derniere_visite_commission: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                    </div>
                  </Field>

                  {/* Prochaine visite */}
                  {data.derniere_visite_commission && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-slate-500">Prochaine visite :</span>
                      {nextVisitBadge()}
                    </div>
                  )}
                  {data.categorie_erp === 5 && !hasLocauxSommeil && (
                    <p className="text-xs text-slate-500">En catégorie 5 sans locaux à sommeil, aucune visite périodique de la commission de sécurité n'est obligatoire.</p>
                  )}
                </div>

                {/* ── Save profile ── */}
                <SaveRow loading={saveLoading} label="Enregistrer le profil réglementaire" />

                {/* ── Generate / Email ── */}
                <div className="border-t border-slate-800 pt-5 space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Document "Mes obligations"
                  </p>

                  {data.document_obligations_updated_at && (
                    <p className="text-xs text-slate-500">
                      Dernière génération : {new Date(data.document_obligations_updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}

                  <MsgBanner msg={genMsg} />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-900/30"
                    >
                      {generating
                        ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Génération en cours…</>
                        : <><Zap className="w-4 h-4" />{data.document_obligations_html ? 'Regénérer mes obligations' : 'Générer mes obligations'}</>
                      }
                    </button>

                    {data.document_obligations_html && (
                      <button
                        type="button"
                        onClick={handleSendEmail}
                        disabled={sendingEmail}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors border border-slate-600"
                      >
                        {sendingEmail
                          ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Envoi…</>
                          : <><Mail className="w-4 h-4" />Envoyer par email</>
                        }
                      </button>
                    )}
                  </div>

                  {/* Preview generated document */}
                  {data.document_obligations_html && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3" />
                          Aperçu du document généré
                        </p>
                      </div>
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-h-80 overflow-y-auto">
                        <div
                          className="prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: formatObligationsHtml(data.document_obligations_html ?? '') }}
                        />
                      </div>
                    </div>
                  )}
                </div>

              </form>
            </CollapseCard>

            {/* ════════════════════════════════════════
                IDENTITÉ VISUELLE
            ════════════════════════════════════════ */}
            <SectionLabel>Identité visuelle</SectionLabel>

            <CollapseCard
              title="Logo" subtitle="Format PNG ou PDF — Taille max 5 Mo"
              icon={<ImageIcon className="w-4 h-4 shrink-0 text-slate-400" />}
              accentClass="from-slate-600 to-slate-500" preview={logoPreviewCollapsed}
              open={openLogo} onToggle={() => { setOpenLogo((v) => !v); setLogoMsg(null); }}
            >
              <form onSubmit={handleSaveLogo} className="space-y-4">
                <MsgBanner msg={logoMsg} />
                <p className="text-xs text-slate-500">Formats acceptés : PNG, PDF — Taille max : 5 Mo</p>
                {(currentLogoSrc || hasPdfLogo) && (
                  <div className="relative inline-flex items-center gap-4 p-4 bg-slate-800 border border-slate-700 rounded-xl">
                    {currentLogoSrc
                      ? <img src={currentLogoSrc} alt="Logo" className="h-16 w-auto max-w-[180px] object-contain rounded-lg" />
                      : <div className="flex items-center gap-3 text-slate-300"><ImageIcon className="w-7 h-7 text-slate-500" /><span className="text-sm">logo.pdf</span></div>
                    }
                    <button type="button" onClick={removeLogo}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors">
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
                    ${dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/40'}`}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-300 font-medium">{logoFile ? logoFile.name : 'Glissez-déposez ou cliquez pour choisir'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">PNG ou PDF, max 5 Mo</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept=".png,image/png,.pdf,application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <div className="flex justify-end pt-1">
                  <button type="submit" disabled={saveLoading || uploadLoading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-900/30">
                    <Save className="w-4 h-4" />
                    {saveLoading || uploadLoading ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </CollapseCard>

          </div>
        )}
      </main>

      {/* ── Activity modal ── */}
      {showActModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowActModal(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-base">Ajouter une activité complémentaire</p>
              <button type="button" onClick={() => setShowActModal(false)} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <select value={actModalSel} onChange={(e) => setActModalSel(e.target.value)} className={selectCls}>
                <option value="">— Sélectionner un type —</option>
                {TYPES_ERP.filter((t) => t.value !== data.activite_principale && !data.activites_complementaires.includes(t.value))
                  .map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowActModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors">
                Annuler
              </button>
              <button type="button" disabled={!actModalSel} onClick={() => addActivity(actModalSel)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold transition-colors">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
