import { useState } from 'react';
import { ShieldCheck, Plus, Trash2, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import type { OnboardingData, VerificateurItem } from './types';

interface Props {
  data: OnboardingData;
  onChange: (patch: Partial<OnboardingData>) => void;
  onNext: (patch: Partial<OnboardingData>) => void;
  onBack: () => void;
  saving: boolean;
}

const TYPES_VERIF = ['SSI', 'Électricité', 'Extincteurs', 'BAES', 'Autre'];

const TEMPLATE_BOURGOGNE: VerificateurItem[] = [
  { nom: 'Apave Bourgogne', type: 'SSI', organisme: 'Apave', personne: '', telephone: '03 80 00 00 00', email: '', prochaine_visite: '' },
  { nom: 'RVRE Bourgogne', type: 'Électricité', organisme: 'RVRE', personne: '', telephone: '', email: '', prochaine_visite: '' },
  { nom: 'Securitas Fire Safety', type: 'Extincteurs', organisme: 'Securitas', personne: '', telephone: '', email: '', prochaine_visite: '' },
  { nom: 'Bureau Veritas Dijon', type: 'BAES', organisme: 'Bureau Veritas', personne: '', telephone: '03 80 00 00 01', email: '', prochaine_visite: '' },
];

const EMPTY_VERIF: VerificateurItem = { nom: '', type: 'SSI', organisme: '', personne: '', telephone: '', email: '', prochaine_visite: '' };

export default function Step4({ data, onChange, onNext, onBack, saving }: Props) {
  const [newRow, setNewRow] = useState<VerificateurItem>({ ...EMPTY_VERIF });

  function addRow() {
    if (!newRow.nom.trim()) return;
    onChange({ verificateurs: [...data.verificateurs, { ...newRow }] });
    setNewRow({ ...EMPTY_VERIF });
  }

  function updateRow(i: number, patch: Partial<VerificateurItem>) {
    const updated = data.verificateurs.map((v, idx) => idx === i ? { ...v, ...patch } : v);
    onChange({ verificateurs: updated });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
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
          onClick={() => onChange({ verificateurs: [...data.verificateurs, ...TEMPLATE_BOURGOGNE] })}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-300 transition-all"
        >
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          Bourgogne standard
        </button>
      </div>

      {/* Existing rows */}
      {data.verificateurs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="pb-2 pr-3">Nom</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Organisme</th>
                <th className="pb-2 pr-3">Contact</th>
                <th className="pb-2 pr-3">Prochaine visite</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.verificateurs.map((v, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3">
                    <input value={v.nom} onChange={e => updateRow(i, { nom: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-2 pr-3">
                    <select value={v.type} onChange={e => updateRow(i, { type: e.target.value })} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                      {TYPES_VERIF.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input value={v.organisme} onChange={e => updateRow(i, { organisme: e.target.value })} placeholder="Bureau Veritas" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-2 pr-3">
                    <input value={v.telephone} onChange={e => updateRow(i, { telephone: e.target.value })} placeholder="Tél." className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="date" value={v.prochaine_visite} onChange={e => updateRow(i, { prochaine_visite: e.target.value })} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="py-2">
                    <button type="button" onClick={() => onChange({ verificateurs: data.verificateurs.filter((_, idx) => idx !== i) })} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New row form */}
      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
        <p className="text-xs font-medium text-slate-400 mb-3">Ajouter un organisme</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <input
            value={newRow.nom}
            onChange={e => setNewRow(s => ({ ...s, nom: e.target.value }))}
            placeholder="Nom du vérificateur"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newRow.type}
            onChange={e => setNewRow(s => ({ ...s, type: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TYPES_VERIF.map(t => <option key={t}>{t}</option>)}
          </select>
          <input
            value={newRow.organisme}
            onChange={e => setNewRow(s => ({ ...s, organisme: e.target.value }))}
            placeholder="Organisme (ex: Apave)"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={newRow.personne}
            onChange={e => setNewRow(s => ({ ...s, personne: e.target.value }))}
            placeholder="Personne de contact"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={newRow.telephone}
            onChange={e => setNewRow(s => ({ ...s, telephone: e.target.value }))}
            placeholder="Téléphone"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email"
            value={newRow.email}
            onChange={e => setNewRow(s => ({ ...s, email: e.target.value }))}
            placeholder="Email"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={newRow.prochaine_visite}
            onChange={e => setNewRow(s => ({ ...s, prochaine_visite: e.target.value }))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="button" onClick={addRow} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-all">
          <Plus className="w-4 h-4" />Ajouter
        </button>
      </div>

      {data.verificateurs.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-2">
          Aucun organisme ajouté — cette étape est optionnelle.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-all">
          <ChevronLeft className="w-4 h-4" />Retour
        </button>
        <button onClick={() => onNext({})} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all">
          <ChevronRight className="w-4 h-4" />Suivant
        </button>
      </div>
    </div>
  );
}
