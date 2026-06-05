import { computeConformite, RegistreItemMin } from '../../lib/registreStatut';

interface Props {
  items: RegistreItemMin[];
}

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 62;
const STROKE = 18;
const CIRCUM = 2 * Math.PI * RADIUS;
const GAP_DEG = 2; // degrees of gap between segments

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

function arcPath(startDeg: number, endDeg: number, r: number): string {
  if (Math.abs(endDeg - startDeg) >= 360) {
    // Full circle: draw as two half arcs
    const top = polarToXY(startDeg, r);
    const bot = polarToXY(startDeg + 180, r);
    return `M ${top.x} ${top.y} A ${r} ${r} 0 0 1 ${bot.x} ${bot.y} A ${r} ${r} 0 0 1 ${top.x} ${top.y} Z`;
  }
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const s = polarToXY(startDeg, r);
  const e = polarToXY(endDeg, r);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function ConformiteDashboard({ items }: Props) {
  const { pct, total, conformes, nbRetard, nbNonPlanifie, nbAttention, nbAJour, couleur } =
    computeConformite(items);

  // Segments: rouge (retard), orange (attention+nonPlanifie), vert (aJour)
  const segments = [
    { value: nbRetard,              color: '#ef4444', label: 'En retard',     glow: '#ef444488' },
    { value: nbNonPlanifie + nbAttention, color: '#f59e0b', label: 'À surveiller', glow: '#f59e0b88' },
    { value: nbAJour,               color: '#22c55e', label: 'À jour',        glow: '#22c55e88' },
  ].filter((s) => s.value > 0);

  const pctColor =
    couleur === 'rouge' ? '#ef4444' : couleur === 'orange' ? '#f59e0b' : '#22c55e';

  // Compute arc angles for each segment
  let currentDeg = 0;
  const arcs: Array<{ startDeg: number; endDeg: number; color: string; glow: string }> = [];

  if (total === 0) {
    // Full grey ring
    arcs.push({ startDeg: 0, endDeg: 359.99, color: 'rgba(255,255,255,0.08)', glow: 'none' });
  } else {
    const totalGap = segments.length * GAP_DEG;
    const usableDeg = 360 - totalGap;

    segments.forEach((seg, i) => {
      const span = (seg.value / total) * usableDeg;
      const start = currentDeg + (i === 0 ? 0 : GAP_DEG / 2);
      const end = start + span - (i === segments.length - 1 ? GAP_DEG / 2 : GAP_DEG / 2);
      arcs.push({ startDeg: start, endDeg: end, color: seg.color, glow: seg.glow });
      currentDeg = end + GAP_DEG / 2;
    });
  }

  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Donut SVG */}
        <div className="shrink-0">
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
                const offset = ((arc.startDeg) / 360) * CIRCUM;
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
              x={CX} y={CY - 6}
              textAnchor="middle"
              fontSize="26"
              fontWeight="800"
              fill={pctColor}
              fontFamily="inherit"
            >
              {pct}%
            </text>
            <text
              x={CX} y={CY + 11}
              textAnchor="middle"
              fontSize="7.5"
              fontWeight="600"
              fill="rgba(148,163,184,0.6)"
              fontFamily="inherit"
              letterSpacing="0.06em"
            >
              CONFORMITÉ
            </text>
          </svg>
        </div>

        {/* Legend + stats */}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {conformes}/{total} vérifications à jour
          </p>

          <div className="space-y-1.5">
            {nbRetard > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#ef4444', boxShadow: '0 0 4px #ef444488' }} />
                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>
                  {nbRetard} en retard
                </span>
              </div>
            )}
            {(nbNonPlanifie + nbAttention) > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#f59e0b', boxShadow: '0 0 4px #f59e0b88' }} />
                <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                  {nbNonPlanifie + nbAttention} à surveiller
                </span>
              </div>
            )}
            {nbAJour > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#22c55e', boxShadow: '0 0 4px #22c55e88' }} />
                <span className="text-xs font-medium" style={{ color: '#22c55e' }}>
                  {nbAJour} à jour
                </span>
              </div>
            )}
            {total === 0 && (
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>Aucune installation planifiable</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
