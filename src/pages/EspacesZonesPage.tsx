import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Plus, Trash2, ChevronDown, ChevronRight, Save, X, CreditCard as Edit2, Users, Layers, AlertCircle, CheckCircle, ShieldCheck, Flame, Building2, DoorOpen, GlassWater, Music, Crown, Shirt, PersonStanding, Utensils, Wine, Music2, Mic2, Ticket, Coffee, Camera, Star, Lock, Key, Radio, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntreprise } from '../hooks/useEntreprise';
import AppHeader from '../components/AppHeader';

// ─── Types ───────────────────────────────────────────────────────────────────

type ZoneCategorie = 'securite_personnes';

type Zone = {
  id: string;
  espace_id: string;
  nom: string;
  description: string;
  capacite: number | null;
  categorie: ZoneCategorie;
};

type ZoneSsi = {
  id: string;
  nom: string;
  description: string;
  actif: boolean;
  ordre: number;
};

type Espace = {
  id: string;
  nom: string;
  description: string;
  couleur: string;
  zones: Zone[];
};

type Toast = { type: 'success' | 'error'; text: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#64748b',
];

const ZONE_CATEGORIES: { value: ZoneCategorie; label: string; icon: React.ElementType; accent: string; border: string; gradient: string }[] = [
  {
    value: 'securite_personnes',
    label: 'Zone sécurité des personnes',
    icon: ShieldCheck,
    accent: 'text-blue-400',
    border: 'border-blue-500/20',
    gradient: 'from-blue-500 to-cyan-400',
  },
];

// ─── Zone icon helpers ───────────────────────────────────────────────────────

const SECURITE_ICONS: React.ElementType[] = [
  DoorOpen, GlassWater, MapPin, Music, Crown, Shirt, PersonStanding,
  Users, Utensils, Wine, Music2, Mic2, Ticket, Coffee, Camera, Star,
  Lock, Key, Radio, ShieldCheck,
];

const ZONE_ICON_MAP: Array<{ keywords: string[]; icon: React.ElementType }> = [
  { keywords: ['entrée', 'entree', 'entry', 'porte', 'door', 'accès', 'acces'], icon: DoorOpen },
  { keywords: ['bar', 'cocktail', 'boisson', 'drink'], icon: GlassWater },
  { keywords: ['extérieur', 'exterieur', 'outdoor', 'terrasse', 'outside'], icon: MapPin },
  { keywords: ['piste', 'dance', 'danse', 'floor', 'dancefloor'], icon: Music },
  { keywords: ['vip', 'lounge', 'privé', 'prive'], icon: Crown },
  { keywords: ['vestiaire', 'cloakroom', 'coat', 'tenue'], icon: Shirt },
  { keywords: ['sanitaire', 'toilette', 'wc', 'restroom', 'lavabo'], icon: PersonStanding },
  { keywords: ['scène', 'scene', 'stage', 'podium'], icon: Mic2 },
  { keywords: ['ticket', 'caisse', 'billetterie', 'cashier'], icon: Ticket },
  { keywords: ['food', 'restauration', 'restaurant', 'buffet'], icon: Utensils },
  { keywords: ['wine', 'vin', 'champagne', 'sommelier'], icon: Wine },
  { keywords: ['photo', 'camera', 'photo booth', 'photobooth'], icon: Camera },
  { keywords: ['café', 'cafe', 'coffee'], icon: Coffee },
  { keywords: ['star', 'artiste', 'artist', 'backstage'], icon: Star },
  { keywords: ['securite', 'sécurité', 'security', 'agent'], icon: ShieldCheck },
  { keywords: ['radio', 'son', 'sound', 'audio', 'dj'], icon: Radio },
];

function getSecuriteIcon(nom: string): React.ElementType {
  const lower = nom.toLowerCase();
  for (const { keywords, icon } of ZONE_ICON_MAP) {
    if (keywords.some((k) => lower.includes(k))) return icon;
  }
  // deterministic fallback based on name chars
  const hash = lower.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SECURITE_ICONS[hash % SECURITE_ICONS.length];
}

const SSI_ICONS: React.ElementType[] = [Flame, Flame, Flame];

// ─── Sub-components ──────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

type EspaceFormProps = {
  initial?: { nom: string; description: string; couleur: string };
  onSave: (data: { nom: string; description: string; couleur: string }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
};

function EspaceForm({ initial, onSave, onCancel, loading }: EspaceFormProps) {
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [couleur, setCouleur] = useState(initial?.couleur ?? PRESET_COLORS[0]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await onSave({ nom: nom.trim(), description: description.trim(), couleur });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Nom de l'espace / salle</label>
          <input
            type="text" required value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Hall, Terrasse, Salle A…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
          <input
            type="text" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description optionnelle"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-2">Couleur</label>
        <ColorPicker value={couleur} onChange={setCouleur} />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-700">
          Annuler
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
            disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors">
          <Save className="w-3.5 h-3.5" />
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

type ZoneFormProps = {
  initial?: { nom: string; description: string; capacite: string };
  onSave: (data: { nom: string; description: string; capacite: number | null }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  accentRing?: string;
};

function ZoneForm({ initial, onSave, onCancel, loading, accentRing = 'focus:ring-blue-500' }: ZoneFormProps) {
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [capacite, setCapacite] = useState(initial?.capacite ?? '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cap = capacite !== '' ? parseInt(String(capacite), 10) : null;
    await onSave({ nom: nom.trim(), description: description.trim(), capacite: isNaN(cap as number) ? null : cap });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Nom de la zone</label>
          <input
            type="text" required value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Zone A, Entrée, Scène…"
            className={`w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:border-transparent transition-all ${accentRing}`}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Capacité max</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="number" min={1} value={capacite}
              onChange={(e) => setCapacite(e.target.value)}
              placeholder="Ex : 200"
              className={`w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-white placeholder-slate-500 text-sm
                focus:outline-none focus:ring-2 focus:border-transparent transition-all ${accentRing}`}
            />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
        <input
          type="text" value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description optionnelle"
          className={`w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 text-sm
            focus:outline-none focus:ring-2 focus:border-transparent transition-all ${accentRing}`}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-700">
          Annuler
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
            disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors">
          <Save className="w-3 h-3" />
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ─── Zone row ────────────────────────────────────────────────────────────────

type ZoneRowProps = {
  zone: Zone;
  espaceColor: string;
  onEdit: () => void;
  onDelete: () => void;
  editingZoneId: string | null;
  onSaveEdit: (data: { nom: string; description: string; capacite: number | null }) => Promise<void>;
  onCancelEdit: () => void;
  zoneFormLoading: boolean;
  accentRing?: string;
};

function ZoneRow({ zone, espaceColor, onEdit, onDelete, editingZoneId, onSaveEdit, onCancelEdit, zoneFormLoading, accentRing }: ZoneRowProps) {
  if (editingZoneId === zone.id) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Modifier</p>
        <ZoneForm
          initial={{ nom: zone.nom, description: zone.description, capacite: zone.capacite !== null ? String(zone.capacite) : '' }}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          loading={zoneFormLoading}
          accentRing={accentRing}
        />
      </div>
    );
  }

  const isSsi = zone.categorie === 'ssi';

  const ZoneIcon = isSsi ? Flame : getSecuriteIcon(zone.nom);

  return (
    <div className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 transition-all group
      ${isSsi
        ? 'bg-red-950/30 hover:bg-red-950/50 border-red-900/40 hover:border-red-800/60'
        : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-800 hover:border-slate-700'}`}
    >
      {/* Icon badge */}
      {isSsi ? (
        <div className="w-9 h-9 rounded-xl bg-red-800/60 border border-red-700/50 flex items-center justify-center shrink-0"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
              fill="url(#flammeGrad)" />
            <defs>
              <linearGradient id="flammeGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="60%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      ) : (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
          style={{ backgroundColor: `${espaceColor}18`, borderColor: `${espaceColor}35` }}>
          <ZoneIcon className="w-4 h-4" style={{ color: espaceColor }} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isSsi ? 'text-amber-300' : 'text-slate-200'}`}>{zone.nom}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {zone.description && <span className="text-xs text-slate-500 truncate">{zone.description}</span>}
          {zone.capacite !== null && (
            <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
              <Users className="w-3 h-3" />{zone.capacite}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit}
          className="w-7 h-7 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 flex items-center justify-center transition-all" title="Modifier">
          <Edit2 className="w-3 h-3" />
        </button>
        <button onClick={onDelete}
          className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all" title="Supprimer">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Zone category panel (inside an espace) ──────────────────────────────────

type ZonePanelProps = {
  espace: Espace;
  categorie: ZoneCategorie;
  label: string;
  icon: React.ElementType;
  accentColor: string;
  border: string;
  gradient: string;
  accentRing: string;
  showAddZone: string | null;
  setShowAddZone: (v: string | null) => void;
  editingZone: string | null;
  setEditingZone: (v: string | null) => void;
  zoneFormLoading: boolean;
  onAddZone: (espaceId: string, categorie: ZoneCategorie, data: { nom: string; description: string; capacite: number | null }) => Promise<void>;
  onEditZone: (zoneId: string, espaceId: string, data: { nom: string; description: string; capacite: number | null }) => Promise<void>;
  onDeleteZone: (zoneId: string, espaceId: string, nom: string) => Promise<void>;
};

function ZonePanel({
  espace, categorie, label, icon: Icon, accentColor, border, gradient, accentRing,
  showAddZone, setShowAddZone, editingZone, setEditingZone,
  zoneFormLoading, onAddZone, onEditZone, onDeleteZone,
}: ZonePanelProps) {
  const panelKey = `${espace.id}-${categorie}`;
  const zones = espace.zones.filter((z) => z.categorie === categorie);
  const isSsi = categorie === 'ssi';

  return (
    <div className={`rounded-xl border ${border} ${isSsi ? 'bg-red-950/20' : 'bg-slate-950/60'} overflow-hidden`}>
      <div className={`h-0.5 bg-gradient-to-r ${gradient}`} />
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isSsi ? (
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
                fill="url(#flammeGradHeader)" />
              <defs>
                <linearGradient id="flammeGradHeader" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="60%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
            </svg>
          ) : (
            <Icon className={`w-4 h-4 ${accentColor} shrink-0`} />
          )}
          <span className={`text-xs font-semibold ${isSsi ? 'text-amber-400/90' : 'text-slate-300'}`}>{label}</span>
          <span className="text-xs text-slate-600 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
            {zones.length}
          </span>
        </div>
        {showAddZone !== panelKey && (
          <button
            onClick={() => { setShowAddZone(panelKey); setEditingZone(null); }}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded-lg transition-all
              ${isSsi
                ? 'text-amber-500/80 hover:text-amber-300 bg-red-950/40 hover:bg-red-900/50 border-red-900/40 hover:border-red-700/50'
                : 'text-slate-500 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600'}`}
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </button>
        )}
      </div>

      {(zones.length > 0 || showAddZone === panelKey) && (
        <div className="px-4 pb-4 space-y-2">
          {zones.map((zone) => (
            <ZoneRow
              key={zone.id}
              zone={zone}
              espaceColor={espace.couleur}
              onEdit={() => setEditingZone(zone.id)}
              onDelete={() => onDeleteZone(zone.id, espace.id, zone.nom)}
              editingZoneId={editingZone}
              onSaveEdit={(data) => onEditZone(zone.id, espace.id, data)}
              onCancelEdit={() => setEditingZone(null)}
              zoneFormLoading={zoneFormLoading}
              accentRing={accentRing}
            />
          ))}

          {showAddZone === panelKey && (
            <div className={`border border-dashed rounded-xl p-4 ${isSsi ? 'bg-red-950/20 border-red-900/40' : 'bg-slate-800/40 border-slate-700'}`}>
              <ZoneForm
                onSave={(data) => onAddZone(espace.id, categorie, data)}
                onCancel={() => setShowAddZone(null)}
                loading={zoneFormLoading}
                accentRing={accentRing}
              />
            </div>
          )}
        </div>
      )}

      {zones.length === 0 && showAddZone !== panelKey && (
        <div className="px-4 pb-4">
          <p className="text-xs text-slate-700 italic">Aucune zone.</p>
        </div>
      )}
    </div>
  );
}

// ─── SSI zone form (nom + description only) ──────────────────────────────────

type SsiZoneFormProps = {
  initial?: { nom: string; description: string };
  onSave: (data: { nom: string; description: string }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
};

function SsiZoneForm({ initial, onSave, onCancel, loading }: SsiZoneFormProps) {
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    await onSave({ nom: nom.trim(), description: description.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Nom de la zone SSI</label>
          <input
            type="text" required value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Détecteur Hall A, RIA Cuisine…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
          <input
            type="text" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description optionnelle"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-700">
          Annuler
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800
            disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors">
          <Save className="w-3 h-3" />
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

function EspacesZonesPage() {
  const { session, signOut, isSuperAdmin, hasAdminAccess } = useAuth();
  const { id: entrepriseEtabId } = useEntreprise();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const zoneParam = searchParams.get('zone'); // 'ssi' | null
  const isOnboarding = searchParams.get('onboarding') === 'true';
  const onboardingEtabId = searchParams.get('etabId') ?? null;

  // In onboarding mode, use the etabId from the URL; otherwise use the current user's etablissement
  const currentEtabId = onboardingEtabId ?? entrepriseEtabId;

  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [expandedEspaces, setExpandedEspaces] = useState<Set<string>>(new Set());
  const [espacesSectionExpanded, setEspacesSectionExpanded] = useState(false);
  const [ssiSectionExpanded, setSsiSectionExpanded] = useState(false);
  const [showAddEspace, setShowAddEspace] = useState(false);
  const [editingEspace, setEditingEspace] = useState<string | null>(null);
  const [espaceFormLoading, setEspaceFormLoading] = useState(false);

  const [showAddZone, setShowAddZone] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [zoneFormLoading, setZoneFormLoading] = useState(false);

  const [zonesSsi, setZonesSsi] = useState<ZoneSsi[]>([]);
  const [showAddSsi, setShowAddSsi] = useState(false);
  const [editingSsiId, setEditingSsiId] = useState<string | null>(null);
  const [ssiFormLoading, setSsiFormLoading] = useState(false);

  useEffect(() => {
    if (!session) { navigate('/'); return; }
    if (!hasAdminAccess) { navigate('/mobile'); return; }
    if (zoneParam === 'ssi') {
      setSsiSectionExpanded(true);
      setTimeout(() => {
        document.getElementById('ssi-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
    if (currentEtabId) fetchAll();
  }, [session, isSuperAdmin, currentEtabId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function fetchAll() {
    setLoading(true);
    const [espacesRes, zonesRes, ssiRes] = await Promise.all([
      supabase.from('espaces').select('*').eq('etablissement_id', currentEtabId ?? '').order('created_at'),
      supabase.from('zones').select('*').order('created_at'),
      supabase.from('zones_ssi').select('*').eq('etablissement_id', currentEtabId ?? '').order('ordre', { ascending: true }),
    ]);
    const zonesData: Zone[] = zonesRes.data ?? [];
    const espacesData: Espace[] = (espacesRes.data ?? []).map((e) => ({
      ...e,
      zones: zonesData.filter((z) => z.espace_id === e.id),
    }));
    setEspaces(espacesData);
    setExpandedEspaces(new Set(espacesData.map((e) => e.id)));
    setZonesSsi((ssiRes.data ?? []) as ZoneSsi[]);
    setLoading(false);
  }

  function toggleEspace(id: string) {
    setExpandedEspaces((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAddEspace(data: { nom: string; description: string; couleur: string }) {
    setEspaceFormLoading(true);
    const { data: inserted, error } = await supabase.from('espaces')
      .insert({ ...data, etablissement_id: currentEtabId }).select().maybeSingle();
    setEspaceFormLoading(false);
    if (error || !inserted) {
      console.error('Espace insert error:', error);
      setToast({ type: 'error', text: error?.message ? `Erreur: ${error.message}` : 'Erreur lors de la création.' });
      return;
    }
    setEspaces((prev) => [...prev, { ...inserted, zones: [] }]);
    setExpandedEspaces((prev) => new Set([...prev, inserted.id]));
    setShowAddEspace(false);
    setToast({ type: 'success', text: `Espace "${inserted.nom}" créé.` });
  }

  async function handleEditEspace(id: string, data: { nom: string; description: string; couleur: string }) {
    setEspaceFormLoading(true);
    const { error } = await supabase.from('espaces').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    setEspaceFormLoading(false);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la modification.' }); return; }
    setEspaces((prev) => prev.map((e) => e.id === id ? { ...e, ...data } : e));
    setEditingEspace(null);
    setToast({ type: 'success', text: 'Espace mis à jour.' });
  }

  async function handleDeleteEspace(id: string, nom: string) {
    const { error } = await supabase.from('espaces').delete().eq('id', id);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la suppression.' }); return; }
    setEspaces((prev) => prev.filter((e) => e.id !== id));
    setToast({ type: 'success', text: `Espace "${nom}" supprimé.` });
  }

  async function handleAddZone(espaceId: string, categorie: ZoneCategorie, data: { nom: string; description: string; capacite: number | null }) {
    setZoneFormLoading(true);
    const { data: inserted, error } = await supabase.from('zones')
      .insert({ espace_id: espaceId, categorie, etablissement_id: currentEtabId, ...data }).select().maybeSingle();
    if (error) console.error('Zone insert error:', error);
    setZoneFormLoading(false);
    if (error || !inserted) { setToast({ type: 'error', text: 'Erreur lors de la création.' }); return; }
    setEspaces((prev) => prev.map((e) => e.id === espaceId
      ? { ...e, zones: [...e.zones, inserted as Zone] }
      : e
    ));
    setShowAddZone(null);
    setToast({ type: 'success', text: `Zone "${inserted.nom}" créée.` });
  }

  async function handleEditZone(zoneId: string, espaceId: string, data: { nom: string; description: string; capacite: number | null }) {
    setZoneFormLoading(true);
    const { error } = await supabase.from('zones').update({ ...data, updated_at: new Date().toISOString() }).eq('id', zoneId);
    setZoneFormLoading(false);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la modification.' }); return; }
    setEspaces((prev) => prev.map((e) => e.id === espaceId
      ? { ...e, zones: e.zones.map((z) => z.id === zoneId ? { ...z, ...data } : z) }
      : e
    ));
    setEditingZone(null);
    setToast({ type: 'success', text: 'Zone mise à jour.' });
  }

  async function handleDeleteZone(zoneId: string, espaceId: string, nom: string) {
    const { error } = await supabase.from('zones').delete().eq('id', zoneId);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la suppression.' }); return; }
    setEspaces((prev) => prev.map((e) => e.id === espaceId
      ? { ...e, zones: e.zones.filter((z) => z.id !== zoneId) }
      : e
    ));
    setToast({ type: 'success', text: `Zone "${nom}" supprimée.` });
  }

  async function handleAddSsi(data: { nom: string; description: string }) {
    setSsiFormLoading(true);
    const ordre = zonesSsi.length;
    const { data: inserted, error } = await supabase
      .from('zones_ssi').insert({ ...data, ordre, etablissement_id: currentEtabId }).select().maybeSingle();
    setSsiFormLoading(false);
    if (error || !inserted) { setToast({ type: 'error', text: 'Erreur lors de la création.' }); return; }
    setZonesSsi((prev) => [...prev, inserted as ZoneSsi]);
    setShowAddSsi(false);
    setToast({ type: 'success', text: `Zone SSI "${inserted.nom}" créée.` });
  }

  async function handleEditSsi(id: string, data: { nom: string; description: string }) {
    setSsiFormLoading(true);
    const { error } = await supabase.from('zones_ssi').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
    setSsiFormLoading(false);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la modification.' }); return; }
    setZonesSsi((prev) => prev.map((z) => z.id === id ? { ...z, ...data } : z));
    setEditingSsiId(null);
    setToast({ type: 'success', text: 'Zone SSI mise à jour.' });
  }

  async function handleDeleteSsi(id: string, nom: string) {
    const { error } = await supabase.from('zones_ssi').delete().eq('id', id);
    if (error) { setToast({ type: 'error', text: 'Erreur lors de la suppression.' }); return; }
    setZonesSsi((prev) => prev.filter((z) => z.id !== id));
    setToast({ type: 'success', text: `Zone SSI "${nom}" supprimée.` });
  }

  async function handleSignOut() { await signOut(); navigate('/'); }

  async function handleOnboardingContinue() {
    if (!onboardingEtabId) return;
    await supabase.from('etablissements').update({
      onboarding_etape: 3,
      onboarding_step: 'motifs',
    }).eq('id', onboardingEtabId);
    navigate(`/onboarding?etabId=${onboardingEtabId}`);
  }

  const totalEspaces = espaces.length;
  const totalZones = espaces.reduce((s, e) => s + e.zones.length, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {isOnboarding ? (
        <div className="bg-blue-600/20 border-b border-blue-500/30 px-6 py-3 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
          <p className="text-blue-200 text-sm font-medium">Étape 3/5 — Configurez vos espaces et zones</p>
        </div>
      ) : (
        <AppHeader onSignOut={handleSignOut} />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border
          ${toast.type === 'success'
            ? 'bg-emerald-900/80 border-emerald-500/30 text-emerald-300'
            : 'bg-red-900/80 border-red-500/30 text-red-300'}`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              Espaces & Zones
            </h1>
            <p className="text-slate-400 text-sm mt-1 ml-12">
              {loading ? '…' : `${totalEspaces} espace${totalEspaces !== 1 ? 's' : ''} · ${totalZones} zone${totalZones !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500 gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Section SSI : Zones Sécurité Incendie ───────────────────── */}
            <div id="ssi-section" className="bg-slate-900 border border-orange-900/40 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
              <div
                className={`px-5 py-4 flex items-center justify-between gap-4 cursor-pointer ${ssiSectionExpanded ? 'border-b border-slate-800' : ''}`}
                onClick={() => setSsiSectionExpanded((v) => !v)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-900/60 border border-red-800/50 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
                        fill="url(#ssiSectionGrad)" />
                      <defs>
                        <linearGradient id="ssiSectionGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                          <stop offset="0%" stopColor="#fbbf24" />
                          <stop offset="60%" stopColor="#f97316" />
                          <stop offset="100%" stopColor="#dc2626" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-amber-300">Zones SSI – Sécurité Incendie</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {zonesSsi.length} zone{zonesSsi.length !== 1 ? 's' : ''} SSI configurée{zonesSsi.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all shrink-0">
                  {ssiSectionExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </div>

              {ssiSectionExpanded && (
                <div className="p-5 space-y-3">
                  {/* Empty state */}
                  {zonesSsi.length === 0 && !showAddSsi && (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-800/40 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
                            fill="url(#emptyFlame)" />
                          <defs>
                            <linearGradient id="emptyFlame" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#dc2626" stopOpacity="0.4" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm font-medium">Aucune zone SSI configurée</p>
                        <p className="text-slate-600 text-xs mt-0.5">Ajoutez des zones pour les utiliser lors des saisies SSI.</p>
                      </div>
                      <button
                        onClick={() => setShowAddSsi(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter une zone SSI
                      </button>
                    </div>
                  )}

                  {/* Zone list */}
                  {zonesSsi.map((zone) => {
                    if (editingSsiId === zone.id) {
                      return (
                        <div key={zone.id} className="bg-slate-800/50 border border-orange-900/40 rounded-xl p-4">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Modifier</p>
                          <SsiZoneForm
                            initial={{ nom: zone.nom, description: zone.description }}
                            onSave={(data) => handleEditSsi(zone.id, data)}
                            onCancel={() => setEditingSsiId(null)}
                            loading={ssiFormLoading}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={zone.id} className="flex items-center gap-3 bg-red-950/30 hover:bg-red-950/50 border border-red-900/40 hover:border-red-800/60 rounded-xl px-3 py-2.5 transition-all group">
                        <div className="w-9 h-9 rounded-xl bg-red-800/60 border border-red-700/50 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
                              fill="url(#flameSsiRow)" />
                            <defs>
                              <linearGradient id="flameSsiRow" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#fbbf24" />
                                <stop offset="60%" stopColor="#f97316" />
                                <stop offset="100%" stopColor="#dc2626" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-amber-300">{zone.nom}</p>
                          {zone.description && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">{zone.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => setEditingSsiId(zone.id)}
                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 flex items-center justify-center transition-all"
                            title="Modifier"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteSsi(zone.id, zone.nom)}
                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add form */}
                  {showAddSsi && (
                    <div className="border border-dashed rounded-xl p-4 bg-red-950/20 border-red-900/40">
                      <SsiZoneForm
                        onSave={handleAddSsi}
                        onCancel={() => setShowAddSsi(false)}
                        loading={ssiFormLoading}
                      />
                    </div>
                  )}

                  {/* Add button (when list is not empty) */}
                  {zonesSsi.length > 0 && !showAddSsi && editingSsiId === null && (
                    <button
                      onClick={() => setShowAddSsi(true)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded-lg
                        text-amber-500/80 hover:text-amber-300 bg-red-950/40 hover:bg-red-900/50
                        border-red-900/40 hover:border-red-700/50 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      Ajouter une zone SSI
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Section 1 : Espace ou salle ────────────────────────────── */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-slate-500 to-slate-400" />
              <div className={`px-5 py-4 flex items-center justify-between gap-4 ${espacesSectionExpanded ? 'border-b border-slate-800' : ''}`}>
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    setEspacesSectionExpanded((v) => {
                      const next = !v;
                      if (next) setExpandedEspaces(new Set(espaces.map((e) => e.id)));
                      return next;
                    });
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-700/60 border border-slate-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-white">Espace ou salle</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {espaces.length} espace{espaces.length !== 1 ? 's' : ''} créé{espaces.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!showAddEspace && espacesSectionExpanded && (
                    <button
                      onClick={() => setShowAddEspace(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500
                        rounded-xl transition-colors shadow-lg shadow-blue-900/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nouvel espace
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEspacesSectionExpanded((v) => {
                        const next = !v;
                        if (next) setExpandedEspaces(new Set(espaces.map((e) => e.id)));
                        return next;
                      });
                    }}
                    className="w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all"
                    title={espacesSectionExpanded ? 'Réduire' : 'Déployer'}
                  >
                    {espacesSectionExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {espacesSectionExpanded && (
              <div className="p-5 space-y-3">
                {/* Add espace form */}
                {showAddEspace && (
                  <div className="bg-slate-800/60 border border-blue-500/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      Nouvel espace / salle
                    </p>
                    <EspaceForm
                      onSave={handleAddEspace}
                      onCancel={() => setShowAddEspace(false)}
                      loading={espaceFormLoading}
                    />
                  </div>
                )}

                {espaces.length === 0 && !showAddEspace && (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Aucun espace créé</p>
                      <p className="text-slate-600 text-xs mt-0.5">Créez des espaces pour y organiser vos zones.</p>
                    </div>
                    <button
                      onClick={() => setShowAddEspace(true)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Créer un espace
                    </button>
                  </div>
                )}

                {/* Espace cards */}
                {espaces.map((espace) => {
                  const expanded = expandedEspaces.has(espace.id);
                  const isEditingThis = editingEspace === espace.id;

                  return (
                    <div key={espace.id} className="border border-slate-800 rounded-xl overflow-hidden">
                      {/* Color bar */}
                      <div className="h-0.5" style={{ background: `linear-gradient(to right, ${espace.couleur}, ${espace.couleur}55)` }} />

                      {/* Header */}
                      <div className="px-4 py-3 bg-slate-800/40">
                        {isEditingThis ? (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Modifier</p>
                            <EspaceForm
                              initial={{ nom: espace.nom, description: espace.description, couleur: espace.couleur }}
                              onSave={(data) => handleEditEspace(espace.id, data)}
                              onCancel={() => setEditingEspace(null)}
                              loading={espaceFormLoading}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: espace.couleur }} />
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleEspace(espace.id)}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-white text-sm">{espace.nom}</p>
                                <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700/60 rounded-full px-2 py-0.5">
                                  {espace.zones.length} zone{espace.zones.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {espace.description && (
                                <p className="text-xs text-slate-500 truncate mt-0.5">{espace.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => setEditingEspace(espace.id)}
                                className="w-7 h-7 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 flex items-center justify-center transition-all" title="Modifier">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteEspace(espace.id, espace.nom)}
                                className="w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all" title="Supprimer">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => toggleEspace(espace.id)}
                                className="w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all ml-0.5">
                                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Zone panels inside this espace (SSI excluded — managed in the SSI section above) */}
                      {!isEditingThis && expanded && (
                        <div className="px-4 pb-4 pt-3 space-y-3 bg-slate-900/40">
                          {ZONE_CATEGORIES.filter((cat) => cat.value !== 'ssi').map((cat) => (
                            <ZonePanel
                              key={cat.value}
                              espace={espace}
                              categorie={cat.value}
                              label={cat.label}
                              icon={cat.icon}
                              accentColor={cat.accent}
                              border={cat.border}
                              gradient={cat.gradient}
                              accentRing="focus:ring-blue-500"
                              showAddZone={showAddZone}
                              setShowAddZone={setShowAddZone}
                              editingZone={editingZone}
                              setEditingZone={setEditingZone}
                              zoneFormLoading={zoneFormLoading}
                              onAddZone={handleAddZone}
                              onEditZone={handleEditZone}
                              onDeleteZone={handleDeleteZone}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* Onboarding sticky footer */}
      {isOnboarding && (
        <div className="sticky bottom-0 z-20 bg-slate-950/95 backdrop-blur border-t border-blue-500/30 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">Les espaces et zones sont sauvegardés au fur et à mesure.</p>
            <button
              type="button"
              onClick={handleOnboardingContinue}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30 shrink-0"
            >
              Enregistrer et continuer
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EspacesZonesPage;