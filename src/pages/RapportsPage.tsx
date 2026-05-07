import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, ChevronDown, ChevronUp, RefreshCw, Calendar, Users,
  AlertTriangle, Play, Mail, ToggleLeft, ToggleRight, Save, CheckCircle,
  AlertCircle, Settings, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

type Rapport = {
  id: string;
  date_soiree: string;
  debut_soiree: string;
  fin_soiree: string;
  nb_evenements: number;
  nb_agents: number;
  contenu_html: string | null;
  created_at: string;
};

type EmailSettings = {
  id: string;
  email_enabled: boolean;
};

function formatDateSoiree(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function RapportsPage() {
  const { signOut, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Email settings state
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('rapports_soiree')
      .select('*')
      .order('date_soiree', { ascending: false });
    setRapports((data ?? []) as Rapport[]);
    setLoading(false);
  }

  async function loadEmailSettings() {
    const { data } = await supabase
      .from('rapport_email_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      setEmailSettings(data as EmailSettings);
      setEmailEnabled(data.email_enabled ?? false);
    }
  }

  useEffect(() => {
    load();
    if (isSuperAdmin) loadEmailSettings();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rapport-soiree`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ test: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erreur inconnue');
      setToast({ msg: json.message ?? 'Rapport généré avec succès.', type: 'success' });
      await load();
    } catch (err: any) {
      setToast({ msg: err.message, type: 'error' });
    }
    setGenerating(false);
  }

  async function handleSaveEmail(e: FormEvent) {
    e.preventDefault();
    if (!emailSettings) return;
    setSavingEmail(true);
    const { error } = await supabase
      .from('rapport_email_settings')
      .update({
        email_enabled: emailEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailSettings.id);
    setSavingEmail(false);
    if (error) {
      setToast({ msg: 'Erreur lors de la sauvegarde.', type: 'error' });
      return;
    }
    setEmailSettings((prev) => prev ? { ...prev, email_enabled: emailEnabled } : prev);
    setEmailPanelOpen(false);
    setToast({ msg: 'Paramètres email enregistrés.', type: 'success' });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AppHeader onSignOut={signOut} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Rapports de soirée</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Générés automatiquement chaque matin à 8h00 pour la soirée précédente (15h00 → 07h00).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-semibold transition-all text-sm"
              >
                <Play className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
                {generating ? 'Génération…' : 'Générer maintenant'}
              </button>
            )}
          </div>
        </div>

        {/* ── Email notification settings ─────────────────────────────── */}
        {isSuperAdmin && emailSettings !== null && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm">Envoi par e-mail</p>
                  {!emailPanelOpen && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {emailSettings.email_enabled ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          Activé
                          {emailSettings.email_destination && (
                            <span className="text-slate-500 ml-1">· {emailSettings.email_destination}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Désactivé</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailPanelOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
                  hover:border-slate-600 transition-all shrink-0"
              >
                <Settings className="w-3 h-3" />
                {emailPanelOpen ? 'Fermer' : 'Configurer'}
              </button>
            </div>

            {emailPanelOpen && (
              <form onSubmit={handleSaveEmail} className="border-t border-slate-800 px-5 py-5 space-y-4">
                {/* Toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Envoyer le rapport par e-mail</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Le rapport HTML sera envoyé dès qu'un nouveau rapport est généré.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailEnabled((v) => !v)}
                    className="shrink-0 transition-colors"
                    aria-label="Activer/désactiver"
                  >
                    {emailEnabled
                      ? <ToggleRight className="w-9 h-9 text-emerald-400" />
                      : <ToggleLeft className="w-9 h-9 text-slate-600" />}
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Le rapport sera envoyé à tous les utilisateurs dont la fonction est <span className="text-slate-300 font-medium">Direction</span>. L'envoi s'effectue via Make.com.
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailPanelOpen(false);
                      setEmailDraft(emailSettings.email_destination);
                      setEmailEnabled(emailSettings.email_enabled);
                    }}
                    className="flex-1 px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={savingEmail}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500
                      disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium px-4 py-2
                      rounded-xl text-sm transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingEmail ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Stats rapides */}
        {!loading && rapports.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-white">{rapports.length}</p>
              <p className="text-slate-400 text-sm mt-1">Rapports générés</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-blue-400">
                {rapports.reduce((s, r) => s + r.nb_evenements, 0)}
              </p>
              <p className="text-slate-400 text-sm mt-1">Événements total</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-emerald-400">
                {rapports.length > 0
                  ? Math.round(rapports.reduce((s, r) => s + r.nb_evenements, 0) / rapports.length)
                  : 0}
              </p>
              <p className="text-slate-400 text-sm mt-1">Moy. / soirée</p>
            </div>
          </div>
        )}

        {/* Liste des rapports */}
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : rapports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-600 gap-4">
            <FileText className="w-12 h-12 opacity-25" />
            <div className="text-center">
              <p className="text-base font-medium text-slate-500">Aucun rapport disponible</p>
              <p className="text-sm text-slate-600 mt-1">
                Le premier rapport sera généré automatiquement demain à 8h00,<br />
                ou vous pouvez en déclencher un manuellement.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rapports.map((rapport) => {
              const isOpen = openId === rapport.id;
              const dateSoiree = formatDateSoiree(rapport.date_soiree);
              const heureDebut = formatTime(rapport.debut_soiree);
              const heureFin = formatTime(rapport.fin_soiree);

              return (
                <div
                  key={rapport.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : rapport.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-slate-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-[15px] capitalize truncate">{dateSoiree}</p>
                      <p className="text-slate-500 text-[12px] mt-0.5">{heureDebut} → {heureFin}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center hidden sm:block">
                        <p className="text-white font-bold text-lg leading-none">{rapport.nb_evenements}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">événements</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="text-emerald-400 font-bold text-lg leading-none">{rapport.nb_agents}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">agents</p>
                      </div>
                      <div className="sm:hidden flex items-center gap-2 text-slate-400 text-sm">
                        <FileText className="w-4 h-4" />{rapport.nb_evenements}
                        <Users className="w-4 h-4 ml-1" />{rapport.nb_agents}
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isOpen
                        ? <ChevronUp className="w-4 h-4 text-slate-500" />
                        : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </button>

                  {isOpen && rapport.contenu_html && (
                    <div className="border-t border-slate-800">
                      <div
                        className="w-full overflow-auto bg-white rounded-b-2xl"
                        style={{ maxHeight: '80vh' }}
                        dangerouslySetInnerHTML={{ __html: rapport.contenu_html }}
                      />
                    </div>
                  )}

                  {isOpen && !rapport.contenu_html && (
                    <div className="border-t border-slate-800 px-5 py-6 flex items-center gap-3 text-slate-500">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span className="text-sm">Aucun contenu HTML disponible pour ce rapport.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl border max-w-sm
          ${toast.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200'
            : 'bg-red-900/90 border-red-700 text-red-200'}`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
