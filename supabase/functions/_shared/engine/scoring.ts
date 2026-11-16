import type { LevelConfig, ScoreBreakdown, ScoreRules, UnlockRequirement } from './types.ts';

export const DEFAULT_SCORE_RULES: ScoreRules = {
  mission_base: 100,
  no_hint_bonus: 30,
  no_error_bonus: 20,
  time_bonus_max: 50,
  time_bonus_full_seconds: 30,
  time_bonus_zero_seconds: 180,
  hint_penalty: 10,
};

export interface ScoreInput {
  rules: ScoreRules;
  level: Pick<LevelConfig, 'max_score'>;
  hintsUsed: number;
  failedAttempts: number;
  elapsedMs: number;
  /** Optional per-level time limit: the time bonus fades to zero by this many seconds. */
  levelTimeLimitSeconds?: number | null;
}

const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** Deterministic, server-side mission score. Never trusts any client-provided figure. */
export function computeMissionScore(input: ScoreInput): ScoreBreakdown {
  const { rules, level } = input;
  const hints = nonNeg(input.hintsUsed);
  const failed = nonNeg(input.failedAttempts);
  const seconds = Math.max(0, input.elapsedMs) / 1000;

  const base = nonNeg(rules.mission_base);
  const noHint = hints === 0 ? nonNeg(rules.no_hint_bonus) : 0;
  const noError = failed === 0 ? nonNeg(rules.no_error_bonus) : 0;

  let timeBonus = 0;
  let full = rules.time_bonus_full_seconds;
  let zeroAt = rules.time_bonus_zero_seconds;
  const limit = input.levelTimeLimitSeconds;
  if (limit && limit > 0) {
    zeroAt = Math.min(zeroAt, limit);
    full = Math.min(full, zeroAt / 2);
  }
  const zero = Math.max(zeroAt, full + 1);
  if (seconds <= full) timeBonus = nonNeg(rules.time_bonus_max);
  else if (seconds < zero) timeBonus = Math.floor(nonNeg(rules.time_bonus_max) * (1 - (seconds - full) / (zero - full)));

  const penalty = hints * nonNeg(rules.hint_penalty);
  const raw = base + noHint + noError + timeBonus - penalty;
  const cap = nonNeg(level.max_score);
  const capped = cap > 0 ? Math.min(raw, cap) : raw;
  const total = Math.max(0, capped);
  return {
    base,
    no_hint_bonus: noHint,
    no_error_bonus: noError,
    time_bonus: timeBonus,
    hint_penalty: penalty,
    capped_at: cap > 0 && raw > cap ? cap : undefined,
    total,
  };
}

export interface ProgressSummary {
  completedLevelIds: ReadonlySet<string>;
  totalScore: number;
}

/** Decide whether a level is playable given the player's progress and the level ordering. */
export function isLevelUnlocked(
  level: LevelConfig,
  orderedLevels: LevelConfig[],
  progress: ProgressSummary,
): boolean {
  return checkUnlock(level.unlock, level, orderedLevels, progress);
}

function checkUnlock(
  req: UnlockRequirement,
  level: LevelConfig,
  ordered: LevelConfig[],
  progress: ProgressSummary,
): boolean {
  switch (req.type) {
    case 'NONE':
      return true;
    case 'MIN_SCORE':
      return progress.totalScore >= req.score;
    case 'LEVEL':
      return progress.completedLevelIds.has(req.level_id);
    case 'PREVIOUS_LEVEL': {
      const idx = ordered.findIndex((l) => l.id === level.id);
      if (idx <= 0) return true;
      return progress.completedLevelIds.has(ordered[idx - 1].id);
    }
  }
}
