import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Flame, Mic, MicOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSaisie } from './SaisieContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

type MotifRow = { id: string; nom: string; description: string | null };

export default function StepSsiMotifs() {
  const navigate = useNavigate();
  const { draft, setField } = useSaisie();
  const [items, setItems] = useState<MotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { transcript: transcription, setTranscript: setTranscription, recording, supported, toggle: toggleRec } =
    useSpeechRecognition(draft.commentaire ?? '');

  useEffect(() => {
    supabase
      .from('motifs_ssi')
      .select('id, nom, description, ordre')
      .order('ordre')
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, []);

  if (!draft.zone) return <Navigate to="/mobile/saisie/ssi/ssi-zone" replace />;

  function toggle(id: string, nom: string) {
    const exists = draft.motifs.some((m) => m.id === id);
    const next = exists
      ? draft.motifs.filter((m) => m.id !== id)
      : [...draft.motifs, { id, label: nom }];
    setField('motifs', next);
  }

  const canContinue = draft.motifs.length > 0;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#111827] border-b border-slate-800">
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: '66%' }} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/mobile/saisie/ssi/ssi-zone')}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-300" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M5 12L12 19M5 12L12 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1">
            <p className="text-white font-bold text-[17px] leading-tight">SSI – Sécurité Incendie</p>
            <p className="text-slate-400 text-[13px]">Étape 2 sur 3</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-900/60 border border-red-800/50 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C12 2 9 6 9 9.5C9 11.4 10.1 13 11.5 14C11.2 13.3 11 12.4 11.5 11.5C12.5 9.8 14 9.5 14 9.5C13.5 11 14 12 15 13C15.6 13.6 16 14.5 16 15.5C16 18 14.2 20 12 20C9.8 20 8 18 8 15.5C8 13.5 9 12 9 12C9 12 7 13.5 7 16C7 19.3 9.2 22 12 22C14.8 22 17 19.3 17 16C17 11.5 12 2 12 2Z"
                fill="url(#flamSsiMotifs)" />
              <defs>
                <linearGradient id="flamSsiMotifs" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="60%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Zone recap badge */}
      <div className="px-4 pt-5">
        <div className="inline-flex items-center gap-2 bg-orange-950/40 border border-orange-800/40 rounded-xl px-3 py-1.5 mb-4">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-orange-300 text-xs font-semibold">{draft.zone.label}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-32">
        <h1 className="text-white font-bold text-2xl leading-tight">Motif SSI</h1>
        <p className="text-slate-400 text-[14px] mt-1 mb-6">
          {draft.motifs.length > 0
            ? `${draft.motifs.length} sélectionné${draft.motifs.length > 1 ? 's' : ''}`
            : 'Sélectionnez un ou plusieurs motifs'}
        </p>

        {loading && <p className="text-slate-500 text-sm text-center py-12">Chargement…</p>}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800/40 flex items-center justify-center">
              <Flame className="w-7 h-7 text-red-700" />
            </div>
            <p className="text-slate-400 font-medium">Aucun motif SSI configuré</p>
            <p className="text-slate-600 text-sm">Ajoutez des motifs SSI dans le back-office.</p>
          </div>
        )}

        <div className="space-y-2.5">
          {items.map((m) => {
            const selected = draft.motifs.some((s) => s.id === m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id, m.nom)}
                className={`w-full text-left px-4 py-4 rounded-2xl border transition-all active:scale-[0.98] flex items-start gap-3
                  ${selected
                    ? 'bg-orange-500/20 border-orange-500/60'
                    : 'bg-[#1c2333] border-slate-700 hover:border-orange-800/60 hover:bg-orange-950/20'
                  }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors
                  ${selected ? 'bg-orange-500 border-orange-500' : 'border-slate-600'}`}>
                  {selected && (
                    <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
                      <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-[15px] ${selected ? 'text-amber-300' : 'text-white'}`}>{m.nom}</p>
                  {m.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Message vocal */}
        <div className="mt-6">
          <p className="text-[11px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-3">
            Message vocal
          </p>
          {supported ? (
            <button
              type="button"
              onClick={toggleRec}
              className={`w-full flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-all
                ${recording
                  ? 'bg-red-950/60 border-red-500/50'
                  : 'bg-red-950/30 border-red-700/40 hover:border-red-600/60'
                }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0
                ${recording ? 'bg-red-500 animate-pulse' : 'bg-red-600'}`}>
                {recording
                  ? <MicOff className="w-6 h-6 text-white" />
                  : <Mic className="w-6 h-6 text-white" />
                }
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-[15px]">
                  {recording ? 'Arrêter l\'enregistrement' : 'Enregistrer un message vocal'}
                </p>
                <p className="text-slate-400 text-[12px] mt-0.5">
                  {recording ? 'Dictée en cours…' : 'Appuyez pour démarrer'}
                </p>
              </div>
            </button>
          ) : (
            <div className="bg-[#1c2333] border border-slate-700 rounded-2xl px-5 py-4 text-center">
              <p className="text-slate-500 text-sm">Dictée vocale non supportée sur ce navigateur.</p>
            </div>
          )}
        </div>

        {/* Transcription */}
        <div className="mt-4">
          <p className="text-[11px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-3">
            Transcription / commentaire
          </p>
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="La transcription de votre enregistrement apparaîtra ici automatiquement… Vous pouvez aussi taper directement."
            rows={4}
            className="w-full bg-[#1c2333] border border-slate-700 rounded-2xl px-4 py-3 text-white text-[14px]
              placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40
              transition-all resize-none"
          />
        </div>
      </div>

      {/* Sticky continue */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/95 to-transparent pt-6 pb-4 px-4 z-20">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              setField('commentaire', transcription.trim());
              navigate('/mobile/saisie/ssi/recap');
            }}
            className={`w-full py-4 rounded-2xl font-bold text-[16px] transition-all
              ${canContinue
                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                : 'bg-[#1e2a1a] text-slate-500 cursor-not-allowed'
              }`}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
