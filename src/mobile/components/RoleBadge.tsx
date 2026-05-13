type Props = { fonction: string | null; isSuperAdmin?: boolean };

export default function RoleBadge({ fonction, isSuperAdmin }: Props) {
  const label = isSuperAdmin && !fonction
    ? 'ADMIN'
    : (fonction ?? 'UTILISATEUR').toUpperCase();

  const isDirection = label === 'DIRECTION' || label === 'ADMIN';
  const isChefDePoste = label === 'CHEF DE POSTE' || label.includes('CHEF');
  const isSecurite = label.includes('SÉCURITÉ') || label.includes('SECURITE');
  const isServeur = label === 'SERVEUR';

  const style = isDirection
    ? { color: '#f59e0b', border: '1.5px solid rgba(245,158,11,0.7)', background: 'rgba(0,0,0,0.5)', boxShadow: '0 0 10px rgba(245,158,11,0.2)' }
    : isChefDePoste
      ? { color: '#a78bfa', border: '1.5px solid rgba(167,139,250,0.5)', background: 'rgba(0,0,0,0.4)' }
      : isSecurite
        ? { color: '#93c5fd', border: '1.5px solid rgba(147,197,253,0.4)', background: 'rgba(0,0,0,0.4)' }
        : isServeur
          ? { color: '#67e8f9', border: '1.5px solid rgba(103,232,249,0.4)', background: 'rgba(0,0,0,0.4)' }
          : { color: '#cbd5e1', border: '1.5px solid rgba(148,163,184,0.3)', background: 'rgba(0,0,0,0.4)' };

  return (
    <span
      style={{ ...style, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', display: 'inline-flex', alignItems: 'center' }}
    >
      {label}
    </span>
  );
}
