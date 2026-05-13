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

const W = 160;
const H = 184;
const q = H * 0.26;
// clip-path percentage values matching the SVG polygon
const CLIP = `polygon(50% 0%, 100% ${q / H * 100}%, 100% ${(H - q) / H * 100}%, 50% 100%, 0% ${(H - q) / H * 100}%, 0% ${q / H * 100}%)`;
const POINTS = `${W * 0.5},0 ${W},${q} ${W},${H - q} ${W * 0.5},${H} 0,${H - q} 0,${q}`;
const DEPTH = 14;

const V = {
  ssi: {
    faceGradTop: '#1a1f2e',
    faceGradBot: '#0d1018',
    rimTopColor: 'rgba(200,210,230,0.55)',
    rimBotColor: 'rgba(20,25,40,0.8)',
    sideColor: '#060810',
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
        {/* Drop shadow */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: DEPTH + 4, left: 2, filter: 'blur(10px)', opacity: 0.65, pointerEvents: 'none' }}
        >
          <polygon points={POINTS} fill="rgba(0,0,0,0.95)" />
        </svg>

        {/* Bottom depth face */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: DEPTH, left: 0, pointerEvents: 'none' }}
        >
          <polygon points={POINTS} fill={v.sideColor} />
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

        {/* Top face + content — clipped to hex shape so nothing bleeds outside */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: W,
            height: H,
            clipPath: CLIP,
            WebkitClipPath: CLIP,
            overflow: 'hidden',
          }}
        >
          {/* Background fill via div — no SVG echo */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(160deg, ${v.faceGradTop} 0%, ${v.faceGradBot} 100%)`,
          }} />
          {/* Inner accent glow border via box-shadow trick */}
          <div style={{
            position: 'absolute',
            inset: 0,
            boxShadow: `inset 0 0 18px ${v.accentBorder}`,
          }} />

          {/* Content — single render, no duplicate */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}>
            <Icon style={{
              width: 38,
              height: 38,
              color: v.iconColor,
              strokeWidth: 2.1,
              filter: `drop-shadow(0 0 8px ${v.iconGlow}) drop-shadow(0 0 14px ${v.iconGlow})`,
            }} />
            <div style={{ textAlign: 'center', paddingLeft: 14, paddingRight: 14 }}>
              <p style={{ color: '#ffffff', fontWeight: 800, fontSize: 20, lineHeight: 1.1 }}>{title}</p>
              <p style={{ color: v.subtitleColor, fontSize: 12, lineHeight: 1.4, marginTop: 5 }}>{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Metallic rim — rendered on top of clipped content, outside clip */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W} height={H}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id={`rim-${variant}`} x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor={v.rimTopColor} />
              <stop offset="45%" stopColor="rgba(120,140,180,0.25)" />
              <stop offset="100%" stopColor={v.rimBotColor} />
            </linearGradient>
          </defs>
          <polygon points={POINTS} fill="none" stroke={`url(#rim-${variant})`} strokeWidth="2" />
        </svg>
      </div>
    </button>
  );
}
