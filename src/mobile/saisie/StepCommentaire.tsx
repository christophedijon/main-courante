import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { Mic, MicOff } from 'lucide-react';
import { useSaisie, SaisieType } from './SaisieContext';
import StepHeader from '../components/StepHeader';

type AnyWindow = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

export default function StepCommentaire() {
  const { type } = useParams<{ type: SaisieType }>();
  const navigate = useNavigate();
  const { draft, setField } = useSaisie();
  const [text, setText] = useState(draft.commentaire);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);

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
      if (finalText) setText((t) => (t ? t + ' ' : '') + finalText.trim());
    };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  if (!type) return <Navigate to="/mobile" replace />;
  if (draft.motifs.length === 0) return <Navigate to={`/mobile/saisie/${type}/motifs`} replace />;

  function toggleRec() {
    if (!recRef.current) return;
    if (recording) {
      recRef.current.stop();
      setRecording(false);
    } else {
      try {
        recRef.current.start();
        setRecording(true);
      } catch {
        setRecording(false);
      }
    }
  }

  function next() {
    setField('commentaire', text.trim());
    navigate(`/mobile/saisie/${type}/recap`);
  }

  return (
    <div>
      <StepHeader
        step={6} total={7}
        title="Commentaire"
        subtitle="Décrivez l'événement"
        backTo={`/mobile/saisie/${type}/motifs`}
      />

      <div className="px-4 py-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Détails de l'événement, témoins, actions entreprises…"
          rows={10}
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-white text-[15px]
            placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
            transition-all resize-none"
        />

        {supported ? (
          <button
            type="button"
            onClick={toggleRec}
            className={`mt-4 w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-[15px]
              transition-all border-2
              ${recording
                ? 'bg-red-600 border-red-500 text-white animate-pulse'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
          >
            {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {recording ? 'Arrêter la dictée' : 'Dictée vocale'}
          </button>
        ) : (
          <p className="mt-4 text-xs text-slate-500 text-center">
            Dictée vocale non supportée sur ce navigateur.
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-6 pb-4 px-4 z-20">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            onClick={next}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-[15px] py-4 rounded-2xl transition-colors"
          >
            Voir le récapitulatif
          </button>
        </div>
      </div>
    </div>
  );
}
