import { useEffect, useState } from 'react';
import {
  Mail, ToggleLeft, ToggleRight, Settings, ChevronDown, ChevronUp,
  Save, X, CheckCircle, AlertCircle, RefreshCw, Send, Plus, Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';

type EmailRule = {
  id: string;
  type: 'rapport_soiree' | 'registre_securite';
  label: string;
  active: boolean;
  dest_direction: boolean;
  dest_chef_de_poste: boolean;
  dest_agent_securite: boolean;
  dest_serveur: boolean;
  dest_email_organisme: boolean;
  dest_emails_libres: string[];
  jours_avant_echeance: number;
  rappel_retard_frequence: 'quotidien' | 'hebdomadaire' | 'mensuel';
};

type Toast = { msg: string; type: 'success' | 'error' };

const FONCTIONS_LABELS: { key: keyof EmailRule; label: string; onlyRegistre?: boolean }[] = [
  { key: 'dest_direction', label: 'Direction' },
  { key: 'dest_chef_de_poste', label: 'Chef de Poste' },
  { key: 'dest_agent_securite', label: 'Agent de Sécurité' },
  { key: 'dest_serveur', label: 'Serveur' },
  { key: 'dest_email_organisme', label: 'Email organisme (registre)', onlyRegistre: true },
];

const FREQUENCE_OPTIONS = [
  { value: 'quotidien', label: 'Quotidien' },
  { value: 'hebdomadaire', label: 'Hebdomadaire (lundi)' },
  { value: 'mensuel', label: 'Mensuel (1er du mois)' },
];

const TYPE_LABELS: Record<string, string> = {
  rapport_soiree: 'Rapport de soirée',
  registre_securite: 'Alertes registre de sécurité',
};

const TYPE_DESC: Record<string, string> = {
  rapport_soiree: 'Envoyé automatiquement à la génération de chaque rapport (chaque matin à 8h ou manuellement).',
  registre_securite: 'Envoyé selon la fréquence configurée pour les vérifications en retard, et lorsqu\'une échéance approche.',
};

const MAKE_WEBHOOK = 'https://hook.eu2.make.com/7g0h9yj07m25am6l5gtpvzbd12mkspbt';

export default function EmailsPage() {
  const { signOut, isSuperAdmin } = useAuth();
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EmailRule>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [newEmail, setNewEmail] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_rules')
      .select('*')
      .order('type');
    if (!error && data) {
      setRules(data as EmailRule[]);
      const d: Record<string, EmailRule> = {};
      (data as EmailRule[]).forEach((r) => { d[r.id] = { ...r }; });
      setDrafts(d);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function updateDraft(id: string, patch: Partial<EmailRule>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function addEmail(id: string) {
    const val = (newEmail[id] ?? '').trim();
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
    const current = drafts[id]?.dest_emails_libres ?? [];
    if (current.includes(val)) return;
    updateDraft(id, { dest_emails_libres: [...current, val] });
    setNewEmail((prev) => ({ ...prev, [id]: '' }));
  }

  function removeEmail(id: string, email: string) {
    const current = drafts[id]?.dest_emails_libres ?? [];
    updateDraft(id, { dest_emails_libres: current.filter((e) => e !== email) });
  }

  async function handleSave(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSaving((prev) => ({ ...prev, [id]: true }));
    const { error } = await supabase
      .from('email_rules')
      .update({
        active: draft.active,
        dest_direction: draft.dest_direction,
        dest_chef_de_poste: draft.dest_chef_de_poste,
        dest_agent_securite: draft.dest_agent_securite,
        dest_serveur: draft.dest_serveur,
        dest_email_organisme: draft.dest_email_organisme,
        dest_emails_libres: draft.dest_emails_libres,
        jours_avant_echeance: draft.jours_avant_echeance,
        rappel_retard_frequence: draft.rappel_retard_frequence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setSaving((prev) => ({ ...prev, [id]: false }));
    if (error) {
      setToast({ msg: 'Erreur lors de la sauvegarde.', type: 'error' });
      return;
    }
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, ...draft } : r));
    setToast({ msg: 'Règle enregistrée.', type: 'success' });
    setOpenId(null);
  }

  async function handleTest(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setTesting((prev) => ({ ...prev, [id]: true }));

    const recipients = await buildRecipients(draft);
    if (recipients.length === 0) {
      setToast({ msg: 'Aucun destinataire configuré pour cet envoi.', type: 'error' });
      setTesting((prev) => ({ ...prev, [id]: false }));
      return;
    }

    const sujetTest = draft.type === 'rapport_soiree'
      ? 'Test — Rapport de soirée'
      : 'Test — Alerte registre de sécurité';

    const htmlTest = `
      <div style="font-family:system-ui,sans-serif;padding:32px;background:#f8fafc;max-width:600px;margin:0 auto">
        <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:16px">
          <h1 style="color:#fff;font-size:18px;margin:0">Test d'envoi — ${TYPE_LABELS[draft.type]}</h1>
          <p style="color:#64748b;font-size:13px;margin:8px 0 0">Main Courante</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
          <p style="color:#374151;font-size:14px;margin:0">
            Ceci est un email de test pour la règle <strong>${draft.label || TYPE_LABELS[draft.type]}</strong>.
          </p>
          <p style="color:#64748b;font-size:13px;margin:12px 0 0">
            Destinataires : ${recipients.join(', ')}
          </p>
        </div>
      </div>
    `;

    try {
      const res = await fetch(MAKE_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipients, sujet: sujetTest, html: htmlTest }),
      });
      if (!res.ok) throw new Error('Webhook error');
      setToast({ msg: `Email de test envoyé à ${recipients.length} destinataire(s).`, type: 'success' });
    } catch {
      setToast({ msg: 'Erreur lors de l\'envoi du test.', type: 'error' });
    }
    setTesting((prev) => ({ ...prev, [id]: false }));
  }

  async function buildRecipients(rule: EmailRule): Promise<string[]> {
    const emails = new Set<string>(rule.dest_emails_libres ?? []);
    const fonctions: string[] = [];
    if (rule.dest_direction) fonctions.push('Direction');
    if (rule.dest_chef_de_poste) fonctions.push('Chef de Poste');
    if (rule.dest_agent_securite) fonctions.push('Agent de Sécurité');
    if (rule.dest_serveur) fonctions.push('Serveur');

    if (fonctions.length > 0) {
      const { data } = await supabase
        .from('managed_users')
        .select('email')
        .in('fonction', fonctions);
      (data ?? []).forEach((u: any) => emails.add(u.email));
    }

    if (rule.dest_email_organisme && rule.type === 'registre_securite') {
      const { data } = await supabase
        .from('registre_securite')
        .select('email_organisme')
        .not('email_organisme', 'is', null)
        .neq('email_organisme', '');
      (data ?? []).forEach((r: any) => { if (r.email_organisme) emails.add(r.email_organisme); });
    }

    return Array.from(emails).filter(Boolean);
  }

  function isDirty(id: string) {
    const orig = rules.find((r) => r.id === id);
    const draft = drafts[id];
    if (!orig || !draft) return false;
    return JSON.stringify(orig) !== JSON.stringify(draft);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AppHeader onSignOut={signOut} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Emails automatiques</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Configurez les règles d'envoi automatique d'emails. Chaque règle définit les destinataires et les conditions d'envoi.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all text-sm shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => {
              const draft = drafts[rule.id] ?? rule;
              const isOpen = openId === rule.id;
              const dirty = isDirty(rule.id);

              return (
                <div
                  key={rule.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
                >
                  {/* Top accent */}
                  <div className={`h-1 ${draft.active ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-slate-800'}`} />

                  {/* Card header */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border
                        ${draft.active
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : 'bg-slate-800 border-slate-700'}`}>
                        <Mail className={`w-4 h-4 ${draft.active ? 'text-emerald-400' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm">{TYPE_LABELS[rule.type]}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {draft.active ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                              Actif
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Inactif</span>
                          )}
                          {!isOpen && (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                          {!isOpen && (() => {
                            const dest: string[] = [];
                            if (rule.dest_direction) dest.push('Direction');
                            if (rule.dest_chef_de_poste) dest.push('Chef de Poste');
                            if (rule.dest_agent_securite) dest.push('Agent de Sécu.');
                            if (rule.dest_serveur) dest.push('Serveur');
                            if (rule.dest_email_organisme) dest.push('Organismes');
                            if ((rule.dest_emails_libres ?? []).length > 0) dest.push(`+${rule.dest_emails_libres.length} libre(s)`);
                            return dest.length > 0 ? (
                              <span className="text-xs text-slate-500 truncate">{dest.join(', ')}</span>
                            ) : (
                              <span className="text-xs text-slate-600">Aucun destinataire</span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Quick toggle active */}
                      <button
                        type="button"
                        onClick={() => {
                          const newVal = !draft.active;
                          updateDraft(rule.id, { active: newVal });
                        }}
                        title={draft.active ? 'Désactiver' : 'Activer'}
                        className="transition-colors"
                      >
                        {draft.active
                          ? <ToggleRight className="w-9 h-9 text-emerald-400" />
                          : <ToggleLeft className="w-9 h-9 text-slate-600" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : rule.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                          text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
                          hover:border-slate-600 transition-all"
                      >
                        <Settings className="w-3 h-3" />
                        {isOpen ? 'Fermer' : 'Configurer'}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded config panel */}
                  {isOpen && (
                    <div className="border-t border-slate-800 px-5 py-5 space-y-6">

                      {/* Description */}
                      <p className="text-xs text-slate-500">{TYPE_DESC[rule.type]}</p>

                      {/* Destinataires par rôle */}
                      <div>
                        <p className="text-sm font-semibold text-slate-200 mb-3">Destinataires</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {FONCTIONS_LABELS.filter((f) => !f.onlyRegistre || draft.type === 'registre_securite').map((f) => {
                            const checked = draft[f.key] as boolean;
                            return (
                              <label
                                key={f.key}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all
                                  ${checked
                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => updateDraft(rule.id, { [f.key]: e.target.checked } as any)}
                                  className="w-4 h-4 rounded accent-blue-500"
                                />
                                <span className="text-sm font-medium">{f.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Emails libres */}
                      <div>
                        <p className="text-sm font-semibold text-slate-200 mb-2">Adresses email supplémentaires</p>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="email"
                            placeholder="exemple@domaine.com"
                            value={newEmail[rule.id] ?? ''}
                            onChange={(e) => setNewEmail((prev) => ({ ...prev, [rule.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(rule.id); } }}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white
                              placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => addEmail(rule.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm transition-all border border-slate-600"
                          >
                            <Plus className="w-4 h-4" />
                            Ajouter
                          </button>
                        </div>
                        {(draft.dest_emails_libres ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {draft.dest_emails_libres.map((email) => (
                              <span
                                key={email}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300"
                              >
                                {email}
                                <button
                                  type="button"
                                  onClick={() => removeEmail(rule.id, email)}
                                  className="text-slate-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        {(draft.dest_emails_libres ?? []).length === 0 && (
                          <p className="text-xs text-slate-600">Aucune adresse supplémentaire.</p>
                        )}
                      </div>

                      {/* Paramètres spécifiques registre */}
                      {draft.type === 'registre_securite' && (
                        <div className="space-y-4">
                          <div className="h-px bg-slate-800" />
                          <p className="text-sm font-semibold text-slate-200">Paramètres registre</p>

                          {/* Fréquence retards */}
                          <div>
                            <label className="text-xs font-medium text-slate-400 block mb-1.5">
                              Fréquence de rappel pour les vérifications en retard
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {FREQUENCE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => updateDraft(rule.id, { rappel_retard_frequence: opt.value as any })}
                                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all
                                    ${draft.rappel_retard_frequence === opt.value
                                      ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Jours avant échéance */}
                          <div>
                            <label className="text-xs font-medium text-slate-400 block mb-1.5">
                              Alerte d'approche d'échéance (jours avant)
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[30, 60, 90, 120].map((j) => (
                                <button
                                  key={j}
                                  type="button"
                                  onClick={() => updateDraft(rule.id, { jours_avant_echeance: j })}
                                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all
                                    ${draft.jours_avant_echeance === j
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                >
                                  {j} jours
                                </button>
                              ))}
                            </div>
                            <p className="text-xs text-slate-600 mt-1.5">
                              Un email est envoyé quand une installation atteint ce délai avant son échéance.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleTest(rule.id)}
                          disabled={testing[rule.id]}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-700
                            text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <Send className={`w-3.5 h-3.5 ${testing[rule.id] ? 'animate-pulse' : ''}`} />
                          {testing[rule.id] ? 'Envoi…' : 'Tester'}
                        </button>

                        <div className="flex-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setOpenId(null);
                            setDrafts((prev) => ({ ...prev, [rule.id]: { ...rule } }));
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                          Annuler
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSave(rule.id)}
                          disabled={saving[rule.id] || !dirty}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                            bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600
                            disabled:cursor-not-allowed text-white transition-all"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {saving[rule.id] ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dirty indicator outside panel */}
                  {!isOpen && dirty && (
                    <div className="px-5 pb-3">
                      <p className="text-xs text-amber-400">
                        Modifications non enregistrées —{' '}
                        <button
                          type="button"
                          onClick={() => setOpenId(rule.id)}
                          className="underline hover:text-amber-300"
                        >
                          ouvrir
                        </button>
                      </p>
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
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl border max-w-sm w-[calc(100%-2rem)]
          ${toast.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200'
            : 'bg-red-900/90 border-red-700 text-red-200'}`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
