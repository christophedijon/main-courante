import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  action?: ReactNode;
};

export default function SectionLabel({ children, action }: Props) {
  return (
    <div className="flex items-end justify-between mb-3 px-1">
      <span className="text-[11px] font-bold text-slate-400 tracking-[0.18em] uppercase">
        {children}
      </span>
      {action}
    </div>
  );
}
