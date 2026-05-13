import { type LucideIcon } from 'lucide-react';

type Variant = 'ssi' | 'personnes';

type Props = {
  variant: Variant;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  onClick: () => void;
};

// Hexagon clip-path (flat-top, 6 sides)
const HEX_CLIP = 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)';

const variants: Record<Variant, {
  outerGlow: string;
  outerBg: string;
  outerBorder: string;
  innerBg: string;
  innerBorder: string;
  iconColor: string;
  subtitleColor: string;
  shadowColor: string;
}> = {
  ssi: {
    outerGlow: 'rgba(220,38,38,0.35)',
    outerBg: 'linear-gradient(145deg, #2a1010 0%, #1a0808 100%)',
    outerBorder: 'rgba(220,38,38,0.5)',
    innerBg: 'linear-gradient(145deg, #1e0a0a 0%, #0f0404 100%)',
    innerBorder: 'rgba(185,28,28,0.6)',
    iconColor: '#ef4444',
    subtitleColor: 'rgba(252,165,165,0.75)',
    shadowColor: 'rgba(220,38,38,0.25)',
  },
  personnes: {
    outerGlow: 'rgba(56,189,248,0.3)',
    outerBg: 'linear-gradient(145deg, #0c1e2e 0%, #060f1a 100%)',
    outerBorder: 'rgba(56,189,248,0.45)',
    innerBg: 'linear-gradient(145deg, #0a1824 0%, #040c14 100%)',
    innerBorder: 'rgba(14,165,233,0.55)',
    iconColor: '#38bdf8',
    subtitleColor: 'rgba(186,230,255,0.7)',
    shadowColor: 'rgba(56,189,248,0.2)',
  },
};

export default function QuickActionCard({ variant, title, subtitle, Icon, onClick }: Props) {
  const v = variants[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center active:scale-95 transition-transform duration-150 select-none"
      style={{ outline: 'none' }}
    >
      {/* Outer hex — glow ring */}
      <div
        style={{
          width: 148,
          height: 170,
          clipPath: HEX_CLIP,
          background: v.outerBg,
          padding: '3px',
          boxShadow: `0 0 32px ${v.outerGlow}, 0 8px 24px ${v.shadowColor}, inset 0 1px 0 ${v.outerBorder}`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Border layer via inner hex */}
        <div
          style={{
            width: '100%',
            height: '100%',
            clipPath: HEX_CLIP,
            background: v.innerBg,
            border: `1.5px solid ${v.innerBorder}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingTop: 8,
          }}
        >
          {/* Icon */}
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${v.iconColor}55`,
          }}>
            <Icon style={{ width: 28, height: 28, color: v.iconColor, strokeWidth: 2.2 }} />
          </div>
          {/* Text */}
          <div style={{ textAlign: 'center', paddingBottom: 4 }}>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 17, lineHeight: 1.1, letterSpacing: '-0.01em' }}>{title}</p>
            <p style={{ color: v.subtitleColor, fontSize: 11, lineHeight: 1.3, marginTop: 3, maxWidth: 90 }}>{subtitle}</p>
          </div>
        </div>
      </div>
    </button>
  );
}
