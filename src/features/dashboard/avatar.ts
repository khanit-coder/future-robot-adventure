import type { RobotConfig } from '@engine';
import { hashPlayerIdToIndex } from '@/utils/robotAssignment';

export const BUILTIN_STYLES = [
  'bolt',
  'nova',
  'gizmo',
  'titan',
  'cyber',
  'echo',
  'spark',
  'shadow',
  'astro',
  'retro',
] as const;

export const RICH_COLORS = [
  '#38bdf8', // sky
  '#f472b6', // pink
  '#4ade80', // green
  '#fbbf24', // amber
  '#a78bfa', // purple
  '#06b6d4', // cyan
  '#ec4899', // rose / sakura
  '#eab308', // gold
  '#8b5cf6', // amethyst / violet
  '#f97316', // orange / flame
] as const;

export interface PlayerAvatarResult {
  robot?: RobotConfig;
  style: string;
  color: string;
}

/**
 * Returns the robot visual representation for a dashboard player.
 * If actual robot configs are provided (from published config / database),
 * it matches the student's assigned robot in game!
 * Otherwise, it distributes across all 10 distinct styles and vibrant color palettes.
 */
export function avatarForPlayer(
  playerId: string,
  robots?: RobotConfig[] | null,
): PlayerAvatarResult {
  if (robots && robots.length > 0) {
    const idx = hashPlayerIdToIndex(playerId, robots.length);
    const chosen = robots[idx];
    return {
      robot: chosen,
      style: chosen.builtin_style || 'bolt',
      color: chosen.primary_color || '#38bdf8',
    };
  }

  const idx = hashPlayerIdToIndex(playerId, 1000);
  return {
    style: BUILTIN_STYLES[idx % BUILTIN_STYLES.length],
    color: RICH_COLORS[idx % RICH_COLORS.length],
  };
}
