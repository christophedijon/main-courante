import { AlertTriangle, type LucideIcon } from 'lucide-react';

type Props = { icon?: LucideIcon; text: string; hint?: string };

export default function EmptyState({ icon: Icon = AlertTriangle, text, hint }: Props) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 py-10 px-6 flex flex-col items-center text-center">
      <Icon className="w-9 h-9 text-slate-600 mb-3" />
      <p className="text-slate-400 text-sm">{text}</p>
      {hint && <p className="text-slate-600 text-xs mt-1">{hint}</p>}
    </div>
  );
}
