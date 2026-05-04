import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, X, Mic, MicOff, Paperclip, Image, Music, Video, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSaisie, SaisieType } from './SaisieContext';

type Niveau = { id: string; label: string; description: string | null; ordre: number };
type Motif = { id: string; nom: string };

type AnyWindow = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

type NiveauStyle = {
  num: string;
  bg: string;
  border: string;
  numColor: string;
  labelColor: string;
  selectedBorder: string;
  selectedBg: string;
  bgIcon?: React.ReactNode;
};

// Mapping par label (insensible à la casse)
// num = chiffre affiché en gros, codeLabel = texte "CODE" affiché en dessous
function getNiveauStyle(label: string, index: number): NiveauStyle {
  const key = label.toUpperCase().replace(/\s+/g, '');

  if (key === 'CODE1') return {
    num: '1',
    bg: 'bg-emerald-950/70', border: 'border-emerald-700/60',
    numColor: 'text-emerald-400', labelColor: 'text-emerald-300',
    selectedBorder: 'border-emerald-400', selectedBg: 'bg-emerald-900/80',
  };
  if (key === 'CODE2') return {
    num: '2',
    bg: 'bg-orange-950/70', border: 'border-orange-700/60',
    numColor: 'text-orange-400', labelColor: 'text-orange-300',
    selectedBorder: 'border-orange-400', selectedBg: 'bg-orange-900/80',
  };
  if (key === 'CODE3') return {
    num: '3',
    bg: 'bg-red-950/70', border: 'border-red-700/60',
    numColor: 'text-red-400', labelColor: 'text-red-300',
    selectedBorder: 'border-red-400', selectedBg: 'bg-red-900/80',
  };
  if (key === 'CODE11') return {
    num: '11',
    bg: 'bg-emerald-700', border: 'border-emerald-500',
    numColor: 'text-white', labelColor: 'text-emerald-100',
    selectedBorder: 'border-white', selectedBg: 'bg-emerald-600',
  };
  if (key === 'CODE18') return {
    num: '18',
    bg: 'bg-red-700', border: 'border-red-500',
    numColor: 'text-white', labelColor: 'text-red-100',
    selectedBorder: 'border-white', selectedBg: 'bg-red-600',
  };
  const fallbacks: NiveauStyle[] = [
    { num: String(index + 1), bg: 'bg-emerald-950/60', border: 'border-emerald-700/50', numColor: 'text-emerald-400', labelColor: 'text-emerald-300', selectedBorder: 'border-emerald-400', selectedBg: 'bg-emerald-900/60' },
    { num: String(index + 1), bg: 'bg-orange-950/60', border: 'border-orange-700/50', numColor: 'text-orange-400', labelColor: 'text-orange-300', selectedBorder: 'border-orange-400', selectedBg: 'bg-orange-900/60' },
    { num: String(index + 1), bg: 'bg-red-950/60', border: 'border-red-700/50', numColor: 'text-red-400', labelColor: 'text-red-300', selectedBorder: 'border-red-400', selectedBg: 'bg-red-900/60' },
  ];
  return fallbacks[Math.min(index, fallbacks.length - 1)];
}

// Icônes SVG pour motifs courants
const MOTIF_ICONS: Record<string, React.ReactNode> = {
  ivresse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M8 2h8l1 7H7L8 2z" /><path d="M7 9c0 5 2 8 5 11M17 9c0 5-2 8-5 11" />
    </svg>
  ),
  fume: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M3 18h14M3 14h14M17 14h1a3 3 0 000-6h-1M20 10V8" />
    </svg>
  ),
  jalousie: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  provocant: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  ),
};

function MotifIcon({ nom }: { nom: string }) {
  const key = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    <span className="text-slate-300">
      {MOTIF_ICONS[key] ?? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      )}
    </span>
  );
}

export default function StepDescription() {
  const { type } = useParams<{ type: SaisieType }>();
  const navigate = useNavigate();
  const { draft, setField, pendingMedias, addPendingMedia, removePendingMedia } = useSaisie();
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [motifs, setMotifs] = useState<Motif[]>([]);
  const [loadingNiveaux, setLoadingNiveaux] = useState(true);
  const [loadingMotifs, setLoadingMotifs] = useState(true);
  const [transcription, setTranscription] = useState(draft.commentaire);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);

  useEffect(() => {
    supabase.from('niveaux_intervention').select('id, label, description, ordre')
      .order('ordre', { ascending: true })
      .then(({ data }) => { setNiveaux(data ?? []); setLoadingNiveaux(false); });

    supabase.from('motifs').select('id, nom, ordre')
      .order('ordre')
      .then(({ data }) => { setMotifs(data ?? []); setLoadingMotifs(false); });
  }, []);

  useEffect(() => {
    const w = window as unknown as AnyWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      if (finalText) setTranscription((t) => (t ? t + ' ' : '') + finalText.trim());
    };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  if (!type) return <Navigate to="/mobile" replace />;
  if (!draft.espace || !draft.zone) return <Navigate to={`/mobile/saisie/${type}/localisation`} replace />;

  const canContinue = !!draft.niveau;

  function pickNiveau(id: string, label: string) {
    setField('niveau', { id, label });
  }

  function toggleMotif(id: string, nom: string) {
    const exists = draft.motifs.some((m) => m.id === id);
    setField('motifs', exists
      ? draft.motifs.filter((m) => m.id !== id)
      : [...draft.motifs, { id, label: nom }]
    );
  }

  function toggleRec() {
    if (!recRef.current) return;
    if (recording) {
      recRef.current.stop();
      setRecording(false);
    } else {
      try { recRef.current.start(); setRecording(true); }
      catch { setRecording(false); }
    }
  }

  function next() {
    if (!canContinue) return;
    setField('commentaire', transcription.trim());
    navigate(`/mobile/saisie/${type}/recap`);
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#111827] border-b border-slate-800">
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: '50%' }} />
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(`/mobile/saisie/${type}/localisation`)}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex-1">
            <p className="text-white font-bold text-[17px] leading-tight">Sécurité des Personnes</p>
            <p className="text-slate-400 text-[13px]">Étape 2 sur 4</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/mobile')}
            className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-6 pb-36 space-y-7">
        {/* Title */}
        <div>
          <h1 className="text-white font-bold text-2xl leading-tight">Description</h1>
          <p className="text-slate-400 text-[14px] mt-1">Sélectionnez le niveau d'intervention</p>
        </div>

        {/* Niveau d'intervention */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-3">
            Niveau d'intervention
          </p>
          {loadingNiveaux && <p className="text-slate-500 text-sm text-center py-4">Chargement…</p>}
          {!loadingNiveaux && niveaux.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Aucun niveau configuré.</p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {niveaux.map((n, i) => {
              const selected = draft.niveau?.id === n.id;
              const style = getNiveauStyle(n.label || '', i);
              const label = n.label || `Niveau ${i + 1}`;
              const desc = n.description || '';
              // Extract "CODE" prefix and the number separately
              const codeMatch = label.match(/^(CODE)\s*(\d+)$/i);
              const codePrefix = codeMatch ? codeMatch[1].toUpperCase() : label;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => pickNiveau(n.id, label)}
                  className={`flex flex-col items-center justify-start gap-0.5 py-3 px-1.5 rounded-2xl border-2 transition-all active:scale-[0.96] min-h-[90px]
                    ${selected ? `${style.selectedBg} ${style.selectedBorder}` : `${style.bg} ${style.border}`}`}
                >
                  <span className={`font-black text-3xl leading-none ${style.numColor}`}>{style.num}</span>
                  <span className={`text-[10px] font-bold text-center leading-tight ${style.labelColor}`}>
                    {codePrefix}
                  </span>
                  {desc && (
                    <span className="text-[9px] text-slate-400 text-center leading-tight line-clamp-2 px-0.5 mt-0.5">
                      {desc}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nature de l'événement (motifs) */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-3">
            Nature de l'événement
          </p>
          {loadingMotifs && <p className="text-slate-500 text-sm text-center py-4">Chargement…</p>}
          {!loadingMotifs && motifs.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">Aucun motif configuré.</p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {motifs.map((m) => {
              const selected = draft.motifs.some((s) => s.id === m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMotif(m.id, m.nom)}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-2 rounded-2xl border transition-all active:scale-[0.96] min-h-[80px]
                    ${selected
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-200'
                      : 'bg-[#1c2333] border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                >
                  <MotifIcon nom={m.nom} />
                  <span className="text-[11px] font-semibold text-center leading-tight">{m.nom}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message vocal + import média */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-3">
            Message vocal
          </p>
          <div className="flex gap-3">
            {supported ? (
              <button
                type="button"
                onClick={toggleRec}
                className={`flex-1 flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-all
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
              <div className="flex-1 bg-[#1c2333] border border-slate-700 rounded-2xl px-5 py-4 text-center">
                <p className="text-slate-500 text-sm">Dictée vocale non supportée sur ce navigateur.</p>
              </div>
            )}

            {/* Import média button */}
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className="w-16 flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2
                bg-sky-950/30 border-sky-700/40 hover:border-sky-600/60 transition-all shrink-0"
            >
              <Paperclip className="w-6 h-6 text-sky-400" />
              <span className="text-sky-300 text-[10px] font-semibold leading-tight text-center">
                Importer
              </span>
            </button>
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,audio/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addPendingMedia(file);
                if (mediaInputRef.current) mediaInputRef.current.value = '';
              }}
            />
          </div>
        </div>

        {/* Médias joints */}
        {pendingMedias.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-3">
              Médias joints ({pendingMedias.length})
            </p>
            <div className="space-y-2">
              {pendingMedias.map((file, i) => {
                const isImage = file.type.startsWith('image/');
                const isAudio = file.type.startsWith('audio/');
                const isVideo = file.type.startsWith('video/');
                const IconComp = isImage ? Image : isAudio ? Music : isVideo ? Video : Paperclip;
                return (
                  <div key={i} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 text-slate-300">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <p className="flex-1 text-white text-[13px] font-medium truncate">{file.name}</p>
                    <button
                      type="button"
                      onClick={() => removePendingMedia(i)}
                      className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transcription */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 tracking-[0.15em] uppercase mb-3">
            Transcription / description texte
          </p>
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="La transcription de votre enregistrement apparaîtra ici automatiquement…"
            rows={4}
            className="w-full bg-[#1c2333] border border-slate-700 rounded-2xl px-4 py-3 text-white text-[14px]
              placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40
              transition-all resize-none"
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="bg-[#111827] border-t border-slate-800 px-4 pt-3 pb-6">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <button
              type="button"
              disabled={!canContinue}
              onClick={next}
              className={`flex-1 py-3.5 rounded-xl font-bold text-[15px] transition-all
                ${canContinue
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-[#1e3a5f] text-slate-500 cursor-not-allowed'
                }`}
            >
              {canContinue ? 'Valider' : 'Choisir une graduation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
