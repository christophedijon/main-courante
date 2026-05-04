import { ChevronRight, type LucideIcon } from 'lucide-react';

type Variant = 'ssi' | 'personnes';

type Props = {
  variant: Variant;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  onClick: () => void;
};

const styles: Record<Variant, {
  container: string;
  iconWrap: string;
  iconColor: string;
  subtitle: string;
  chevron: string;
}> = {
  ssi: {
    container: 'bg-red-950/40 border-red-700/60 hover:border-red-600 hover:bg-red-950/60',
    iconWrap: 'bg-red-600',
    iconColor: 'text-amber-300',
    subtitle: 'text-red-300/90',
    chevron: 'text-red-400/80',
  },
  personnes: {
    container: 'bg-sky-950/40 border-sky-700/60 hover:border-sky-600 hover:bg-sky-950/60',
    iconWrap: 'bg-sky-500/30 border border-sky-500/40',
    iconColor: 'text-sky-300',
    subtitle: 'text-sky-300/90',
    chevron: 'text-sky-400/80',
  },
};

export default function QuickActionCard({ variant, title, subtitle, Icon, onClick }: Props) {
  const s = styles[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all
        active:scale-[0.985] ${s.container}`}
    >
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${s.iconWrap}`}>
        <Icon className={`w-7 h-7 ${s.iconColor}`} strokeWidth={2.4} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-white font-bold text-lg leading-tight">{title}</p>
        <p className={`text-sm mt-0.5 ${s.subtitle}`}>{subtitle}</p>
      </div>
      <ChevronRight className={`w-6 h-6 shrink-0 ${s.chevron}`} />
    </button>
  );
}
