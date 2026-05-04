import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Save, CheckCircle, AlertCircle, Eye, EyeOff,
  Key, MessageSquare, Cpu, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

const GPT_MODELS = [
  { value: 'gpt-4o',          label: 'GPT-4o' },
  { value: 'gpt-4o-mini',     label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo',     label: 'GPT-4 Turbo' },
  { value: 'gpt-4',           label: 'GPT-4' },
  { value: 'gpt-3.5-turbo',   label: 'GPT-3.5 Turbo' },
];

type IASettings = {
  id?: string;
  prompt: string;
  openai_api_key: string;
  gpt_model: string;
};

const EMPTY: IASettings = {
  prompt: '',
  openai_api_key: '',
  gpt_model: 'gpt-4o',
};

export default function IAPage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<IASettings>(EMPTY);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [openPrompt, setOpenPrompt] = useState(true);
  const [openKey, setOpenKey] = useState(true);
  const [openModel, setOpenModel] = useState(true);

  useEffect(() => {
    if (!session) { navigate('/'); return; }
    fetchSettings();
  }, [session]);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase
      .from('ia_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      setSettings({ prompt: data.prompt, openai_api_key: data.openai_api_key, gpt_model: data.gpt_model });
      setRowId(data.id);
    }
    setLoading(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const payload = {
      prompt: settings.prompt.trim(),
      openai_api_key: settings.openai_api_key.trim(),
      gpt_model: settings.gpt_model,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (rowId) {
      ({ error } = await supabase.from('ia_settings').update(payload).eq('id', rowId));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ia_settings')
        .insert(payload)
        .select('id')
        .single();
      error = insertError;
      if (inserted) setRowId(inserted.id);
    }

    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
    } else {
      setMsg({ type: 'success', text: 'Paramètres IA enregistrés avec succès.' });
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const maskedKey = settings.openai_api_key
    ? showKey
      ? settings.openai_api_key
      : settings.openai_api_key.slice(0, 7) + '••••••••••••••••••••' + settings.openai_api_key.slice(-4)
    : '';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={handleSignOut} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-500 gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Chargement…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Header */}
            <div className="mb-2">
              <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                <Bot className="w-6 h-6 text-cyan-400" />
                Intelligence Artificielle
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Configurez les paramètres de l'assistant IA
              </p>
            </div>

            {/* Feedback */}
            {msg && (
              <div className={`flex items-start gap-3 rounded-xl p-3.5 text-sm border
                ${msg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
              >
                {msg.type === 'success'
                  ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{msg.text}</span>
              </div>
            )}

            {/* Prompt */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
              <div
                className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                onClick={() => setOpenPrompt((v) => !v)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm">Prompt système</p>
                    {!openPrompt && settings.prompt && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{settings.prompt.slice(0, 60)}{settings.prompt.length > 60 ? '…' : ''}</p>
                    )}
                    {!openPrompt && !settings.prompt && (
                      <p className="text-xs text-slate-600 mt-0.5 italic">Non configuré</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                    text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
                    hover:border-slate-600 transition-all shrink-0"
                >
                  {openPrompt ? 'Réduire' : 'Déployer'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openPrompt ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {openPrompt && (
                <div className="border-t border-slate-800 px-5 pb-5 pt-4">
                  <textarea
                    rows={8}
                    value={settings.prompt}
                    onChange={(e) => setSettings((s) => ({ ...s, prompt: e.target.value }))}
                    placeholder="Ex : Tu es un assistant spécialisé dans la sécurité des événements. Réponds toujours en français de manière professionnelle…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white
                      placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500
                      focus:border-transparent transition-all resize-none leading-relaxed"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    {settings.prompt.length} caractère{settings.prompt.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* API Key */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
              <div
                className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                onClick={() => setOpenKey((v) => !v)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm">Clé API OpenAI</p>
                    {!openKey && settings.openai_api_key && (
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{maskedKey}</p>
                    )}
                    {!openKey && !settings.openai_api_key && (
                      <p className="text-xs text-slate-600 mt-0.5 italic">Non configurée</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                    text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
                    hover:border-slate-600 transition-all shrink-0"
                >
                  {openKey ? 'Réduire' : 'Déployer'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openKey ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {openKey && (
                <div className="border-t border-slate-800 px-5 pb-5 pt-4">
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={settings.openai_api_key}
                      onChange={(e) => setSettings((s) => ({ ...s, openai_api_key: e.target.value }))}
                      placeholder="sk-proj-…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-12 py-2.5 text-white
                        placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500
                        focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowKey((v) => !v); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                      title={showKey ? 'Masquer' : 'Afficher'}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {settings.openai_api_key && !showKey && (
                    <p className="text-xs text-slate-600 mt-2 font-mono">{maskedKey}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Trouvez votre clé sur{' '}
                    <span className="text-amber-400/80">platform.openai.com/api-keys</span>
                  </p>
                </div>
              )}
            </div>

            {/* Model selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-sky-400" />
              <div
                className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                onClick={() => setOpenModel((v) => !v)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm">Modèle GPT</p>
                    {!openModel && (
                      <p className="text-xs text-slate-500 mt-0.5">{GPT_MODELS.find((m) => m.value === settings.gpt_model)?.label}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                    text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
                    hover:border-slate-600 transition-all shrink-0"
                >
                  {openModel ? 'Réduire' : 'Déployer'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openModel ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {openModel && (
                <div className="border-t border-slate-800 px-5 pb-5 pt-4">
                  <div className="relative">
                    <select
                      value={settings.gpt_model}
                      onChange={(e) => setSettings((s) => ({ ...s, gpt_model: e.target.value }))}
                      className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-xl px-4 pr-10 py-2.5
                        text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        transition-all cursor-pointer"
                    >
                      {GPT_MODELS.map((m) => (
                        <option key={m.value} value={m.value} className="bg-slate-800">
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {GPT_MODELS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, gpt_model: m.value }))}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm transition-all text-left
                          ${settings.gpt_model === m.value
                            ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${settings.gpt_model === m.value ? 'bg-blue-400' : 'bg-slate-600'}`} />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Save */}
            <div className="flex justify-end pb-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900
                  disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors
                  shadow-lg shadow-cyan-900/30"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
