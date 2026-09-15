import { useEffect, useState, useCallback } from 'react';
import { Clapperboard, X } from 'lucide-react';

type Props = {
  videoId: string;
  label?: string;
  className?: string;
};

export default function VideoHelpButton({ videoId, label = 'Voir la vidéo d\'aide', className = '' }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 hover:border-slate-600 transition-all active:scale-95 ${className}`}
      >
        <Clapperboard className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-medium">{label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="relative w-full max-w-3xl mx-4">
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="absolute -top-11 right-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            >
              <X className="w-4 h-4" />
              <span className="text-xs font-medium">Fermer</span>
            </button>
            <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-900">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`https://www.loom.com/embed/${videoId}`}
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture"
                  className="absolute inset-0 w-full h-full"
                  title={label}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
