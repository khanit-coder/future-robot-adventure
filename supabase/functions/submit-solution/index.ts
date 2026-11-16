// deno-lint-ignore-file no-explicit-any
import { evaluateSubmission } from '../_shared/engine/evaluate.ts';
import { computeMissionScore, isLevelUnlocked } from '../_shared/engine/scoring.ts';
import { loadPlayerContext, expireIfNeeded } from '../_shared/player.ts';
import { HttpError, adminClient, emitEvents, isUuid, loadConfig, rateLimit, requireUser, serve } from '../_shared/util.ts';
import type { NewEvent } from '../_shared/util.ts';

/**
 * submit-solution — the authoritative compile step.
 *
 *   untrusted JSON program → parse/validate → run the deterministic interpreter against the mission of the
 *   player's PINNED config version → compute the score on the server → store everything in ONE transaction
 *   (apply_submission) → broadcast → return the execution trace for Phaser to play.
 *
 * The browser never supplies a score, a time, or a result.
 */
Deno.serve(
  serve(async (req, body) => {
    const user = await requireUser(req);
    if (!isUuid(body.level_id)) throw new HttpError(422, 'BAD_LEVEL');
    if (!isUuid(body.client_submission_id)) throw new HttpError(422, 'BAD_SUBMISSION_ID');
    await rateLimit(`submit:${user.id}`, 40, 60);

    const db = adminClient();
    let ctx = await loadPlayerContext(user.id);
    ctx = await expireIfNeeded(ctx);
    const { player, ps, session } = ctx;

    if (session.status !== 'ACTIVE') return { accepted: false, reason: 'SESSION_CLOSED' };
    if (ps.status === 'TIME_EXPIRED') return { accepted: false, reason: 'TIME_EXPIRED', player_status: ps.status };
    if (ps.status === 'FINISHED') return { accepted: false, reason: 'FINISHED', player_status: ps.status };
    if (ps.status !== 'PLAYING') return { accepted: false, reason: 'NOT_STARTED', player_status: ps.status };

    const cfg = await loadConfig(ps.config_version);
    const level = cfg.levels.find((l) => l.id === body.level_id);
    if (!level) throw new HttpError(404, 'LEVEL_NOT_FOUND');

    const { data: progressRows } = await db.from('player_level_progress').select('*').eq('player_session_id', ps.id);
    const completed = new Set((progressRows ?? []).filter((r: any) => r.status === 'COMPLETED').map((r: any) => r.level_id));
    if (!isLevelUnlocked(level, cfg.levels, { completedLevelIds: completed, totalScore: ps.total_score })) {
      throw new HttpError(403, 'LEVEL_LOCKED');
    }

    const missionWithAllBlocks = {
      ...level.mission,
      rules: {
        ...level.mission.rules,
        allowed_commands: cfg.blocks.filter((b) => b.enabled).map((b) => b.command_type),
      },
    };
    const outcome = evaluateSubmission(missionWithAllBlocks, body.program, cfg.blocks);
    if (outcome.status === 'INVALID') {
      // Nothing ran, so it does not count as an attempt.
      return { accepted: true, status: 'INVALID', issues: outcome.issues, server_now: new Date().toISOString() };
    }
    const result = outcome.result;
    const status = result.success ? 'SUCCESS' : 'FAILED';

    // Up to 3 tries: the score depends on counters that a parallel request could change.
    for (let attempt = 0; attempt < 3; attempt++) {
      const prog = (attempt === 0 ? progressRows ?? [] : (await db.from('player_level_progress').select('*').eq('player_session_id', ps.id)).data ?? []).find(
        (r: any) => r.level_id === level.id,
      );
      const failed = prog?.failed_attempts ?? 0;
      const hints = prog?.hints_used ?? 0;
      const startedAt = new Date(prog?.started_at ?? ps.started_at).getTime();
      const elapsedMs = Math.max(0, Date.now() - startedAt);
      const levelLimit = level.time_limit_seconds ?? cfg.settings.level_timer_seconds;
      const breakdown = computeMissionScore({
        rules: cfg.settings.score_rules,
        level,
        hintsUsed: hints,
        failedAttempts: failed,
        elapsedMs,
        levelTimeLimitSeconds: levelLimit,
      });

      const { data, error } = await db.rpc('apply_submission', {
        p_player_session_id: ps.id,
        p_level_id: level.id,
        p_client_submission_id: body.client_submission_id,
        p_program: Array.isArray(body.program) ? body.program : [],
        p_result: { success: result.success, failure: result.failure ?? null, objectives: result.objectives, steps: result.steps_executed },
        p_status: status,
        p_score: breakdown.total,
        p_breakdown: breakdown,
        p_elapsed_ms: elapsedMs,
        p_expected_failed: failed,
        p_expected_hints: hints,
        p_bonus_seconds: result.success ? cfg.settings.bonus_seconds_per_level : 0,
        p_total_levels: cfg.levels.length,
      });
      if (error) {
        console.error('apply_submission failed', error);
        throw new HttpError(500, 'SUBMIT_FAILED');
      }
      const applied = data as any;
      if (!applied.accepted && applied.reason === 'RETRY') continue;
      if (!applied.accepted) {
        return { accepted: false, reason: applied.reason, player_status: applied.reason === 'TIME_EXPIRED' ? 'TIME_EXPIRED' : undefined };
      }
      if (applied.duplicate) {
        // Same client_submission_id replayed: return the stored outcome, replay the trace, change nothing.
        return {
          accepted: true,
          duplicate: true,
          status: applied.status,
          result,
          score: { awarded: 0, total: applied.total_score },
          levels_completed: applied.levels_completed,
          hearts_remaining: applied.hearts_remaining,
          out_of_hearts: Boolean(applied.out_of_hearts),
          server_now: new Date().toISOString(),
        };
      }

      const events: NewEvent[] = [];
      const base = { player_id: player.id, session_id: player.game_session_id };
      const level_index = cfg.levels.findIndex((l) => l.id === level.id) + 1;
      if (result.success) {
        events.push({ type: 'PLAYER_COMPILE_SUCCESS', ...base, payload: { level_index, level_code: level.code, animation: level.completion_animation, steps: result.steps_executed } });
        if (applied.score_awarded > 0 || !applied.already_completed) {
          events.push({
            type: 'PLAYER_LEVEL_COMPLETED',
            ...base,
            payload: { level_index, total_levels: cfg.levels.length, score_awarded: applied.score_awarded, score: applied.total_score, levels_completed: applied.levels_completed, name: player.display_name },
          });
        }
        if (applied.finished) {
          events.push({ type: 'PLAYER_FINISHED', ...base, payload: { reason: 'ALL_LEVELS', score: applied.total_score, levels_completed: applied.levels_completed, name: player.display_name } });
        }
      } else {
        events.push({ type: 'PLAYER_COMPILE_FAILED', ...base, payload: { level_index, code: result.failure?.code ?? 'UNKNOWN' } });
        if (applied.out_of_hearts) {
          events.push({
            type: 'PLAYER_FINISHED',
            ...base,
            payload: {
              reason: 'OUT_OF_HEARTS',
              score: applied.total_score,
              levels_completed: applied.levels_completed,
              name: player.display_name,
            },
          });
        }
      }
      await emitEvents(events);

      return {
        accepted: true,
        duplicate: false,
        status,
        result,
        score: { awarded: applied.score_awarded, total: applied.total_score, breakdown: applied.score_awarded > 0 ? breakdown : null },
        already_completed: applied.already_completed,
        levels_completed: applied.levels_completed,
        player_status: applied.player_status,
        expires_at: applied.expires_at,
        finished: applied.finished,
        out_of_hearts: Boolean(applied.out_of_hearts),
        hearts_remaining: applied.hearts_remaining,
        server_now: new Date().toISOString(),
      };
    }
    throw new HttpError(409, 'CONFLICT', 'Please try again');
  }),
);
