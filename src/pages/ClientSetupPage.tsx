import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, ShieldCheck, CheckCircle2,
  Plus, Trash2, ChevronRight, ChevronLeft,
  Loader2, MapPin, Music,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ── types ────────────────────────────────────────────────────────────────────
type EspaceItem     = { nom: string; couleur: string };
type ZoneItem       = { nom: string; categorie: string; capacite: number | '' };
type NiveauItem     = { nom: string; ordre: number };
type VerifItem      = { nom: string; type: string; organisme: string; personne: string; telephone: string; email: string; prochaine_visite: string };

const COULEURS = ['#3b82f6','#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#64748b','#f97316'];
const TYPES_VERIF = ['SSI', 'Électricité', 'Extincteurs', 'BAES', 'Autre'];

const CATEGORIE_LABELS: Record<string, string> = {
  securite_personnes: 'Sécurité personnes',
  sortie_secours: 'Sortie de secours',
  acces_public: 'Accès public',
  zone_service: 'Zone service',
};

const TEMPLATE_STRUCTURE = {
  espaces: [
    { nom: 'Piste', couleur: '#6366f1' },
    { nom: 'Bar', couleur: '#3b82f6' },
    { nom: 'Vestiaire', couleur: '#64748b' },
  ],
  zones: [
    { nom: 'Entrée principale', categorie: 'acces_public', capacite: '' as const },
    { nom: 'Piste de danse', categorie: 'securite_personnes', capacite: '' as const },
    { nom: 'Bar central', categorie: 'securite_personnes', capacite: '' as const },
    { nom: 'Sortie de secours', categorie: 'sortie_secours', capacite: '' as const },
  ],
  niveaux: [{ nom: 'RDC', ordre: 1 }],
};

const TEMPLATE_VERIF = [
  { nom: 'Vérificateur SSI', type: 'SSI', organisme: '', personne: '', telephone: '', email: '', prochaine_visite: '' },
  { nom: 'Électricité', type: 'Électricité', organisme: '', personne: '', telephone: '', email: '', prochaine_visite: '' },
  { nom: 'Extincteurs', type: 'Extincteurs', organisme: '', personne: '', telephone: '', email: '', prochaine_visite: '' },
  { nom: 'BAES', type: 'BAES', organisme: '', personne: '', telephone: '', email: '', prochaine_visite: '' },
];

const EMPTY_VERIF: VerifItem = { nom: '', type: 'SSI', organisme: '', personne: '', telephone: '', email: '', prochaine_visite: '' };

// ── Step 1 — Structure ───────────────────────────────────────────────────────
function StepStructure({
  espaces, zones, niveaux,
  onChange,
  onNext, onSkip,
}: {
  espaces: EspaceItem[]; zones: ZoneItem[]; niveaux: NiveauItem[];
  onChange: (p: { espaces?: EspaceItem[]; zones?: ZoneItem[]; niveaux?: NiveauItem[] }) => void;
  onNext: () => void; onSkip: () => void;
}) {
  const [newEspace, setNewEspace] = useState<EspaceItem>({ nom: '', couleur: '#3b82f6' });
  const [newZone, setNewZone] = useState<ZoneItem>({ nom: '', categorie: 'securite_personnes', capacite: '' });

  function addEspace() {
    if (!newEspace.nom.trim()) return;
    onChange({ espaces: [...espaces, { ...newEspace }] });
    setNewEspace({ nom: '', couleur: '#3b82f6' });
  }

  function addZone() {
    if (!newZone.nom.trim()) return;
    onChange({ zones: [...zones, { ...newZone }] });
    setNewZone({ nom: '', categorie: 'securite_personnes', capacite: '' });
  }

  function applyTemplate() {
    onChange({
      espaces: [...espaces, ...TEMPLATE_STRUCTURE.espaces],
      zones: [...zones, ...TEMPLATE_STRUCTURE.zones],
      niveaux: niveaux.length === 0 ? TEMPLATE_STRUCTURE.niveaux : niveaux,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Structure de l'établissement</h2>
            <p className="text-sm text-slate-400">Espaces, zones et niveaux</p>
          </div>
        </div>
        <button
          type="button"
          onClick={applyTemplate}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 transition-all"
        >
          <Music className="w-3.5 h-3.5 text-slate-400" />
          Modèle discothèque
        </button>
      </div>

      {/* Espaces */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">Espaces</h3>
        {espaces.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {espaces.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.couleur }} />
                {e.nom}
                <button type="button" onClick={() => onChange({ espaces: espaces.filter((_, idx) => idx !== i) })} className="ml-1 text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newEspace.nom}
            onChange={e => setNewEspace(s => ({ ...s, nom: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addEspace()}
            placeholder="Nom de l'espace"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-1">
            {COULEURS.map(c => (
              <button key={c} type="button" onClick={() => setNewEspace(s => ({ ...s, couleur: c }))}
                className={`w-6 h-6 rounded-full transition-all ${newEspace.couleur === c ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button type="button" onClick={addEspace} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-slate-200 transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zones */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">Zones</h3>
        {zones.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {zones.map((z, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
                <span className="text-sm text-white flex-1">{z.nom}</span>
                <span className="text-xs text-slate-400">{CATEGORIE_LABELS[z.categorie] ?? z.categorie}</span>
                <button type="button" onClick={() => onChange({ zones: zones.filter((_, idx) => idx !== i) })} className="text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newZone.nom}
            onChange={e => setNewZone(s => ({ ...s, nom: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addZone()}
            placeholder="Nom de la zone"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newZone.categorie}
            onChange={e => setNewZone(s => ({ ...s, categorie: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CATEGORIE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" onClick={addZone} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-slate-200 transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onSkip} className="px-5 py-2.5 text-slate-400 hover:text-slate-200 text-sm transition-all">
          Passer cette étape
        </button>
        <button
          onClick={onNext}
          disabled={espaces.length === 0 || zones.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all"
        >
          Suivant <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2 — Vérificateurs ───────────────────────────────────────────────────
function StepVerificateurs({
  verificateurs,
  onChange,
  onNext, onBack, onSkip,
}: {
  verificateurs: VerifItem[];
  onChange: (v: VerifItem[]) => void;
  onNext: () => void; onBack: () => void; onSkip: () => void;
}) {
  const [newRow, setNewRow] = useState<VerifItem>({ ...EMPTY_VERIF });

  function addRow() {
    if (!newRow.nom.trim()) return;
    onChange([...verificateurs, { ...newRow }]);
    setNewRow({ ...EMPTY_VERIF });
  }

  function update(i: number, patch: Partial<VerifItem>) {
    onChange(verificateurs.map((v, idx) => idx === i ? { ...v, ...patch } : v));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Vérificateurs & Organismes</h2>
            <p className="text-sm text-slate-400">SSI, électricité, extincteurs, BAES</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange([...verificateurs, ...TEMPLATE_VERIF])}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 transition-all"
        >
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          Modèle standard
        </button>
      </div>

      {verificateurs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-3">Nom</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Organisme</th>
                <th className="pb-2 pr-3">Prochaine visite</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {verificateurs.map((v, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3">
                    <input value={v.nom} onChange={e => update(i, { nom: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-2 pr-3">
                    <select value={v.type} onChange={e => update(i, { type: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                      {TYPES_VERIF.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input value={v.organisme} onChange={e => update(i, { organisme: e.target.value })}
                      placeholder="Bureau Veritas"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="date" value={v.prochaine_visite} onChange={e => update(i, { prochaine_visite: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-2">
                    <button type="button" onClick={() => onChange(verificateurs.filter((_, idx) => idx !== i))}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
        <p className="text-xs font-medium text-slate-400 mb-3">Ajouter un organisme</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <input value={newRow.nom} onChange={e => setNewRow(s => ({ ...s, nom: e.target.value }))}
            placeholder="Nom du vérificateur"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={newRow.type} onChange={e => setNewRow(s => ({ ...s, type: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {TYPES_VERIF.map(t => <option key={t}>{t}</option>)}
          </select>
          <input value={newRow.organisme} onChange={e => setNewRow(s => ({ ...s, organisme: e.target.value }))}
            placeholder="Organisme (ex: Apave)"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={newRow.telephone} onChange={e => setNewRow(s => ({ ...s, telephone: e.target.value }))}
            placeholder="Téléphone"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="email" value={newRow.email} onChange={e => setNewRow(s => ({ ...s, email: e.target.value }))}
            placeholder="Email"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="date" value={newRow.prochaine_visite} onChange={e => setNewRow(s => ({ ...s, prochaine_visite: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="button" onClick={addRow}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-all">
          <Plus className="w-4 h-4" />Ajouter
        </button>
      </div>

      {verificateurs.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-2">
          Aucun organisme ajouté — cette étape est optionnelle.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <div className="flex gap-2">
          <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm transition-all">
            <ChevronLeft className="w-4 h-4" />Retour
          </button>
          <button onClick={onSkip} className="px-5 py-2.5 text-slate-400 hover:text-slate-200 text-sm transition-all">
            Passer
          </button>
        </div>
        <button onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition-all">
          Terminer <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3 — Done ─────────────────────────────────────────────────────────────
function StepDone({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Votre espace est prêt !</h2>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">
          Votre structure et vos organismes ont été enregistrés. Vous pouvez maintenant commencer à utiliser l'application.
        </p>
      </div>
      <button
        onClick={onGo}
        className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
      >
        Accéder à mon espace <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientSetupPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [etablissementId, setEtablissementId] = useState<string | null>(null);

  const [espaces, setEspaces] = useState<EspaceItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [niveaux, setNiveaux] = useState<NiveauItem[]>([]);
  const [verificateurs, setVerificateurs] = useState<VerifItem[]>([]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('managed_users')
      .select('etablissement_id')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.etablissement_id) setEtablissementId(data.etablissement_id);
      });
  }, [session]);

  async function saveStructure() {
    if (!etablissementId) return;
    setSaving(true);

    const espaceInserts = espaces.map(e => ({
      nom: e.nom,
      couleur: e.couleur,
      etablissement_id: etablissementId,
    }));
    const zoneInserts = zones.map(z => ({
      nom: z.nom,
      categorie: z.categorie,
      capacite: z.capacite === '' ? null : z.capacite,
      etablissement_id: etablissementId,
    }));
    const niveauInserts = niveaux.map(n => ({
      nom: n.nom,
      ordre: n.ordre,
      etablissement_id: etablissementId,
    }));

    if (espaceInserts.length > 0) {
      await supabase.from('espaces').insert(espaceInserts);
    }
    if (zoneInserts.length > 0) {
      await supabase.from('zones').insert(zoneInserts);
    }
    if (niveauInserts.length > 0) {
      await supabase.from('niveaux').insert(niveauInserts);
    }

    setSaving(false);
  }

  async function saveVerificateurs() {
    if (!etablissementId || verificateurs.length === 0) return;
    setSaving(true);
    const rows = verificateurs.map(v => ({
      nom: v.nom,
      type: v.type,
      organisme: v.organisme || null,
      personne_contact: v.personne || null,
      telephone: v.telephone || null,
      email: v.email || null,
      prochaine_visite: v.prochaine_visite || null,
      etablissement_id: etablissementId,
    }));
    await supabase.from('verificateurs').insert(rows);
    setSaving(false);
  }

  async function handleFinishStructure() {
    if (espaces.length > 0 || zones.length > 0) await saveStructure();
    setStep(2);
  }

  async function handleFinishVerificateurs() {
    await saveVerificateurs();
    setStep(3);
  }

  const STEPS = [
    { label: 'Structure', icon: LayoutGrid },
    { label: 'Vérificateurs', icon: ShieldCheck },
    { label: 'Terminé', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const idx = i + 1;
            const active = idx === step;
            const done = idx < step;
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  active ? 'bg-blue-600 text-white' :
                  done ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-slate-800 text-slate-500'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-px mx-1 ${done ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          {saving && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-slate-400 text-sm">Enregistrement…</span>
            </div>
          )}
          {!saving && step === 1 && (
            <StepStructure
              espaces={espaces} zones={zones} niveaux={niveaux}
              onChange={p => {
                if (p.espaces !== undefined) setEspaces(p.espaces);
                if (p.zones !== undefined) setZones(p.zones);
                if (p.niveaux !== undefined) setNiveaux(p.niveaux);
              }}
              onNext={handleFinishStructure}
              onSkip={() => setStep(2)}
            />
          )}
          {!saving && step === 2 && (
            <StepVerificateurs
              verificateurs={verificateurs}
              onChange={setVerificateurs}
              onNext={handleFinishVerificateurs}
              onBack={() => setStep(1)}
              onSkip={() => setStep(3)}
            />
          )}
          {!saving && step === 3 && (
            <StepDone onGo={() => navigate('/mobile')} />
          )}
        </div>
      </div>
    </div>
  );
}
