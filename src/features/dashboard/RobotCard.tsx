import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import type { DashboardPlayer } from '@/services/api/publicApi';
import { cn } from '@/utils/cn';
import { avatarForPlayer } from './avatar';

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
}

/** Memoized lightweight player robot card — easily handles 100+ concurrent players at 60fps. */
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

  return (
    <div
      data-testid="dashboard-robot-card"
      className={cn(
        'relative flex flex-col items-center rounded-2xl border p-3 transition-transform',
        dark
          ? 'border-slate-800 bg-slate-900/85 text-white'
          : 'border-slate-200 bg-white text-slate-900 shadow-xs',
        overrideState === 'celebrate' && 'ring-2 ring-amber-400 scale-[1.03]',
        overrideState === 'fail' && 'ring-2 ring-rose-500',
      )}
    >
      {/* Online dot */}
      <span
        className={cn(
          'absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full',
          online ? 'bg-emerald-400 shadow-[0_0_8px_#4ade80]' : 'bg-slate-600',
        )}
        title={online ? 'Online' : 'Offline'}
      />

      <RobotIllustration
        styleName={avatar.style}
        color={avatar.color}
        size={robotSize}
        state={animationsEnabled ? animState : 'idle'}
      />

      <p className="mt-1.5 w-full truncate text-center text-sm font-extrabold">{player.name}</p>
      {showSchool && (
        <p className={cn('w-full truncate text-center text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
          {player.school}
        </p>
      )}

      <div className="mt-2 flex w-full items-center justify-between gap-1 text-[11px] font-bold">
        <span
          className={cn(
            'rounded-full px-2 py-0.5',
            player.status === 'FINISHED'
              ? 'bg-emerald-500/20 text-emerald-300'
              : player.status === 'PLAYING'
                ? 'bg-sky-500/20 text-sky-300'
                : player.status === 'TIME_EXPIRED'
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-slate-700/70 text-slate-300',
          )}
        >
          {t(`statuses.${player.status}`)}
        </span>
        {showScore && <span className="text-amber-400 font-extrabold">{player.score}</span>}
      </div>

      {/* Level progress bar */}
      <div className="mt-2 w-full">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p
          className={cn(
            'mt-1 text-center text-[10px] font-semibold',
            dark ? 'text-slate-400' : 'text-slate-500',
          )}
        >
          {t('lvlProgress', { done: player.levels_completed, total: totalLevels })}
        </p>
      </div>
    </div>
  );
});
