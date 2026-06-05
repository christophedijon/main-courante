import { computeConformite, RegistreItemMin } from '../../lib/registreStatut';

const COLOR_MAP = {
  vert:   '#22c55e',
  orange: '#f59e0b',
  rouge:  '#ef4444',
};

const RADIUS = 80;
const STROKE = 16;
const CX = 100;
const CY = 100;
// Semi-circle: start at left (180°) going clockwise to right (0°)
// For a 180° arc: circumference of half-circle
const CIRCUM = Math.PI * RADIUS; // half circumference

interface Props {
  items: RegistreItemMin[];
}

export default function ConformiteDashboard({ items }: Props) {
  const { pct, total, conformes, nbRetard, nbNonPlanifie, nbAttention, couleur } =
    computeConformite(items);

  const color = COLOR_MAP[couleur];
  const filled = (pct / 100) * CIRCUM;
  const gap = CIRCUM - filled;

  // SVG viewBox: 200 wide, 110 tall (semi-circle top-half, center at 100,100)
  // Arc starts at left point (20,100) and goes clockwise to right (180,100)
  const arcPath = `M ${CX - RADIUS},${CY} A ${RADIUS},${RADIUS} 0 0 1 ${CX + RADIUS},${CY}`;

  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Semi-circle gauge */}
      <div className="flex justify-center" style={{ marginBottom: -16 }}>
        <svg
          viewBox="0 0 200 108"
          width="220"
          height="118"
          style={{ overflow: 'visible' }}
        >
          {/* Track */}
          <path
            d={arcPath}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap + 0.1}`}
            style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
          />
          {/* Center text */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            fontSize="28"
            fontWeight="800"
            fill={color}
            fontFamily="inherit"
          >
            {pct}%
          </text>
          <text
            x={CX}
            y={CY + 14}
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill="rgba(148,163,184,0.75)"
            fontFamily="inherit"
            letterSpacing="0.08em"
          >
            CONFORMITÉ DU REGISTRE
          </text>
        </svg>
      </div>

      {/* Stats below gauge */}
      <div className="text-center space-y-1 pt-2">
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {conformes}/{total} vérifications à jour
        </p>
        {nbRetard > 0 && (
          <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>
            {nbRetard} en retard
          </p>
        )}
        {nbNonPlanifie > 0 && (
          <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>
            {nbNonPlanifie} jamais vérifiée{nbNonPlanifie > 1 ? 's' : ''}
          </p>
        )}
        {nbAttention > 0 && nbRetard === 0 && nbNonPlanifie === 0 && (
          <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>
            {nbAttention} échéance{nbAttention > 1 ? 's' : ''} proche{nbAttention > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
