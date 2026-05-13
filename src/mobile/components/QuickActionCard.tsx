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

// Hexagon points — flat bottom, pointy sides
const hexPoints = (w: number, h: number) => {
  const hw = w / 2;
  const hh = h / 2;
  const q = h * 0.25;
  return `${hw},0 ${w},${q} ${w},${h - q} ${hw},${h} 0,${h - q} 0,${q}`;
};

const V = {
  ssi: {
    accent: '#dc2626',
    accentDim: 'rgba(220,38,38,0.18)',
    topHighlight: 'rgba(255,80,80,0.55)',
    bottomShadow: 'rgba(0,0,0,0.9)',
    sideShadow: 'rgba(80,0,0,0.6)',
    bgTop: '#1c0808',
    bgBottom: '#0a0303',
    iconColor: '#f87171',
    glowColor: 'rgba(220,38,38,0.5)',
    subtitleColor: 'rgba(252,165,165,0.7)',
    rimLight: 'rgba(248,113,113,0.4)',
  },
  personnes: {
    accent: '#0ea5e9',
    accentDim: 'rgba(14,165,233,0.15)',
    topHighlight: 'rgba(56,189,248,0.5)',
    bottomShadow: 'rgba(0,0,0,0.9)',
    sideShadow: 'rgba(0,30,60,0.6)',
    bgTop: '#071525',
    bgBottom: '#030a12',
    iconColor: '#38bdf8',
    glowColor: 'rgba(14,165,233,0.45)',
    subtitleColor: 'rgba(186,230,255,0.65)',
    rimLight: 'rgba(56,189,248,0.35)',
  },
};

const W = 150;
const H = 172;
const DEPTH = 10; // 3D extrusion depth in px

export default function QuickActionCard({ variant, title, subtitle, Icon, onClick, offsetTop = 0 }: Props) {
  const v = V[variant];
  const pts = hexPoints(W, H);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center select-none focus:outline-none group"
      style={{ marginTop: offsetTop, WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="relative active:translate-y-[3px] transition-transform duration-100" style={{ width: W, height: H + DEPTH }}>
        {/* ── Bottom face (3D depth) ── */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="absolute"
          style={{ top: DEPTH, left: 0 }}
        >
          <polygon
            points={pts}
            fill={v.bottomShadow}
            stroke="rgba(0,0,0,0.8)"
            strokeWidth="1"
          />
        </svg>

        {/* ── Side faces — left-bottom bevel (dark) ── */}
        <svg viewBox={`0 0 ${W} ${H + DEPTH}`} width={W} height={H + DEPTH} className="absolute inset-0">
          {/* left lower side */}
          <polygon
            points={`0,${H * 0.25} 0,${H * 0.75 + DEPTH} ${W / 2},${H + DEPTH} ${W / 2},${H}`}
            fill={v.sideShadow}
          />
          {/* right lower side */}
          <polygon
            points={`${W},${H * 0.25} ${W},${H * 0.75 + DEPTH} ${W / 2},${H + DEPTH} ${W / 2},${H}`}
            fill={v.sideShadow}
          />
          {/* bottom side */}
          <polygon
            points={`${W / 2},${H} ${W},${H * 0.75} ${W},${H * 0.75 + DEPTH} ${W / 2},${H + DEPTH}`}
            fill="rgba(0,0,0,0.7)"
          />
          <polygon
            points={`0,${H * 0.75} ${W / 2},${H} ${W / 2},${H + DEPTH} 0,${H * 0.75 + DEPTH}`}
            fill="rgba(0,0,0,0.7)"
          />
        </svg>

        {/* ── Top face (main surface) ── */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="absolute"
          style={{ top: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={`bg-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={v.bgTop} />
              <stop offset="100%" stopColor={v.bgBottom} />
            </linearGradient>
            <linearGradient id={`rim-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={v.topHighlight} />
              <stop offset="45%" stopColor={v.accent} stopOpacity="0.4" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
            </linearGradient>
            <filter id={`glow-${variant}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Background fill */}
          <polygon points={pts} fill={`url(#bg-${variant})`} />
          {/* Outer rim border — bright top, dark bottom */}
          <polygon points={pts} fill="none" stroke={`url(#rim-${variant})`} strokeWidth="2.5" />
          {/* Inner subtle glow border */}
          <polygon points={pts} fill="none" stroke={v.accentDim} strokeWidth="6" opacity="0.4" />
        </svg>

        {/* ── Content overlay ── */}
        <div
          className="absolute flex flex-col items-center justify-center gap-2"
          style={{ top: 0, left: 0, width: W, height: H }}
        >
          {/* Icon circle */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: `radial-gradient(circle at 40% 35%, ${v.bgTop}, rgba(0,0,0,0.7))`,
            border: `1.5px solid ${v.rimLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 18px ${v.glowColor}, 0 2px 6px rgba(0,0,0,0.6)`,
          }}>
            <Icon style={{ width: 26, height: 26, color: v.iconColor, strokeWidth: 2.3, filter: `drop-shadow(0 0 6px ${v.iconColor})` }} />
          </div>
          {/* Labels */}
          <div style={{ textAlign: 'center', paddingBottom: 4 }}>
            <p style={{
              color: '#fff',
              fontWeight: 800,
              fontSize: 18,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              textShadow: `0 1px 8px ${v.glowColor}`,
            }}>{title}</p>
            <p style={{
              color: v.subtitleColor,
              fontSize: 11,
              lineHeight: 1.35,
              marginTop: 4,
              maxWidth: 100,
            }}>{subtitle}</p>
          </div>
        </div>
      </div>
    </button>
  );
}
