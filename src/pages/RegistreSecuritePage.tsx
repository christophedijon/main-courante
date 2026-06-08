import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardList, Upload, Eye, History, X, ChevronDown, ChevronUp,
  Plus, Save, CheckCircle, AlertTriangle, Clock, Minus, FileText, Loader2, Pencil, Trash2,
  Archive, PlayCircle,
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
  email_organisme: string;
  periodicite: string;
  jours_rappel: number | null;
  applicable: boolean;
  date_verification: string | null;
  nom_verificateur: string;
  telephone_verificateur: string;
  observations: string;
  observations_levees: string;
  rapport_url: string;
  updated_at: string;
  reprise_papier: boolean;
  confirme_par_organisme: boolean;
  confirme_at: string | null;
  confirme_organisme_email: string | null;
};

type ConfirmationEntry = {
  installation: string;
  organisme_verificateur: string;
  confirme_at: string;
  confirme_organisme_email: string | null;
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

function getNextDate(lastDate: string, periodicite: string): Date | null {
  if (!lastDate) return null;
  const d = new Date(lastDate);
  switch (periodicite.toLowerCase()) {
    case 'mensuelle': d.setMonth(d.getMonth() + 1); break;
    case 'trimestrielle': d.setMonth(d.getMonth() + 3); break;
    case 'semestrielle': d.setMonth(d.getMonth() + 6); break;
    case 'annuelle': d.setFullYear(d.getFullYear() + 1); break;
    case 'triennale': d.setFullYear(d.getFullYear() + 3); break;
    case 'quinquennale': d.setFullYear(d.getFullYear() + 5); break;
    case 'sans': return null;
    default: return null;
  }
  return d;
}

function getStatut(lastDate: string | null, periodicite: string, applicable: boolean): Statut {
  if (!applicable) return 'non_applicable';
  if (periodicite.toLowerCase() === 'sans') return 'non_applicable';
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
  mensuelle: 'bg-red-500/15 text-red-300 border-red-500/30',
  trimestrielle: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  semestrielle: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  annuelle: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  triennale: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  quinquennale: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  sans: 'bg-slate-700/30 text-slate-500 border-slate-600/30',
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

// ─── Historique Panel ────────────────────────────────────────────────────────

function HistoriquePanel({ item, onClose }: { item: RegistreItem; onClose: () => void }) {
  const [entries, setEntries] = useState<HistoriqueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from('registre_historique')
        .select('*')
        .eq('registre_id', item.id),
      supabase
        .from('registre_signatures')
        .select('id, registre_id, date_verification_signee, verificateur_nom, observations_signature, signed_at')
        .eq('registre_id', item.id),
    ]).then(([{ data: histData }, { data: sigData }]) => {
      const histEntries: HistoriqueEntry[] = (histData ?? []) as HistoriqueEntry[];
      const sigEntries: HistoriqueEntry[] = (sigData ?? []).map((s: any) => ({
        id: s.id,
        registre_id: s.registre_id,
        date_verification: s.date_verification_signee,
        nom_verificateur: s.verificateur_nom ?? '',
        rapport_url: '',
        observations: s.observations_signature ?? '',
        observations_levees: '',
        created_at: s.signed_at,
        _signed: true,
      }));
      const allEntries = [...histEntries, ...sigEntries].sort(
        (a, b) => new Date(b.date_verification).getTime() - new Date(a.date_verification).getTime()
      );
      setEntries(allEntries);
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
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">{formatDate(e.date_verification)}</span>
                  {(e as any)._signed && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      Signé
                    </span>
                  )}
                </div>
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

// ─── Confirmations Organisme Modal ──────────────────────────────────────────

function ConfirmationsModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ConfirmationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('registre_securite')
      .select('installation, organisme_verificateur, confirme_at, confirme_organisme_email')
      .eq('confirme_par_organisme', true)
      .order('confirme_at', { ascending: false })
      .then(({ data }) => {
        setEntries((data ?? []) as ConfirmationEntry[]);
        setLoading(false);
      });
  }, []);

  function scroll(dir: 'up' | 'down') {
    scrollRef.current?.scrollBy({ top: dir === 'down' ? 120 : -120, behavior: 'smooth' });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <div>
            <h3 className="text-white font-bold text-[17px]">Confirmations organisme</h3>
            {!loading && (
              <p className="text-slate-500 text-xs mt-0.5">{entries.length} confirmation{entries.length !== 1 ? 's' : ''} reçue{entries.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
          {loading && <p className="text-slate-500 text-sm text-center py-8">Chargement…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-slate-500 text-sm italic text-center py-10">Aucune confirmation reçue pour le moment</p>
          )}
          <div className="space-y-3">
            {entries.map((e, i) => {
              const d = new Date(e.confirme_at);
              const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm leading-snug truncate">{e.installation}</p>
                    {e.organisme_verificateur && (
                      <p className="text-slate-400 text-xs mt-0.5 truncate">{e.organisme_verificateur}</p>
                    )}
                    {e.confirme_organisme_email && (
                      <p className="text-slate-500 text-xs mt-0.5 truncate">{e.confirme_organisme_email}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-blue-400 text-xs font-semibold whitespace-nowrap">{dateStr}</p>
                    <p className="text-slate-500 text-xs">à {timeStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="shrink-0 px-6 pb-6 pt-2 border-t border-slate-800 flex items-center gap-3">
          <div className="flex gap-2">
            <button onClick={() => scroll('up')} className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button onClick={() => scroll('down')} className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors text-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 2-Step Verification Modal ───────────────────────────────────────────────

type VerifModalProps = {
  item: RegistreItem;
  onClose: () => void;
  onSaved: (updated: RegistreItem) => void;
};

type VerifForm = {
  date_verification: string;
  nom_verificateur: string;
  observations: string;
  observations_levees: string;
  rapport_file: File | null;
};

function VerifModal({ item, onClose, onSaved }: VerifModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<VerifForm>({
    date_verification: '',
    nom_verificateur: '',
    observations: '',
    observations_levees: '',
    rapport_file: null,
  });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasPrevious = !!item.date_verification;
  const totalSteps = hasPrevious ? 2 : 1;

  function handleNext() {
    if (!form.date_verification) return;
    if (hasPrevious) {
      setStep(2);
    } else {
      handleConfirm();
    }
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      // 1. Archive old data if exists
      if (item.date_verification) {
        await supabase.from('registre_historique').insert({
          registre_id: item.id,
          date_verification: item.date_verification,
          nom_verificateur: item.nom_verificateur,
          rapport_url: item.rapport_url,
          observations: item.observations,
          observations_levees: item.observations_levees,
        });
      }

      // 2. Upload new rapport if provided
      let rapport_url = item.rapport_url;
      if (form.rapport_file) {
        const ext = form.rapport_file.name.split('.').pop();
        const path = `${item.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('registre-securite')
          .upload(path, form.rapport_file, { contentType: form.rapport_file.type, upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('registre-securite').getPublicUrl(path);
          rapport_url = urlData.publicUrl;
        }
      }

      // 3. Save new verification data
      const { data, error } = await supabase
        .from('registre_securite')
        .update({
          date_verification: form.date_verification,
          nom_verificateur: form.nom_verificateur,
          observations: form.observations,
          observations_levees: form.observations_levees,
          rapport_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .select()
        .single();

      if (!error && data) {
        onSaved(data as RegistreItem);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Étape {step} / {totalSteps}
            </span>
            <h3 className="text-white font-bold text-lg mt-0.5">
              {step === 1 ? 'Nouvelle vérification' : 'Confirmation d\'archivage'}
            </h3>
            <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[260px]">{item.installation}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        {hasPrevious && (
          <div className="flex gap-2 mb-6">
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-blue-500' : 'bg-slate-700'}`} />
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-blue-500' : 'bg-slate-700'}`} />
          </div>
        )}

        {/* STEP 1 — New verification form */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Date de vérification *</label>
              <input
                type="date"
                value={form.date_verification}
                onChange={(e) => setForm(f => ({ ...f, date_verification: e.target.value }))}
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Nom du vérificateur</label>
              <input
                type="text"
                value={form.nom_verificateur}
                onChange={(e) => setForm(f => ({ ...f, nom_verificateur: e.target.value }))}
                placeholder="Nom ou organisme"
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Rapport PDF (optionnel)</label>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setForm(f => ({ ...f, rapport_file: e.target.files?.[0] ?? null }))} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full mt-1.5 flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl px-3 py-2.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{form.rapport_file ? form.rapport_file.name : 'Choisir un fichier…'}</span>
              </button>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Observations</label>
              <textarea
                value={form.observations}
                onChange={(e) => setForm(f => ({ ...f, observations: e.target.value }))}
                rows={3}
                placeholder="Observations de la vérification…"
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Levée des observations</label>
              <textarea
                value={form.observations_levees}
                onChange={(e) => setForm(f => ({ ...f, observations_levees: e.target.value }))}
                rows={2}
                placeholder="Mesures correctives…"
                className={`w-full mt-1.5 border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none resize-none transition-colors ${form.observations_levees ? 'bg-emerald-950/40 border-emerald-700/40 focus:border-emerald-500' : 'bg-slate-800 border-slate-700 focus:border-blue-500'}`}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors">
                Annuler
              </button>
              <button
                onClick={handleNext}
                disabled={!form.date_verification || saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {!hasPrevious && saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement…</>
                ) : hasPrevious ? 'Suivant →' : 'Confirmer'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Archive confirmation */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">La vérification précédente sera archivée dans l'historique avant d'être remplacée.</p>

            {/* Previous verification summary card */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2.5">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Vérification précédente</p>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Date</span>
                <span className="text-white text-sm font-semibold">{formatDate(item.date_verification)}</span>
              </div>
              {item.nom_verificateur && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Vérificateur</span>
                  <span className="text-white text-sm">{item.nom_verificateur}</span>
                </div>
              )}
              {item.rapport_url && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Rapport</span>
                  <a href={item.rapport_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg transition-colors">
                    <FileText className="w-3 h-3" />Voir
                  </a>
                </div>
              )}
              {item.observations && (
                <div>
                  <span className="text-slate-400 text-sm">Observations</span>
                  <p className="text-slate-300 text-xs mt-1 leading-relaxed">{item.observations}</p>
                </div>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <p className="text-amber-300 text-xs">Cette vérification sera archivée dans l'historique.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors">
                ← Retour
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirmer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Modal ───────────────────────────────────────────────────────────────

type AddModalProps = { onClose: () => void; onAdded: (item: RegistreItem) => void };

function AddModal({ onClose, onAdded }: AddModalProps) {
  const [form, setForm] = useState({ installation: '', reference_reglementaire: '', organisme_verificateur: '', email_organisme: '', periodicite: 'Annuelle', jours_rappel: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!form.installation.trim()) return;
    setSaving(true);
    const payload = {
      installation: form.installation,
      reference_reglementaire: form.reference_reglementaire,
      organisme_verificateur: form.organisme_verificateur,
      email_organisme: form.email_organisme,
      periodicite: form.periodicite,
      jours_rappel: form.jours_rappel !== '' ? parseInt(form.jours_rappel, 10) : null,
      applicable: true,
    };
    const { data, error } = await supabase.from('registre_securite').insert(payload).select().single();
    if (!error && data) onAdded(data as RegistreItem);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-lg">Nouvelle visite périodique</h3>
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
            <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Email organisme</label>
            <input type="email" value={form.email_organisme} onChange={(e) => setForm(f => ({ ...f, email_organisme: e.target.value }))}
              className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="email@organisme.fr" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Périodicité</label>
            <select value={form.periodicite} onChange={(e) => setForm(f => ({ ...f, periodicite: e.target.value }))}
              className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              {['Mensuelle', 'Trimestrielle', 'Semestrielle', 'Annuelle', 'Triennale', 'Quinquennale', 'Sans', 'Autre'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Rappel (jours avant)</label>
            <input
              type="number"
              min="1"
              value={form.jours_rappel}
              onChange={(e) => setForm(f => ({ ...f, jours_rappel: e.target.value.replace(/[^0-9]/g, '') }))}
              className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="ex: 90 — laisser vide pour désactiver"
            />
            <p className="text-[11px] text-slate-500 mt-1">Un email est envoyé ce nombre de jours avant l'échéance calculée.</p>
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

// ─── Edit Modal ──────────────────────────────────────────────────────────────

type EditModalProps = {
  item: RegistreItem;
  onClose: () => void;
  onSaved: (updated: RegistreItem) => void;
  onDeleted: (id: string, status: 'success' | 'error') => void;
  onDeleteRequest: () => void;
};

function DeleteConfirmModal({ item, onCancel, onConfirm }: { item: RegistreItem; onCancel: () => void; onConfirm: (status: 'success' | 'error') => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    console.log('[delete] deleting registre id:', item.id);
    setDeleting(true);
    const { error } = await supabase.from('registre_securite').delete().eq('id', item.id);
    setDeleting(false);
    if (error) {
      console.error('Delete error:', error);
      onConfirm('error');
      return;
    }
    onConfirm('success');
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">Supprimer cette visite périodique ?</h3>
          <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Cette action est irréversible. Toutes les données associées à la visite périodique <span className="text-white font-semibold">{item.installation}</span> seront définitivement supprimées.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors text-sm">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Confirmer la suppression
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ item, onClose, onSaved, onDeleted, onDeleteRequest }: EditModalProps) {
  const [form, setForm] = useState({
    installation: item.installation,
    reference_reglementaire: item.reference_reglementaire,
    organisme_verificateur: item.organisme_verificateur,
    nom_verificateur: item.nom_verificateur,
    telephone_verificateur: item.telephone_verificateur ?? '',
    email_organisme: item.email_organisme,
    periodicite: item.periodicite,
    jours_rappel: item.jours_rappel !== null ? String(item.jours_rappel) : '',
    date_verification: item.date_verification ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    const patch: Partial<RegistreItem> = {
      installation: form.installation.trim(),
      reference_reglementaire: form.reference_reglementaire.trim(),
      organisme_verificateur: form.organisme_verificateur.trim(),
      nom_verificateur: form.nom_verificateur.trim(),
      telephone_verificateur: form.telephone_verificateur.trim(),
      email_organisme: form.email_organisme.trim(),
      periodicite: form.periodicite,
      jours_rappel: form.jours_rappel !== '' ? parseInt(form.jours_rappel, 10) : null,
      date_verification: form.date_verification !== '' ? form.date_verification : null,
    };
    const { data, error } = await supabase
      .from('registre_securite')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .select()
      .single();
    setSaving(false);
    if (!error && data) onSaved(data as RegistreItem);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div
          className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
          style={{ maxHeight: '90vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — fixed */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-slate-800">
            <h3 className="text-white font-bold text-lg">Modifier la visite périodique</h3>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Visite périodique *</label>
              <input value={form.installation} onChange={(e) => setForm(f => ({ ...f, installation: e.target.value }))}
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Nom de la visite périodique" />
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
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Nom du vérificateur</label>
              <input value={form.nom_verificateur} onChange={(e) => setForm(f => ({ ...f, nom_verificateur: e.target.value }))}
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Nom et prénom du vérificateur" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Téléphone</label>
              <input type="tel" value={form.telephone_verificateur} onChange={(e) => setForm(f => ({ ...f, telephone_verificateur: e.target.value }))}
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Téléphone du vérificateur" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Email organisme</label>
              <input type="email" value={form.email_organisme} onChange={(e) => setForm(f => ({ ...f, email_organisme: e.target.value }))}
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="email@organisme.fr" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Périodicité</label>
              <select value={form.periodicite} onChange={(e) => setForm(f => ({ ...f, periodicite: e.target.value }))}
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                {['Mensuelle', 'Trimestrielle', 'Semestrielle', 'Annuelle', 'Triennale', 'Quinquennale', 'Sans', 'Autre'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Rappel (jours avant)</label>
              <input
                type="number"
                min="1"
                value={form.jours_rappel}
                onChange={(e) => setForm(f => ({ ...f, jours_rappel: e.target.value.replace(/[^0-9]/g, '') }))}
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="ex: 90 — laisser vide pour désactiver"
              />
              <p className="text-[11px] text-slate-500 mt-1">Un email est envoyé ce nombre de jours avant l'échéance calculée.</p>
            </div>
            <div>
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Dernière vérification</label>
              <input
                type="date"
                value={form.date_verification}
                onChange={(e) => setForm(f => ({ ...f, date_verification: e.target.value }))}
                className="w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer — fixed */}
          <div className="shrink-0 px-6 py-4 border-t border-slate-800 flex gap-3">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); onDeleteRequest(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 transition-colors text-sm font-semibold shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !form.installation.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
  );
}

// ─── Activation Modal ────────────────────────────────────────────────────────

function ActivationModal({
  item,
  onClose,
  onUpdate,
}: {
  item: RegistreItem;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<RegistreItem>) => void;
}) {
  const [mode, setMode] = useState<null | 'migration' | 'numerique'>(null);
  const [migrationDate, setMigrationDate] = useState('');
  const [migrationNom, setMigrationNom] = useState('');
  const [saving, setSaving] = useState(false);

  const canSaveMigration = migrationDate.trim() !== '' && migrationNom.trim() !== '';

  const inputClass = "w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500";

  async function handleMigration() {
    if (!canSaveMigration) return;
    setSaving(true);
    const { error } = await supabase.from('registre_securite').update({
      applicable: true,
      date_verification: migrationDate,
      nom_verificateur: migrationNom.trim(),
      reprise_papier: true,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    setSaving(false);
    if (!error) {
      onUpdate(item.id, { applicable: true, date_verification: migrationDate, nom_verificateur: migrationNom.trim(), reprise_papier: true });
      onClose();
    }
  }

  async function handleNumerique() {
    setSaving(true);
    const { error } = await supabase.from('registre_securite').update({
      applicable: true,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    setSaving(false);
    if (!error) {
      onUpdate(item.id, { applicable: true });
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0 border-b border-slate-800">
          <div>
            <h3 className="text-white font-bold text-lg">Première activation</h3>
            <p className="text-slate-400 text-sm mt-0.5 truncate max-w-[280px]">{item.installation}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
          {/* Choice cards */}
          {mode === null && (
            <div className="space-y-3">
              {/* Card A — Migration registre */}
              <button
                type="button"
                onClick={() => setMode('migration')}
                className="w-full text-left rounded-2xl border border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/15 p-4 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                    <Archive className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm group-hover:text-amber-200 transition-colors">Migration registre</p>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">Transférer les données de l'ancien registre cahier.</p>
                  </div>
                </div>
              </button>

              {/* Card B — Première visite numérique */}
              <button
                type="button"
                onClick={() => setMode('numerique')}
                className="w-full text-left rounded-2xl border border-blue-500/30 bg-blue-500/8 hover:bg-blue-500/15 p-4 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                    <PlayCircle className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm group-hover:text-blue-200 transition-colors">Première visite numérique</p>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">La périodicité démarrera à la première signature numérique.</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Migration fields */}
          {mode === 'migration' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                ← Retour
              </button>
              <div>
                <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Date de la dernière vérification (registre papier) *</label>
                <input
                  type="date"
                  value={migrationDate}
                  onChange={(e) => setMigrationDate(e.target.value)}
                  className={inputClass}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Nom du vérificateur / organisme *</label>
                <input
                  type="text"
                  value={migrationNom}
                  onChange={(e) => setMigrationNom(e.target.value)}
                  placeholder="Nom ou organisme"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Numérique confirmation */}
          {mode === 'numerique' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                ← Retour
              </button>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                <p className="text-blue-300 text-sm leading-relaxed">
                  L'installation sera activée sans date de vérification. La périodicité démarrera à la première signature numérique.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-800 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl transition-colors text-sm">
            Annuler
          </button>
          {mode === 'migration' && (
            <button
              type="button"
              onClick={handleMigration}
              disabled={!canSaveMigration || saving}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Enregistrer la migration
            </button>
          )}
          {mode === 'numerique' && (
            <button
              type="button"
              onClick={handleNumerique}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              Activer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Desktop Table Row ───────────────────────────────────────────────────────

type RowProps = {
  item: RegistreItem;
  historiqueCount: number;
  onUpdate: (id: string, patch: Partial<RegistreItem>) => void;
  onSaved: (updated: RegistreItem) => void;
  onDeleted: (id: string, status: 'success' | 'error') => void;
  onHistoriqueCountChange: (id: string, delta: number) => void;
};

function RegistreRow({ item, historiqueCount, onUpdate, onSaved, onDeleted, onHistoriqueCountChange }: RowProps) {
  const [showHistorique, setShowHistorique] = useState(false);
  const [showVerif, setShowVerif] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);

  const statut = getStatut(item.date_verification, item.periodicite, item.applicable);
  const nextDate = item.date_verification ? getNextDate(item.date_verification, item.periodicite) : null;

  async function handleToggleApplicable() {
    const newVal = !item.applicable;
    if (!newVal) {
      const { error } = await supabase.from('registre_securite').update({ applicable: false, updated_at: new Date().toISOString() }).eq('id', item.id);
      if (!error) onUpdate(item.id, { applicable: false });
      return;
    }
    if (item.date_verification !== null) {
      const { error } = await supabase.from('registre_securite').update({ applicable: true, updated_at: new Date().toISOString() }).eq('id', item.id);
      if (!error) onUpdate(item.id, { applicable: true });
      return;
    }
    setShowActivationModal(true);
  }

  function handleVerifSaved(updated: RegistreItem) {
    onSaved(updated);
    if (item.date_verification) {
      onHistoriqueCountChange(item.id, 1);
    }
  }

  const rowOpacity = !item.applicable ? 'opacity-50' : '';

  return (
    <>
      <tr className={`border-b border-slate-800 hover:bg-slate-900/50 transition-colors ${rowOpacity}`}>
        {/* Applicable toggle */}
        <td className="px-3 py-3 text-center">
          <button type="button" onClick={handleToggleApplicable}
            className={`w-10 h-5 rounded-full transition-colors relative ${item.applicable ? 'bg-blue-600' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${item.applicable ? 'left-5' : 'left-0.5'}`} />
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
        <td className="px-3 py-3 min-w-[110px]">
          <p className="text-slate-300 text-xs">{formatDate(item.date_verification)}</p>
        </td>

        {/* Vérificateur */}
        <td className="px-3 py-3 min-w-[120px]">
          <p className="text-slate-400 text-xs">{item.nom_verificateur || <span className="text-slate-600">—</span>}</p>
        </td>

        {/* Prochaine vérification + statut */}
        <td className="px-3 py-3 min-w-[160px]">
          <div className="space-y-1">
            {item.confirme_par_organisme ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 whitespace-nowrap">
                  <CheckCircle className="w-3 h-3" />Confirmé par l'organisme
                </span>
                {item.confirme_at && (
                  <p className="text-slate-500 text-[10px]">
                    le {new Date(item.confirme_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                )}
              </>
            ) : (
              <>
                <StatutBadge statut={statut} nextDate={nextDate} />
                {nextDate && <p className="text-slate-500 text-[10px]">{nextDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>}
              </>
            )}
          </div>
        </td>

        {/* Observations */}
        <td className="px-3 py-3 min-w-[150px]">
          <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{item.observations || <span className="text-slate-600">—</span>}</p>
        </td>

        {/* Levée des observations */}
        <td className="px-3 py-3 min-w-[150px]">
          <p className={`text-xs leading-relaxed line-clamp-2 ${item.observations_levees ? 'text-emerald-400' : 'text-slate-600'}`}>
            {item.observations_levees || '—'}
          </p>
        </td>

        {/* Rapport PDF */}
        <td className="px-3 py-3 min-w-[80px]">
          {item.rapport_url ? (
            <a href={item.rapport_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg transition-colors whitespace-nowrap w-fit">
              <Eye className="w-3 h-3" />Voir
            </a>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setShowVerif(true)}
              className="flex items-center gap-1 text-[11px] text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-semibold"
            >
              <CheckCircle className="w-3 h-3" />
              Nouvelle visite
            </button>
            <button type="button" onClick={() => setShowHistorique(true)}
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              <History className="w-3 h-3" />
              Historique
              {historiqueCount > 0 && (
                <span className="bg-slate-600 text-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {historiqueCount}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setShowEdit(true)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              <Pencil className="w-3 h-3" />Modifier
            </button>
          </div>
        </td>
      </tr>

      {showHistorique && <HistoriquePanel item={item} onClose={() => setShowHistorique(false)} />}
      {showVerif && <VerifModal item={item} onClose={() => setShowVerif(false)} onSaved={handleVerifSaved} />}
      {showEdit && (
        <EditModal
          item={item}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { onSaved(updated); setShowEdit(false); }}
          onDeleted={onDeleted}
          onDeleteRequest={() => { setShowEdit(false); setShowDeleteConfirm(true); }}
        />
      )}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          item={item}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={(status) => { setShowDeleteConfirm(false); onDeleted(item.id, status); }}
        />
      )}
      {showActivationModal && (
        <ActivationModal
          item={item}
          onClose={() => setShowActivationModal(false)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}

// ─── Mobile Card View ────────────────────────────────────────────────────────

type MobileFilter = 'all' | 'retard' | 'attention' | 'a_jour';

function MobileCardView({ items, historiqueCounts }: { items: RegistreItem[]; historiqueCounts: Record<string, number> }) {
  const [filter, setFilter] = useState<MobileFilter>('all');
  const [histItem, setHistItem] = useState<RegistreItem | null>(null);

  const counts = useMemo(() => ({
    retard: items.filter(i => getStatut(i.date_verification, i.periodicite, i.applicable) === 'retard').length,
    attention: items.filter(i => getStatut(i.date_verification, i.periodicite, i.applicable) === 'attention').length,
    a_jour: items.filter(i => getStatut(i.date_verification, i.periodicite, i.applicable) === 'a_jour').length,
  }), [items]);

  const filtered = useMemo(() => {
    const withStatut = items.map(item => ({
      item,
      statut: getStatut(item.date_verification, item.periodicite, item.applicable),
      nextDate: item.date_verification ? getNextDate(item.date_verification, item.periodicite) : null,
    }));
    const sorted = withStatut.sort((a, b) => {
      const order: Record<Statut, number> = { retard: 0, attention: 1, a_jour: 2, non_planifie: 3, non_applicable: 4 };
      return order[a.statut] - order[b.statut];
    });
    if (filter === 'all') return sorted;
    return sorted.filter(({ statut }) => statut === filter);
  }, [items, filter]);

  const filters: { key: MobileFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'retard', label: 'Retard', count: counts.retard },
    { key: 'attention', label: 'À planifier', count: counts.attention },
    { key: 'a_jour', label: 'À jour', count: counts.a_jour },
  ];

  return (
    <div className="md:hidden">
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm pb-3 pt-1">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {filters.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${
                filter === key
                  ? 'bg-[#3b8fe8] text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  filter === key ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Aucune visite périodique dans cette catégorie</p>
          </div>
        )}
        {filtered.map(({ item, statut, nextDate }) => {
          const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
          const count = historiqueCounts[item.id] ?? 0;

          return (
            <div
              key={item.id}
              className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4"
            >
              {/* Top row: name + status badge */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-white font-bold text-base leading-snug">{item.installation}</p>
                <div className="shrink-0">
                  {statut === 'retard' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 whitespace-nowrap">
                      <AlertTriangle className="w-3 h-3" />EN RETARD
                    </span>
                  )}
                  {statut === 'attention' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                      <AlertTriangle className="w-3 h-3" />À PLANIFIER
                    </span>
                  )}
                  {statut === 'a_jour' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                      <CheckCircle className="w-3 h-3" />À JOUR
                    </span>
                  )}
                  {(statut === 'non_applicable' || statut === 'non_planifie') && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-700/50 text-slate-400 border border-slate-600/30 whitespace-nowrap">
                      <Minus className="w-3 h-3" />SANS OBJET
                    </span>
                  )}
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-1.5 mb-3">
                <p className="text-slate-400 text-sm">
                  Dernière vérif. : <span className="text-slate-200 font-medium">{item.date_verification ? formatDate(item.date_verification) : 'Jamais vérifié'}</span>
                </p>
                {nextDate && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-400 text-sm">
                      Prochaine : <span className="text-slate-200 font-medium">{nextDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </p>
                    {daysLeft !== null && (
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                        daysLeft < 0
                          ? 'bg-red-500/20 text-red-400'
                          : daysLeft < 90
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {daysLeft < 0 ? `J+${Math.abs(daysLeft)} en retard` : `J-${daysLeft}`}
                      </span>
                    )}
                  </div>
                )}
                {item.reference_reglementaire && (
                  <p className="text-slate-500 text-xs">{item.reference_reglementaire} · {item.periodicite}</p>
                )}
              </div>

              {/* Historique button */}
              <button
                type="button"
                onClick={() => setHistItem(item)}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors w-full justify-center font-medium"
              >
                <History className="w-4 h-4" />
                Historique
                {count > 0 && (
                  <span className="bg-slate-600 text-slate-200 text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ml-0.5">{count}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {histItem && <HistoriquePanel item={histItem} onClose={() => setHistItem(null)} />}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RegistreSecuritePage() {
  const { signOut, session } = useAuth();
  const { nom, logo_url } = useEntreprise();
  const [items, setItems] = useState<RegistreItem[]>([]);
  const [historiqueCounts, setHistoriqueCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [collapseNonApp, setCollapseNonApp] = useState(true);
  const [showConfirmations, setShowConfirmations] = useState(false);
  const [userFonction, setUserFonction] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.email) return;
    supabase
      .from('managed_users')
      .select('fonction')
      .eq('email', session.user.email)
      .maybeSingle()
      .then(({ data }) => setUserFonction((data as any)?.fonction ?? null));
  }, [session]);

  useEffect(() => {
    (async () => {
      try {
        const [{ data, error }, { data: histRows }, { data: sigRows }] = await Promise.all([
          supabase.from('registre_securite').select('*').order('installation'),
          supabase.from('registre_historique').select('registre_id'),
          supabase.from('registre_signatures').select('registre_id'),
        ]);
        if (error) throw error;
        setItems((data ?? []) as RegistreItem[]);

        const countMap: Record<string, number> = {};
        for (const row of histRows ?? []) {
          const rid = (row as any).registre_id;
          countMap[rid] = (countMap[rid] ?? 0) + 1;
        }
        for (const row of sigRows ?? []) {
          const rid = (row as any).registre_id;
          countMap[rid] = (countMap[rid] ?? 0) + 1;
        }
        setHistoriqueCounts(countMap);
      } catch (err: any) {
        console.error('RegistreSecuritePage error:', err);
        setLoadError(err?.message ?? 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleUpdate(id: string, patch: Partial<RegistreItem>) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));
  }

  function handleSaved(updated: RegistreItem) {
    setItems((prev) => prev.map((it) => it.id === updated.id ? updated : it));
  }

  function handleHistoriqueCountChange(id: string, delta: number) {
    setHistoriqueCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + delta }));
  }

  const [toast, setToast] = useState<string | null>(null);

  function handleDeleted(id: string, status: 'success' | 'error') {
    if (status === 'error') {
      setToast('Erreur lors de la suppression');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
    setToast('Visite périodique supprimée');
    setTimeout(() => setToast(null), 3000);
  }

  const lastUpdated = items.reduce<string | null>((acc, it) => {
    if (!acc || it.updated_at > acc) return it.updated_at;
    return acc;
  }, null);

  const applicable = items.filter((it) => it.applicable);
  const nonApplicable = items.filter((it) => !it.applicable);

  const stats = useMemo(() => {
    let enRetard = 0;
    let aPlanifier = 0;
    let aJour = 0;
    let sansObjet = 0;
    items.forEach((item) => {
      const statut = getStatut(item.date_verification, item.periodicite, item.applicable);
      switch (statut) {
        case 'retard': enRetard++; break;
        case 'attention': aPlanifier++; break;
        case 'a_jour': aJour++; break;
        case 'non_applicable': sansObjet++; break;
      }
    });
    return { enRetard, aPlanifier, aJour, sansObjet };
  }, [items]);

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
            className="hidden md:flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />Nouvelle visite périodique
          </button>
        </div>

        {/* Summary badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'En retard', count: stats.enRetard, color: 'red' },
            { label: 'À planifier', count: stats.aPlanifier, color: 'amber' },
            { label: 'À jour', count: stats.aJour, color: 'emerald' },
            { label: 'Sans objet', count: stats.sansObjet, color: 'slate' },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <p className={`text-3xl font-black ${color === 'red' ? 'text-red-400' : color === 'amber' ? 'text-amber-400' : color === 'emerald' ? 'text-emerald-400' : 'text-slate-400'}`}>{count}</p>
              <p className="text-slate-500 text-sm mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {loading && <p className="text-slate-500 text-sm text-center py-16">Chargement…</p>}

        {loadError && (
          <div className="min-h-[40vh] flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-red-400 font-semibold mb-2">Erreur de chargement</p>
              <p className="text-slate-500 text-sm mb-4">{loadError}</p>
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 transition-colors">Réessayer</button>
            </div>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {/* Mobile card view — shown only on small screens */}
            <MobileCardView items={items} historiqueCounts={historiqueCounts} />

            {/* Desktop table — hidden on small screens */}
            <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/60 border-b border-slate-700">
                      {['Applic.', 'Visite périodique', 'Référence', 'Organisme', 'Périodicité', 'Dernière vérif.', 'Vérificateur', 'Prochaine vérif.', 'Observations', 'Levée observations', 'Rapport PDF', 'Actions'].map((h) => (
                        <th key={h} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {applicable.map((item) => (
                      <RegistreRow
                        key={item.id}
                        item={item}
                        historiqueCount={historiqueCounts[item.id] ?? 0}
                        onUpdate={handleUpdate}
                        onSaved={handleSaved}
                        onDeleted={handleDeleted}
                        onHistoriqueCountChange={handleHistoriqueCountChange}
                      />
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
                    {nonApplicable.length} visite(s) périodique(s) sans objet
                  </button>
                  {!collapseNonApp && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <tbody>
                          {nonApplicable.map((item) => (
                            <RegistreRow
                              key={item.id}
                              item={item}
                              historiqueCount={historiqueCounts[item.id] ?? 0}
                              onUpdate={handleUpdate}
                              onSaved={handleSaved}
                              onHistoriqueCountChange={handleHistoriqueCountChange}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Confirmations history button — SuperAdmin / Direction only */}
      {(userFonction === 'Direction' || userFonction === null) && !loading && !loadError && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pb-10 mt-2">
          <button
            onClick={() => setShowConfirmations(true)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-xl transition-colors font-medium"
          >
            <History className="w-4 h-4" />
            Historique des confirmations organisme
          </button>
        </div>
      )}

      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onAdded={(item) => { setItems((prev) => [...prev, item]); setShowAddModal(false); }}
        />
      )}

      {showConfirmations && (
        <ConfirmationsModal onClose={() => setShowConfirmations(false)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-slate-800 border border-slate-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
