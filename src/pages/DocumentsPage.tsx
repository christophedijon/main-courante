import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Flame, FileText, Radio, Plus, Pencil, Trash2, Eye, EyeOff,
  Save, X, AlertCircle, CheckCircle, ChevronDown, ChevronUp, GripVertical,
  ArrowUp, ArrowDown, Users, PenLine,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import RichEditor from '../components/RichEditor';

type Categorie = 'RONDE' | 'SSI' | 'PROCEDURE' | 'RADIO';

type Doc = {
  id: string;
  titre: string;
  description: string;
  contenu: string;
  categorie: Categorie;
  ordre: number;
  actif: boolean;
  destinataires: string[];
  signature_requise: boolean;
  content_version: number;
  created_at: string;
  updated_at: string;
};

type DocDraft = {
  titre: string;
  description: string;
  contenu: string;
  categorie: Categorie;
  ordre: number;
  actif: boolean;
  destinataires: string[];
  signature_requise: boolean;
};

type Msg = { type: 'success' | 'error'; text: string };

const ROLES = ['Direction', 'Chef de poste', 'Agent de Sécurité', 'Serveur'];

const CATEGORIES: { id: Categorie; label: string; icon: React.ComponentType<{ className?: string }>; accent: string; activeClass: string }[] = [
  { id: 'RONDE',     label: 'Ronde',         icon: Shield,   accent: 'text-blue-400',  activeClass: 'border-blue-500 bg-blue-500/10 text-blue-300' },
  { id: 'SSI',       label: 'Consignes SSI', icon: Flame,    accent: 'text-red-400',   activeClass: 'border-red-500 bg-red-500/10 text-red-300' },
  { id: 'PROCEDURE', label: 'Procédure',     icon: FileText, accent: 'text-slate-300', activeClass: 'border-slate-400 bg-slate-700/50 text-slate-200' },
  { id: 'RADIO',     label: 'Radio',         icon: Radio,    accent: 'text-teal-400',  activeClass: 'border-teal-500 bg-teal-500/10 text-teal-300' },
];

const EMPTY_DRAFT: DocDraft = {
  titre: '',
  description: '',
  contenu: '',
  categorie: 'RONDE',
  ordre: 0,
  actif: true,
  destinataires: [],
  signature_requise: false,
};

const inputCls = `w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`;

export default function DocumentsPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Categorie>('RONDE');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Msg | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Doc | null>(null);
  const [draft, setDraft] = useState<DocDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [modalMsg, setModalMsg] = useState<Msg | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('toolbox_documents')
      .select('*')
      .order('categorie')
      .order('ordre')
      .order('created_at');
    if (!error && data) setDocs(data as Doc[]);
    setLoading(false);
  }

  function openCreate() {
    setEditTarget(null);
    setDraft({ ...EMPTY_DRAFT, categorie: activeTab, ordre: nextOrdre(activeTab) });
    setModalMsg(null);
    setModalOpen(true);
  }

  function openEdit(doc: Doc) {
    setEditTarget(doc);
    setDraft({
      titre: doc.titre,
      description: doc.description,
      contenu: doc.contenu,
      categorie: doc.categorie,
      ordre: doc.ordre,
      actif: doc.actif,
      destinataires: doc.destinataires ?? [],
      signature_requise: doc.signature_requise ?? false,
    });
    setModalMsg(null);
    setModalOpen(true);
  }

  function nextOrdre(cat: Categorie): number {
    const catDocs = docs.filter((d) => d.categorie === cat);
    return catDocs.length > 0 ? Math.max(...catDocs.map((d) => d.ordre)) + 1 : 0;
  }

  function toggleDestinataire(role: string) {
    setDraft((d) => ({
      ...d,
      destinataires: d.destinataires.includes(role)
        ? d.destinataires.filter((r) => r !== role)
        : [...d.destinataires, role],
    }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!draft.titre.trim()) {
      setModalMsg({ type: 'error', text: 'Le titre est obligatoire.' });
      return;
    }
    setSaving(true);
    setModalMsg(null);

    const contentChanged = editTarget && draft.contenu !== editTarget.contenu;
    const newVersion = contentChanged
      ? (editTarget!.content_version ?? 1) + 1
      : (editTarget?.content_version ?? 1);

    const payload = {
      titre: draft.titre.trim(),
      description: draft.description.trim(),
      contenu: draft.contenu,
      categorie: draft.categorie,
      ordre: draft.ordre,
      actif: draft.actif,
      destinataires: draft.destinataires,
      signature_requise: draft.signature_requise,
      content_version: newVersion,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editTarget) {
      // Invalider les signatures si le contenu a changé
      if (contentChanged) {
        await supabase.from('signatures').delete().eq('document_id', editTarget.id);
      }
      ({ error } = await supabase.from('toolbox_documents').update(payload).eq('id', editTarget.id));
    } else {
      ({ error } = await supabase.from('toolbox_documents').insert({ ...payload, content_version: 1 }));
    }

    setSaving(false);
    if (error) { setModalMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' }); return; }
    await load();
    setActiveTab(draft.categorie);
    setModalOpen(false);
    setMsg({ type: 'success', text: editTarget ? 'Document modifié.' : 'Document créé.' });
    setTimeout(() => setMsg(null), 3000);
  }

  async function toggleActif(doc: Doc) {
    await supabase.from('toolbox_documents').update({ actif: !doc.actif, updated_at: new Date().toISOString() }).eq('id', doc.id);
    setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, actif: !d.actif } : d));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    await supabase.from('toolbox_documents').delete().eq('id', deleteTarget.id);
    setDocs((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    setDeleteLoading(false);
    setDeleteTarget(null);
    setMsg({ type: 'success', text: 'Document supprimé.' });
    setTimeout(() => setMsg(null), 3000);
  }

  async function moveOrdre(doc: Doc, dir: 'up' | 'down') {
    const catDocs = docs.filter((d) => d.categorie === doc.categorie).sort((a, b) => a.ordre - b.ordre);
    const idx = catDocs.findIndex((d) => d.id === doc.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= catDocs.length) return;
    const other = catDocs[swapIdx];
    await Promise.all([
      supabase.from('toolbox_documents').update({ ordre: other.ordre, updated_at: new Date().toISOString() }).eq('id', doc.id),
      supabase.from('toolbox_documents').update({ ordre: doc.ordre, updated_at: new Date().toISOString() }).eq('id', other.id),
    ]);
    setDocs((prev) => prev.map((d) => {
      if (d.id === doc.id) return { ...d, ordre: other.ordre };
      if (d.id === other.id) return { ...d, ordre: doc.ordre };
      return d;
    }));
  }

  async function handleSignOut() { await signOut(); navigate('/'); }

  const tabDocs = docs.filter((d) => d.categorie === activeTab).sort((a, b) => a.ordre - b.ordre);
  const activeTabMeta = CATEGORIES.find((c) => c.id === activeTab)!;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <AppHeader onSignOut={handleSignOut} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-white">Documents</h2>
            <p className="text-slate-400 text-sm mt-1">Contenus publiés dans la Boîte à outils mobile</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30"
          >
            <Plus className="w-4 h-4" />
            Nouveau document
          </button>
        </div>

        {msg && (
          <div className={`flex items-center gap-2 rounded-xl p-3 mb-6 text-sm border
            ${msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            {msg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = docs.filter((d) => d.categorie === cat.id).length;
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all
                  ${active ? cat.activeClass : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <Icon className={`w-4 h-4 ${active ? '' : cat.accent}`} />
                {cat.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/15' : 'bg-slate-700 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Documents list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <activeTabMeta.icon className={`w-4 h-4 ${activeTabMeta.accent}`} />
              <span className="text-sm font-semibold text-white">{activeTabMeta.label}</span>
              <span className="text-xs text-slate-500 ml-1">— {tabDocs.length} document{tabDocs.length !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Chargement…
            </div>
          ) : tabDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <activeTabMeta.icon className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">Aucun document pour cette catégorie.</p>
              <button onClick={openCreate} className="mt-3 text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors">
                Créer le premier document
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {tabDocs.map((doc, idx) => {
                const isExpanded = expandedId === doc.id;
                return (
                  <div key={doc.id} className={`${!doc.actif ? 'opacity-50' : ''}`}>
                    <div className="px-5 py-4 flex items-start gap-4 group">
                      <div className="flex flex-col gap-0.5 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" disabled={idx === 0} onClick={() => moveOrdre(doc, 'up')}
                          className="w-6 h-6 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 flex items-center justify-center disabled:opacity-20 disabled:cursor-default transition-all">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button type="button" disabled={idx === tabDocs.length - 1} onClick={() => moveOrdre(doc, 'down')}
                          className="w-6 h-6 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 flex items-center justify-center disabled:opacity-20 disabled:cursor-default transition-all">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="mt-1.5 shrink-0 opacity-0 group-hover:opacity-30 transition-opacity">
                        <GripVertical className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">{doc.titre}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border
                            ${doc.actif ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                            {doc.actif ? 'Actif' : 'Inactif'}
                          </span>
                          {doc.signature_requise && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-500/10 text-amber-400 border-amber-500/20">
                              <PenLine className="w-2.5 h-2.5" />
                              Signature
                            </span>
                          )}
                          {doc.destinataires?.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                              <Users className="w-2.5 h-2.5" />
                              {doc.destinataires.length} rôle{doc.destinataires.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-slate-400 text-xs mt-0.5 truncate">{doc.description}</p>
                        )}
                        {doc.contenu && (
                          <button type="button" onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                            className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExpanded ? 'Masquer le contenu' : 'Voir le contenu'}
                          </button>
                        )}
                        {isExpanded && (
                          <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                            {doc.contenu}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button type="button" onClick={() => toggleActif(doc)} title={doc.actif ? 'Désactiver' : 'Activer'}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                          {doc.actif ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => openEdit(doc)} title="Modifier"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(doc)} title="Supprimer"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Create / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-white font-semibold text-base">
                {editTarget ? 'Modifier le document' : 'Nouveau document'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {modalMsg && (
                <div className={`flex items-center gap-2 rounded-xl p-3 text-sm border
                  ${modalMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {modalMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {modalMsg.text}
                </div>
              )}

              {/* Titre */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Titre <span className="text-red-400">*</span></label>
                <input type="text" required value={draft.titre}
                  onChange={(e) => setDraft((d) => ({ ...d, titre: e.target.value }))}
                  placeholder="Ex : Procédure d'évacuation incendie"
                  className={inputCls} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description courte <span className="text-slate-500 font-normal">(optionnel)</span>
                </label>
                <input type="text" value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Ex : Étapes à suivre en cas d'alarme incendie"
                  className={inputCls} />
              </div>

              {/* Contenu */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Contenu <span className="text-red-400">*</span>
                  <span className="ml-2 text-[11px] font-normal text-slate-500">Glissez une image ou un PDF directement dans l'éditeur</span>
                </label>
                <RichEditor
                  value={draft.contenu}
                  onChange={(html) => setDraft((d) => ({ ...d, contenu: html }))}
                  placeholder="Rédigez le contenu du document ici…"
                />
              </div>

              {/* Destinataires */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-0.5">Destinataires</label>
                <p className="text-xs text-slate-500 mb-2">Profils pouvant voir ce document. Laisser vide = visible par tous.</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((role) => {
                    const checked = draft.destinataires.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleDestinataire(role)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-all
                          ${checked
                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                          }`}
                      >
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all
                          ${checked ? 'bg-blue-500 border-blue-400' : 'border-slate-600'}`}>
                          {checked && (
                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Catégorie + Ordre */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Catégorie</label>
                  <select value={draft.categorie}
                    onChange={(e) => setDraft((d) => ({ ...d, categorie: e.target.value as Categorie }))}
                    className={`${inputCls} appearance-none`}>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Ordre d'affichage</label>
                  <input type="number" min={0} value={draft.ordre}
                    onChange={(e) => setDraft((d) => ({ ...d, ordre: parseInt(e.target.value) || 0 }))}
                    className={inputCls} />
                </div>
              </div>

              {/* Signature requise */}
              <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div>
                  <p className="text-white text-sm font-medium flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-amber-400" />
                    Signature requise
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    L'agent doit saisir son mot de passe pour confirmer la lecture
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, signature_requise: !d.signature_requise }))}
                  className={`relative w-12 h-6 rounded-full transition-all ${draft.signature_requise ? 'bg-amber-500' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${draft.signature_requise ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Statut */}
              <div className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
                <div>
                  <p className="text-white text-sm font-medium">Statut</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {draft.actif ? 'Visible sur le mobile' : 'Masqué sur le mobile'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, actif: !d.actif }))}
                  className={`relative w-12 h-6 rounded-full transition-all ${draft.actif ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${draft.actif ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
            </form>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button type="button" onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all">
                Annuler
              </button>
              <button type="button" disabled={saving}
                onClick={(e) => { e.preventDefault(); handleSave(e as unknown as FormEvent); }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/30">
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-white font-semibold text-center text-base mb-1">Supprimer le document</h3>
            <p className="text-slate-400 text-sm text-center mb-6">
              "<span className="text-white">{deleteTarget.titre}</span>" sera définitivement supprimé.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors">
                Annuler
              </button>
              <button onClick={confirmDelete} disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed transition-colors">
                {deleteLoading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
