import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, AlertTriangle, Clock, Minus, FileText, ChevronDown, ChevronUp,
  FileDown, Printer, X, PenLine, RotateCcw, Archive, Pencil,
} from 'lucide-react';
import SignaturePad from 'signature_pad';
import { supabase } from '../../lib/supabase';
import { useEntreprise } from '../../hooks/useEntreprise';
import { useAuth } from '../../context/AuthContext';
import FicheVerification, { type RegistreSignature } from '../../components/FicheVerification';
import ConformiteDashboard from '../components/ConformiteDashboard';
import EcheancesDashboard from '../components/EcheancesDashboard';

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
};

type RegistreSignatureRow = RegistreSignature & {
  id: string;
  registre_id: string;
  date_verification_signee: string;
  signataire_id: string;
  verificateur_nom: string;
  verificateur_organisme: string;
  verificateur_contact: string;
  observations_signature: string;
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
  if (!d) return 'Non planifié';
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const GROUP_CONFIG = [
  {
    key: 'retard' as Statut,
    label: 'En retard',
    icon: AlertTriangle,
    cardBorder: 'border-red-700/40',
    cardBg: 'bg-red-950/30',
    badgeBg: 'bg-red-500/15 text-red-400 border-red-500/30',
    iconColor: 'text-red-400',
  },
  {
    key: 'attention' as Statut,
    label: 'À planifier sous 3 mois',
    icon: AlertTriangle,
    cardBorder: 'border-amber-700/40',
    cardBg: 'bg-amber-950/30',
    badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    iconColor: 'text-amber-400',
  },
  {
    key: 'non_planifie' as Statut,
    label: 'Non planifié',
    icon: Clock,
    cardBorder: 'border-slate-700/40',
    cardBg: 'bg-slate-900/60',
    badgeBg: 'bg-slate-600/30 text-slate-400 border-slate-600/30',
    iconColor: 'text-slate-400',
  },
  {
    key: 'a_jour' as Statut,
    label: 'À jour',
    icon: CheckCircle,
    cardBorder: 'border-emerald-700/30',
    cardBg: 'bg-emerald-950/20',
    badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    key: 'non_applicable' as Statut,
    label: 'Sans objet',
    icon: Minus,
    cardBorder: 'border-slate-800',
    cardBg: 'bg-slate-900/40',
    badgeBg: 'bg-slate-700/50 text-slate-500 border-slate-600/30',
    iconColor: 'text-slate-500',
    collapsible: true,
  },
];

function RegistreCard({
  item,
  config,
  onFiche,
  canEdit,
  onReprise,
  onEditCoordonnees,
}: {
  item: RegistreItem;
  config: typeof GROUP_CONFIG[0];
  onFiche: (item: RegistreItem) => void;
  canEdit: boolean;
  onReprise: (item: RegistreItem) => void;
  onEditCoordonnees: (item: RegistreItem) => void;
}) {
  const nextDate = item.date_verification ? getNextDate(item.date_verification, item.periodicite) : null;
  const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const pdfUrl = item.rapport_url
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(item.rapport_url)}&embedded=true`
    : null;

  const showRepriseBtn = canEdit && item.applicable && !item.date_verification && !item.reprise_papier;
  const showModifierRepriseBtn = canEdit && item.applicable && item.reprise_papier;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${config.cardBorder} ${config.cardBg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-snug">{item.installation}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-400 border border-slate-600/30">
              {item.reference_reglementaire}
            </span>
            {item.reprise_papier && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                Reprise papier
              </span>
            )}
          </div>
        </div>
        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${config.badgeBg}`}>
          <config.icon className={`w-3 h-3 ${config.iconColor}`} />
          {config.key === 'retard' && daysLeft !== null ? `${Math.abs(daysLeft)}j de retard` :
           config.key === 'attention' && daysLeft !== null ? `J-${daysLeft}` :
           config.key === 'a_jour' ? 'À jour' :
           config.key === 'non_planifie' ? 'Non planifié' :
           'Sans objet'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Organisme</p>
          <p className="text-slate-300 mt-0.5">{item.organisme_verificateur}</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Périodicité</p>
          <p className="text-slate-300 mt-0.5">{item.periodicite}</p>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Dernière vérif.</p>
          <p className={`mt-0.5 ${!item.date_verification ? 'text-red-400' : 'text-slate-300'}`}>
            {formatDate(item.date_verification)}
          </p>
        </div>
        {nextDate && (
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Prochaine vérif.</p>
            <p className="text-slate-300 mt-0.5">
              {nextDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {item.observations && (
        <div className="bg-slate-950/50 rounded-xl px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Observations</p>
          <p className="text-slate-300 text-xs leading-relaxed">{item.observations}</p>
        </div>
      )}
      {item.observations_levees && (
        <div className="bg-emerald-950/30 border border-emerald-700/20 rounded-xl px-3 py-2">
          <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-semibold mb-1">Levée des observations</p>
          <p className="text-emerald-300 text-xs leading-relaxed">{item.observations_levees}</p>
        </div>
      )}

      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-[12px] text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-xl transition-colors"
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          Voir le rapport PDF
        </a>
      )}

      {showRepriseBtn && (
        <button
          onClick={() => onReprise(item)}
          className="flex items-center gap-2 text-[12px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl transition-colors w-full"
        >
          <Archive className="w-3.5 h-3.5 shrink-0" />
          Reprise papier
        </button>
      )}

      {showModifierRepriseBtn && (
        <button
          onClick={() => onReprise(item)}
          className="flex items-center gap-2 text-[12px] text-slate-400 hover:text-slate-300 bg-slate-800/50 border border-slate-700/50 px-3 py-2 rounded-xl transition-colors w-full"
        >
          <Archive className="w-3.5 h-3.5 shrink-0" />
          Modifier la reprise
        </button>
      )}

      {canEdit && item.applicable && (
        <button
          onClick={() => onEditCoordonnees(item)}
          className="flex items-center gap-2 text-[12px] text-slate-400 hover:text-slate-300 bg-slate-800/50 border border-slate-700/50 px-3 py-2 rounded-xl transition-colors w-full"
        >
          <Pencil className="w-3.5 h-3.5 shrink-0" />
          Coordonnées
        </button>
      )}

      {item.applicable && (
        <button
          onClick={() => onFiche(item)}
          className="flex items-center gap-2 text-[12px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl transition-colors w-full"
        >
          <FileDown className="w-3.5 h-3.5 shrink-0" />
          Fiche PDF
        </button>
      )}
    </div>
  );
}

// ── Coordonnées du vérificateur modal ────────────────────────────────────────

function CoordonneesModal({
  item,
  onClose,
  onSaved,
}: {
  item: RegistreItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [coordOrganisme, setCoordOrganisme] = useState(item.organisme_verificateur ?? '');
  const [coordNom, setCoordNom] = useState(item.nom_verificateur ?? '');
  const [coordEmail, setCoordEmail] = useState(item.email_organisme ?? '');
  const [coordTel, setCoordTel] = useState(item.telephone_verificateur ?? '');
  const [coordReference, setCoordReference] = useState(item.reference_reglementaire ?? '');
  const [coordPeriodicite, setCoordPeriodicite] = useState(item.periodicite ?? 'Annuelle');
  const [coordJoursRappel, setCoordJoursRappel] = useState(item.jours_rappel !== null && item.jours_rappel !== undefined ? String(item.jours_rappel) : '');
  const [coordDateVerification, setCoordDateVerification] = useState(item.date_verification ?? '');
  const [coordObservations, setCoordObservations] = useState(item.observations ?? '');
  const [coordRapportUrl, setCoordRapportUrl] = useState(item.rapport_url ?? '');
  const [coordObservationsLevees, setCoordObservationsLevees] = useState(item.observations_levees ?? '');
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors";
  const selectClass = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-slate-500 transition-colors";

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('registre_securite')
      .update({
        organisme_verificateur: coordOrganisme.trim(),
        nom_verificateur: coordNom.trim(),
        email_organisme: coordEmail.trim(),
        telephone_verificateur: coordTel.trim(),
        reference_reglementaire: coordReference.trim(),
        periodicite: coordPeriodicite,
        jours_rappel: coordJoursRappel !== '' ? parseInt(coordJoursRappel, 10) : null,
        date_verification: coordDateVerification !== '' ? coordDateVerification : null,
        observations: coordObservations.trim(),
        rapport_url: coordRapportUrl.trim(),
        observations_levees: coordObservationsLevees.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    setSaving(false);
    if (!error) {
      onSaved();
      onClose();
    } else {
      console.error('Coordonnées save error:', error);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex',
               alignItems: 'center', justifyContent: 'center',
               padding: '16px', background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="bg-slate-900 rounded-xl w-full shadow-2xl flex flex-col border border-slate-700"
        style={{ maxWidth: '420px', maxHeight: '85vh' }}
      >
        {/* En-tête */}
        <div style={{ flexShrink: 0 }} className="border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-[15px]">Informations de la visite</p>
            <p className="text-slate-400 text-xs mt-0.5 truncate">{item.installation}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="px-4 py-4 space-y-4">

          {/* ── Vérificateur ── */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Vérificateur</p>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Organisme / Société</p>
            <input type="text" value={coordOrganisme} onChange={(e) => setCoordOrganisme(e.target.value)}
              placeholder="Organisme ou société" className={inputClass} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Nom du vérificateur</p>
            <input type="text" value={coordNom} onChange={(e) => setCoordNom(e.target.value)}
              placeholder="Nom et prénom" className={inputClass} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Email organisme</p>
            <input type="email" value={coordEmail} onChange={(e) => setCoordEmail(e.target.value)}
              placeholder="email@organisme.fr" className={inputClass} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Téléphone</p>
            <input type="tel" value={coordTel} onChange={(e) => setCoordTel(e.target.value)}
              placeholder="Téléphone du vérificateur" className={inputClass} />
          </div>

          {/* ── Visite ── */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 pt-2">Visite périodique</p>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Référence réglementaire</p>
            <input type="text" value={coordReference} onChange={(e) => setCoordReference(e.target.value)}
              placeholder="ex: MS 73" className={inputClass} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Périodicité</p>
            <select value={coordPeriodicite} onChange={(e) => setCoordPeriodicite(e.target.value)} className={selectClass}>
              {['Mensuelle', 'Trimestrielle', 'Semestrielle', 'Annuelle', 'Triennale', 'Quinquennale', 'Sans'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Rappel (jours avant)</p>
            <input type="number" min="1" value={coordJoursRappel}
              onChange={(e) => setCoordJoursRappel(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="ex: 90 — laisser vide pour désactiver" className={inputClass} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Date de vérification</p>
            <input type="date" value={coordDateVerification} onChange={(e) => setCoordDateVerification(e.target.value)}
              className={inputClass} style={{ colorScheme: 'dark' }} />
          </div>

          {/* ── Compte-rendu ── */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 pt-2">Compte-rendu</p>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Observations</p>
            <textarea rows={3} value={coordObservations} onChange={(e) => setCoordObservations(e.target.value)}
              placeholder="Observations de la vérification…"
              className={`${inputClass} resize-none`} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Levée des observations</p>
            <textarea rows={2} value={coordObservationsLevees} onChange={(e) => setCoordObservationsLevees(e.target.value)}
              placeholder="Mesures correctives…"
              className={`${inputClass} resize-none ${coordObservationsLevees ? 'border-emerald-700/40' : ''}`} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">URL du rapport PDF</p>
            <input type="url" value={coordRapportUrl} onChange={(e) => setCoordRapportUrl(e.target.value)}
              placeholder="https://…" className={inputClass} />
          </div>
        </div>

        {/* Pied */}
        <div style={{ flexShrink: 0 }} className="border-t border-slate-800 px-4 py-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            style={{
              background: saving ? 'rgba(37,99,235,0.3)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              border: '1px solid rgba(59,130,246,0.4)',
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reprise papier modal ─────────────────────────────────────────────────────

function RepriseModal({
  item,
  onClose,
  onSaved,
}: {
  item: RegistreItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [repriseDate, setRepriseDate] = useState(item.date_verification ?? '');
  const [repriseNom, setRepriseNom] = useState(item.nom_verificateur ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = repriseDate.trim() !== '' && repriseNom.trim() !== '';

  const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors";

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const { error } = await supabase
      .from('registre_securite')
      .update({
        date_verification: repriseDate,
        nom_verificateur: repriseNom.trim(),
        reprise_papier: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    setSaving(false);
    if (!error) {
      onSaved();
      onClose();
    } else {
      console.error('Reprise save error:', error);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9997, background: '#020617',
                  display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* 1. HEADER — enfant direct, ne rétrécit jamais */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #1e293b' }}
           className="px-4 py-3 flex items-start justify-between">
        <div>
          <p className="font-bold text-white text-[15px]">Reprise registre papier</p>
          <p className="text-slate-400 text-xs mt-0.5 truncate">{item.installation}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-slate-800 text-white ml-2">
          <X size={18} />
        </button>
      </div>

      {/* 2. BODY — enfant direct, prend tout l'espace restant et scrolle */}
      <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
           className="px-4 py-4 space-y-4">

        {/* Info banner */}
        <div className="flex gap-2 rounded-xl px-3 py-3" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Archive className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs leading-relaxed">
            Ces données proviennent du registre papier antérieur. Elles seront remplacées lors de la prochaine vérification numérique.
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Dernière vérification (registre papier)
          </p>
          <input
            type="date"
            value={repriseDate}
            onChange={(e) => setRepriseDate(e.target.value)}
            className={inputClass}
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Nom du vérificateur / organisme
          </p>
          <input
            type="text"
            value={repriseNom}
            onChange={(e) => setRepriseNom(e.target.value)}
            placeholder="Nom ou organisme"
            className={inputClass}
          />
        </div>
      </div>

      {/* 3. FOOTER — enfant direct, ne rétrécit jamais — HORS du scroll */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #1e293b', background: '#020617',
                    paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
           className="px-4 pt-3">
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          style={{
            background: canSave && !saving
              ? 'linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9))'
              : 'rgba(245,158,11,0.2)',
            color: '#fff',
            border: '1px solid rgba(245,158,11,0.4)',
          }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

    </div>
  );
}

// ── Signature modal ──────────────────────────────────────────────────────────

function SignatureModal({
  item,
  onClose,
  onSaved,
  signataireName,
  signataireRole,
  signataire_id,
  onEditCoordonnees,
}: {
  item: RegistreItem;
  onClose: () => void;
  onSaved: () => void;
  signataireName: string;
  signataireRole: string;
  signataire_id: string;
  onEditCoordonnees: (item: RegistreItem) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verificateurNom, setVerificateurNom] = useState(item.nom_verificateur ?? '');
  const [observationsSig, setObservationsSig] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);
    const pad = new SignaturePad(canvas, { penColor: '#000000', backgroundColor: '#ffffff' });
    padRef.current = pad;
    pad.addEventListener('endStroke', () => setHasDrawn(true));
    return () => { pad.off(); };
  }, []);

  function handleClear() {
    padRef.current?.clear();
    setHasDrawn(false);
  }

  async function handleValidate() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty() || !verificateurNom.trim()) return;
    setSaving(true);
    const dataURL = pad.toDataURL('image/png');

    const [sigRes, updateRes] = await Promise.all([
      supabase.from('registre_signatures').insert({
        registre_id: item.id,
        date_verification_signee: item.date_verification,
        signataire_id,
        signataire_nom: signataireName,
        signataire_role: signataireRole,
        signature_data: dataURL,
        verificateur_nom: verificateurNom.trim(),
        verificateur_organisme: item.organisme_verificateur,
        verificateur_contact: item.telephone_verificateur || item.email_organisme,
        observations_signature: observationsSig.trim(),
      }),
      supabase.from('registre_securite').update({
        nom_verificateur: verificateurNom.trim(),
        observations: observationsSig.trim() || item.observations,
        reprise_papier: false,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id),
    ]);

    setSaving(false);
    if (sigRes.error) {
      console.error('Signature save error:', sigRes.error);
      return;
    }
    if (updateRes.error) {
      console.error('Registre update error:', updateRes.error);
    }
    onSaved();
    onClose();
  }

  const canValidate = hasDrawn && verificateurNom.trim().length > 0 && !saving;

  const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors";

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#020617',
                  display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* 1. HEADER — enfant direct, ne rétrécit jamais */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #1e293b' }}
           className="px-4 py-3 flex items-start justify-between">
        <div>
          <p className="font-bold text-white text-base truncate">{item.installation}</p>
          <p className="text-sm text-slate-400 mt-0.5">
            Vérification du {formatDate(item.date_verification)}
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-slate-800 text-white ml-2 shrink-0">
          <X size={18} />
        </button>
      </div>

      {/* 2. BODY — enfant direct, prend tout l'espace restant et scrolle */}
      <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
           className="px-4 py-4 space-y-5">

        {/* Coordonnées lecture seule + bouton Modifier */}
        <div className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {item.nom_verificateur || '—'}
            </p>
            <p className="text-slate-400 text-xs truncate">
              {item.organisme_verificateur || '—'}
            </p>
          </div>
          <button
            onClick={() => onEditCoordonnees(item)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 flex items-center gap-1 shrink-0 ml-3"
          >
            <Pencil size={12} /> Modifier
          </button>
        </div>

        {/* Nom du vérificateur */}
        <div>
          <label className="text-xs uppercase text-slate-400 font-medium tracking-widest">
            Nom du vérificateur
          </label>
          <input
            type="text"
            value={verificateurNom}
            onChange={(e) => setVerificateurNom(e.target.value)}
            placeholder="Nom et prénom du vérificateur"
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
        </div>

        {/* Canvas signature */}
        <div>
          <label className="text-xs uppercase text-slate-400 font-medium tracking-widest">
            Signez dans le cadre ci-dessous
          </label>
          <canvas
            ref={canvasRef}
            style={{ height: '150px', width: '100%', background: '#fff',
                     borderRadius: '12px', marginTop: '8px', display: 'block' }}
          />
          <div className="flex justify-center mt-2">
            <button
              onClick={handleClear}
              className="px-4 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm flex items-center gap-1"
            >
              <RotateCcw size={14} /> Effacer
            </button>
          </div>
        </div>

        {/* Observations */}
        <div>
          <label className="text-xs uppercase text-slate-400 font-medium tracking-widest">
            Observations (optionnel)
          </label>
          <textarea
            rows={2}
            value={observationsSig}
            onChange={(e) => setObservationsSig(e.target.value)}
            placeholder="Remarques, anomalies constatées…"
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-slate-500 resize-none"
          />
        </div>
      </div>

      {/* 3. FOOTER — enfant direct, ne rétrécit jamais — HORS du scroll */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #1e293b', background: '#020617',
                    paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
           className="px-4 pt-3">
        <button
          onClick={handleValidate}
          disabled={!canValidate}
          className="w-full py-3 rounded-xl font-semibold text-white bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {saving ? 'Enregistrement…' : 'Valider la signature'}
        </button>
      </div>

    </div>
  );
}

// ── Faire signer tab ──────────────────────────────────────────────────────────

function FaireSignerTab({
  items,
  signatures,
  onSign,
  onRefresh,
}: {
  items: RegistreItem[];
  signatures: RegistreSignatureRow[];
  onSign: (item: RegistreItem) => void;
  onRefresh: () => void;
}) {
  const signable = items.filter((it) => it.applicable && !!it.date_verification);

  function getSignature(item: RegistreItem): RegistreSignatureRow | undefined {
    return signatures.find(
      (s) => s.registre_id === item.id && s.date_verification_signee === item.date_verification,
    );
  }

  const unsigned = signable.filter((it) => !getSignature(it));
  const signed = signable.filter((it) => !!getSignature(it));

  if (signable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <CheckCircle className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400 text-sm">Aucune vérification à signer pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* À signer */}
      {unsigned.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <PenLine className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-bold text-[15px]">À signer</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {unsigned.length}
            </span>
          </div>
          <div className="space-y-3">
            {unsigned.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm leading-snug">{item.installation}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-400 border border-slate-600/30">
                      {item.reference_reglementaire}
                    </span>
                  </div>
                </div>
                <p className="text-slate-400 text-xs">
                  Vérifié le {formatDate(item.date_verification)}
                  {item.nom_verificateur ? ` par ${item.nom_verificateur}` : ''}
                </p>
                <button
                  onClick={() => onSign(item)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.12))',
                    border: '1px solid rgba(245,158,11,0.4)',
                    color: '#f59e0b',
                  }}
                >
                  <PenLine className="w-4 h-4" />
                  Signer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Signées */}
      {signed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-bold text-[15px]">Signées</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {signed.length}
            </span>
          </div>
          <div className="space-y-3">
            {signed.map((item) => {
              const sig = getSignature(item)!;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-emerald-700/25 bg-emerald-950/15 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm leading-snug">{item.installation}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        Signé par {sig.signataire_nom} ({sig.signataire_role}) le{' '}
                        {new Date(sig.signed_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                        })}
                      </p>
                      {sig.verificateur_nom && (
                        <p className="text-slate-300 text-xs mt-0.5 font-semibold">
                          {sig.verificateur_nom}
                          {sig.verificateur_organisme ? (
                            <span className="font-normal text-slate-400"> — {sig.verificateur_organisme}</span>
                          ) : null}
                        </p>
                      )}
                      {sig.verificateur_contact && (
                        <p className="text-slate-500 text-[11px] mt-0.5">{sig.verificateur_contact}</p>
                      )}
                      {sig.observations_signature && (
                        <p className="text-slate-500 text-[11px] mt-0.5 italic">{sig.observations_signature}</p>
                      )}
                    </div>
                    {/* Signature thumbnail */}
                    <div
                      className="shrink-0 rounded-lg overflow-hidden border border-slate-600"
                      style={{ background: '#fff', padding: 2 }}
                    >
                      <img
                        src={sig.signature_data}
                        alt="Signature"
                        style={{ height: 40, width: 'auto', maxWidth: 80, objectFit: 'contain', display: 'block' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => onSign(item)}
                    className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Re-signer
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {unsigned.length === 0 && signed.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-3 rounded-xl bg-emerald-950/20 border border-emerald-700/20">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-emerald-400 text-sm font-medium">Toutes les vérifications sont signées.</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type EntrepriseInfo = {
  nom: string | null;
  logo_url: string | null;
  type_erp: string | null;
  categorie_erp: string | null;
  siret: string | null;
};

export default function RegistreMobilePage() {
  const navigate = useNavigate();
  const { nom, logo_url } = useEntreprise();
  const { session, isSuperAdmin, userFonction } = useAuth();

  const [items, setItems] = useState<RegistreItem[]>([]);
  const [signatures, setSignatures] = useState<RegistreSignatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapseNonApp, setCollapseNonApp] = useState(true);
  const [entreprise, setEntreprise] = useState<EntrepriseInfo | null>(null);
  const [ficheItem, setFicheItem] = useState<RegistreItem | null>(null);
  const [signItem, setSignItem] = useState<RegistreItem | null>(null);
  const [repriseItem, setRepriseItem] = useState<RegistreItem | null>(null);
  const [coordItem, setCoordItem] = useState<RegistreItem | null>(null);

  const canSign = isSuperAdmin || userFonction === 'Direction' || userFonction === 'Chef de poste';
  const [activeTab, setActiveTab] = useState<'suivi' | 'signer'>('suivi');

  async function loadData() {
    const [registreRes, entrepriseRes, signaturesRes] = await Promise.all([
      supabase.from('registre_securite').select('*').order('installation'),
      supabase.from('entreprise').select('nom, logo_url, type_erp, categorie_erp, siret').limit(1).maybeSingle(),
      supabase.from('registre_signatures').select('*'),
    ]);
    setItems((registreRes.data ?? []) as RegistreItem[]);
    setEntreprise(entrepriseRes.data as EntrepriseInfo | null);
    setSignatures((signaturesRes.data ?? []) as RegistreSignatureRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const lastUpdated = items.reduce<string | null>((acc, it) => {
    if (!acc || it.updated_at > acc) return it.updated_at;
    return acc;
  }, null);

  const grouped = GROUP_CONFIG.map((cfg) => ({
    ...cfg,
    items: items.filter((it) => getStatut(it.date_verification, it.periodicite, it.applicable) === cfg.key),
  }));

  // Find signature for ficheItem
  const ficheSignature = ficheItem
    ? (signatures.find(
        (s) => s.registre_id === ficheItem.id && s.date_verification_signee === ficheItem.date_verification,
      ) ?? null)
    : null;

  // Determine signataire name from session + profile (best-effort)
  const signataireName = session?.user?.user_metadata?.full_name
    ?? session?.user?.email
    ?? 'Inconnu';
  const signataireRole = isSuperAdmin ? 'Super Admin' : (userFonction ?? '');

  return (
    <div className="pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {logo_url && <img src={logo_url} alt="logo" className="h-5 w-auto object-contain rounded" />}
            <p className="text-white font-semibold text-[15px] truncate">{nom || 'Registre de sécurité'}</p>
          </div>
          {lastUpdated && (
            <p className="text-slate-500 text-xs mt-0.5">
              Mis à jour le {new Date(lastUpdated).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Tab selector — only for canSign users */}
      {canSign && !loading && (
        <div className="px-4 pt-4">
          <div
            className="flex rounded-xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {(['suivi', 'signer'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 text-sm font-bold transition-all"
                style={
                  activeTab === tab
                    ? {
                        background: 'rgba(245,158,11,0.18)',
                        color: '#f59e0b',
                        borderBottom: '2px solid #f59e0b',
                      }
                    : { color: 'rgba(148,163,184,0.7)' }
                }
              >
                {tab === 'suivi' ? 'Suivi' : 'Faire signer'}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="text-center text-slate-500 text-sm py-16">Chargement…</p>}

      {!loading && activeTab === 'suivi' && (
        <div className="px-4 py-5 space-y-6">
          <ConformiteDashboard items={items} />
          <EcheancesDashboard items={items} />
          {grouped.map((group) => {
            if (group.items.length === 0) return null;
            const isNonApp = group.key === 'non_applicable';

            return (
              <section key={group.key}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between mb-3"
                  onClick={() => isNonApp && setCollapseNonApp((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className={`w-4 h-4 ${group.iconColor}`} />
                    <h2 className="text-white font-bold text-[15px]">{group.label}</h2>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${group.badgeBg}`}>
                      {group.items.length}
                    </span>
                  </div>
                  {isNonApp && (collapseNonApp ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />)}
                </button>

                {(!isNonApp || !collapseNonApp) && (
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <RegistreCard key={item.id} item={item} config={group} onFiche={setFicheItem} canEdit={canSign} onReprise={setRepriseItem} onEditCoordonnees={setCoordItem} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!loading && activeTab === 'signer' && canSign && (
        <div className="px-4 py-5">
          <FaireSignerTab
            items={items}
            signatures={signatures}
            onSign={setSignItem}
            onRefresh={loadData}
          />
        </div>
      )}

      {/* ── Fiche PDF modal ── */}
      {ficheItem && (
        <div className="fixed inset-0 z-[9999] bg-white overflow-auto">
          <div
            className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }}
          >
            <p className="text-sm font-semibold text-slate-700 truncate min-w-0">
              Fiche — {ficheItem.installation}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Exporter en PDF
              </button>
              <button
                onClick={() => setFicheItem(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Fermer
              </button>
            </div>
          </div>
          <div className="p-6">
            <FicheVerification item={ficheItem} entreprise={entreprise} signature={ficheSignature} />
          </div>
        </div>
      )}

      {/* ── Coordonnées modal ── */}
      {coordItem && (
        <CoordonneesModal
          item={coordItem}
          onClose={() => setCoordItem(null)}
          onSaved={async () => {
            await loadData();
            if (signItem && signItem.id === coordItem.id) {
              const { data } = await supabase.from('registre_securite').select('*').eq('id', coordItem.id).single();
              if (data) setSignItem(data as RegistreItem);
            }
          }}
        />
      )}

      {/* ── Reprise papier modal ── */}
      {repriseItem && (
        <RepriseModal
          item={repriseItem}
          onClose={() => setRepriseItem(null)}
          onSaved={loadData}
        />
      )}

      {/* ── Signature modal ── */}
      {signItem && session && (
        <SignatureModal
          item={signItem}
          onClose={() => setSignItem(null)}
          onSaved={loadData}
          signataireName={signataireName}
          signataireRole={signataireRole}
          signataire_id={session.user.id}
          onEditCoordonnees={(it) => setCoordItem(it)}
        />
      )}
    </div>
  );
}
