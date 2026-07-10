import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bug, Lightbulb, Mic, MicOff, Send, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useEntreprise } from '../../hooks/useEntreprise';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

type FeedbackType = 'bug' | 'suggestion';
type Step = 'choice' | 'form' | 'sent';

const PAGES = [
  'Accueil',
  "Saisie d'événements",
  'Jauge',
  'Rondes & Balises',
  'Registre de sécurité',
  'Assistant IA',
  'Historique',
  'Espaces & Zones',
  'Motifs',
  'Paramètres établissement',
  'Emails automatiques',
  'Boîte à outils',
  'Autre',
];

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { session, userFonction } = useAuth();
  const { nom: etabNom } = useEntreprise();

  const [step, setStep] = useState<Step>('choice');
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [pageConcernee, setPageConcernee] = useState('Accueil');
  const [loading, setLoading] = useState(false);
  const [enseigne, setEnseigne] = useState('');

  const { transcript, recording, supported, toggle, setTranscript } = useSpeechRecognition('');

  useEffect(() => {
    supabase
      .from('etablissements')
      .select('enseigne')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data?.enseigne) setEnseigne(data.enseigne); });
  }, []);

  function selectType(type: FeedbackType) {
    setFeedbackType(type);
    setTranscript('');
    setStep('form');
  }

  async function handleSend() {
    const trimmed = transcript.trim();
    if (trimmed.length < 10) return;
    setLoading(true);

    const userEmail = session?.user.email ?? 'inconnu';
    const etablissementLabel = enseigne ? `${etabNom} (${enseigne})` : etabNom;
    const isBug = feedbackType === 'bug';

    const subject = isBug
      ? `[Main Courante] 🐛 Bug — ${pageConcernee} — ${etablissementLabel}`
      : `[Main Courante] 💡 Suggestion — ${pageConcernee} — ${etablissementLabel}`;

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#0f172a;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;">${isBug ? '🐛 Signalement de bug' : '💡 Suggestion'}</h2>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;">
    <table style="width:100%;font-size:14px;color:#334155;">
      <tr>
        <td style="padding:8px 0;font-weight:600;color:#94a3b8;width:140px;">Établissement</td>
        <td style="padding:8px 0;">${etablissementLabel}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;color:#94a3b8;">Utilisateur</td>
        <td style="padding:8px 0;">${userEmail} — ${userFonction ?? 'inconnu'}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;color:#94a3b8;">Page concernée</td>
        <td style="padding:8px 0;">${pageConcernee}</td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <h3 style="color:#1e293b;font-size:15px;">Message :</h3>
    <p style="color:#475569;font-size:14px;line-height:1.7;white-space:pre-wrap;">${trimmed.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
    <p style="color:#94a3b8;font-size:12px;">Envoyé depuis Main Courante — ${new Date().toLocaleString('fr-FR')}</p>
  </div>
</div>`;

    await supabase.functions.invoke('send-test-email', {
      body: { to: 'contact@maincourante.eu', subject, html, replyTo: userEmail },
    });

    setLoading(false);
    setStep('sent');
    setTimeout(() => navigate('/mobile/outils'), 2000);
  }

  const isBug = feedbackType === 'bug';
  const canSend = transcript.trim().length >= 10;

  function Header() {
    return (
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button
          type="button"
          onClick={() => {
            if (step === 'form') setStep('choice');
            else navigate('/mobile/outils');
          }}
          className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-white text-xl font-bold">Feedback</h1>
      </div>
    );
  }

  if (step === 'sent') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-white text-xl font-bold text-center">Feedback envoyé !</h2>
          <p className="text-slate-400 text-sm text-center">
            Merci, nous reviendrons vers vous bientôt.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-slate-950">
        <Header />
        <div className="px-4 pt-2 pb-6">
          <p className="text-slate-400 text-sm mb-6">Comment pouvons-nous vous aider ?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => selectType('bug')}
              className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-red-500/50 p-5 flex flex-col gap-3 transition-all active:scale-[0.97] group"
            >
              <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 group-hover:bg-red-500/25 flex items-center justify-center transition-colors">
                <Bug className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-[14px] leading-tight">Signaler un bug</p>
                <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                  Quelque chose ne fonctionne pas
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => selectType('suggestion')}
              className="text-left rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 p-5 flex flex-col gap-3 transition-all active:scale-[0.97] group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 group-hover:bg-blue-500/25 flex items-center justify-center transition-colors">
                <Lightbulb className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-[14px] leading-tight">
                  Suggérer une amélioration
                </p>
                <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                  Une idée pour améliorer l'app
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="px-4 pb-10 space-y-5">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${
            isBug
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}
        >
          {isBug ? <Bug className="w-4 h-4" /> : <Lightbulb className="w-4 h-4" />}
          {isBug ? 'Signaler un bug' : 'Suggérer une amélioration'}
        </div>

        <div>
          <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Page concernée
          </label>
          <div className="relative">
            <select
              value={pageConcernee}
              onChange={(e) => setPageConcernee(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
            >
              {PAGES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Votre message
            </label>
            {supported && (
              <button
                type="button"
                onClick={toggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                  recording
                    ? 'bg-red-500/15 border border-red-500/40 text-red-400'
                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {recording
                  ? <MicOff className="w-3.5 h-3.5" />
                  : <Mic className="w-3.5 h-3.5" />}
                {recording ? 'Arrêter' : 'Dicter'}
              </button>
            )}
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              isBug
                ? 'Décrivez le problème rencontré...'
                : 'Décrivez votre idée...'
            }
            rows={6}
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-500 transition-colors"
          />
          {recording && (
            <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              Enregistrement en cours…
            </p>
          )}
          <p
            className={`text-[11px] mt-1 text-right transition-colors ${
              transcript.trim().length < 10 ? 'text-slate-600' : 'text-slate-500'
            }`}
          >
            {transcript.trim().length} caractère{transcript.trim().length > 1 ? 's' : ''} (10 min.)
          </p>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend || loading}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-[15px] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-5 h-5 rounded-full border-2 border-t-transparent border-white animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              Envoyer
            </>
          )}
        </button>
      </div>
    </div>
  );
}
