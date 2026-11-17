import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import type { DashboardPlayer } from '@/services/api/publicApi';
import { cn } from '@/utils/cn';
import { avatarForPlayer } from './avatar';

export type DashboardTheme = 'space' | 'lab' | 'planet' | 'light';

interface RobotCardProps {
  player: DashboardPlayer;
  totalLevels: number;
  online: boolean;
  robotSize: number;
  showSchool: boolean;
  showScore: boolean;
  animationsEnabled: boolean;
  overrideState?: RobotVisualState;
  dark?: boolean;
  theme?: DashboardTheme;
}

/** Memoized lightweight player robot card with 4-style typography support */
export const RobotCard = React.memo(function RobotCard({
  player,
  totalLevels,
  online,
  robotSize,
  showSchool,
  showScore,
  animationsEnabled,
  overrideState,
  dark = true,
  theme = 'space',
}: RobotCardProps) {
  const { t } = useTranslation('dashboard');
  const avatar = avatarForPlayer(player.id);

  let animState: RobotVisualState = 'idle';
  if (!animationsEnabled) {
    animState = 'idle';
  } else if (overrideState) {
    animState = overrideState;
  } else if (player.status === 'FINISHED') {
    animState = 'celebrate';
  } else if (player.status === 'PLAYING') {
    animState = 'walk';
  } else if (player.status === 'LEARNING') {
    animState = 'wave';
  }

  const pct = totalLevels > 0 ? Math.min(100, Math.round((player.levels_completed / totalLevels) * 100)) : 0;

  // Style 1: Cyber Futuristic (space)
  // Style 2: Modern eSports (lab)
  // Style 3: Clean Tech Academy (light)
  // Style 4: Comic Arcade Quest (planet)
  const isCyber = theme === 'space';
  const isEsports = theme === 'lab';
  const isAcademy = theme === 'light';
  const isArcade = theme === 'planet';

  return (
    <div
      data-testid="dashboard-robot-card"
      className={cn(
        'relative flex flex-col items-center p-3 transition-all duration-200',
        // Container styles per theme
        isCyber &&
          'rounded-2xl border border-sky-500/35 bg-slate-900/90 text-white shadow-[0_0_15px_rgba(56,189,248,0.12)] hover:border-sky-400 hover:shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:scale-[1.02]',
        isEsports &&
          'rounded-2xl border border-violet-500/35 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-lg hover:border-amber-400 hover:scale-[1.02]',
        isAcademy &&
          'rounded-2xl border border-slate-200 bg-white/95 text-slate-900 shadow-xs hover:shadow-md hover:border-indigo-400',
        isArcade &&
          'rounded-3xl border-2 border-pink-400/40 bg-indigo-950/90 text-white shadow-md hover:scale-[1.03] hover:border-pink-300',
        // Overrides
        overrideState === 'celebrate' && 'ring-2 ring-amber-400 scale-[1.03]',
        overrideState === 'fail' && 'ring-2 ring-rose-500',
      )}
    >
      {/* Online indicator dot */}
      <span
        className={cn(
          'absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full',
          online
            ? isCyber
              ? 'bg-emerald-400 shadow-[0_0_10px_#4ade80]'
              : 'bg-emerald-400 shadow-[0_0_6px_#4ade80]'
            : 'bg-slate-600',
        )}
        title={online ? 'Online' : 'Offline'}
      />

      <RobotIllustration
        styleName={avatar.style}
        color={avatar.color}
        size={robotSize}
        state={animationsEnabled ? animState : 'idle'}
      />

      {/* Player Name */}
      <p
        className={cn(
          'mt-1.5 w-full truncate text-center text-sm',
          isCyber && 'font-extrabold text-sky-200 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)] tracking-wide',
          isEsports && 'font-black uppercase tracking-tight text-white',
          isAcademy && 'font-extrabold text-slate-900 tracking-normal',
          isArcade && 'font-black text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]',
        )}
      >
        {player.name}
      </p>

      {/* School Name */}
      {showSchool && (
        <p
          className={cn(
            'w-full truncate text-center text-xs mt-0.5',
            isCyber && 'border border-sky-400/25 bg-sky-500/10 text-sky-200/90 rounded-md px-1 py-0.5 text-[11px] font-medium max-w-[90%] mx-auto',
            isEsports && 'text-slate-400 font-bold text-[11px]',
            isAcademy && 'text-slate-500 font-medium text-xs',
            isArcade && 'text-pink-300/90 font-semibold text-[11px]',
          )}
        >
          {player.school}
        </p>
      )}

      {/* Status & Score Row */}
      <div className="mt-2 flex w-full items-center justify-between gap-1 text-[11px] font-bold">
        <span
          className={cn(
            'rounded-full px-2 py-0.5',
            isCyber &&
              (player.status === 'FINISHED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                : player.status === 'PLAYING'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                  : player.status === 'TIME_EXPIRED'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                    : 'bg-slate-700/70 text-slate-300'),
            !isCyber &&
              (player.status === 'FINISHED'
                ? 'bg-emerald-500/20 text-emerald-300'
                : player.status === 'PLAYING'
                  ? 'bg-sky-500/20 text-sky-300'
                  : player.status === 'TIME_EXPIRED'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-700/70 text-slate-300'),
          )}
        >
          {t(`statuses.${player.status}`)}
        </span>

        {showScore && (
          <span
            className={cn(
              isCyber && 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] font-mono font-black text-xs',
              isEsports && 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded text-[11px]',
              isAcademy && 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded text-[11px]',
              isArcade && 'bg-gradient-to-r from-pink-500 to-amber-400 text-white font-black rounded-full px-2 py-0.5 text-[11px]',
            )}
          >
            {player.score}
          </span>
        )}
      </div>

      {/* Level progress bar */}
      <div className="mt-2 w-full">
        <div
          className={cn(
            'h-1.5 w-full overflow-hidden rounded-full',
            dark ? 'bg-slate-800' : 'bg-slate-200',
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isCyber && 'bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400 shadow-[0_0_8px_#38bdf8]',
              isEsports && 'bg-gradient-to-r from-amber-400 to-rose-500',
              isAcademy && 'bg-gradient-to-r from-indigo-500 to-sky-500',
              isArcade && 'bg-gradient-to-r from-pink-400 via-purple-400 to-amber-300',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p
          className={cn(
            'mt-1 text-center text-[10px] font-semibold',
            dark ? 'text-slate-400' : 'text-slate-500',
            isCyber && 'text-sky-300/80 font-mono',
          )}
        >
          {t('lvlProgress', { done: player.levels_completed, total: totalLevels })}
        </p>
      </div>
    </div>
  );
});
