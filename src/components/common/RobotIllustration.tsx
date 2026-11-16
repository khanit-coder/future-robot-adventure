import type { RobotConfig } from '@engine';
import { cn } from '@/utils/cn';

export type RobotVisualState = 'idle' | 'walk' | 'run' | 'jump' | 'turn' | 'wave' | 'celebrate' | 'fail';

interface RobotIllustrationProps {
  styleName?: string | null;
  color?: string;
  size?: number;
  state?: RobotVisualState;
  robot?: Partial<RobotConfig> | null;
  className?: string;
}

/**
 * Lightweight, original SVG robot component used across Registration, Lessons,
 * Level Map, Admin previews, and the 100-player TV Dashboard (zero Phaser overhead).
 */
export function RobotIllustration({
  styleName,
  color,
  size = 84,
  state = 'idle',
  robot,
  className,
}: RobotIllustrationProps) {
  const accent = robot?.primary_color || color || '#38bdf8';
  const variant = robot?.builtin_style || styleName || 'bolt';
  const animClass = `animate-robot-${state}`;

  if (robot?.kind === 'spritesheet' && robot.sprite_url) {
    return (
      <div
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden rounded-2xl',
          animClass,
          className,
        )}
        style={{ width: size, height: size }}
      >
        <img src={robot.sprite_url} alt="Robot" className="h-full w-full object-contain" loading="lazy" />
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      className={cn('select-none shrink-0', animClass, className)}
      aria-hidden="true"
    >
      {/* Shadow */}
      <ellipse cx="40" cy="74" rx="18" ry="3.5" fill="rgba(15, 23, 42, 0.18)" />

      {/* Antenna */}
      {variant === 'nova' ? (
        <>
          <path d="M28 18 L24 8" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M52 18 L56 8" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="7" r="3.5" fill="#fbbf24" />
          <circle cx="56" cy="7" r="3.5" fill="#fbbf24" />
        </>
      ) : (
        <>
          <line x1="40" y1="16" x2="40" y2="7" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
          <circle
            cx="40"
            cy="6"
            r="4"
            fill={state === 'celebrate' ? '#4ade80' : state === 'fail' ? '#f43f5e' : '#f59e0b'}
          />
        </>
      )}

      {/* Left Arm */}
      <rect x="11" y="42" width="7" height="16" rx="3.5" fill={accent} stroke="#1e293b" strokeWidth="2" />

      {/* Right Arm (waves during wave/celebrate) */}
      <g className="robot-arm-right">
        <rect
          x="62"
          y={state === 'celebrate' ? 28 : 42}
          width="7"
          height="16"
          rx="3.5"
          fill={accent}
          stroke="#1e293b"
          strokeWidth="2"
        />
      </g>

      {/* Body */}
      <rect x="22" y="42" width="36" height="22" rx="8" fill={accent} stroke="#1e293b" strokeWidth="2.2" />
      <rect x="30" y="48" width="20" height="10" rx="4" fill="#0f172a" opacity="0.85" />
      <circle cx="35" cy="53" r="2.2" fill="#38bdf8" />
      <circle cx="40" cy="53" r="2.2" fill="#4ade80" />
      <circle cx="45" cy="53" r="2.2" fill="#fbbf24" />

      {/* Legs / Thruster */}
      {variant === 'gizmo' ? (
        <path d="M29 64 L51 64 L46 71 L34 71 Z" fill="#475569" stroke="#1e293b" strokeWidth="2" />
      ) : (
        <>
          <rect x="27" y="64" width="9" height="7" rx="3" fill="#475569" stroke="#1e293b" strokeWidth="2" />
          <rect x="44" y="64" width="9" height="7" rx="3" fill="#475569" stroke="#1e293b" strokeWidth="2" />
        </>
      )}

      {/* Head */}
      <rect
        x="18"
        y="15"
        width="44"
        height="30"
        rx={variant === 'nova' ? 14 : 10}
        fill={accent}
        stroke="#1e293b"
        strokeWidth="2.4"
      />

      {/* Visor */}
      <rect x="24" y="21" width="32" height="18" rx="7" fill="#0f172a" />

      {/* Eyes + Expression */}
      {state === 'fail' ? (
        <>
          <path d="M29 27 L34 32 M34 27 L29 32" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M46 27 L51 32 M51 27 L46 32" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M35 36 Q40 33 45 36" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : state === 'celebrate' ? (
        <>
          <path d="M28 30 Q32 25 36 30" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M44 30 Q48 25 52 30" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M34 34 Q40 39 46 34" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="32" cy="29" r="3.4" fill="#38bdf8" />
          <circle cx="48" cy="29" r="3.4" fill="#38bdf8" />
          <circle cx="33" cy="28" r="1.1" fill="#ffffff" />
          <circle cx="49" cy="28" r="1.1" fill="#ffffff" />
          <path d="M35 34.5 Q40 37.5 45 34.5" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
