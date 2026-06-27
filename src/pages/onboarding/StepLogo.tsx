import { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, X, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  etabId: string;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
}

const MAX_SIZE_MB = 2;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

export default function StepLogo({ etabId, onNext, onBack, saving }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setError(null);
    if (!ACCEPTED.includes(f.type)) {
      setError('Format non supporté. Utilisez PNG, JPG, SVG ou WebP.');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop lourd (max ${MAX_SIZE_MB} Mo).`);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function removeFile() {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function uploadAndContinue() {
    if (!file) return;
    setUploading(true);
    setError(null);

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `etablissement_${etabId}/logo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true });

    if (upErr) {
      setUploading(false);
      setError("Erreur lors de l'upload. Réessayez.");
      return;
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);

    const { error: dbErr } = await supabase
      .from('etablissements')
      .update({ logo_url: urlData.publicUrl })
      .eq('id', etabId);

    setUploading(false);

    if (dbErr) {
      setError("Logo uploadé mais erreur lors de la sauvegarde.");
      return;
    }

    onNext();
  }

  const busy = saving || uploading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Logo de l'établissement</h2>
          <p className="text-sm text-slate-400">Personnalisez l'interface — optionnel, modifiable à tout moment</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!file ? (
        /* Drop zone */
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-12 cursor-pointer transition-all ${
            dragOver
              ? 'border-blue-500 bg-blue-500/5'
              : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center">
            <Upload className="w-6 h-6 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">
              Glissez votre logo ici ou <span className="text-blue-400 underline">parcourez</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG, SVG, WebP — 2 Mo max</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        /* Preview */
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 rounded-xl bg-white/5 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={preview!}
                alt="Aperçu du logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{file.name}</p>
              <p className="text-xs text-slate-400 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} Mo
              </p>
              <button
                onClick={removeFile}
                className="mt-3 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="flex gap-2">
          <button
            onClick={onNext}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 rounded-xl text-sm transition-all"
          >
            Ajouter plus tard
          </button>

          {file && (
            <button
              onClick={uploadAndContinue}
              disabled={busy}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Upload…</>
              ) : (
                <><ChevronRight className="w-4 h-4" />Enregistrer le logo</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
