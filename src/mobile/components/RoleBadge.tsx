type Props = { fonction: string | null; isSuperAdmin?: boolean };

export default function RoleBadge({ fonction, isSuperAdmin }: Props) {
  const label = isSuperAdmin && !fonction
    ? 'ADMIN'
    : (fonction ?? 'UTILISATEUR').toUpperCase();

  const isDirection = label === 'DIRECTION' || label === 'ADMIN';
  const isSecurite = label.includes('SÉCURITÉ') || label.includes('SECURITE');
  const isServeur = label === 'SERVEUR';

  const cls = isDirection
    ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
    : isSecurite
      ? 'text-blue-300 border-blue-500/40 bg-blue-500/10'
      : isServeur
        ? 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10'
        : 'text-slate-300 border-slate-600/50 bg-slate-700/30';

  return (
    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-[11px] font-extrabold tracking-wider ${cls}`}>
      {label}
    </span>
  );
}
