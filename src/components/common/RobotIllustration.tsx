import { useEffect, useState } from 'react';
import type { RobotAnimationRange, RobotConfig } from '@engine';
import { BUILTIN_ANIMATIONS } from '@/game-engine/animations/animationConstants';
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
 * Supports 10 distinct builtin robot styles and spritesheet slicing.
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
      <SpritesheetRobotIllustration
        spriteUrl={robot.sprite_url}
        frameWidth={robot.frame_width ?? undefined}
        frameHeight={robot.frame_height ?? undefined}
        size={size}
        state={state}
        animations={robot.animations}
        className={className}
      />
    );
  }

  const isCelebrated = state === 'celebrate';
  const isFailed = state === 'fail';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      className={cn('select-none shrink-0', animClass, className)}
      aria-hidden="true"
    >
      {/* Ground Shadow */}
      <ellipse cx="40" cy="74" rx="18" ry="3.5" fill="rgba(15, 23, 42, 0.2)" />

      {/* Movement Base / Legs / Thrusters / Treads */}
      {variant === 'gizmo' ? (
        <g>
          <path d="M28 64 L52 64 L47 71 L33 71 Z" fill="#475569" stroke="#1e293b" strokeWidth="2" />
          <ellipse cx="40" cy="72" rx="4" ry="2" fill="#38bdf8" />
        </g>
      ) : variant === 'titan' ? (
        <g>
          <rect x="20" y="63" width="40" height="9" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          <circle cx="28" cy="67.5" r="2.5" fill="#64748b" />
          <circle cx="40" cy="67.5" r="2.5" fill="#64748b" />
          <circle cx="52" cy="67.5" r="2.5" fill="#64748b" />
        </g>
      ) : variant === 'echo' ? (
        <ellipse cx="40" cy="68" rx="14" ry="3.5" fill="none" stroke="#38bdf8" strokeWidth="2" />
      ) : variant === 'retro' ? (
        <g>
          <rect x="25" y="63" width="11" height="8" rx="1" fill="#475569" stroke="#1e293b" strokeWidth="2" />
          <rect x="44" y="63" width="11" height="8" rx="1" fill="#475569" stroke="#1e293b" strokeWidth="2" />
        </g>
      ) : (
        <g>
          <rect x="27" y="64" width="9" height="7" rx="3" fill="#475569" stroke="#1e293b" strokeWidth="2" />
          <rect x="44" y="64" width="9" height="7" rx="3" fill="#475569" stroke="#1e293b" strokeWidth="2" />
        </g>
      )}

      {/* Arms */}
      {variant === 'titan' ? (
        <>
          <rect x="8" y="40" width="11" height="18" rx="3" fill={accent} stroke="#1e293b" strokeWidth="2" />
          <rect x="61" y={isCelebrated ? 26 : 40} width="11" height="18" rx="3" fill={accent} stroke="#1e293b" strokeWidth="2" />
        </>
      ) : variant === 'echo' ? (
        <>
          <rect x="14" y="44" width="6" height="12" rx="3" fill={accent} stroke="#1e293b" strokeWidth="2" />
          <rect x="60" y={isCelebrated ? 30 : 44} width="6" height="12" rx="3" fill={accent} stroke="#1e293b" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="11" y="42" width="7" height="16" rx="3.5" fill={accent} stroke="#1e293b" strokeWidth="2" />
          <rect x="62" y={isCelebrated ? 28 : 42} width="7" height="16" rx="3.5" fill={accent} stroke="#1e293b" strokeWidth="2" />
        </>
      )}

      {/* Body */}
      {variant === 'echo' ? (
        <rect x="23" y="41" width="34" height="22" rx="11" fill={accent} stroke="#1e293b" strokeWidth="2.2" />
      ) : variant === 'titan' ? (
        <rect x="18" y="39" width="44" height="23" rx="4" fill={accent} stroke="#1e293b" strokeWidth="2.4" />
      ) : (
        <rect x="22" y="42" width="36" height="22" rx="8" fill={accent} stroke="#1e293b" strokeWidth="2.2" />
      )}

      {/* Chest Accent / Core */}
      {variant === 'echo' ? (
        <circle cx="40" cy="52" r="5" fill={isCelebrated ? '#4ade80' : isFailed ? '#fb7185' : '#38bdf8'} stroke="#ffffff" strokeWidth="1.5" />
      ) : variant === 'spark' ? (
        <g>
          <rect x="30" y="47" width="20" height="11" rx="3" fill="#0f172a" />
          <polygon points="40,48 45,52.5 40,57 35,52.5" fill={isCelebrated ? '#4ade80' : '#fbbf24'} />
        </g>
      ) : variant === 'cyber' ? (
        <g>
          <rect x="28" y="47" width="24" height="10" rx="3" fill="#0f172a" />
          <rect x="31" y="51" width="18" height="2.5" rx="1" fill="#06b6d4" />
        </g>
      ) : variant === 'titan' ? (
        <g>
          <rect x="27" y="45" width="26" height="11" rx="2" fill="#0f172a" />
          <rect x="31" y="48" width="4" height="5" fill="#f59e0b" />
          <rect x="38" y="48" width="4" height="5" fill="#f59e0b" />
          <rect x="45" y="48" width="4" height="5" fill="#f59e0b" />
        </g>
      ) : variant === 'retro' ? (
        <g>
          <circle cx="40" cy="53" r="6" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.5" />
          <line x1="40" y1="53" x2="43" y2="50" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <rect x="30" y="48" width="20" height="10" rx="4" fill="#0f172a" opacity="0.85" />
          <circle cx="35" cy="53" r="2.2" fill="#38bdf8" />
          <circle cx="40" cy="53" r="2.2" fill="#4ade80" />
          <circle cx="45" cy="53" r="2.2" fill="#fbbf24" />
        </g>
      )}

      {/* Headwear / Antennas */}
      {variant === 'nova' ? (
        <>
          <path d="M28 18 L24 8" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M52 18 L56 8" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="7" r="3.5" fill="#fbbf24" />
          <circle cx="56" cy="7" r="3.5" fill="#fbbf24" />
        </>
      ) : variant === 'spark' ? (
        <>
          <polygon points="26,17 21,5 29,11" fill="#fbbf24" stroke="#1e293b" strokeWidth="1.5" />
          <polygon points="54,17 59,5 51,11" fill="#fbbf24" stroke="#1e293b" strokeWidth="1.5" />
        </>
      ) : variant === 'cyber' ? (
        <>
          <path d="M21 28 Q40 10 59 28" stroke="#1e293b" strokeWidth="3" fill="none" />
          <rect x="15" y="22" width="7" height="18" rx="3" fill="#06b6d4" stroke="#1e293b" strokeWidth="2" />
          <rect x="58" y="22" width="7" height="18" rx="3" fill="#06b6d4" stroke="#1e293b" strokeWidth="2" />
        </>
      ) : variant === 'echo' ? (
        <>
          <rect x="15" y="23" width="6" height="12" rx="3" fill={accent} stroke="#1e293b" strokeWidth="2" />
          <rect x="59" y="23" width="6" height="12" rx="3" fill={accent} stroke="#1e293b" strokeWidth="2" />
        </>
      ) : variant === 'retro' ? (
        <>
          <path d="M40 16 L40 12 L43 10 L37 7 L40 5" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
          <circle cx="40" cy="4" r="3.5" fill="#ef4444" />
          <circle cx="16" cy="30" r="3" fill="#94a3b8" stroke="#1e293b" strokeWidth="1.5" />
          <circle cx="64" cy="30" r="3" fill="#94a3b8" stroke="#1e293b" strokeWidth="1.5" />
        </>
      ) : variant === 'astro' ? (
        <circle cx="40" cy="30" r="23" stroke="#cbd5e1" strokeWidth="2" fill="none" opacity="0.6" />
      ) : variant === 'titan' ? (
        <rect x="36" y="10" width="8" height="6" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
      ) : (
        <>
          <line x1="40" y1="16" x2="40" y2="7" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
          <circle
            cx="40"
            cy="6"
            r="4"
            fill={isCelebrated ? '#4ade80' : isFailed ? '#f43f5e' : '#f59e0b'}
          />
        </>
      )}

      {/* Head */}
      <rect
        x={variant === 'echo' ? 19 : variant === 'titan' ? 17 : 18}
        y={15}
        width={variant === 'echo' ? 42 : variant === 'titan' ? 46 : 44}
        height={30}
        rx={variant === 'echo' ? 15 : variant === 'nova' ? 14 : variant === 'titan' ? 5 : variant === 'retro' ? 3 : 10}
        fill={accent}
        stroke="#1e293b"
        strokeWidth="2.4"
      />

      {/* Visor */}
      {variant === 'cyber' ? (
        <rect x="22" y="22" width="36" height="15" rx="4" fill="#0f172a" />
      ) : variant === 'shadow' ? (
        <g>
          <rect x="23" y="22" width="34" height="10" rx="3" fill="#0f172a" />
          <rect x="23" y="32" width="34" height="10" fill="#334155" />
        </g>
      ) : variant === 'titan' ? (
        <rect x="23" y="23" width="34" height="11" rx="2" fill="#0f172a" />
      ) : (
        <rect x="24" y="21" width="32" height="18" rx="7" fill="#0f172a" />
      )}

      {/* Eyes + Expression */}
      {isFailed ? (
        <>
          <path d="M29 27 L34 32 M34 27 L29 32" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M46 27 L51 32 M51 27 L46 32" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M35 36 Q40 33 45 36" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : isCelebrated ? (
        <>
          <path d="M28 30 Q32 25 36 30" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M44 30 Q48 25 52 30" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M34 34 Q40 39 46 34" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : variant === 'cyber' ? (
        <rect x="25" y="26" width="30" height="5" rx="2" fill="#00f0ff" />
      ) : variant === 'shadow' ? (
        <g>
          <rect x="27" y="25" width="9" height="3" rx="1" fill="#ef4444" />
          <rect x="44" y="25" width="9" height="3" rx="1" fill="#ef4444" />
        </g>
      ) : variant === 'echo' ? (
        <>
          <circle cx="32" cy="29" r="4.2" fill="#38bdf8" />
          <circle cx="48" cy="29" r="4.2" fill="#38bdf8" />
          <circle cx="33" cy="27.5" r="1.8" fill="#ffffff" />
          <circle cx="49" cy="27.5" r="1.8" fill="#ffffff" />
          <path d="M36 34 Q40 37 44 34" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
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

function SpritesheetRobotIllustration({
  spriteUrl,
  frameWidth = 96,
  frameHeight = 96,
  size = 84,
  state = 'idle',
  animations,
  className,
}: {
  spriteUrl: string;
  frameWidth?: number;
  frameHeight?: number;
  size?: number;
  state?: RobotVisualState;
  animations?: Record<string, RobotAnimationRange> | null;
  className?: string;
}) {
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let active = true;
    const img = new Image();
    img.src = spriteUrl;
    img.onload = () => {
      if (active) {
        setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    return () => {
      active = false;
    };
  }, [spriteUrl]);

  const anim = animations?.[state] ?? BUILTIN_ANIMATIONS[state] ?? { start: 0, end: 0, frame_rate: 6 };
  const [frameOffset, setFrameOffset] = useState(0);

  useEffect(() => {
    const count = Math.max(1, anim.end - anim.start + 1);
    if (count <= 1) return;
    const fps = Math.max(1, anim.frame_rate || 6);
    const intervalMs = Math.round(1000 / fps);
    const id = window.setInterval(() => {
      setFrameOffset((prev) => (prev + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [anim.start, anim.end, anim.frame_rate]);

  const currentFrame = anim.start + (anim.end > anim.start ? frameOffset % (anim.end - anim.start + 1) : 0);

  if (!imgDimensions || imgDimensions.w === 0 || imgDimensions.h === 0) {
    return (
      <div
        className={cn('relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-slate-900/30', className)}
        style={{ width: size, height: size }}
      >
        <img src={spriteUrl} alt="Robot Spritesheet" className="h-full w-full object-contain" />
      </div>
    );
  }

  const fw = frameWidth || 96;
  const fh = frameHeight || 96;
  const cols = Math.max(1, Math.floor(imgDimensions.w / fw));
  const col = currentFrame % cols;
  const row = Math.floor(currentFrame / cols);

  const scale = size / Math.max(fw, fh);
  const bgW = imgDimensions.w * scale;
  const bgH = imgDimensions.h * scale;
  const posX = -col * fw * scale;
  const posY = -row * fh * scale;

  return (
    <div
      className={cn('relative inline-block overflow-hidden shrink-0 select-none rounded-xl', className)}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${spriteUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${posX}px ${posY}px`,
        backgroundSize: `${bgW}px ${bgH}px`,
        imageRendering: 'pixelated',
      }}
      aria-label={`Robot frame ${currentFrame}`}
    />
  );
}
