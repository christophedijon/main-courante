import { Check, ChevronRight } from 'lucide-react';

type Props = {
  label: string;
  description?: string;
  selected?: boolean;
  multi?: boolean;
  onClick: () => void;
  accent?: 'blue' | 'red' | 'amber' | 'sky';
};

const accents = {
  blue:  { active: 'border-blue-500/70 bg-blue-500/10',  dot: 'bg-blue-500' },
  red:   { active: 'border-red-500/70 bg-red-500/10',    dot: 'bg-red-500' },
  amber: { active: 'border-amber-500/70 bg-amber-500/10',dot: 'bg-amber-500' },
  sky:   { active: 'border-sky-500/70 bg-sky-500/10',    dot: 'bg-sky-500' },
} as const;

export default function SelectableTile({
  label, description, selected, multi, onClick, accent = 'blue',
}: Props) {
  const a = accents[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-4 rounded-2xl border
        transition-all active:scale-[0.99] min-h-[64px]
        ${selected
          ? a.active
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
        }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-[15px] leading-tight truncate">{label}</p>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{description}</p>
        )}
      </div>
      {multi ? (
        <span
          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border-2
            ${selected ? `${a.dot} border-transparent` : 'border-slate-700'}`}
        >
          {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </span>
      ) : (
        <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
      )}
    </button>
  );
}
