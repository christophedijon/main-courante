import { useEffect, useRef, useState } from 'react';
import {
  ClipboardList, Upload, Eye, RefreshCw, History, X, ChevronDown, ChevronUp,
  Plus, Save, CheckCircle, AlertTriangle, Clock, Minus, FileText, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntreprise } from '../hooks/useEntreprise';
import AppHeader from '../components/AppHeader';

type RegistreItem = {
  id: string;
  installation: string;
  reference_reglementaire: string;
  organisme_verificateur: string;
  periodicite: string;
  applicable: boolean;
  date_verification: string | null;
  nom_verificateur: string;
  observations: string;
  observations_levees: string;
  rapport_url: string;
  updated_at: string;
};

type HistoriqueEntry = {
  id: string;
  registre_id: string;
  date_verification: string;
  nom_verificateur: string;
  rapport_url: string;
  observations: string;
  observations_levees: string;
  created_at: string;
};

type Statut = 'non_applicable' | 'non_planifie' | 'a_jour' | 'attention' | 'retard';

type DirtyItem = Partial<RegistreItem>;

function getNextDate(lastDate: string, periodicite: string): Date | null {
  if (!lastDate) return null;
  const d = new Date(lastDate);
  switch (periodicite.toLowerCase()) {
    case 'annuelle': d.setFullYear(d.getFullYear() + 1); break;
    case 'semestrielle': d.setMonth(d.getMonth() + 6); break;
    case 'triennale': d.setFullYear(d.getFullYear() + 3); break;
    case 'quinquennale': d.setFullYear(d.getFullYear() + 5); break;
    default: return null;
  }
  return d;
}

function getStatut(lastDate: string | null, periodicite: string, applicable: boolean): Statut {
  if (!applicable) return 'non_applicable';
  if (!lastDate) return 'non_planifie';
  const next = getNextDate(lastDate, periodicite);
  if (!next) return 'non_planifie';
  const diff = next.getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'retard';
  if (days < 90) return 'attention';
  return 'a_jour';
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PERIODE_COLORS: Record<string, string> = {
  annuelle: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  semestrielle: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  triennale: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  quinquennale: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

function StatutBadge({ statut, nextDate }: { statut: Statut; nextDate: Date | null }) {
  const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  switch (statut) {
    case 'non_applicable':
      return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-700/50 text-slate-400 border border-slate-600/30"><Minus className="w-3 h-3" />Sans objet</span>;
    case 'non_planifie':
      return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-600/30 text-slate-400 border border-slate-600/30"><Clock className="w-3 h-3" />Non planifié</span>;
    case 'a_jour':
      return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><CheckCircle className="w-3 h-3" />À jour</span>;
    case 'attention':
      return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30"><AlertTriangle className="w-3 h-3" />{daysLeft !== null ? `J-${daysLeft}` : '< 3 mois'}</span>;
    case 'retard':
      return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30"><AlertTriangle className="w-3 h-3" />En retard{daysLeft !== null ? ` (${Math.abs(daysLeft)}j)` : ''}</span>;
  }
}

function HistoriquePanel({ item, onClose }: { item: RegistreItem; onClose: () => void }) {
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('registre_historique')
      .select('*')
      .eq('registre_id', item.id)
      .order('date_verification', { ascending: false })
      .then(({ data }) => {
        setEntries((data ?? []) as HistoriqueEntry[]);
        setLoading(false);
      });
  }, [item.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-6 max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-[17px]">Historique</h3>
            <p className="text-slate-400 text-sm mt-0.5">{item.installation}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
        {!loading && entries.length === 0 && (
          <div className="text-center py-10">
            <History className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aucun historique disponible</p>
          </div>
        )}
        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-sm">{formatDate(e.date_verification)}</span>
                {e.rapport_url && (
                  <a href={e.rapport_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg transition-colors">
                    <FileText className="w-3 h-3" />Voir rapport
                  </a>
                )}
              </div>
              {e.nom_verificateur && <p className="text-slate-400 text-xs">Vérificateur : <span className="text-slate-300">{e.nom_verificateur}</span></p>}
              {e.observations && <p className="text-slate-400 text-xs">Observations : <span className="text-slate-300">{e.observations}</span></p>}
              {e.observations_levees && <p className="text-xs text-emerald-400">Levée : {e.observations_levees}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type AddModalProps = { onClose: () => void; onAdded: (item: RegistreItem) => void };

function AddModal({ onClose, onAdded }: AddModalProps) {
  const [form, setForm] = useState({ installation: '', reference_reglementaire: '', organisme_verificateur: '', periodicite: 'Annuelle' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.installation.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('registre_securite').insert({ ...form, applicable: true }).select().single();
    if (!error && data) onAdded(data as RegistreItem);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">Nouvelle vérification</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Installation *</label>
            <input value={form.installation} onChange={(e) => setForm(f => ({ ...f, installation: e.target.value }))}
              className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Nom de l'installation" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Référence réglementaire</label>
            <input value={form.reference_reglementaire} onChange={(e) => setForm(f => ({ ...f, reference_reglementaire: e.target.value }))}
              className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="ex: MS 73" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Organisme vérificateur</label>
            <input value={form.organisme_verificateur} onChange={(e) => setForm(f => ({ ...f, organisme_verificateur: e.target.value }))}
              className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="ex: Technicien compétent" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Périodicité</label>
            <select value={form.periodicite} onChange={(e) => setForm(f => ({ ...f, periodicite: e.target.value }))}
              className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              {['Annuelle', 'Semestrielle', 'Triennale', 'Quinquennale'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !form.installation.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

type RowProps = {
  item: RegistreItem;
  onUpdate: (id: string, patch: Partial<RegistreItem>) => void;
  onSaved: (updated: RegistreItem) => void;
};

function RegistreRow({ item, onUpdate, onSaved }: RowProps) {
  const [dirty, setDirty] = useState<DirtyItem>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = { ...item, ...dirty };
  const isDirty = Object.keys(dirty).length > 0;

  const statut = getStatut(current.date_verification, current.periodicite, current.applicable);
  const nextDate = current.date_verification ? getNextDate(current.date_verification, current.periodicite) : null;

  function patch(field: keyof RegistreItem, value: any) {
    setDirty((d) => ({ ...d, [field]: value }));
  }

  async function handleToggleApplicable() {
    const newVal = !current.applicable;
    const { error } = await supabase.from('registre_securite').update({ applicable: newVal, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (!error) {
      setDirty({});
      onUpdate(item.id, { applicable: newVal });
    }
  }

  async function handleSave() {
    if (!isDirty) return;
    setSaving(true);

    // Archive si la date change
    if (dirty.date_verification && item.date_verification && dirty.date_verification !== item.date_verification) {
      await supabase.from('registre_historique').insert({
        registre_id: item.id,
        date_verification: item.date_verification,
        nom_verificateur: item.nom_verificateur,
        rapport_url: item.rapport_url,
        observations: item.observations,
        observations_levees: item.observations_levees,
      });
    }

    const { data, error } = await supabase
      .from('registre_securite')
      .update({ ...dirty, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .select()
      .single();

    setSaving(false);
    if (!error && data) {
      setDirty({});
      onSaved(data as RegistreItem);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    // Archive l'ancien rapport si présent
    if (item.rapport_url) {
      await supabase.from('registre_historique').insert({
        registre_id: item.id,
        date_verification: item.date_verification ?? new Date().toISOString().slice(0, 10),
        nom_verificateur: item.nom_verificateur,
        rapport_url: item.rapport_url,
        observations: item.observations,
        observations_levees: item.observations_levees,
      });
    }

    const ext = file.name.split('.').pop();
    const path = `${item.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('registre-securite').upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) { setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('registre-securite').getPublicUrl(path);
    const rapport_url = urlData.publicUrl;

    const { data, error } = await supabase.from('registre_securite').update({ rapport_url, updated_at: new Date().toISOString() }).eq('id', item.id).select().single();
    setUploading(false);
    if (!error && data) {
      setDirty((d) => { const nd = { ...d }; delete nd.rapport_url; return nd; });
      onSaved(data as RegistreItem);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  const rowOpacity = !current.applicable ? 'opacity-50' : '';

  return (
    <>
      <tr className={`border-b border-slate-800 hover:bg-slate-900/50 transition-colors ${rowOpacity}`}>
        {/* Applicable toggle */}
        <td className="px-3 py-3 text-center">
          <button type="button" onClick={handleToggleApplicable}
            className={`w-10 h-5 rounded-full transition-colors relative ${current.applicable ? 'bg-blue-600' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${current.applicable ? 'left-5' : 'left-0.5'}`} />
          </button>
        </td>

        {/* Installation */}
        <td className="px-3 py-3 min-w-[180px]">
          <p className="text-white text-sm font-medium leading-snug">{item.installation}</p>
        </td>

        {/* Référence */}
        <td className="px-3 py-3">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/30 whitespace-nowrap">
            {item.reference_reglementaire}
          </span>
        </td>

        {/* Organisme */}
        <td className="px-3 py-3 min-w-[140px]">
          <p className="text-slate-400 text-xs leading-snug">{item.organisme_verificateur}</p>
        </td>

        {/* Périodicité */}
        <td className="px-3 py-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border whitespace-nowrap ${PERIODE_COLORS[item.periodicite.toLowerCase()] ?? 'bg-slate-700/50 text-slate-300 border-slate-600/30'}`}>
            {item.periodicite}
          </span>
        </td>

        {/* Dernière vérification */}
        <td className="px-3 py-3 min-w-[140px]">
          <input
            type="date"
            value={current.date_verification ?? ''}
            onChange={(e) => patch('date_verification', e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-full"
          />
        </td>

        {/* Vérificateur */}
        <td className="px-3 py-3 min-w-[120px]">
          <input
            type="text"
            value={current.nom_verificateur}
            onChange={(e) => patch('nom_verificateur', e.target.value)}
            placeholder="Nom…"
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-full"
          />
        </td>

        {/* Prochaine vérification + statut */}
        <td className="px-3 py-3 min-w-[150px]">
          <div className="space-y-1">
            <StatutBadge statut={statut} nextDate={nextDate} />
            {nextDate && <p className="text-slate-500 text-[10px]">{nextDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>}
          </div>
        </td>

        {/* Observations */}
        <td className="px-3 py-3 min-w-[150px]">
          <textarea
            value={current.observations}
            onChange={(e) => patch('observations', e.target.value)}
            rows={2}
            placeholder="Observations…"
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-full resize-none"
          />
        </td>

        {/* Levée des observations */}
        <td className="px-3 py-3 min-w-[150px]">
          <textarea
            value={current.observations_levees}
            onChange={(e) => patch('observations_levees', e.target.value)}
            rows={2}
            placeholder="Levée des observations…"
            className={`border rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none w-full resize-none transition-colors ${current.observations_levees ? 'bg-emerald-950/40 border-emerald-700/40 focus:border-emerald-500' : 'bg-slate-800 border-slate-700 focus:border-blue-500'}`}
          />
        </td>

        {/* Rapport PDF */}
        <td className="px-3 py-3 min-w-[120px]">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileUpload} />
          <div className="flex flex-col gap-1.5">
            {current.rapport_url ? (
              <>
                <a href={current.rapport_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                  <Eye className="w-3 h-3" />Voir
                </a>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                  <RefreshCw className="w-3 h-3" />Remplacer
                </button>
              </>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Uploader
              </button>
            )}
          </div>
        </td>

        {/* Actions */}
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1.5">
            {isDirty && (
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 text-[11px] text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-semibold">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Enregistrer
              </button>
            )}
            <button type="button" onClick={() => setShowHistorique(true)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              <History className="w-3 h-3" />Historique
            </button>
          </div>
        </td>
      </tr>
      {showHistorique && <tr><td colSpan={12}></td></tr>}
      {showHistorique && <HistoriquePanel item={item} onClose={() => setShowHistorique(false)} />}
    </>
  );
}

export default function RegistreSecuritePage() {
  const { signOut } = useAuth();
  const { nom, logo_url } = useEntreprise();
  const [items, setItems] = useState<RegistreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [collapseNonApp, setCollapseNonApp] = useState(true);

  useEffect(() => {
    supabase
      .from('registre_securite')
      .select('*')
      .order('installation')
      .then(({ data }) => {
        setItems((data ?? []) as RegistreItem[]);
        setLoading(false);
      });
  }, []);

  function handleUpdate(id: string, patch: Partial<RegistreItem>) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));
  }

  function handleSaved(updated: RegistreItem) {
    setItems((prev) => prev.map((it) => it.id === updated.id ? updated : it));
  }

  const lastUpdated = items.reduce<string | null>((acc, it) => {
    if (!acc || it.updated_at > acc) return it.updated_at;
    return acc;
  }, null);

  const applicable = items.filter((it) => it.applicable);
  const nonApplicable = items.filter((it) => !it.applicable);

  const retard = applicable.filter((it) => getStatut(it.date_verification, it.periodicite, it.applicable) === 'retard').length;
  const attention = applicable.filter((it) => getStatut(it.date_verification, it.periodicite, it.applicable) === 'attention').length;
  const aJour = applicable.filter((it) => getStatut(it.date_verification, it.periodicite, it.applicable) === 'a_jour').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AppHeader onSignOut={signOut} />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">Registre de sécurité</h1>
              <div className="flex items-center gap-3 mt-0.5">
                {logo_url && <img src={logo_url} alt="logo" className="h-5 w-auto object-contain rounded" />}
                {nom && <span className="text-slate-400 text-sm">{nom}</span>}
                {lastUpdated && (
                  <span className="text-slate-600 text-xs">· Mis à jour le {new Date(lastUpdated).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />Ajouter une vérification
          </button>
        </div>

        {/* Summary badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'En retard', count: retard, color: 'red' },
            { label: 'À planifier', count: attention, color: 'amber' },
            { label: 'À jour', count: aJour, color: 'emerald' },
            { label: 'Sans objet', count: nonApplicable.length, color: 'slate' },
          ].map(({ label, count, color }) => (
            <div key={label} className={`rounded-2xl bg-slate-900 border border-slate-800 p-4`}>
              <p className={`text-3xl font-black ${color === 'red' ? 'text-red-400' : color === 'amber' ? 'text-amber-400' : color === 'emerald' ? 'text-emerald-400' : 'text-slate-400'}`}>{count}</p>
              <p className="text-slate-500 text-sm mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {loading && <p className="text-slate-500 text-sm text-center py-16">Chargement…</p>}

        {!loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/60 border-b border-slate-700">
                    {['Applic.', 'Installation', 'Référence', 'Organisme', 'Périodicité', 'Dernière vérif.', 'Vérificateur', 'Prochaine vérif.', 'Observations', 'Levée observations', 'Rapport PDF', 'Actions'].map((h) => (
                      <th key={h} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {applicable.map((item) => (
                    <RegistreRow key={item.id} item={item} onUpdate={handleUpdate} onSaved={handleSaved} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Non applicables — repliables */}
            {nonApplicable.length > 0 && (
              <div className="border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCollapseNonApp((v) => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-colors text-sm font-medium"
                >
                  {collapseNonApp ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  {nonApplicable.length} installation(s) sans objet
                </button>
                {!collapseNonApp && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {nonApplicable.map((item) => (
                          <RegistreRow key={item.id} item={item} onUpdate={handleUpdate} onSaved={handleSaved} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onAdded={(item) => { setItems((prev) => [...prev, item]); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}
