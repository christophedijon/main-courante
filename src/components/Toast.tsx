import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

type Props = {
  message: string;
  type: ToastType;
  onClose: () => void;
};

export default function Toast({ message, type, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
        border backdrop-blur-sm animate-slide-up
        ${type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}
    >
      {type === 'success'
        ? <CheckCircle className="w-4 h-4 shrink-0" />
        : <XCircle className="w-4 h-4 shrink-0" />
      }
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
