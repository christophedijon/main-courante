import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Dropcursor from '@tiptap/extension-dropcursor';
import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered, Minus, Upload, Loader2, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_PDF = ['application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('documents-media').upload(path, file, { contentType: file.type });
  if (error) return null;
  const { data } = supabase.storage.from('documents-media').getPublicUrl(path);
  return data.publicUrl;
}

export default function RichEditor({ value, onChange, placeholder = 'Rédigez le contenu du document ici…' }: RichEditorProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        dropcursor: false,
      }),
      Underline,
      Image.configure({ allowBase64: false, inline: false }),
      Dropcursor.configure({ color: '#3b82f6', width: 2 }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose-editor focus:outline-none min-h-[200px]',
      },
    },
  });

  // Sync external value changes (e.g. when editing an existing doc)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !editor) return;
    const file = files[0];
    if (!file) return;
    if (file.size > MAX_SIZE) return;

    if (ALLOWED_IMAGE.includes(file.type)) {
      setUploading(true);
      const url = await uploadFile(file);
      setUploading(false);
      if (url) editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } else if (ALLOWED_PDF.includes(file.type)) {
      setUploading(true);
      const url = await uploadFile(file);
      setUploading(false);
      if (url) {
        editor.chain().focus().insertContent(
          `<p><a href="${url}">📎 ${file.name}</a></p>`
        ).run();
      }
    }
  }, [editor]);

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }
  function onDragLeave(e: React.DragEvent) {
    if (!editorRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    await handleFiles(e.dataTransfer.files);
  }

  if (!editor) return null;

  const btnBase = 'p-1.5 rounded-lg transition-all text-slate-400 hover:text-white hover:bg-slate-700';
  const btnActive = 'bg-slate-700 text-white';

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b border-slate-700 bg-slate-850">
        {/* Text style */}
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

        {/* Headings */}
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

        {/* Lists */}
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${btnBase} ${editor.isActive('bulletList') ? btnActive : ''}`} title="Liste à puces">
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${btnBase} ${editor.isActive('orderedList') ? btnActive : ''}`} title="Liste numérotée">
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-slate-600 mx-1" />

        {/* Separator */}
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnBase} title="Séparateur">
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-slate-600 mx-1" />

        {/* File upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`${btnBase} flex items-center gap-1.5 px-2 text-xs font-medium`}
          title="Importer image ou PDF"
        >
          {uploading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            : <><Upload className="w-3.5 h-3.5" /><span className="hidden sm:inline text-[11px]">Fichier</span></>
          }
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Editor area with drag zone */}
      <div
        ref={editorRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="relative"
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-b-xl pointer-events-none">
            <Paperclip className="w-8 h-8 text-blue-400" />
            <p className="text-blue-300 font-semibold text-sm">Déposez votre fichier ici</p>
            <p className="text-blue-400/60 text-xs">Image (JPG, PNG, GIF, WebP) ou PDF · 5 MB max</p>
          </div>
        )}

        {/* Upload spinner overlay */}
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
    </div>
  );
}
