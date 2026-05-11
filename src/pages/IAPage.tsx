import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Save, CheckCircle, AlertCircle, Eye, EyeOff,
  Key, MessageSquare, Cpu, ChevronDown, Scale, Volume2, GitBranch,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

const GPT_MODELS = [
  { value: 'gpt-4o',        label: 'GPT-4o' },
  { value: 'gpt-4o-mini',   label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo',   label: 'GPT-4 Turbo' },
  { value: 'gpt-4',         label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

const GPT_ROUTER_MODELS = [
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (recommandé — rapide et économique)' },
  { value: 'gpt-4o-mini',   label: 'GPT-4o Mini' },
  { value: 'gpt-4o',        label: 'GPT-4o' },
];

type IASettings = {
  id?: string;
  prompt: string;
  openai_api_key: string;
  gpt_model: string;
  prompt_erp: string;
  gpt_model_erp: string;
  prompt_bruit: string;
  gpt_model_bruit: string;
  prompt_router: string;
  gpt_model_router: string;
};

const EMPTY: IASettings = {
  prompt: '',
  openai_api_key: '',
  gpt_model: 'gpt-4o',
  prompt_erp: '',
  gpt_model_erp: 'gpt-4o',
  prompt_bruit: '',
  gpt_model_bruit: 'gpt-4o',
  prompt_router: '',
  gpt_model_router: 'gpt-3.5-turbo',
};

// ── Shared sub-components ──────────────────────────────────────────────────

function CardHeader({
  open,
  onToggle,
  iconBg,
  icon,
  title,
  collapsedPreview,
}: {
  open: boolean;
  onToggle: () => void;
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  collapsedPreview?: React.ReactNode;
}) {
  return (
    <div
      className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm">{title}</p>
          {!open && collapsedPreview}
        </div>
      </div>
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
          text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
          hover:border-slate-600 transition-all shrink-0"
      >
        {open ? 'Réduire' : 'Déployer'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}

function ModelSelector({
  value,
  onChange,
  accentColor,
}: {
  value: string;
  onChange: (v: string) => void;
  accentColor: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">Modèle GPT</label>
      <div className="relative mb-3">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-xl px-4 pr-10 py-2.5
            text-white text-sm focus:outline-none focus:ring-2 focus:border-transparent
            transition-all cursor-pointer"
          style={{ ['--tw-ring-color' as string]: accentColor }}
        >
          {GPT_MODELS.map((m) => (
            <option key={m.value} value={m.value} className="bg-slate-800">
              {m.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {GPT_MODELS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm transition-all text-left
              ${value === m.value
                ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === m.value ? 'bg-blue-400' : 'bg-slate-600'}`} />
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MsgBanner({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) {
  if (!msg) return null;
  return (
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
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function IAPage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<IASettings>(EMPTY);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);

  // Open/close state per section
  const [openRouter, setOpenRouter] = useState(true);
  const [openPrompt, setOpenPrompt] = useState(true);
  const [openKey, setOpenKey] = useState(true);
  const [openModel, setOpenModel] = useState(true);
  const [openErp, setOpenErp] = useState(false);
  const [openBruit, setOpenBruit] = useState(false);

  // Per-card save states
  const [savingRouter, setSavingRouter] = useState(false);
  const [msgRouter, setMsgRouter] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingTerrain, setSavingTerrain] = useState(false);
  const [msgTerrain, setMsgTerrain] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingErp, setSavingErp] = useState(false);
  const [msgErp, setMsgErp] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingBruit, setSavingBruit] = useState(false);
  const [msgBruit, setMsgBruit] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!session) { navigate('/'); return; }
    fetchSettings();
  }, [session]);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase.from('ia_settings').select('*').limit(1).maybeSingle();
    if (data) {
      setSettings({
        prompt: data.prompt ?? '',
        openai_api_key: data.openai_api_key ?? '',
        gpt_model: data.gpt_model ?? 'gpt-4o',
        prompt_erp: data.prompt_erp ?? '',
        gpt_model_erp: data.gpt_model_erp ?? 'gpt-4o',
        prompt_bruit: data.prompt_bruit ?? '',
        gpt_model_bruit: data.gpt_model_bruit ?? 'gpt-4o',
        prompt_router: data.prompt_router ?? '',
        gpt_model_router: data.gpt_model_router ?? 'gpt-3.5-turbo',
      });
      setRowId(data.id);
    }
    setLoading(false);
  }

  async function persist(
    payload: Partial<IASettings>,
    setSaving: (v: boolean) => void,
    setMsg: (m: { type: 'success' | 'error'; text: string } | null) => void,
  ) {
    setSaving(true);
    setMsg(null);
    const full = { ...payload, updated_at: new Date().toISOString() };
    let error;
    if (rowId) {
      ({ error } = await supabase.from('ia_settings').update(full).eq('id', rowId));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ia_settings').insert(full).select('id').single();
      error = insertError;
      if (inserted) setRowId(inserted.id);
    }
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
    } else {
      setMsg({ type: 'success', text: 'Enregistré avec succès.' });
    }
  }

  async function handleSaveRouter(e: FormEvent) {
    e.preventDefault();
    await persist(
      { prompt_router: settings.prompt_router.trim(), gpt_model_router: settings.gpt_model_router },
      setSavingRouter,
      setMsgRouter,
    );
  }

  async function handleSaveTerrain(e: FormEvent) {
    e.preventDefault();
    await persist(
      { prompt: settings.prompt.trim(), openai_api_key: settings.openai_api_key.trim(), gpt_model: settings.gpt_model },
      setSavingTerrain,
      setMsgTerrain,
    );
  }

  async function handleSaveErp(e: FormEvent) {
    e.preventDefault();
    await persist(
      { prompt_erp: settings.prompt_erp.trim(), gpt_model_erp: settings.gpt_model_erp },
      setSavingErp,
      setMsgErp,
    );
  }

  async function handleSaveBruit(e: FormEvent) {
    e.preventDefault();
    await persist(
      { prompt_bruit: settings.prompt_bruit.trim(), gpt_model_bruit: settings.gpt_model_bruit },
      setSavingBruit,
      setMsgBruit,
    );
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
          <div className="space-y-8">
            {/* ── Page header ── */}
            <div>
              <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                <Bot className="w-6 h-6 text-cyan-400" />
                Intelligence Artificielle
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Configurez les paramètres de chaque assistant IA
              </p>
            </div>

            {/* ════════════════════════════════════════
                CONTENEUR 0 — Routeur IA
            ════════════════════════════════════════ */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center shrink-0">
                  <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Routeur IA</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">Système</span>
              </div>
              <p className="text-slate-500 text-xs mb-4 ml-9">
                Détermine automatiquement quel(s) expert(s) utiliser pour répondre à chaque question.
              </p>

              <form onSubmit={handleSaveRouter} className="space-y-4">
                <MsgBanner msg={msgRouter} />

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-slate-500 to-slate-400" />
                  <CardHeader
                    open={openRouter}
                    onToggle={() => setOpenRouter((v) => !v)}
                    iconBg="bg-slate-500/10 border border-slate-500/20"
                    icon={<GitBranch className="w-4 h-4 text-slate-400" />}
                    title="Prompt système — Routeur"
                    collapsedPreview={
                      settings.prompt_router
                        ? <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{settings.prompt_router.slice(0, 60)}{settings.prompt_router.length > 60 ? '…' : ''}</p>
                        : <p className="text-xs text-slate-600 mt-0.5 italic">Non configuré</p>
                    }
                  />
                  {openRouter && (
                    <div className="border-t border-slate-800 px-5 pb-5 pt-4 space-y-5">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Prompt système — Routeur</label>
                        <textarea
                          rows={10}
                          value={settings.prompt_router}
                          onChange={(e) => setSettings((s) => ({ ...s, prompt_router: e.target.value }))}
                          placeholder="Collez ici le prompt du routeur IA…"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white
                            placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500
                            focus:border-transparent transition-all resize-none leading-relaxed"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          Ce prompt est utilisé par un modèle rapide (GPT-3.5) pour détecter automatiquement quel(s) expert(s) utiliser.
                          Il doit retourner uniquement un tableau JSON comme <code className="text-slate-400 bg-slate-800 px-1 rounded">["terrain"]</code> ou <code className="text-slate-400 bg-slate-800 px-1 rounded">["terrain","erp"]</code>.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Modèle GPT du routeur</label>
                        <div className="relative mb-3">
                          <select
                            value={settings.gpt_model_router}
                            onChange={(e) => setSettings((s) => ({ ...s, gpt_model_router: e.target.value }))}
                            className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-xl px-4 pr-10 py-2.5
                              text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent
                              transition-all cursor-pointer"
                          >
                            {GPT_ROUTER_MODELS.map((m) => (
                              <option key={m.value} value={m.value} className="bg-slate-800">{m.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                        <p className="text-xs text-slate-500">
                          Utilisez GPT-3.5-turbo pour le routeur — il est 10x moins cher et suffisamment précis pour la détection de contexte.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingRouter}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                      disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {savingRouter ? 'Enregistrement…' : 'Enregistrer le routeur'}
                  </button>
                </div>
              </form>
            </section>

            <div className="border-t border-slate-800" />

            {/* ════════════════════════════════════════
                CONTENEUR 1 — Assistant terrain
            ════════════════════════════════════════ */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Assistant terrain</p>
              </div>
              <p className="text-slate-500 text-xs mb-4 ml-9">
                Sécurité des personnes et gestion SSI pour les agents sur le terrain.
              </p>

              <form onSubmit={handleSaveTerrain} className="space-y-4">
                <MsgBanner msg={msgTerrain} />

                {/* Prompt */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
                  <CardHeader
                    open={openPrompt}
                    onToggle={() => setOpenPrompt((v) => !v)}
                    iconBg="bg-cyan-500/10 border border-cyan-500/20"
                    icon={<MessageSquare className="w-4 h-4 text-cyan-400" />}
                    title="Prompt système"
                    collapsedPreview={
                      settings.prompt
                        ? <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{settings.prompt.slice(0, 60)}{settings.prompt.length > 60 ? '…' : ''}</p>
                        : <p className="text-xs text-slate-600 mt-0.5 italic">Non configuré</p>
                    }
                  />
                  {openPrompt && (
                    <div className="border-t border-slate-800 px-5 pb-5 pt-4">
                      <textarea
                        rows={8}
                        value={settings.prompt}
                        onChange={(e) => setSettings((s) => ({ ...s, prompt: e.target.value }))}
                        placeholder="Ex : Tu es un assistant spécialisé dans la sécurité des événements. Réponds toujours en français…"
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
                  <CardHeader
                    open={openKey}
                    onToggle={() => setOpenKey((v) => !v)}
                    iconBg="bg-amber-500/10 border border-amber-500/20"
                    icon={<Key className="w-4 h-4 text-amber-400" />}
                    title="Clé API OpenAI"
                    collapsedPreview={
                      settings.openai_api_key
                        ? <p className="text-xs text-slate-500 mt-0.5 font-mono">{maskedKey}</p>
                        : <p className="text-xs text-slate-600 mt-0.5 italic">Non configurée</p>
                    }
                  />
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

                {/* Model */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-500 to-sky-400" />
                  <CardHeader
                    open={openModel}
                    onToggle={() => setOpenModel((v) => !v)}
                    iconBg="bg-blue-500/10 border border-blue-500/20"
                    icon={<Cpu className="w-4 h-4 text-blue-400" />}
                    title="Modèle GPT"
                    collapsedPreview={
                      !openModel
                        ? <p className="text-xs text-slate-500 mt-0.5">{GPT_MODELS.find((m) => m.value === settings.gpt_model)?.label}</p>
                        : undefined
                    }
                  />
                  {openModel && (
                    <div className="border-t border-slate-800 px-5 pb-5 pt-4">
                      <ModelSelector
                        value={settings.gpt_model}
                        onChange={(v) => setSettings((s) => ({ ...s, gpt_model: v }))}
                        accentColor="#3b82f6"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingTerrain}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900
                      disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors
                      shadow-lg shadow-cyan-900/30"
                  >
                    <Save className="w-4 h-4" />
                    {savingTerrain ? 'Enregistrement…' : 'Enregistrer l\'assistant terrain'}
                  </button>
                </div>
              </form>
            </section>

            <div className="border-t border-slate-800" />

            {/* ════════════════════════════════════════
                CONTENEUR 2 — Expert ERP
            ════════════════════════════════════════ */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Scale className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Expert réglementation ERP multi-activités</p>
              </div>
              <p className="text-slate-500 text-xs mb-4 ml-9">
                Analyse le profil réglementaire de l'établissement et génère les obligations ERP applicables selon les activités déclarées.
              </p>

              <form onSubmit={handleSaveErp} className="space-y-4">
                <MsgBanner msg={msgErp} />

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
                  <CardHeader
                    open={openErp}
                    onToggle={() => setOpenErp((v) => !v)}
                    iconBg="bg-blue-500/10 border border-blue-500/20"
                    icon={<Scale className="w-4 h-4 text-blue-400" />}
                    title="Prompt système — Expert ERP"
                    collapsedPreview={
                      settings.prompt_erp
                        ? <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{settings.prompt_erp.slice(0, 60)}{settings.prompt_erp.length > 60 ? '…' : ''}</p>
                        : <p className="text-xs text-slate-600 mt-0.5 italic">Non configuré</p>
                    }
                  />
                  {openErp && (
                    <div className="border-t border-slate-800 px-5 pb-5 pt-4 space-y-5">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Prompt système — Expert ERP</label>
                        <textarea
                          rows={12}
                          value={settings.prompt_erp}
                          onChange={(e) => setSettings((s) => ({ ...s, prompt_erp: e.target.value }))}
                          placeholder="Collez ici le prompt système de l'expert ERP…"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white
                            placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                            focus:border-transparent transition-all resize-none leading-relaxed"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          {settings.prompt_erp.length} caractère{settings.prompt_erp.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ModelSelector
                        value={settings.gpt_model_erp}
                        onChange={(v) => setSettings((s) => ({ ...s, gpt_model_erp: v }))}
                        accentColor="#3b82f6"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingErp}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900
                      disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors
                      shadow-lg shadow-blue-900/30"
                  >
                    <Save className="w-4 h-4" />
                    {savingErp ? 'Enregistrement…' : 'Enregistrer le prompt ERP'}
                  </button>
                </div>
              </form>
            </section>

            <div className="border-t border-slate-800" />

            {/* ════════════════════════════════════════
                CONTENEUR 3 — Expert bruit
            ════════════════════════════════════════ */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Volume2 className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Expert bruit et acoustique</p>
              </div>
              <p className="text-slate-500 text-xs mb-4 ml-9">
                Analyse les obligations acoustiques de l'établissement selon le Décret n°2017-1244 et la réglementation sur les sons amplifiés.
              </p>

              <form onSubmit={handleSaveBruit} className="space-y-4">
                <MsgBanner msg={msgBruit} />

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-violet-500 to-violet-400" />
                  <CardHeader
                    open={openBruit}
                    onToggle={() => setOpenBruit((v) => !v)}
                    iconBg="bg-violet-500/10 border border-violet-500/20"
                    icon={<Volume2 className="w-4 h-4 text-violet-400" />}
                    title="Prompt système — Expert bruit"
                    collapsedPreview={
                      settings.prompt_bruit
                        ? <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{settings.prompt_bruit.slice(0, 60)}{settings.prompt_bruit.length > 60 ? '…' : ''}</p>
                        : <p className="text-xs text-slate-600 mt-0.5 italic">Non configuré</p>
                    }
                  />
                  {openBruit && (
                    <div className="border-t border-slate-800 px-5 pb-5 pt-4 space-y-5">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Prompt système — Expert bruit</label>
                        <textarea
                          rows={12}
                          value={settings.prompt_bruit}
                          onChange={(e) => setSettings((s) => ({ ...s, prompt_bruit: e.target.value }))}
                          placeholder="Collez ici le prompt système de l'expert acoustique…"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white
                            placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500
                            focus:border-transparent transition-all resize-none leading-relaxed"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          {settings.prompt_bruit.length} caractère{settings.prompt_bruit.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ModelSelector
                        value={settings.gpt_model_bruit}
                        onChange={(v) => setSettings((s) => ({ ...s, gpt_model_bruit: v }))}
                        accentColor="#8b5cf6"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end pb-4">
                  <button
                    type="submit"
                    disabled={savingBruit}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900
                      disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors
                      shadow-lg shadow-violet-900/30"
                  >
                    <Save className="w-4 h-4" />
                    {savingBruit ? 'Enregistrement…' : 'Enregistrer le prompt bruit'}
                  </button>
                </div>
              </form>
            </section>

          </div>
        )}
      </main>
    </div>
  );
}
