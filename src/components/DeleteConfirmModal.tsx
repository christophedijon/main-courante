import { Trash2 } from 'lucide-react';

type Props = {
  userName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
};

export default function DeleteConfirmModal({ userName, onConfirm, onCancel, loading }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-red-500 to-orange-400" />

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Supprimer l'utilisateur</h2>
              <p className="text-xs text-slate-400 mt-0.5">Cette action est irréversible</p>
            </div>
          </div>

          <p className="text-sm text-slate-300 mb-6">
            Voulez-vous vraiment supprimer{' '}
            <span className="font-medium text-white">{userName}</span> ?
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl py-2.5 text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed
                text-white font-medium rounded-xl py-2.5 text-sm transition-colors"
            >
              {loading ? 'Suppression…' : 'Supprimer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
