import { type LucideIcon } from 'lucide-react';

type Variant = 'ssi' | 'personnes';

type Props = {
  variant: Variant;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  onClick: () => void;
  offsetTop?: number;
};

// Flat-top hexagon — matches the maquette shape (slightly squarish)
// Width 160, Height 180
const W = 160;
const H = 184;
// Flat-top hex: top-left, top-right, right, bottom-right, bottom-left, left
// with slightly rounded feel via tighter points
const q = H * 0.26; // ~48px quarter offset
const POINTS = `${W * 0.5},0 ${W},${q} ${W},${H - q} ${W * 0.5},${H} 0,${H - q} 0,${q}`;
const DEPTH = 14;

const V = {
  ssi: {
    faceGradTop: '#1a1f2e',
    faceGradBot: '#0d1018',
    rimTopColor: 'rgba(200,210,230,0.55)',
    rimBotColor: 'rgba(20,25,40,0.8)',
    sideColor: '#060810',
    shadowColor: 'rgba(0,0,0,0.85)',
    iconColor: '#ef4444',
    iconGlow: 'rgba(239,68,68,0.6)',
    subtitleColor: 'rgba(252,165,165,0.72)',
    accentBorder: 'rgba(100,120,180,0.25)',
  },
  personnes: {
    faceGradTop: '#141a28',
    faceGradBot: '#090d16',
    rimTopColor: 'rgba(200,215,240,0.5)',
    rimBotColor: 'rgba(15,20,35,0.85)',
    sideColor: '#050810',
    shadowColor: 'rgba(0,0,0,0.85)',
    iconColor: '#38bdf8',
    iconGlow: 'rgba(56,189,248,0.55)',
    subtitleColor: 'rgba(186,230,255,0.68)',
    accentBorder: 'rgba(56,189,248,0.2)',
  },
};

export default function QuickActionCard({ variant, title, subtitle, Icon, onClick, offsetTop = 0 }: Props) {
  const v = V[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center select-none focus:outline-none"
      style={{ marginTop: offsetTop, WebkitTapHighlightColor: 'transparent' }}
    >
      <div
        className="active:translate-y-[4px] transition-transform duration-100"
        style={{ width: W, height: H + DEPTH, position: 'relative' }}
      >
        {/* ── Drop shadow layer (lowest) ── */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: DEPTH + 4, left: 2, filter: 'blur(8px)', opacity: 0.7 }}
        >
          <polygon points={POINTS} fill="rgba(0,0,0,0.9)" />
        </svg>

        {/* ── Bottom / depth face ── */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: DEPTH, left: 0 }}
        >
          <polygon points={POINTS} fill={v.sideColor} stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
        </svg>

        {/* ── Side bevel faces ── */}
        <svg
          viewBox={`0 0 ${W} ${H + DEPTH}`}
          width={W} height={H + DEPTH}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* Left-bottom bevel */}
          <polygon
            points={`0,${q} 0,${H - q + DEPTH} ${W * 0.5},${H + DEPTH} ${W * 0.5},${H}`}
            fill="rgba(0,0,0,0.65)"
          />
          {/* Right-bottom bevel */}
          <polygon
            points={`${W},${q} ${W},${H - q + DEPTH} ${W * 0.5},${H + DEPTH} ${W * 0.5},${H}`}
            fill="rgba(0,0,0,0.55)"
          />
          {/* Bottom-left face */}
          <polygon
            points={`0,${H - q} ${W * 0.5},${H} ${W * 0.5},${H + DEPTH} 0,${H - q + DEPTH}`}
            fill="rgba(0,0,0,0.7)"
          />
          {/* Bottom-right face */}
          <polygon
            points={`${W},${H - q} ${W * 0.5},${H} ${W * 0.5},${H + DEPTH} ${W},${H - q + DEPTH}`}
            fill="rgba(0,0,0,0.7)"
          />
        </svg>

        {/* ── Top face (main surface) ── */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={`face-${variant}`} x1="0.3" y1="0" x2="0.7" y2="1">
              <stop offset="0%" stopColor={v.faceGradTop} />
              <stop offset="100%" stopColor={v.faceGradBot} />
            </linearGradient>
            {/* Rim: bright silver top, dark bottom */}
            <linearGradient id={`rim-${variant}`} x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor={v.rimTopColor} />
              <stop offset="40%" stopColor="rgba(140,155,190,0.3)" />
              <stop offset="100%" stopColor={v.rimBotColor} />
            </linearGradient>
          </defs>
          {/* Main fill */}
          <polygon points={POINTS} fill={`url(#face-${variant})`} />
          {/* Accent inner border */}
          <polygon points={POINTS} fill="none" stroke={v.accentBorder} strokeWidth="8" />
          {/* Outer rim — metallic bevel */}
          <polygon points={POINTS} fill="none" stroke={`url(#rim-${variant})`} strokeWidth="2" />
        </svg>

        {/* ── Content ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: W,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {/* Icon */}
          <Icon style={{
            width: 38,
            height: 38,
            color: v.iconColor,
            strokeWidth: 2.1,
            filter: `drop-shadow(0 0 8px ${v.iconGlow}) drop-shadow(0 0 16px ${v.iconGlow})`,
          }} />
          {/* Labels */}
          <div style={{ textAlign: 'center', paddingBottom: 6, paddingLeft: 12, paddingRight: 12 }}>
            <p style={{
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 20,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}>{title}</p>
            <p style={{
              color: v.subtitleColor,
              fontSize: 12,
              lineHeight: 1.4,
              marginTop: 5,
            }}>{subtitle}</p>
          </div>
        </div>
      </div>
    </button>
  );
}
