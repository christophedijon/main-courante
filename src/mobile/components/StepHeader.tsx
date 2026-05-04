import { ArrowLeft, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  backTo?: string;
  cancelTo?: string;
};

export default function StepHeader({ step, total, title, subtitle, backTo, cancelTo = '/mobile' }: Props) {
  const nav = useNavigate();
  const pct = Math.round((step / total) * 100);

  return (
    <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <div className="h-1 bg-slate-800">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => (backTo ? nav(backTo) : nav(-1))}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center
            hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="text-center flex-1 min-w-0 px-3">
          <p className="text-[10.5px] font-bold text-blue-400 tracking-[0.18em]">
            ÉTAPE {step} / {total}
          </p>
          <p className="text-white font-semibold text-[15px] leading-tight truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
        </div>
        <Link
          to={cancelTo}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center
            hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </Link>
      </div>
    </div>
  );
}
