import { useEffect, useState, useCallback } from 'react';
import {
  Radio, Plus, Pencil, Trash2, Star, ToggleLeft, ToggleRight,
  Shuffle, List, Clock, ChevronDown, GripVertical, X, Save,
  Loader2, CheckCircle, AlertTriangle, Info, Download, User,
  ChevronRight, MapPin,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

// ─── Types ───────────────────────────────────────────────────────────────────

type Zone = { id: string; nom: string; espace_nom: string };
type Beacon = {
  id: string; nom: string; description: string;
  minor: number; major: number; uuid_beacon: string;
  mac: string; rssi_seuil: number; is_entree: boolean;
  actif: boolean; zone_id: string | null; zone_label?: string;
  created_at: string;
};
type RondeConfig = {
  id: string; nom: string; heure_prevue: string | null;
  mode: 'aleatoire' | 'defini'; actif: boolean; created_at: string;
  beacons?: BeaconInRonde[];
};
type BeaconInRonde = { id: string; beacon_id: string; nom: string; ordre: number };
type ToastMsg = { type: 'success' | 'error'; text: string };

// ─── RSSI helpers ─────────────────────────────────────────────────────────────

function rssiLabel(v: number) {
  if (v >= -55) return '1–3 m';
  if (v >= -65) return '3–6 m';
  if (v >= -75) return '6–10 m';
  if (v >= -85) return '10–15 m';
  return '> 15 m';
}
function rssiColor(v: number) {
  if (v >= -55) return 'text-emerald-400';
  if (v >= -65) return 'text-sky-400';
  if (v >= -75) return 'text-amber-400';
  if (v >= -85) return 'text-orange-400';
  return 'text-red-400';
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: ToastMsg; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
      ${msg.type === 'success' ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-700' : 'bg-red-900/90 text-red-200 border border-red-700'}`}>
      {msg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      {msg.text}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ text, onConfirm, onCancel }: { text: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <p className="text-slate-200 text-sm leading-relaxed mb-6">{text}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Annuler</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all">Supprimer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable beacon row (in ronde modal) ─────────────────────────────────────

function SortableBeaconRow({ item, onRemove }: { item: BeaconInRonde; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
        ${isDragging ? 'bg-slate-700 border-blue-500/50 shadow-lg z-10' : 'bg-slate-800 border-slate-700'}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="flex-1 text-sm text-slate-200">{item.nom}</span>
      <button onClick={() => onRemove(item.id)} className="text-slate-500 hover:text-red-400 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BaliseRondesPage() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<'balises' | 'rondes' | 'rapports'>('balises');
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const notify = useCallback((type: ToastMsg['type'], text: string) => setToast({ type, text }), []);

  async function handleSignOut() { await signOut(); }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AppHeader onSignOut={handleSignOut} />
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Radio className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Balises & Rondes</h1>
            <p className="text-sm text-slate-400">Gestion des balises BLE et des circuits de ronde</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 w-fit mb-8">
          {(['balises', 'rondes', 'rapports'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all
                ${tab === t ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
              {t === 'balises' ? 'Balises' : t === 'rondes' ? 'Rondes' : 'Rapports'}
            </button>
          ))}
        </div>

        {tab === 'balises' && <BaliseTab notify={notify} />}
        {tab === 'rondes' && <RondeTab notify={notify} />}
        {tab === 'rapports' && <RapportTab notify={notify} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — BALISES
// ═══════════════════════════════════════════════════════════════════════════════

function BaliseTab({ notify }: { notify: (t: ToastMsg['type'], msg: string) => void }) {
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Beacon | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: zonesRaw } = await supabase
      .from('zones')
      .select('id, nom, espace_id, espaces(nom)')
      .order('nom');
    const mappedZones: Zone[] = (zonesRaw ?? []).map((z: any) => ({
      id: z.id, nom: z.nom, espace_nom: z.espaces?.nom ?? '',
    }));
    setZones(mappedZones);

    const { data: raw } = await supabase
      .from('beacons')
      .select('*')
      .order('created_at', { ascending: false });
    const mapped: Beacon[] = (raw ?? []).map((b: any) => ({
      ...b,
      zone_label: b.zone_id ? (mappedZones.find(z => z.id === b.zone_id)?.espace_nom ?? '') + ' — ' + (mappedZones.find(z => z.id === b.zone_id)?.nom ?? '') : null,
    }));
    setBeacons(mapped);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActif(b: Beacon) {
    const { error } = await supabase.from('beacons').update({ actif: !b.actif }).eq('id', b.id);
    if (error) { notify('error', 'Erreur lors de la mise à jour'); return; }
    setBeacons(prev => prev.map(x => x.id === b.id ? { ...x, actif: !b.actif } : x));
  }

  async function deleteBeacon(id: string) {
    const { error } = await supabase.from('beacons').delete().eq('id', id);
    if (error) { notify('error', 'Erreur lors de la suppression'); return; }
    setBeacons(prev => prev.filter(b => b.id !== id));
    notify('success', 'Balise supprimée');
    setConfirmId(null);
  }

  return (
    <>
      {confirmId && (
        <ConfirmDialog
          text="Supprimer cette balise ? Cette action est irréversible."
          onConfirm={() => deleteBeacon(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
      {modalOpen && (
        <BeaconModal
          zones={zones}
          beacon={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); load(); notify('success', editing ? 'Balise modifiée' : 'Balise ajoutée'); }}
          notify={notify}
        />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-slate-400 text-sm">
          <span className="text-white font-semibold">{beacons.length}</span> balise{beacons.length !== 1 ? 's' : ''} configurée{beacons.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
          <Plus className="w-4 h-4" /> Ajouter une balise
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : beacons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Radio className="w-10 h-10 opacity-30" />
          <p className="text-sm">Aucune balise configurée</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {beacons.map(b => (
            <BeaconCard key={b.id} beacon={b}
              onToggle={() => toggleActif(b)}
              onEdit={() => { setEditing(b); setModalOpen(true); }}
              onDelete={() => setConfirmId(b.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Beacon Card ──────────────────────────────────────────────────────────────

function BeaconCard({ beacon: b, onToggle, onEdit, onDelete }: {
  beacon: Beacon; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className={`bg-slate-900 border rounded-2xl p-5 flex flex-col gap-4 transition-all
      ${b.actif ? 'border-slate-700 hover:border-slate-600' : 'border-slate-800 opacity-60'}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-sm truncate">{b.nom}</h3>
            {b.is_entree && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                <Star className="w-3 h-3" /> Pointage
              </span>
            )}
          </div>
          {b.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{b.description}</p>}
        </div>
        <button onClick={onToggle} className="shrink-0 transition-colors">
          {b.actif
            ? <ToggleRight className="w-6 h-6 text-blue-400" />
            : <ToggleLeft className="w-6 h-6 text-slate-600" />}
        </button>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-800/50 rounded-lg px-3 py-2">
          <p className="text-slate-500 mb-0.5">Minor / Major</p>
          <p className="text-slate-200 font-mono">{b.minor} / {b.major}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg px-3 py-2">
          <p className="text-slate-500 mb-0.5">RSSI seuil</p>
          <p className={`font-mono font-semibold ${rssiColor(b.rssi_seuil)}`}>{b.rssi_seuil} dBm <span className="font-normal text-slate-400">({rssiLabel(b.rssi_seuil)})</span></p>
        </div>
        {b.mac && (
          <div className="bg-slate-800/50 rounded-lg px-3 py-2 col-span-2">
            <p className="text-slate-500 mb-0.5">MAC</p>
            <p className="text-slate-200 font-mono">{b.mac}</p>
          </div>
        )}
        {b.zone_label && (
          <div className="bg-slate-800/50 rounded-lg px-3 py-2 col-span-2">
            <p className="text-slate-500 mb-0.5">Zone</p>
            <p className="text-slate-200">{b.zone_label}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1 border-t border-slate-800">
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all">
          <Pencil className="w-3.5 h-3.5" /> Modifier
        </button>
        <button onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
          <Trash2 className="w-3.5 h-3.5" /> Supprimer
        </button>
      </div>
    </div>
  );
}

// ─── Beacon Modal ─────────────────────────────────────────────────────────────

const DEFAULT_UUID = '426C7565-4368-6172-6D42-6561636F6E73';

function BeaconModal({ beacon, zones, onClose, onSaved, notify }: {
  beacon: Beacon | null; zones: Zone[];
  onClose: () => void; onSaved: () => void;
  notify: (t: ToastMsg['type'], msg: string) => void;
}) {
  const [nom, setNom] = useState(beacon?.nom ?? '');
  const [description, setDescription] = useState(beacon?.description ?? '');
  const [zoneId, setZoneId] = useState(beacon?.zone_id ?? '');
  const [minor, setMinor] = useState(beacon?.minor?.toString() ?? '');
  const [major, setMajor] = useState(beacon?.major?.toString() ?? '1');
  const [uuidBeacon, setUuidBeacon] = useState(beacon?.uuid_beacon ?? DEFAULT_UUID);
  const [mac, setMac] = useState(beacon?.mac ?? '');
  const [rssi, setRssi] = useState(beacon?.rssi_seuil ?? -72);
  const [isEntree, setIsEntree] = useState(beacon?.is_entree ?? false);
  const [actif, setActif] = useState(beacon?.actif ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!nom.trim() || !minor.trim()) { notify('error', 'Nom et Minor sont requis'); return; }
    setSaving(true);
    const payload = {
      nom: nom.trim(), description: description.trim(),
      zone_id: zoneId || null, minor: parseInt(minor), major: parseInt(major) || 1,
      uuid_beacon: uuidBeacon.trim() || DEFAULT_UUID, mac: mac.trim() || null,
      rssi_seuil: rssi, is_entree: isEntree, actif,
    };

    if (isEntree) {
      await supabase.from('beacons').update({ is_entree: false }).neq('id', beacon?.id ?? '');
    }

    const { error } = beacon
      ? await supabase.from('beacons').update(payload).eq('id', beacon.id)
      : await supabase.from('beacons').insert(payload);

    setSaving(false);
    if (error) { notify('error', 'Erreur lors de la sauvegarde'); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-white font-semibold">{beacon ? 'Modifier la balise' : 'Ajouter une balise'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nom <span className="text-red-400">*</span></label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Balise entrée principale"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Description optionnelle"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
          </div>

          {/* Zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Zone</label>
            <div className="relative">
              <select value={zoneId} onChange={e => setZoneId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none pr-9">
                <option value="">— Aucune zone —</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>{z.espace_nom} — {z.nom}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Minor / Major */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Minor <span className="text-red-400">*</span></label>
              <input value={minor} onChange={e => setMinor(e.target.value)} type="number" min={0} placeholder="Ex: 42"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Major</label>
              <input value={major} onChange={e => setMajor(e.target.value)} type="number" min={0} placeholder="1"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>

          {/* UUID */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">UUID Beacon</label>
            <input value={uuidBeacon} onChange={e => setUuidBeacon(e.target.value)} placeholder={DEFAULT_UUID}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          {/* MAC */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Adresse MAC</label>
            <input value={mac} onChange={e => setMac(e.target.value)} placeholder="Ex: AA:BB:CC:DD:EE:FF"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          {/* RSSI Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400">Seuil RSSI de détection</label>
              <span className={`text-sm font-bold font-mono ${rssiColor(rssi)}`}>{rssi} dBm — {rssiLabel(rssi)}</span>
            </div>
            <input type="range" min={-100} max={0} value={rssi} onChange={e => setRssi(parseInt(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-slate-700 accent-blue-500 cursor-pointer" />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>-100 dBm (loin)</span><span>0 dBm (proche)</span>
            </div>
          </div>

          {/* is_entree */}
          <label className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl cursor-pointer hover:bg-amber-500/10 transition-all">
            <input type="checkbox" checked={isEntree} onChange={e => setIsEntree(e.target.checked)}
              className="mt-0.5 accent-amber-500 w-4 h-4" />
            <div>
              <p className="text-sm font-semibold text-amber-300 flex items-center gap-1.5"><Star className="w-4 h-4" /> Balise de pointage</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Le 1er passage enregistré marque l'heure de prise de poste de l'agent. Une seule balise peut avoir ce rôle.</p>
            </div>
          </label>

          {/* Actif */}
          <label className="flex items-center justify-between p-4 bg-slate-800 rounded-xl cursor-pointer">
            <span className="text-sm font-medium text-slate-200">Balise active</span>
            <button type="button" onClick={() => setActif(v => !v)}>
              {actif ? <ToggleRight className="w-7 h-7 text-blue-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
            </button>
          </label>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Annuler</button>
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {beacon ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — RONDES
// ═══════════════════════════════════════════════════════════════════════════════

function RondeTab({ notify }: { notify: (t: ToastMsg['type'], msg: string) => void }) {
  const [rondeMode, setRondeMode] = useState<'aleatoire' | 'defini'>('aleatoire');
  const [rondes, setRondes] = useState<RondeConfig[]>([]);
  const [beacons, setBeacons] = useState<Pick<Beacon, 'id' | 'nom'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RondeConfig | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: ent }, { data: rondesRaw }, { data: beaconsRaw }] = await Promise.all([
      supabase.from('entreprise').select('ronde_mode').maybeSingle(),
      supabase.from('rondes_config').select('*').order('created_at'),
      supabase.from('beacons').select('id, nom').eq('actif', true).order('nom'),
    ]);
    setRondeMode((ent?.ronde_mode as 'aleatoire' | 'defini') ?? 'aleatoire');
    setBeacons(beaconsRaw ?? []);

    // load balises per ronde
    const ids = (rondesRaw ?? []).map((r: any) => r.id);
    let balisesByRonde: Record<string, BeaconInRonde[]> = {};
    if (ids.length > 0) {
      const { data: rcb } = await supabase
        .from('rondes_config_balises')
        .select('id, ronde_config_id, beacon_id, ordre, beacons(nom)')
        .in('ronde_config_id', ids)
        .order('ordre');
      for (const row of (rcb ?? []) as any[]) {
        if (!balisesByRonde[row.ronde_config_id]) balisesByRonde[row.ronde_config_id] = [];
        balisesByRonde[row.ronde_config_id].push({ id: row.id, beacon_id: row.beacon_id, nom: row.beacons?.nom ?? '', ordre: row.ordre });
      }
    }
    setRondes((rondesRaw ?? []).map((r: any) => ({ ...r, beacons: balisesByRonde[r.id] ?? [] })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function switchMode(mode: 'aleatoire' | 'defini') {
    setSavingMode(true);
    const { error } = await supabase.from('entreprise').update({ ronde_mode: mode }).not('id', 'is', null);
    setSavingMode(false);
    if (error) { notify('error', 'Erreur lors de la mise à jour'); return; }
    setRondeMode(mode);
  }

  async function toggleRondeActif(r: RondeConfig) {
    const { error } = await supabase.from('rondes_config').update({ actif: !r.actif }).eq('id', r.id);
    if (error) { notify('error', 'Erreur'); return; }
    setRondes(prev => prev.map(x => x.id === r.id ? { ...x, actif: !r.actif } : x));
  }

  async function deleteRonde(id: string) {
    const { error } = await supabase.from('rondes_config').delete().eq('id', id);
    if (error) { notify('error', 'Erreur lors de la suppression'); return; }
    setRondes(prev => prev.filter(r => r.id !== id));
    notify('success', 'Ronde supprimée');
    setConfirmId(null);
  }

  return (
    <>
      {confirmId && (
        <ConfirmDialog
          text="Supprimer cette ronde ? Les passages associés ne seront pas supprimés."
          onConfirm={() => deleteRonde(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
      {modalOpen && (
        <RondeModal
          ronde={editing}
          beacons={beacons}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); load(); notify('success', editing ? 'Ronde modifiée' : 'Ronde créée'); }}
          notify={notify}
        />
      )}

      {/* Mode toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Mode de ronde</p>
        <div className="flex gap-2">
          <button
            onClick={() => switchMode('aleatoire')}
            disabled={savingMode}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all
              ${rondeMode === 'aleatoire' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            <Shuffle className="w-4 h-4" /> Aléatoire
          </button>
          <button
            onClick={() => switchMode('defini')}
            disabled={savingMode}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all
              ${rondeMode === 'defini' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            <List className="w-4 h-4" /> Définir
          </button>
        </div>
      </div>

      {rondeMode === 'aleatoire' ? (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 flex gap-4 items-start">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-300 font-semibold text-sm mb-1">Mode aléatoire activé</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Les agents effectuent leurs passages dans n'importe quel ordre, sans circuit prédéfini.
              Tous les passages sont enregistrés et consultables dans l'onglet Rapports.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-slate-400 text-sm">
              <span className="text-white font-semibold">{rondes.length}</span> ronde{rondes.length !== 1 ? 's' : ''} configurée{rondes.length !== 1 ? 's' : ''}
            </p>
            <button onClick={() => { setEditing(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
              <Plus className="w-4 h-4" /> Nouvelle ronde
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : rondes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <List className="w-10 h-10 opacity-30" />
              <p className="text-sm">Aucune ronde configurée</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rondes.map(r => (
                <RondeCard key={r.id} ronde={r}
                  onToggle={() => toggleRondeActif(r)}
                  onEdit={() => { setEditing(r); setModalOpen(true); }}
                  onDelete={() => setConfirmId(r.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── Ronde Card ───────────────────────────────────────────────────────────────

function RondeCard({ ronde: r, onToggle, onEdit, onDelete }: {
  ronde: RondeConfig; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className={`bg-slate-900 border rounded-2xl p-5 flex flex-col gap-4 transition-all
      ${r.actif ? 'border-slate-700 hover:border-slate-600' : 'border-slate-800 opacity-60'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-white font-semibold text-sm">{r.nom}</h3>
          {r.heure_prevue && (
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
              <Clock className="w-3.5 h-3.5" />
              {r.heure_prevue.slice(0, 5)}
            </div>
          )}
        </div>
        <button onClick={onToggle} className="shrink-0">
          {r.actif
            ? <ToggleRight className="w-6 h-6 text-blue-400" />
            : <ToggleLeft className="w-6 h-6 text-slate-600" />}
        </button>
      </div>

      {/* Beacon list */}
      {r.beacons && r.beacons.length > 0 ? (
        <div className="flex flex-col gap-1">
          {r.beacons.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2 text-xs text-slate-300">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-500 font-bold shrink-0">{i + 1}</span>
              {b.nom}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic">Aucune balise assignée</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-slate-800">
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all">
          <Pencil className="w-3.5 h-3.5" /> Modifier
        </button>
        <button onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
          <Trash2 className="w-3.5 h-3.5" /> Supprimer
        </button>
      </div>
    </div>
  );
}

// ─── Ronde Modal ──────────────────────────────────────────────────────────────

function RondeModal({ ronde, beacons, onClose, onSaved, notify }: {
  ronde: RondeConfig | null;
  beacons: Pick<Beacon, 'id' | 'nom'>[];
  onClose: () => void; onSaved: () => void;
  notify: (t: ToastMsg['type'], msg: string) => void;
}) {
  const [nom, setNom] = useState(ronde?.nom ?? '');
  const [heure, setHeure] = useState(ronde?.heure_prevue?.slice(0, 5) ?? '');
  const [actif, setActif] = useState(ronde?.actif ?? true);
  const [assigned, setAssigned] = useState<BeaconInRonde[]>(
    ronde?.beacons?.map(b => ({ ...b })) ?? []
  );
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const availableBeacons = beacons.filter(b => !assigned.find(a => a.beacon_id === b.id));

  function addBeacon(b: Pick<Beacon, 'id' | 'nom'>) {
    setAssigned(prev => [...prev, { id: `tmp-${b.id}`, beacon_id: b.id, nom: b.nom, ordre: prev.length + 1 }]);
  }

  function removeBeacon(id: string) {
    setAssigned(prev => prev.filter(b => b.id !== id).map((b, i) => ({ ...b, ordre: i + 1 })));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setAssigned(prev => {
      const oldIndex = prev.findIndex(b => b.id === active.id);
      const newIndex = prev.findIndex(b => b.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((b, i) => ({ ...b, ordre: i + 1 }));
    });
  }

  async function save() {
    if (!nom.trim()) { notify('error', 'Le nom est requis'); return; }
    setSaving(true);

    const payload = { nom: nom.trim(), heure_prevue: heure || null, actif };
    let rondeId = ronde?.id;

    if (ronde) {
      const { error } = await supabase.from('rondes_config').update(payload).eq('id', ronde.id);
      if (error) { notify('error', 'Erreur lors de la mise à jour'); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('rondes_config').insert(payload).select().single();
      if (error || !data) { notify('error', 'Erreur lors de la création'); setSaving(false); return; }
      rondeId = data.id;
    }

    // rebuild balises
    await supabase.from('rondes_config_balises').delete().eq('ronde_config_id', rondeId!);
    if (assigned.length > 0) {
      const rows = assigned.map((b, i) => ({ ronde_config_id: rondeId!, beacon_id: b.beacon_id, ordre: i + 1 }));
      const { error } = await supabase.from('rondes_config_balises').insert(rows);
      if (error) { notify('error', 'Erreur lors de la sauvegarde des balises'); setSaving(false); return; }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-white font-semibold">{ronde ? 'Modifier la ronde' : 'Nouvelle ronde'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nom <span className="text-red-400">*</span></label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Ronde de nuit principale"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          {/* Heure prévue */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Heure prévue</label>
            <input type="time" value={heure} onChange={e => setHeure(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
          </div>

          {/* Actif */}
          <label className="flex items-center justify-between p-4 bg-slate-800 rounded-xl cursor-pointer">
            <span className="text-sm font-medium text-slate-200">Ronde active</span>
            <button type="button" onClick={() => setActif(v => !v)}>
              {actif ? <ToggleRight className="w-7 h-7 text-blue-400" /> : <ToggleLeft className="w-7 h-7 text-slate-600" />}
            </button>
          </label>

          {/* Beacon assignment */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-3">Balises du circuit</label>

            {/* Assigned list (sortable) */}
            {assigned.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={assigned.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2 mb-4">
                    {assigned.map(b => (
                      <SortableBeaconRow key={b.id} item={b} onRemove={removeBeacon} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Available beacons */}
            {availableBeacons.length > 0 ? (
              <div>
                <p className="text-xs text-slate-500 mb-2">Ajouter des balises :</p>
                <div className="flex flex-wrap gap-2">
                  {availableBeacons.map(b => (
                    <button key={b.id} onClick={() => addBeacon(b)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-blue-500 transition-all">
                      <Plus className="w-3.5 h-3.5" /> {b.nom}
                    </button>
                  ))}
                </div>
              </div>
            ) : assigned.length > 0 ? (
              <p className="text-xs text-slate-600 italic">Toutes les balises actives sont dans ce circuit.</p>
            ) : (
              <p className="text-xs text-slate-600 italic">Aucune balise active disponible.</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Annuler</button>
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {ronde ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — RAPPORTS
// ═══════════════════════════════════════════════════════════════════════════════

type AgentOption = { id: string; email: string; label: string };

type PassageRow = {
  beacon_id: string;
  beacon_nom: string;
  zone_nom: string | null;
  count: number;
  last_ts: string;
};

type AgentRapport = {
  agent_id: string;
  agent_label: string;
  prise_de_poste: string | null;
  passages: PassageRow[];
  chronologie: { ts: string; beacon_nom: string; zone_nom: string | null }[];
};

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function RapportTab({ notify }: { notify: (t: ToastMsg['type'], msg: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [loading, setLoading] = useState(false);
  const [rapports, setRapports] = useState<AgentRapport[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('managed_users')
        .select('id, email, fonction')
        .order('email');
      setAgents((data ?? []).map((u: any) => ({ id: u.id, email: u.email, label: `${u.email} (${u.fonction})` })));
    })();
  }, []);

  async function load() {
    setLoading(true);
    setRapports([]);

    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    let query = supabase
      .from('rondes_passages')
      .select('agent_id, beacon_id, rssi, timestamp, beacons(nom, is_entree, zone_id, zones(nom)), managed_users(id, email, fonction)')
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: true });

    if (selectedAgent) query = query.eq('agent_id', selectedAgent);

    const { data: rows, error } = await query;
    if (error) { notify('error', 'Erreur lors du chargement des rapports'); setLoading(false); return; }

    const byAgent = new Map<string, any[]>();
    for (const row of (rows ?? []) as any[]) {
      if (!byAgent.has(row.agent_id)) byAgent.set(row.agent_id, []);
      byAgent.get(row.agent_id)!.push(row);
    }

    const agentIds = [...byAgent.keys()];
    const priseMap = new Map<string, string>();
    if (agentIds.length > 0) {
      const { data: rr } = await supabase
        .from('rondes_rapports')
        .select('agent_id, heure_prise_poste')
        .in('agent_id', agentIds)
        .eq('date_nuit', date);
      for (const r of (rr ?? []) as any[]) {
        if (r.heure_prise_poste) priseMap.set(r.agent_id, r.heure_prise_poste);
      }
    }

    const result: AgentRapport[] = [];
    for (const [agentId, agentRows] of byAgent.entries()) {
      const firstRow = agentRows[0];
      const mu = firstRow.managed_users as any;
      const agentLabel = mu?.email ?? agentId;

      const entrieTs = agentRows
        .filter((r: any) => r.beacons?.is_entree)
        .map((r: any) => r.timestamp as string);
      const priseDePoste = priseMap.get(agentId) ?? (entrieTs.length > 0 ? entrieTs.sort()[0] : null);

      const beaconMap = new Map<string, PassageRow>();
      for (const row of agentRows) {
        const b = row.beacons as any;
        if (!b) continue;
        const bid = row.beacon_id;
        if (!beaconMap.has(bid)) {
          beaconMap.set(bid, { beacon_id: bid, beacon_nom: b.nom ?? bid, zone_nom: b.zones?.nom ?? null, count: 0, last_ts: row.timestamp });
        }
        const pr = beaconMap.get(bid)!;
        pr.count++;
        if (row.timestamp > pr.last_ts) pr.last_ts = row.timestamp;
      }

      const chronologie = agentRows.map((r: any) => ({
        ts: r.timestamp,
        beacon_nom: r.beacons?.nom ?? r.beacon_id,
        zone_nom: r.beacons?.zones?.nom ?? null,
      }));

      result.push({
        agent_id: agentId,
        agent_label: agentLabel,
        prise_de_poste: priseDePoste,
        passages: [...beaconMap.values()].sort((a, b) => a.beacon_nom.localeCompare(b.beacon_nom)),
        chronologie,
      });
    }

    setRapports(result);
    setLoading(false);
  }

  function toggleExpand(agentId: string) {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      next.has(agentId) ? next.delete(agentId) : next.add(agentId);
      return next;
    });
  }

  function exportCSV(rapport: AgentRapport) {
    const lines = [
      `Agent;${rapport.agent_label}`,
      `Date;${date}`,
      `Prise de poste;${rapport.prise_de_poste ? fmt(rapport.prise_de_poste) : '—'}`,
      '',
      'Balise;Zone;Passages;Dernier passage',
      ...rapport.passages.map(p => `${p.beacon_nom};${p.zone_nom ?? ''};${p.count};${fmt(p.last_ts)}`),
      '',
      'Chronologie',
      ...rapport.chronologie.map(c => `${fmt(c.ts)};${c.beacon_nom};${c.zone_nom ?? ''}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ronde_${date}_${rapport.agent_label.split('@')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end mb-6">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Agent (optionnel)</label>
          <div className="relative">
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none pr-9">
              <option value="">— Tous les agents —</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-all">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          Afficher
        </button>
      </div>

      {!loading && rapports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Radio className="w-10 h-10 opacity-30" />
          <p className="text-sm">Aucun passage enregistré pour cette nuit.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {rapports.map(rapport => {
          const isExpanded = expandedAgents.has(rapport.agent_id);
          const chrono = rapport.chronologie;
          const visible = isExpanded ? chrono : chrono.slice(0, 5);

          return (
            <div key={rapport.agent_id} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              {/* Agent header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{rapport.agent_label}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Prise de poste :{' '}
                      {rapport.prise_de_poste
                        ? <span className="text-emerald-400 font-semibold">{fmt(rapport.prise_de_poste)}</span>
                        : <span className="text-slate-600">—</span>}
                    </p>
                  </div>
                </div>
                <button onClick={() => exportCSV(rapport)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-700">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>

              <div className="p-5 flex flex-col gap-5">
                {/* Passage summary table */}
                {rapport.passages.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Résumé par balise</p>
                    <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Balise</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 hidden sm:table-cell">Zone</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-400">Passages</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-400">Dernier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rapport.passages.map(p => (
                            <tr key={p.beacon_id} className="border-b border-slate-700/50 last:border-0">
                              <td className="px-4 py-2.5 text-slate-200 font-medium">{p.beacon_nom}</td>
                              <td className="px-4 py-2.5 text-slate-400 hidden sm:table-cell">
                                {p.zone_nom
                                  ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.zone_nom}</span>
                                  : <span className="text-slate-600">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/15 text-blue-400 text-xs font-bold">{p.count}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-300 font-mono text-xs">{fmt(p.last_ts)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Chronologie */}
                {chrono.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Chronologie</p>
                    <div className="flex flex-col gap-1.5">
                      {visible.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-slate-500 font-mono text-xs w-12 shrink-0">{fmt(c.ts)}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                          <span className="text-slate-200">{c.beacon_nom}</span>
                          {c.zone_nom && <span className="text-slate-500 text-xs">({c.zone_nom})</span>}
                        </div>
                      ))}
                    </div>
                    {chrono.length > 5 && (
                      <button onClick={() => toggleExpand(rapport.agent_id)}
                        className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        {isExpanded ? 'Réduire ▲' : `Voir tout (${chrono.length}) ▼`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default BaliseRondesPage