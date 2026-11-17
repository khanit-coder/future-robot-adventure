import type { RobotAnimationRange } from '@engine';

export const BUILTIN_FRAME_SIZE = 96;

/** Frame map for procedurally generated builtin robot spritesheets (16 frames total). */
export const BUILTIN_ANIMATIONS: Record<string, RobotAnimationRange> = {
  idle: { start: 0, end: 1, frame_rate: 3, repeat: -1 },
  walk: { start: 2, end: 5, frame_rate: 8, repeat: -1 },
  run: { start: 2, end: 5, frame_rate: 12, repeat: -1 },
  jump: { start: 6, end: 7, frame_rate: 6, repeat: 0 },
  turn: { start: 8, end: 9, frame_rate: 8, repeat: 0 },
  wave: { start: 10, end: 11, frame_rate: 6, repeat: -1 },
  celebrate: { start: 12, end: 13, frame_rate: 7, repeat: -1 },
  fail: { start: 14, end: 15, frame_rate: 6, repeat: 1 },
};
