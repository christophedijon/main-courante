import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import {
  Calendar, Clock, Building2, MapPin, Layers, Flame, Users,
  FileText, User as UserIcon, CheckCircle2, Tag, Pencil, Check, X as XIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { useEntreprise } from '../../hooks/useEntreprise';
import { useSessionActive } from '../../hooks/useSessionActive';
import { useSaisie, SaisieType } from './SaisieContext';
import StepHeader from '../components/StepHeader';

function Row({ icon: Icon, label, value, valueClass = 'text-white', action }: {
  icon: any; label: string; value: string; valueClass?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-800 last:border-b-0">
      <Icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
        <div className="flex items-center gap-2">
          <p className={`text-[14px] font-medium leading-snug break-words ${valueClass}`}>{value}</p>
          {action}
        </div>
      </div>
    </div>
  );
}

// Single digit input box for time picker
function DigitBox({ value, onChange, max }: { value: string; onChange: (v: string) => void; max: number }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={1}
      value={value}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '');
        if (v === '' || Number(v) <= max) onChange(v);
        if (v !== '') {
          // move focus to next sibling input
          const parent = ref.current?.parentElement;
          if (parent) {
            const inputs = Array.from(parent.querySelectorAll('input'));
            const idx = inputs.indexOf(ref.current!);
            if (idx < inputs.length - 1) (inputs[idx + 1] as HTMLInputElement).focus();
          }
        }
      }}
      onFocus={() => ref.current?.select()}
      className="w-14 h-16 bg-slate-800 border-2 border-slate-600 focus:border-sky-500 rounded-xl
        text-white text-3xl font-black text-center outline-none transition-colors"
    />
  );
}

function TimeEditModal({ initialTime, onConfirm, onClose }: {
  initialTime: string; onConfirm: (t: string) => void; onClose: () => void;
}) {
  const parts = initialTime.split(':');
  const [h1, setH1] = useState(parts[0]?.[0] ?? '0');
  const [h2, setH2] = useState(parts[0]?.[1] ?? '0');
  const [m1, setM1] = useState(parts[1]?.[0] ?? '0');
  const [m2, setM2] = useState(parts[1]?.[1] ?? '0');

  const preview = `${h1}${h2}:${m1}${m2}`;
  const valid = Number(`${h1}${h2}`) <= 23 && Number(`${m1}${m2}`) <= 59;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xs shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-white font-bold text-[17px]">Modifier l'heure</p>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* 4 digit boxes: H H : M M */}
        <div className="flex items-center justify-center gap-2 mb-2" id="time-digit-group">
          <DigitBox value={h1} onChange={setH1} max={2} />
          <DigitBox value={h2} onChange={setH2} max={9} />
          <span className="text-white text-3xl font-black select-none mb-1">:</span>
          <DigitBox value={m1} onChange={setM1} max={5} />
          <DigitBox value={m2} onChange={setM2} max={9} />
        </div>

        <p className={`text-center text-sm mb-5 ${valid ? 'text-slate-400' : 'text-red-400'}`}>
          {valid ? `Heure sélectionnée : ${preview}` : 'Heure invalide'}
        </p>

        <button
          type="button"
          disabled={!valid}
          onClick={() => { if (valid) onConfirm(preview); }}
          className="w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-colors
            bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white"
        >
          <Check className="w-5 h-5" />
          Confirmer
        </button>
      </div>
    </div>
  );
}

export default function StepRecap() {
  const { type } = useParams<{ type: SaisieType }>();
  const navigate = useNavigate();
  const { draft, reset, pendingMedias, clearPendingMedias } = useSaisie();
  const { session, userFonction } = useAuth();
  const { profile } = useCurrentProfile();
  const { nom: entrepriseNom } = useEntreprise();
  const { entrepriseId } = useSessionActive();

  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const defaultTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const [customTime, setCustomTime] = useState<string | null>(null);
  const timeStr = customTime ?? defaultTime;

  if (!type) return <Navigate to="/mobile" replace />;
  const isGestionClient = type === 'securite_personnes';
  const isSsiFlow = type === 'ssi';
  if (!confirmed && !draft.niveau && !isSsiFlow) {
    return <Navigate to={`/mobile/saisie/${type}/description`} replace />;
  }
  if (!confirmed && isSsiFlow && !draft.zone) {
    return <Navigate to="/mobile/saisie/ssi/ssi-zone" replace />;
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || profile.email;

  async function submit() {
    if (!session?.user) return;
    setSubmitting(true);
    setError(null);

    // Build date with custom time if set
    let eventDate = new Date();
    if (customTime) {
      const [h, m] = customTime.split(':').map(Number);
      eventDate.setHours(h, m, 0, 0);
    }

    const { data: inserted, error: insErr } = await supabase
      .from('evenements')
      .insert({
        type,
        etablissement_id: entrepriseId,
        espace_id: draft.espace?.id || null,
        zone_id: isSsiFlow ? null : (draft.zone?.id || null),
        zone_ssi_id: isSsiFlow ? (draft.zone?.id || null) : null,
        niveau_id: draft.niveau?.id || null,
        espace_nom: draft.espace?.label ?? '',
        zone_nom: draft.zone?.label ?? '',
        niveau_label: draft.niveau?.label ?? '',
        commentaire: draft.commentaire,
        date_evenement: eventDate.toISOString(),
        created_by: session.user.id,
        created_by_email: session.user.email ?? '',
        user_fonction: userFonction ?? '',
        etablissement_nom: draft.etablissement?.label ?? entrepriseNom ?? '',
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      setSubmitting(false);
      setError(insErr?.message || 'Erreur à l\'enregistrement');
      return;
    }

    if (draft.motifs.length > 0) {
      const rows = draft.motifs.map((m) => ({
        evenement_id: inserted.id,
        motif_id: m.id,
        motif_nom: m.label,
      }));
      await supabase.from('evenement_motifs').insert(rows);
    }

    // Upload pending medias
    if (pendingMedias.length > 0) {
      await Promise.all(pendingMedias.map(async (file) => {
        const ext = file.name.split('.').pop();
        const path = `${session.user.id}/${inserted.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('media-evenements').upload(path, file, { contentType: file.type });
        if (!upErr) {
          await supabase.from('evenement_medias').insert({
            evenement_id: inserted.id,
            storage_path: path,
            mime_type: file.type,
            original_name: file.name,
            created_by: session.user.id,
          });
        }
      }));
      clearPendingMedias();
    }

    setSubmitting(false);
    setConfirmed(true);
    setTimeout(() => {
      reset();
      navigate('/mobile', { replace: true });
    }, 1400);
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6">
        <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center animate-fade-in">
          <CheckCircle2 className="w-12 h-12 text-emerald-400" strokeWidth={2.2} />
        </div>
        <p className="text-white text-xl font-bold mt-6 animate-slide-up">Événement enregistré</p>
        <p className="text-slate-400 text-sm mt-1 animate-slide-up">Retour à l'accueil…</p>
      </div>
    );
  }

  return (
    <div>
      <StepHeader
        step={isSsiFlow ? 3 : isGestionClient ? 3 : 7}
        total={isSsiFlow ? 3 : isGestionClient ? 3 : 7}
        title="Récapitulatif"
        subtitle="Vérifiez avant de valider"
        backTo={isSsiFlow ? '/mobile/saisie/ssi/ssi-motifs' : `/mobile/saisie/${type}/${isGestionClient ? 'description' : 'commentaire'}`}
      />

      <div className="px-4 py-5 pb-32">
        {/* Type banner */}
        <div className={`rounded-2xl p-4 border-2 mb-4 flex items-center gap-3
          ${type === 'ssi'
            ? 'bg-red-950/40 border-red-700/60'
            : 'bg-sky-950/40 border-sky-700/60'}`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center
            ${type === 'ssi' ? 'bg-red-600' : 'bg-sky-500/30 border border-sky-500/40'}`}>
            {type === 'ssi'
              ? <Flame className="w-5 h-5 text-amber-300" strokeWidth={2.4} />
              : <Users className="w-5 h-5 text-sky-300" strokeWidth={2.4} />}
          </div>
          <div>
            <p className="text-white font-bold text-[15px]">
              {type === 'ssi' ? 'SSI – Sécurité Incendie' : 'Personnes – Sécurité des personnes'}
            </p>
            <p className="text-slate-400 text-xs">Type d'événement</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4">
          <Row icon={Calendar} label="Date" value={dateStr} />
          <Row
            icon={Clock}
            label="Heure"
            value={timeStr}
            valueClass={customTime ? 'text-sky-300' : 'text-white'}
            action={
              <button
                type="button"
                onClick={() => setShowTimeModal(true)}
                className="ml-1 px-2 py-0.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] font-semibold transition-colors flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                Modifier
              </button>
            }
          />
          <Row icon={UserIcon} label="Utilisateur" value={`${fullName}${userFonction ? ` · ${userFonction}` : ''}`} />
          <Row icon={Building2} label="Établissement" value={draft.etablissement?.label || entrepriseNom || '—'} />
          {!isSsiFlow && <Row icon={MapPin} label="Espace" value={draft.espace?.label || '—'} />}
          <Row icon={MapPin} label="Zone" value={draft.zone?.label || '—'} />
          {!isSsiFlow && <Row icon={Layers} label="Niveau" value={draft.niveau?.label || '—'} valueClass="text-amber-300" />}
          <Row icon={Tag} label="Motifs" value={draft.motifs.map((m) => m.label).join(', ') || '—'} />
          <Row icon={FileText} label="Commentaire" value={draft.commentaire || '—'} />
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-950/40 border border-red-700/40 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-6 pb-4 px-4 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <button
            type="button"
            onClick={() => navigate(isSsiFlow ? '/mobile/saisie/ssi/ssi-zone' : `/mobile/saisie/${type}/${isGestionClient ? 'localisation' : 'etablissement'}`)}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200
              font-semibold py-4 px-4 rounded-2xl transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Modifier
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white
              font-bold text-[15px] py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            {submitting ? 'Enregistrement…' : 'Valider l\'événement'}
          </button>
        </div>
      </div>

      {showTimeModal && (
        <TimeEditModal
          initialTime={timeStr}
          onConfirm={(t) => { setCustomTime(t); setShowTimeModal(false); }}
          onClose={() => setShowTimeModal(false)}
        />
      )}
    </div>
  );
}
