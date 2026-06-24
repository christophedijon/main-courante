import { useState } from 'react';
import { LayoutGrid, Plus, Trash2, ChevronLeft, ChevronRight, Music } from 'lucide-react';
import type { OnboardingData, EspaceItem, ZoneItem, NiveauItem } from './types';
import { TEMPLATES_STRUCTURE, CATEGORIE_LABELS } from './types';

interface Props {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: (patch: Partial<OnboardingData>) => void;
  onBack: () => void;
  saving: boolean;
}

const COULEURS = ['#3b82f6','#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#64748b','#f97316'];

export default function Step3({ data, onChange, onNext, onBack, saving }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newEspace, setNewEspace] = useState<EspaceItem>({ nom: '', couleur: '#3b82f6' });
  const [newZone, setNewZone] = useState<ZoneItem>({ nom: '', categorie: 'securite_personnes', capacite: '' });
  const [newNiveau, setNewNiveau] = useState<NiveauItem>({ nom: '', ordre: data.niveaux.length + 1 });

  function validate() {
    const e: Record<string, string> = {};
    if (data.espaces.length === 0) e.espaces = 'Ajoutez au moins un espace';
    if (data.zones.length === 0) e.zones = 'Ajoutez au moins une zone';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function addEspace() {
    if (!newEspace.nom.trim()) return;
    onChange({ espaces: [...data.espaces, { ...newEspace }] });
    setNewEspace({ nom: '', couleur: '#3b82f6' });
  }

  function addZone() {
    if (!newZone.nom.trim()) return;
    onChange({ zones: [...data.zones, { ...newZone }] });
    setNewZone({ nom: '', categorie: 'securite_personnes', capacite: '' });
  }

  function addNiveau() {
    if (!newNiveau.nom.trim()) return;
    onChange({ niveaux: [...data.niveaux, { ...newNiveau }] });
    setNewNiveau({ nom: '', ordre: data.niveaux.length + 2 });
  }

  function loadTemplate() {
    const tpl = TEMPLATES_STRUCTURE.discotheque;
    onChange({ espaces: tpl.espaces, zones: tpl.zones, niveaux: tpl.niveaux });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Structure</h2>
            <p className="text-sm text-slate-400">Espaces, zones et niveaux de l'établissement</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadTemplate}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 transition-all"
        >
          <Music className="w-3.5 h-3.5 text-slate-400" />
          Template discothèque
        </button>
      </div>

      {/* Espaces */}
      <Section
        title="Espaces"
        required
        error={errors.espaces}
        hint="Grandes zones physiques (Piste, Bar, VIP...)"
      >
        <div className="flex gap-2 mb-2">
          <input
            value={newEspace.nom}
            onChange={e => setNewEspace(s => ({ ...s, nom: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addEspace()}
            placeholder="Nom de l'espace"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-1">
            {COULEURS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewEspace(s => ({ ...s, couleur: c }))}
                className={`w-7 h-7 rounded-md transition-transform hover:scale-110 ${newEspace.couleur === c ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button type="button" onClick={addEspace} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <ItemList
          items={data.espaces}
          renderItem={e => <><span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.couleur }} />{e.nom}</>}
          onRemove={i => onChange({ espaces: data.espaces.filter((_, idx) => idx !== i) })}
        />
      </Section>

      {/* Zones */}
      <Section title="Zones" required error={errors.zones} hint="Sous-zones avec catégorie (Entrée, Piste, Sortie secours...)">
        <div className="flex gap-2 mb-2">
          <input
            value={newZone.nom}
            onChange={e => setNewZone(s => ({ ...s, nom: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addZone()}
            placeholder="Nom de la zone"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newZone.categorie}
            onChange={e => setNewZone(s => ({ ...s, categorie: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CATEGORIE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Cap."
            value={newZone.capacite}
            onChange={e => setNewZone(s => ({ ...s, capacite: e.target.value ? parseInt(e.target.value) : '' }))}
            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={addZone} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <ItemList
          items={data.zones}
          renderItem={z => <>{z.nom}<span className="ml-2 text-xs text-slate-500">{CATEGORIE_LABELS[z.categorie]}</span>{z.capacite ? <span className="ml-1 text-xs text-slate-500">· {z.capacite} pers.</span> : null}</>}
          onRemove={i => onChange({ zones: data.zones.filter((_, idx) => idx !== i) })}
        />
      </Section>

      {/* Niveaux */}
      <Section title="Niveaux (étages)" hint="Optionnel — RDC, Étage 1, Sous-sol...">
        <div className="flex gap-2 mb-2">
          <input
            value={newNiveau.nom}
            onChange={e => setNewNiveau(s => ({ ...s, nom: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addNiveau()}
            placeholder="ex : RDC"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={addNiveau} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <ItemList
          items={data.niveaux}
          renderItem={n => <>{n.nom}<span className="ml-2 text-xs text-slate-500">#{n.ordre}</span></>}
          onRemove={i => onChange({ niveaux: data.niveaux.filter((_, idx) => idx !== i) })}
        />
      </Section>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-all">
          <ChevronLeft className="w-4 h-4" />Retour
        </button>
        <button
          onClick={() => { if (validate()) onNext({}); }}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all"
        >
          <ChevronRight className="w-4 h-4" />Suivant
        </button>
      </div>
    </div>
  );
}

function Section({ title, required, error, hint, children }: { title: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}{required && <span className="text-red-400 ml-1">*</span>}</h3>
        {hint && <span className="text-xs text-slate-500">— {hint}</span>}
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      {children}
    </div>
  );
}

function ItemList<T>({ items, renderItem, onRemove }: { items: T[]; renderItem: (item: T) => React.ReactNode; onRemove: (i: number) => void }) {
  if (items.length === 0) return <p className="text-xs text-slate-500 italic">Aucun élément</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800 rounded-lg group">
          <div className="flex items-center gap-2 text-sm text-slate-300 min-w-0">{renderItem(item)}</div>
          <button type="button" onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
