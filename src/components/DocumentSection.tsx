import { useState, useRef } from 'react';
import {
  FileText, PlusCircle, Upload, Trash2, ExternalLink,
  Pencil, Check, X, CheckCircle, AlertCircle, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type DocRow = {
  id: string;
  nom: string;
  file_url: string;
  file_path: string;
  created_at: string;
};

type Props = {
  title: string;
  addLabel: string;
  tableName: string;
  storagePath: string;
  maxItems?: number;
  accentFrom?: string;
  accentTo?: string;
  iconColor?: string;
  pdfIconColor?: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function DocumentSection({
  title,
  addLabel,
  tableName,
  storagePath,
  maxItems = 10,
  accentFrom = 'from-amber-500',
  accentTo = 'to-orange-400',
  iconColor = 'text-amber-400',
  pdfIconColor = 'text-red-400',
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DocRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadItems() {
    if (loaded) return;
    setListLoading(true);
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoaded(true);
    setListLoading(false);
  }

  async function reloadItems() {
    setListLoading(true);
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });
    setItems(data ?? []);
    setListLoading(false);
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) loadItems();
  }

  function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setMsg({ type: 'error', text: 'Uniquement les fichiers PDF sont acceptés.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'Fichier trop volumineux (max 10 Mo).' });
      return;
    }
    setDocFile(file);
    setMsg(null);
  }

  async function handleUpload() {
    if (!docName.trim()) { setMsg({ type: 'error', text: 'Veuillez saisir un nom.' }); return; }
    if (!docFile) { setMsg({ type: 'error', text: 'Veuillez sélectionner un fichier PDF.' }); return; }
    if (items.length >= maxItems) { setMsg({ type: 'error', text: `Limite de ${maxItems} documents atteinte.` }); return; }

    setUploading(true);
    setMsg(null);

    const safeName = docFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `${storagePath}/${Date.now()}-${safeName}`;

    const { error: storageErr } = await supabase.storage
      .from('documents')
      .upload(filePath, docFile, { contentType: 'application/pdf' });

    if (storageErr) {
      setUploading(false);
      setMsg({ type: 'error', text: "Erreur lors de l'upload du fichier." });
      return;
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

    const { error: dbErr } = await supabase
      .from(tableName)
      .insert({ nom: docName.trim(), file_url: urlData.publicUrl, file_path: filePath });

    if (dbErr) {
      await supabase.storage.from('documents').remove([filePath]);
      setUploading(false);
      setMsg({ type: 'error', text: 'Erreur lors de la sauvegarde.' });
      return;
    }

    setUploading(false);
    setDocName('');
    setDocFile(null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
    await reloadItems();
    setMsg({ type: 'success', text: 'Document ajouté avec succès.' });
  }

  function startRename(item: DocRow) {
    setRenamingId(item.id);
    setRenameValue(item.nom);
  }

  async function confirmRename(id: string) {
    if (!renameValue.trim()) return;
    setRenameSaving(true);
    const { error } = await supabase
      .from(tableName)
      .update({ nom: renameValue.trim() })
      .eq('id', id);
    setRenameSaving(false);
    if (!error) {
      setItems((prev) => prev.map((p) => p.id === id ? { ...p, nom: renameValue.trim() } : p));
      setRenamingId(null);
    } else {
      setMsg({ type: 'error', text: 'Erreur lors du renommage.' });
    }
  }

  async function handleDelete(item: DocRow) {
    setDeleteLoading(true);
    await supabase.storage.from('documents').remove([item.file_path]);
    await supabase.from(tableName).delete().eq('id', item.id);
    setDeleteLoading(false);
    setDeletingId(null);
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    setMsg({ type: 'success', text: 'Document supprimé.' });
  }

  const canAdd = items.length < maxItems;

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className={`h-1 bg-gradient-to-r ${accentFrom} ${accentTo}`} />

        {/* Collapsed header — always visible */}
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className={`w-5 h-5 shrink-0 ${iconColor}`} />
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">{title}</p>
              {loaded && !open && (
                <p className="text-slate-500 text-xs mt-0.5">
                  {items.length} / {maxItems} document{items.length !== 1 ? 's' : ''}
                </p>
              )}
              {!loaded && !open && (
                <p className="text-slate-600 text-xs mt-0.5">Cliquez sur Modifier pour charger</p>
              )}
            </div>
          </div>

          <button
            onClick={handleToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
              text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700
              hover:border-slate-600 transition-all shrink-0"
          >
            {open ? 'Réduire' : 'Modifier'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Expanded content */}
        {open && (
          <div className="border-t border-slate-800 px-5 pb-5 pt-4 space-y-4">
            {/* Counter + add button */}
            <div className="flex items-center justify-between gap-4">
              <p className="text-slate-400 text-sm">
                {items.length} / {maxItems} document{items.length !== 1 ? 's' : ''} enregistré{items.length !== 1 ? 's' : ''}
              </p>
              {!showForm && (
                <button
                  onClick={() => { setShowForm(true); setMsg(null); }}
                  disabled={!canAdd}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700
                    disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium px-3 py-2
                    rounded-xl text-xs transition-colors shadow-lg shadow-amber-900/20 shrink-0"
                  title={!canAdd ? `Limite de ${maxItems} documents atteinte` : undefined}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  {addLabel}
                </button>
              )}
            </div>

            {/* Message */}
            {msg && (
              <div className={`flex items-start gap-3 rounded-xl p-3.5 text-xs border
                ${msg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
              >
                {msg.type === 'success'
                  ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                <span>{msg.text}</span>
              </div>
            )}

            {/* Upload form */}
            {showForm && (
              <div className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nouveau document</h3>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Nom du document</label>
                    <input
                      type="text"
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      placeholder="Ex : Procédure incendie 2026"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white
                        placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500
                        focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Fichier PDF</label>
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-3 border border-dashed border-slate-700 hover:border-slate-500
                        hover:bg-slate-900/60 rounded-lg p-4 cursor-pointer transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-300 font-medium">
                          {docFile ? docFile.name : 'Cliquez pour sélectionner un PDF'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">PDF uniquement, max 10 Mo</p>
                      </div>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={uploading}
                      className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800
                        disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors"
                    >
                      {uploading ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Envoi…
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          Ajouter
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setDocName(''); setDocFile(null); setMsg(null); }}
                      disabled={uploading}
                      className="px-3 py-2 text-slate-400 hover:text-white text-xs rounded-lg hover:bg-slate-800 transition-all"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List */}
            {listLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Chargement…
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Aucun document enregistré</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-3
                      hover:border-slate-700 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                      <FileText className={`w-4 h-4 ${pdfIconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {renamingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmRename(item.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-white text-xs
                              focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                          <button
                            onClick={() => confirmRename(item.id)}
                            disabled={renameSaving}
                            className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors disabled:opacity-60"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-white text-xs font-medium truncate">{item.nom}</p>
                          <p className="text-slate-500 text-xs mt-0.5">Ajouté le {formatDate(item.created_at)}</p>
                        </>
                      )}
                    </div>

                    {renamingId !== item.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800
                            flex items-center justify-center transition-all"
                          title="Ouvrir le PDF"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => startRename(item)}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800
                            flex items-center justify-center transition-all"
                          title="Renommer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(item.id)}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10
                            flex items-center justify-center transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deletingId && (() => {
        const item = items.find((p) => p.id === deletingId);
        if (!item) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-white font-semibold text-center mb-1">Supprimer ce document ?</h3>
              <p className="text-slate-400 text-sm text-center mb-6">
                "<span className="text-white font-medium">{item.nom}</span>" sera définitivement supprimé.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
