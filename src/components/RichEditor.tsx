import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Dropcursor from '@tiptap/extension-dropcursor';
import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered, Minus, Image as ImageIcon, Paperclip, Link2, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

async function uploadFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('documents-media')
    .upload(path, file, { contentType: file.type });
  if (error) return null;
  const { data } = supabase.storage.from('documents-media').getPublicUrl(path);
  return data.publicUrl;
}

// Mini-modal for PDF URL insertion
function PdfUrlModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (url: string, name: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-white font-semibold text-sm">Insérer un PDF (URL externe)</p>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">URL du PDF</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/fichier.pdf"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Nom du lien</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Procédure évacuation.pdf"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(url.trim(), name.trim())}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all"
          >
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RichEditor({ value, onChange, placeholder = 'Rédigez le contenu du document ici…' }: RichEditorProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pdfUrlModal, setPdfUrlModal] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ dropcursor: false }),
      Underline,
      Image.configure({ allowBase64: false, inline: false }),
      Dropcursor.configure({ color: '#3b82f6', width: 2 }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: { class: 'prose-editor focus:outline-none min-h-[200px]' },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  async function handleImageFile(files: FileList | null) {
    if (!files?.[0] || !editor) return;
    const file = files[0];
    if (file.size > MAX_SIZE) { setUploadError('Fichier trop lourd (5 MB max)'); return; }
    setUploading(true);
    setUploadError(null);
    const url = await uploadFile(file);
    setUploading(false);
    if (url) {
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } else {
      setUploadError("Échec de l'upload de l'image. Vérifiez votre connexion et réessayez.");
    }
    // Reset input so the same file can be re-selected
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  async function handlePdfFile(files: FileList | null) {
    if (!files?.[0] || !editor) return;
    const file = files[0];
    if (file.size > MAX_SIZE) { setUploadError('Fichier trop lourd (5 MB max)'); return; }
    setUploading(true);
    setUploadError(null);
    const url = await uploadFile(file);
    setUploading(false);
    if (url) {
      editor.chain().focus().insertContent(`<p><a href="${url}">📎 ${file.name}</a></p>`).run();
    } else {
      setUploadError("Échec de l'upload du PDF. Vérifiez votre connexion et réessayez.");
    }
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  }

  function handlePdfUrl(url: string, name: string) {
    setPdfUrlModal(false);
    if (!url || !editor) return;
    const label = name || url;
    editor.chain().focus().insertContent(`<p><a href="${url}">📎 ${label}</a></p>`).run();
  }

  // Drag & drop — handles both images and PDFs
  async function handleDropFiles(files: FileList) {
    const file = files[0];
    if (!file) return;
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      await handleImageFile(files);
    } else if (file.type === 'application/pdf') {
      await handlePdfFile(files);
    }
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragOver(true); }
  function onDragLeave(e: React.DragEvent) {
    if (!editorRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    await handleDropFiles(e.dataTransfer.files);
  }

  if (!editor) return null;

  const btnBase = 'p-1.5 rounded-lg transition-all text-slate-400 hover:text-white hover:bg-slate-700';
  const btnActive = 'bg-slate-700 text-white';

  return (
    <>
      <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
        {/* Toolbar */}
        <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b border-slate-700">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`${btnBase} ${editor.isActive('bold') ? btnActive : ''}`} title="Gras">
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${btnBase} ${editor.isActive('italic') ? btnActive : ''}`} title="Italique">
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`${btnBase} ${editor.isActive('underline') ? btnActive : ''}`} title="Souligné">
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-600 mx-1" />

          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`${btnBase} ${editor.isActive('heading', { level: 1 }) ? btnActive : ''}`} title="Titre 1">
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${btnBase} ${editor.isActive('heading', { level: 2 }) ? btnActive : ''}`} title="Titre 2">
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`${btnBase} ${editor.isActive('heading', { level: 3 }) ? btnActive : ''}`} title="Titre 3">
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-600 mx-1" />

          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${btnBase} ${editor.isActive('bulletList') ? btnActive : ''}`} title="Liste à puces">
            <List className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${btnBase} ${editor.isActive('orderedList') ? btnActive : ''}`} title="Liste numérotée">
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-600 mx-1" />

          <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnBase} title="Séparateur">
            <Minus className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-600 mx-1" />

          {/* Image upload */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className={`${btnBase} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Insérer une image (upload)"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <ImageIcon className="w-3.5 h-3.5" />}
          </button>

          {/* PDF upload */}
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={uploading}
            className={`${btnBase} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Insérer un PDF (upload)"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>

          {/* PDF via URL */}
          <button
            type="button"
            onClick={() => setPdfUrlModal(true)}
            className={btnBase}
            title="Insérer un PDF (URL externe)"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => handleImageFile(e.target.files)}
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handlePdfFile(e.target.files)}
        />

        {/* Editor area with drag zone */}
        <div
          ref={editorRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className="relative"
        >
          {isDragOver && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-b-xl pointer-events-none">
              <Paperclip className="w-8 h-8 text-blue-400" />
              <p className="text-blue-300 font-semibold text-sm">Déposez votre fichier ici</p>
              <p className="text-blue-400/60 text-xs">Image (JPG, PNG, GIF, WebP) ou PDF · 5 MB max</p>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60 rounded-b-xl">
              <div className="flex items-center gap-2 text-blue-300 text-sm font-medium">
                <Loader2 className="w-5 h-5 animate-spin" />
                Upload en cours…
              </div>
            </div>
          )}
          <EditorContent editor={editor} className="rich-editor-content" />
        </div>

        {uploadError && (
          <p className="text-red-400 text-xs px-3 py-2 border-t border-red-500/20 bg-red-500/5">
            {uploadError}
          </p>
        )}
      </div>

      {pdfUrlModal && (
        <PdfUrlModal onConfirm={handlePdfUrl} onClose={() => setPdfUrlModal(false)} />
      )}
    </>
  );
}
