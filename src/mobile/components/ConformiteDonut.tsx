import { computeConformite, type RegistreItemMin } from '../../lib/registreStatut';

interface Props {
  items: RegistreItemMin[];
  size?: number;
}

const BASE = 160;
const BASE_CX = BASE / 2;
const BASE_CY = BASE / 2;
const BASE_RADIUS = 62;
const BASE_STROKE = 18;
const GAP_DEG = 2;

export default function ConformiteDonut({ items, size = 160 }: Props) {
  const scale = size / BASE;
  const SIZE = size;
  const CX = BASE_CX * scale;
  const CY = BASE_CY * scale;
  const RADIUS = BASE_RADIUS * scale;
  const STROKE = BASE_STROKE * scale;
  const CIRCUM = 2 * Math.PI * RADIUS;

  const { pct, total, nbRetard, nbNonPlanifie, nbAttention, nbAJour, couleur } =
    computeConformite(items);

  const segments = [
    { value: nbRetard,                    color: '#ef4444', glow: '#ef444488' },
    { value: nbNonPlanifie + nbAttention, color: '#f59e0b', glow: '#f59e0b88' },
    { value: nbAJour,                     color: '#22c55e', glow: '#22c55e88' },
  ].filter((s) => s.value > 0);

  const pctColor =
    couleur === 'rouge' ? '#ef4444' : couleur === 'orange' ? '#f59e0b' : '#22c55e';

  let currentDeg = 0;
  const arcs: Array<{ startDeg: number; endDeg: number; color: string; glow: string }> = [];

  if (total === 0) {
    arcs.push({ startDeg: 0, endDeg: 359.99, color: 'rgba(255,255,255,0.08)', glow: 'none' });
  } else {
    const totalGap = segments.length * GAP_DEG;
    const usableDeg = 360 - totalGap;
    segments.forEach((seg, i) => {
      const span = (seg.value / total) * usableDeg;
      const start = currentDeg + (i === 0 ? 0 : GAP_DEG / 2);
      const end = start + span - GAP_DEG / 2;
      arcs.push({ startDeg: start, endDeg: end, color: seg.color, glow: seg.glow });
      currentDeg = end + GAP_DEG / 2;
    });
  }

  const pctFontSize = 26 * scale;
  const labelFontSize = 7.5 * scale;
  const pctY = CY - 6 * scale;
  const labelY = CY + 11 * scale;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={STROKE}
      />
      {/* Colored arcs */}
      {total === 0 ? (
        <circle
          cx={CX} cy={CY} r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
        />
      ) : (
        arcs.map((arc, i) => {
          const span = arc.endDeg - arc.startDeg;
          const filled = (span / 360) * CIRCUM;
          const offset = (arc.startDeg / 360) * CIRCUM;
          return (
            <circle
              key={i}
              cx={CX} cy={CY} r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${CIRCUM - filled}`}
              strokeDashoffset={-offset + CIRCUM / 4}
              style={{ filter: arc.glow !== 'none' ? `drop-shadow(0 0 5px ${arc.glow})` : undefined }}
            />
          );
        })
      )}
      {/* Center text */}
      <text
        x={CX} y={pctY}
        textAnchor="middle"
        fontSize={pctFontSize}
        fontWeight="800"
        fill={pctColor}
        fontFamily="inherit"
      >
        {pct}%
      </text>
      <text
        x={CX} y={labelY}
        textAnchor="middle"
        fontSize={labelFontSize}
        fontWeight="600"
        fill="rgba(148,163,184,0.6)"
        fontFamily="inherit"
        letterSpacing="0.06em"
      >
        CONFORMITÉ
      </text>
    </svg>
  );
}
