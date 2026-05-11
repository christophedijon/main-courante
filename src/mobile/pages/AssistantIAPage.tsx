import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mic, MicOff, Send, Sparkles, RotateCcw,
  AlertCircle, Pencil,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Section = { title: string; content: string };

const CARD_COLORS = [
  { bg: 'bg-blue-500/10 border-blue-500/25',   title: 'text-blue-400',  num: 'bg-blue-500/20 text-blue-300' },
  { bg: 'bg-red-500/10 border-red-500/25',     title: 'text-red-400',   num: 'bg-red-500/20 text-red-300' },
  { bg: 'bg-amber-500/10 border-amber-500/25', title: 'text-amber-400', num: 'bg-amber-500/20 text-amber-300' },
  { bg: 'bg-cyan-500/10 border-cyan-500/25',   title: 'text-cyan-400',  num: 'bg-cyan-500/20 text-cyan-300' },
];

function parseResponse(text: string): Section[] {
  const parts = text.split(/(?=^[1-4]\.\s)/m).filter((p) => p.trim() !== '');
  if (parts.length >= 2) {
    return parts.slice(0, 4).map((part, i) => {
      const firstLine = part.split('\n')[0].trim();
      const titleMatch = firstLine.match(/^[1-4]\.\s*\*?\*?([^*\n]+)\*?\*?/);
      const title = titleMatch ? titleMatch[1].replace(/\*/g, '').trim() : `Section ${i + 1}`;
      const content = part.replace(/^[1-4]\.\s*\*?\*?[^*\n]+\*?\*?\n?/, '').trim();
      return { title, content };
    });
  }
  return [{ title: 'Réponse', content: text.trim() }];
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function AssistantIAPage() {
  const navigate = useNavigate();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [expertsUsed, setExpertsUsed] = useState<string[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const speechAvailable = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function stopRecording() {
    recognitionRef.current?.stop();
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setRecording(false);
    setElapsed(0);
  }

  function handleRecord() {
    if (recording) {
      stopRecording();
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (i < event.results.length - 1) transcript += ' ';
      }
      setMessage(transcript);
    };

    recognition.onerror = () => stopRecording();

    recognition.onend = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setRecording(false);
      setElapsed(0);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    setElapsed(0);

    timerRef.current = setTimeout(() => {
      recognition.stop();
      setRecording(false);
    }, 90000);

    intervalRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e >= 90) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          return 90;
        }
        return e + 1;
      });
    }, 1000);
  }

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setSections(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ia-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ message: trimmed }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        const msg = data.error || 'Erreur lors de la requête.';
        if (msg.includes('non configuré')) {
          setError("L'assistant IA n'est pas encore configuré. Contactez votre administrateur.");
        } else {
          setError(msg);
        }
        return;
      }

      const parsedSections = parseResponse(data.response);
      setSections(parsedSections);
      setExpertsUsed(data.experts || ['terrain']);
      setEditMode(false);

      // Sauvegarder dans l'historique
      if (session) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .maybeSingle();
        const agentNom = profile
          ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
          : session.user.email ?? 'Agent';

        await supabase.from('ia_historique').insert({
          agent_id: session.user.id,
          agent_nom: agentNom,
          question: trimmed,
          reponse_complete: data.response,
          sections: parsedSections,
        });
      }
    } catch {
      setError("Impossible de joindre l'assistant. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setMessage('');
    setSections(null);
    setError(null);
    setEditMode(false);
    setExpertsUsed([]);
  }

  const showInput = !sections || editMode;

  return (
    <div className="pb-12">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/mobile/outils')}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px]">Assistant IA</p>
          <p className="text-slate-500 text-xs">Gestion sécurité personnes & incendie</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* Mic button */}
        {speechAvailable && showInput && (
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              type="button"
              onClick={handleRecord}
              disabled={loading}
              className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1.5 border-2 transition-all active:scale-95
                ${recording
                  ? 'bg-red-500/20 border-red-500/60 text-red-400'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
            >
              {recording && (
                <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
              )}
              {recording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              <span className="text-[10px] font-semibold leading-none">
                {recording ? 'Arrêter' : 'Parler'}
              </span>
            </button>
            {recording ? (
              <p className="text-red-400 text-xs font-mono font-semibold">{elapsed}s / 90s</p>
            ) : (
              <p className="text-slate-500 text-xs text-center">Appuyez pour dicter votre question</p>
            )}
          </div>
        )}

        {/* Textarea + send */}
        {showInput && (
          <div className="space-y-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="La transcription apparaîtra ici automatiquement… Vous pouvez aussi taper directement."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 text-white placeholder-slate-600 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none transition-all"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!message.trim() || loading}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Analyse en cours…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Envoyer à l'IA
                </>
              )}
            </button>
          </div>
        )}

        {/* Skeleton loader */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2">
                <div className="h-3 bg-slate-800 rounded-full w-1/3" />
                <div className="h-2.5 bg-slate-800 rounded-full w-full" />
                <div className="h-2.5 bg-slate-800 rounded-full w-4/5" />
                <div className="h-2.5 bg-slate-800 rounded-full w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/25 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {/* Response cards */}
        {sections && !editMode && !loading && (
          <>
            {/* Expert badges */}
            {expertsUsed.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {expertsUsed.includes('terrain') && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    Expert Terrain
                  </span>
                )}
                {expertsUsed.includes('erp') && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    Expert ERP
                  </span>
                )}
                {expertsUsed.includes('bruit') && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    Expert Bruit
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-[13px] font-medium transition-all active:scale-[0.98]"
            >
              <Pencil className="w-3.5 h-3.5" />
              Modifier ou compléter la situation
            </button>

            <div className="space-y-3">
              {sections.map((section, i) => {
                const c = CARD_COLORS[i % CARD_COLORS.length];
                return (
                  <div key={i} className={`rounded-2xl border p-4 ${c.bg}`}>
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${c.num}`}>
                        {i + 1}
                      </span>
                      <p className={`font-bold text-[14px] leading-tight ${c.title}`}>{section.title}</p>
                    </div>
                    <p className="text-slate-300 text-[13px] leading-relaxed whitespace-pre-line">
                      {section.content}
                    </p>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4" />
              Nouvelle question
            </button>
          </>
        )}
      </div>

    </div>
  );
}