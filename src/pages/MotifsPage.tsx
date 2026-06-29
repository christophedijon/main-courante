import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Plus, Trash2, ChevronDown, Save,
  CheckCircle, AlertTriangle, Layers, FileText, GripVertical, Flame,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntreprise } from '../hooks/useEntreprise';
import AppHeader from '../components/AppHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

type Motif = {
  id: string;
  nom: string;
  description: string;
  ordre: number;
};

type Niveau = {
  id: string;
  label: string;
  description: string;
  ordre: number;
};

type ToastMsg = { type: 'success' | 'error'; text: string };

// ─── Shared helpers ───────────────────────────────────────────────────────────

const NIVEAU_COLORS = [
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400' },
  { bg: 'bg-sky-500/10',     border: 'border-sky-500/25',     text: 'text-sky-400'     },
  { bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   text: 'text-amber-400'   },
  { bg: 'bg-orange-500/10',  border: 'border-orange-500/25',  text: 'text-orange-400'  },
  { bg: 'bg-red-500/10',     border: 'border-red-500/25',     text: 'text-red-400'     },
];

function getColor(i: number) {
  return NIVEAU_COLORS[Math.min(i, NIVEAU_COLORS.length - 1)];
}

// ─── CollapseCard ─────────────────────────────────────────────────────────────

function CollapseCard({
  accentFrom, accentTo, icon, title, subtitle, open, onToggle, preview, children,
}: {
  accentFrom: string; accentTo: string;
  icon: React.ReactNode;
  title: string; subtitle?: string;
  open: boolean; onToggle: () => void;
  preview?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${accentFrom} ${accentTo}`} />
      <div
        className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">{title}</p>
            {!open && preview
              ? <div className="mt-0.5">{preview}</div>
              : subtitle
                ? <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>
                : null}
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
            hover:border-slate-600 transition-all shrink-0"
        >
          {open ? 'Réduire' : 'Déployer'}
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

// ─── MotifItem ────────────────────────────────────────────────────────────────

function MotifItem({
  motif, onSave, onDelete, saving,
}: {
  motif: Motif;
  onSave: (m: Motif) => Promise<void>;
  onDelete: () => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Motif>(motif);

  useEffect(() => { setLocal(motif); }, [motif]);

  async function handleSave() {
    await onSave(local);
    setOpen(false);
  }

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-white text-sm font-medium leading-tight truncate">
              {motif.nom || <span className="text-slate-600 italic">Sans titre</span>}
            </p>
            {!open && motif.description && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{motif.description}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
            hover:border-slate-600 transition-all shrink-0"
        >
          {open ? 'Réduire' : 'Modifier'}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              Nom du motif
            </label>
            <input
              type="text"
              value={local.nom}
              onChange={(e) => setLocal((m) => ({ ...m, nom: e.target.value }))}
              placeholder="Ex : Altercation, Malaise, Chute…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm
                placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                focus:border-blue-500/50 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              Description (optionnel)
            </label>
            <input
              type="text"
              value={local.description}
              onChange={(e) => setLocal((m) => ({ ...m, description: e.target.value }))}
              placeholder="Précision sur ce type d'incident…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm
                placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                focus:border-blue-500/50 transition-all"
            />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400
                hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-transparent
                hover:border-red-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !local.nom.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900
                disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-xl text-sm
                transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NiveauItem ───────────────────────────────────────────────────────────────

function NiveauItem({
  niveau, index, onSave, onDelete, saving,
}: {
  niveau: Niveau;
  index: number;
  onSave: (n: Niveau) => Promise<void>;
  onDelete: () => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<Niveau>(niveau);
  const color = getColor(index);

  useEffect(() => { setLocal(niveau); }, [niveau]);

  async function handleSave() {
    await onSave(local);
    setOpen(false);
  }

  return (
    <div className={`border rounded-xl overflow-hidden ${color.bg} ${color.border}`}>
      <div
        className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span className={`text-xs font-bold w-5 text-center shrink-0 ${color.text}`}>{index + 1}</span>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium leading-tight truncate">
              {niveau.label || <span className="text-slate-600 italic">Sans libellé</span>}
            </p>
            {!open && niveau.description && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{niveau.description}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700
            hover:border-slate-600 transition-all shrink-0"
        >
          {open ? 'Réduire' : 'Modifier'}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-700/50 bg-slate-900/60 px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                Libellé du niveau
              </label>
              <input
                type="text"
                value={local.label}
                onChange={(e) => setLocal((n) => ({ ...n, label: e.target.value }))}
                placeholder="Ex : Critique, Alerte, Niveau 3…"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm
                  placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                  focus:border-blue-500/50 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                Description (optionnel)
              </label>
              <input
                type="text"
                value={local.description}
                onChange={(e) => setLocal((n) => ({ ...n, description: e.target.value }))}
                placeholder="Ex : Tension verbale légère…"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm
                  placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                  focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400
                hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-transparent
                hover:border-red-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !local.label.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900
                disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-xl text-sm
                transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MotifsPage ───────────────────────────────────────────────────────────────

export default function MotifsPage() {
  const { session, signOut, isSuperAdmin, hasAdminAccess } = useAuth();
  const { id: etablissementId, loading: etabLoading } = useEntreprise();
  const navigate = useNavigate();

  const [motifs, setMotifs]       = useState<Motif[]>([]);
  const [motifsSsi, setMotifsSsi] = useState<Motif[]>([]);
  const [niveaux, setNiveaux]     = useState<Niveau[]>([]);
  const [loading, setLoading]     = useState(true);
  const [savingMotif,    setSavingMotif]    = useState(false);
  const [savingMotifSsi, setSavingMotifSsi] = useState(false);
  const [savingNiveau,   setSavingNiveau]   = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const [openMotifs,    setOpenMotifs]    = useState(true);
  const [openMotifsSsi, setOpenMotifsSsi] = useState(true);
  const [openNiveaux,   setOpenNiveaux]   = useState(true);

  useEffect(() => {
    if (!session)        { navigate('/'); return; }
    if (!hasAdminAccess) { navigate('/mobile'); return; }
    if (etabLoading)     return;
    fetchAll();
  }, [session, isSuperAdmin, etabLoading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: motifsData }, { data: motifsSsiData }, { data: niveauxData }] = await Promise.all([
      (etablissementId
        ? supabase.from('motifs').select('*').eq('etablissement_id', etablissementId)
        : supabase.from('motifs').select('*')
      ).order('ordre', { ascending: true }),
      (etablissementId
        ? supabase.from('motifs_ssi').select('*').eq('etablissement_id', etablissementId)
        : supabase.from('motifs_ssi').select('*')
      ).order('ordre', { ascending: true }),
      (etablissementId
        ? supabase.from('niveaux_intervention').select('*').eq('etablissement_id', etablissementId)
        : supabase.from('niveaux_intervention').select('*')
      ).order('ordre', { ascending: true }),
    ]);
    setMotifs((motifsData ?? []).map((m) => ({
      id: m.id, nom: m.nom, description: m.description, ordre: m.ordre,
    })));
    setMotifsSsi((motifsSsiData ?? []).map((m) => ({
      id: m.id, nom: m.nom, description: m.description, ordre: m.ordre,
    })));
    setNiveaux((niveauxData ?? []).map((n) => ({
      id: n.id, label: n.label, description: n.description, ordre: n.ordre,
    })));
    setLoading(false);
  }

  // ── Motifs CRUD ────────────────────────────────────────────────────────────

  async function addMotif() {
    if (!etablissementId) return;
    const ordre = motifs.length;
    const { data, error } = await supabase
      .from('motifs').insert({ nom: '', description: '', ordre, etablissement_id: etablissementId })
      .select('*').single();
    if (error || !data) { setToast({ type: 'error', text: 'Erreur lors de la création.' }); return; }
    setMotifs((prev) => [...prev, { id: data.id, nom: data.nom, description: data.description, ordre: data.ordre }]);
  }

  async function saveMotif(updated: Motif) {
    setSavingMotif(true);
    const { error } = await supabase
      .from('motifs')
      .update({ nom: updated.nom.trim(), description: updated.description.trim(), ordre: updated.ordre })
      .eq('id', updated.id);
    setSavingMotif(false);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }
    setMotifs((prev) => prev.map((m) => m.id === updated.id ? { ...updated } : m));
    setToast({ type: 'success', text: 'Motif enregistré.' });
  }

  async function deleteMotif(id: string) {
    const { error } = await supabase.from('motifs').delete().eq('id', id);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la suppression.' }); return; }
    setMotifs((prev) => prev.filter((m) => m.id !== id));
    setToast({ type: 'success', text: 'Motif supprimé.' });
  }

  // ── Motifs SSI CRUD ────────────────────────────────────────────────────────

  async function addMotifSsi() {
    if (!etablissementId) return;
    const ordre = motifsSsi.length;
    const { data, error } = await supabase
      .from('motifs_ssi').insert({ nom: '', description: '', ordre, etablissement_id: etablissementId })
      .select('*').single();
    if (error || !data) { setToast({ type: 'error', text: 'Erreur lors de la création.' }); return; }
    setMotifsSsi((prev) => [...prev, { id: data.id, nom: data.nom, description: data.description, ordre: data.ordre }]);
  }

  async function saveMotifSsi(updated: Motif) {
    setSavingMotifSsi(true);
    const { error } = await supabase
      .from('motifs_ssi')
      .update({ nom: updated.nom.trim(), description: updated.description.trim(), ordre: updated.ordre })
      .eq('id', updated.id);
    setSavingMotifSsi(false);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }
    setMotifsSsi((prev) => prev.map((m) => m.id === updated.id ? { ...updated } : m));
    setToast({ type: 'success', text: 'Motif SSI enregistré.' });
  }

  async function deleteMotifSsi(id: string) {
    const { error } = await supabase.from('motifs_ssi').delete().eq('id', id);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la suppression.' }); return; }
    setMotifsSsi((prev) => prev.filter((m) => m.id !== id));
    setToast({ type: 'success', text: 'Motif SSI supprimé.' });
  }

  // ── Niveaux CRUD ───────────────────────────────────────────────────────────

  async function addNiveau() {
    if (!etablissementId) return;
    const ordre = niveaux.length;
    const { data, error } = await supabase
      .from('niveaux_intervention').insert({ label: '', description: '', ordre, etablissement_id: etablissementId })
      .select('*').single();
    if (error || !data) { setToast({ type: 'error', text: 'Erreur lors de la création.' }); return; }
    setNiveaux((prev) => [...prev, { id: data.id, label: data.label, description: data.description, ordre: data.ordre }]);
  }

  async function saveNiveau(updated: Niveau) {
    setSavingNiveau(true);
    const { error } = await supabase
      .from('niveaux_intervention')
      .update({ label: updated.label.trim(), description: updated.description.trim(), ordre: updated.ordre })
      .eq('id', updated.id);
    setSavingNiveau(false);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }
    setNiveaux((prev) => prev.map((n) => n.id === updated.id ? { ...updated } : n));
    setToast({ type: 'success', text: 'Niveau enregistré.' });
  }

  async function deleteNiveau(id: string) {
    const { error } = await supabase.from('niveaux_intervention').delete().eq('id', id);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la suppression.' }); return; }
    setNiveaux((prev) => prev.filter((n) => n.id !== id));
    setToast({ type: 'success', text: 'Niveau supprimé.' });
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={handleSignOut} />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl
          shadow-2xl border text-sm font-medium
          ${toast.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-700/50 text-emerald-300'
            : 'bg-red-900/90 border-red-700/50 text-red-300'}`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.text}
        </div>
      )}

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
          <div className="space-y-6">

            {/* Page header */}
            <div className="mb-2">
              <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-blue-400" />
                Motifs &amp; Graduations
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Configurez indépendamment les types d'incidents et les niveaux de gravité
              </p>
            </div>

            {/* ── Conteneur Motifs ─────────────────────────────────────────── */}
            <CollapseCard
              accentFrom="from-blue-600"
              accentTo="to-cyan-500"
              icon={
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20
                  flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
              }
              title="Motifs d'intervention"
              subtitle={`${motifs.length} motif${motifs.length !== 1 ? 's' : ''} configuré${motifs.length !== 1 ? 's' : ''}`}
              open={openMotifs}
              onToggle={() => setOpenMotifs((v) => !v)}
              preview={
                <p className="text-xs text-slate-500 mt-0.5">
                  {motifs.length === 0
                    ? 'Aucun motif'
                    : motifs.map((m) => m.nom || 'Sans titre').join(', ')}
                </p>
              }
            >
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Définissez les types d'incidents liés à la sécurité des personnes
                (ex&nbsp;: Altercation, Malaise, Chute…). Chaque motif est combinable
                librement avec n'importe quel niveau de graduation.
              </p>

              <div className="space-y-2">
                {motifs.length === 0 && (
                  <div className="text-center py-8 text-slate-600">
                    <FileText className="w-9 h-9 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">Aucun motif configuré</p>
                  </div>
                )}
                {motifs.map((motif) => (
                  <MotifItem
                    key={motif.id}
                    motif={motif}
                    onSave={saveMotif}
                    onDelete={() => deleteMotif(motif.id)}
                    saving={savingMotif}
                  />
                ))}
                <button
                  type="button"
                  onClick={addMotif}
                  className="w-full flex items-center justify-center gap-2 border border-dashed
                    border-slate-700 hover:border-blue-500/50 rounded-xl py-3 text-sm font-medium
                    text-slate-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all mt-1"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un motif
                </button>
              </div>
            </CollapseCard>

            {/* ── Conteneur Motifs SSI ─────────────────────────────────────── */}
            <CollapseCard
              accentFrom="from-red-600"
              accentTo="to-orange-500"
              icon={
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20
                  flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
                      fill="url(#flammeMotifGrad)" />
                    <defs>
                      <linearGradient id="flammeMotifGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="60%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#dc2626" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              }
              title="Motifs d'intervention SSI"
              subtitle={`${motifsSsi.length} motif${motifsSsi.length !== 1 ? 's' : ''} SSI configuré${motifsSsi.length !== 1 ? 's' : ''}`}
              open={openMotifsSsi}
              onToggle={() => setOpenMotifsSsi((v) => !v)}
              preview={
                <p className="text-xs text-slate-500 mt-0.5">
                  {motifsSsi.length === 0
                    ? 'Aucun motif SSI'
                    : motifsSsi.map((m) => m.nom || 'Sans titre').join(', ')}
                </p>
              }
            >
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Définissez les types d'incidents liés à la sécurité incendie
                (ex&nbsp;: Déclenchement alarme, Départ de feu, Évacuation…).
              </p>

              <div className="space-y-2">
                {motifsSsi.length === 0 && (
                  <div className="text-center py-8 text-slate-600">
                    <Flame className="w-9 h-9 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">Aucun motif SSI configuré</p>
                  </div>
                )}
                {motifsSsi.map((motif) => (
                  <MotifItem
                    key={motif.id}
                    motif={motif}
                    onSave={saveMotifSsi}
                    onDelete={() => deleteMotifSsi(motif.id)}
                    saving={savingMotifSsi}
                  />
                ))}
                <button
                  type="button"
                  onClick={addMotifSsi}
                  className="w-full flex items-center justify-center gap-2 border border-dashed
                    border-slate-700 hover:border-red-500/50 rounded-xl py-3 text-sm font-medium
                    text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all mt-1"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un motif SSI
                </button>
              </div>
            </CollapseCard>

            {/* ── Conteneur Graduation ─────────────────────────────────────── */}
            <CollapseCard
              accentFrom="from-orange-500"
              accentTo="to-red-500"
              icon={
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20
                  flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-orange-400" />
                </div>
              }
              title="Graduation de l'intervention"
              subtitle={`${niveaux.length} niveau${niveaux.length !== 1 ? 'x' : ''} configuré${niveaux.length !== 1 ? 's' : ''}`}
              open={openNiveaux}
              onToggle={() => setOpenNiveaux((v) => !v)}
              preview={
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {niveaux.slice(0, 6).map((n, i) => (
                    <span key={n.id}
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-md border
                        ${getColor(i).bg} ${getColor(i).border} ${getColor(i).text}`}
                    >
                      {n.label || `N${i + 1}`}
                    </span>
                  ))}
                  {niveaux.length > 6 && (
                    <span className="text-xs text-slate-500">+{niveaux.length - 6}</span>
                  )}
                  {niveaux.length === 0 && (
                    <span className="text-xs text-slate-600 italic">Aucun niveau</span>
                  )}
                </div>
              }
            >
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Définissez les niveaux de gravité utilisables pour tout incident
                (ex&nbsp;: Légère tension, Altercation avec menace, Bagarre physique…).
                Ces niveaux sont indépendants des motifs et combinables librement.
              </p>

              <div className="space-y-2">
                {niveaux.length === 0 && (
                  <div className="text-center py-8 text-slate-600">
                    <Layers className="w-9 h-9 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">Aucun niveau configuré</p>
                  </div>
                )}
                {niveaux.map((niveau, i) => (
                  <NiveauItem
                    key={niveau.id}
                    niveau={niveau}
                    index={i}
                    onSave={saveNiveau}
                    onDelete={() => deleteNiveau(niveau.id)}
                    saving={savingNiveau}
                  />
                ))}
                <button
                  type="button"
                  onClick={addNiveau}
                  className="w-full flex items-center justify-center gap-2 border border-dashed
                    border-slate-700 hover:border-orange-500/50 rounded-xl py-3 text-sm font-medium
                    text-slate-500 hover:text-orange-400 hover:bg-orange-500/5 transition-all mt-1"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un niveau
                </button>
              </div>
            </CollapseCard>

          </div>
        )}
      </main>
    </div>
  );
}
