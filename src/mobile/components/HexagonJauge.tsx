type Niveau = 'vert' | 'orange' | 'rouge';

type Props = {
  count: number;
  Ep: number;
  taux: number;
  niveau: Niveau;
  loading: boolean;
  offsetTop?: number;
  onDoubleClick?: () => void;
};

const W = 96;
const H = 110;
const q = H * 0.26; // flat-top offset matching QuickActionCard proportions
const CLIP = `polygon(50% 0%, 100% ${(q / H) * 100}%, 100% ${((H - q) / H) * 100}%, 50% 100%, 0% ${((H - q) / H) * 100}%, 0% ${(q / H) * 100}%)`;
const POINTS = `${W * 0.5},0 ${W},${q} ${W},${H - q} ${W * 0.5},${H} 0,${H - q} 0,${q}`;
const DEPTH = 10;

const COLORS: Record<Niveau, { face: string; side: string; rim: string; glow: string }> = {
  vert: {
    face: 'linear-gradient(160deg, #16a34a 0%, #065f46 100%)',
    side: '#052e16',
    rim: 'rgba(74,222,128,0.55)',
    glow: 'rgba(22,163,74,0.5)',
  },
  orange: {
    face: 'linear-gradient(160deg, #ea580c 0%, #7c2d12 100%)',
    side: '#431407',
    rim: 'rgba(251,146,60,0.55)',
    glow: 'rgba(234,88,12,0.5)',
  },
  rouge: {
    face: 'linear-gradient(160deg, #dc2626 0%, #7f1d1d 100%)',
    side: '#450a0a',
    rim: 'rgba(252,165,165,0.55)',
    glow: 'rgba(220,38,38,0.55)',
  },
};

const GRAY = {
  face: 'linear-gradient(160deg, #1e2d45 0%, #0d1421 100%)',
  side: '#060810',
  rim: 'rgba(148,163,184,0.25)',
  glow: 'transparent',
};

export default function HexagonJauge({ count, Ep, taux, niveau, loading, offsetTop = 26, onDoubleClick }: Props) {
  const unconfigured = !loading && Ep === 0;
  const c = (loading || unconfigured) ? GRAY : COLORS[niveau];
  const isPulsing = !loading && !unconfigured && niveau === 'rouge';
  const showHint = !!onDoubleClick && !loading && Ep > 0;

  return (
    <div
      className="flex flex-col items-center select-none"
      style={{ marginTop: offsetTop, touchAction: 'manipulation' }}
      onDoubleClick={onDoubleClick}
    >
      <div
        style={{ width: W, height: H + DEPTH, position: 'relative' }}
        title={unconfigured ? 'Ep non configuré' : undefined}
      >
        {/* Drop shadow */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: DEPTH + 4, left: 1, filter: 'blur(8px)', opacity: 0.55, pointerEvents: 'none' }}
        >
          <polygon points={POINTS} fill="rgba(0,0,0,0.9)" />
        </svg>

        {/* Bottom depth face */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: DEPTH, left: 0, pointerEvents: 'none' }}
        >
          <polygon points={POINTS} fill={c.side} />
        </svg>

        {/* Side bevel faces */}
        <svg
          viewBox={`0 0 ${W} ${H + DEPTH}`}
          width={W} height={H + DEPTH}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <polygon points={`0,${q} 0,${H - q + DEPTH} ${W * 0.5},${H + DEPTH} ${W * 0.5},${H}`} fill="rgba(0,0,0,0.6)" />
          <polygon points={`${W},${q} ${W},${H - q + DEPTH} ${W * 0.5},${H + DEPTH} ${W * 0.5},${H}`} fill="rgba(0,0,0,0.5)" />
          <polygon points={`0,${H - q} ${W * 0.5},${H} ${W * 0.5},${H + DEPTH} 0,${H - q + DEPTH}`} fill="rgba(0,0,0,0.7)" />
          <polygon points={`${W},${H - q} ${W * 0.5},${H} ${W * 0.5},${H + DEPTH} ${W},${H - q + DEPTH}`} fill="rgba(0,0,0,0.7)" />
        </svg>

        {/* Top face — clipped hex */}
        <div
          className={isPulsing ? 'animate-pulse' : ''}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: W,
            height: H,
            clipPath: CLIP,
            WebkitClipPath: CLIP,
            overflow: 'hidden',
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        >
          {/* Background */}
          <div style={{ position: 'absolute', inset: 0, background: c.face }} />

          {/* Inner glow */}
          <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 14px ${c.glow}` }} />

          {/* Content */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}>
            {loading ? (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: 700 }}>…</span>
            ) : unconfigured ? (
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 22, fontWeight: 700 }}>—</span>
            ) : (
              <>
                <span style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                  {count.toLocaleString('fr-FR')}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 1.3 }}>
                  / {Ep.toLocaleString('fr-FR')}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 1.3 }}>
                  {taux} %
                </span>
              </>
            )}
          </div>
        </div>

        {/* Metallic rim */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id="jauge-rim" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor={c.rim} />
              <stop offset="45%" stopColor="rgba(120,140,180,0.2)" />
              <stop offset="100%" stopColor="rgba(15,20,35,0.75)" />
            </linearGradient>
          </defs>
          <polygon points={POINTS} fill="none" stroke="url(#jauge-rim)" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Label */}
      <p className="mt-2 text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>Jauge</p>
      {showHint && (
        <p className="mt-0.5 text-[10px]" style={{ color: 'rgba(148,163,184,0.4)' }}>Double tap</p>
      )}
    </div>
  );
}
