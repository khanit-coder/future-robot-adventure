// deno-lint-ignore-file no-explicit-any
import { isLevelUnlocked } from '../_shared/engine/scoring.ts';
import { loadPlayerContext, expireIfNeeded } from '../_shared/player.ts';
import type { PlayerContext } from '../_shared/player.ts';
import {
  HttpError,
  adminClient,
  emitEvents,
  isUuid,
  latestConfigVersion,
  loadConfig,
  publicConfig,
  rateLimit,
  requireUser,
  serve,
} from '../_shared/util.ts';

/**
 * player-action — every state transition a player can perform besides submitting a solution.
 * The client never writes to the database directly; it only asks this function.
 */
Deno.serve(
  serve(async (req, body) => {
    const user = await requireUser(req);
    const action = String(body.action ?? '');
    await rateLimit(`player-action:${user.id}`, 240, 60);

    let ctx = await loadPlayerContext(user.id);
    ctx = await expireIfNeeded(ctx);
    const db = adminClient();

    switch (action) {
      case 'get_state':
        return await getState(ctx);

      case 'get_config': {
        const cfg = await loadConfig(ctx.ps.config_version);
        return { config: publicConfig(cfg), latest_version: await latestConfigVersion() };
      }

      case 'set_language': {
        const lang = body.lang === 'en' ? 'en' : 'th';
        await db.from('players').update({ lang }).eq('id', ctx.player.id);
        return { ok: true };
      }

      case 'lessons_started': {
        if (ctx.ps.status === 'REGISTERED') {
          await db.from('player_sessions').update({ status: 'LEARNING', last_seen_at: new Date().toISOString() }).eq('id', ctx.ps.id).eq('status', 'REGISTERED');
          await emitEvents([{ type: 'PLAYER_LESSON_PROGRESS', player_id: ctx.player.id, session_id: ctx.player.game_session_id, payload: { lesson_index: 0, started: true } }]);
        }
        return { ok: true };
      }

      case 'complete_lesson': {
        requireOpen(ctx);
        if (!isUuid(body.lesson_id)) throw new HttpError(422, 'BAD_LESSON');
        const cfg = await loadConfig(ctx.ps.config_version);
        const idx = cfg.lessons.findIndex((l) => l.id === body.lesson_id);
        if (idx < 0) throw new HttpError(404, 'LESSON_NOT_FOUND');
        await db.from('lesson_progress').upsert({ player_session_id: ctx.ps.id, lesson_id: body.lesson_id }, { onConflict: 'player_session_id,lesson_id', ignoreDuplicates: true });
        const { count } = await db.from('lesson_progress').select('id', { count: 'exact', head: true }).eq('player_session_id', ctx.ps.id);
        const patch: any = { lessons_completed: count ?? 0, last_seen_at: new Date().toISOString() };
        if (ctx.ps.status === 'REGISTERED') patch.status = 'LEARNING';
        await db.from('player_sessions').update(patch).eq('id', ctx.ps.id);
        await emitEvents([
          {
            type: 'PLAYER_LESSON_PROGRESS',
            player_id: ctx.player.id,
            session_id: ctx.player.game_session_id,
            payload: { lesson_index: idx + 1, total: cfg.lessons.length },
          },
        ]);
        return { ok: true, lessons_completed: count ?? 0 };
      }

      case 'start_game': {
        requireOpen(ctx);
        if (ctx.ps.status === 'PLAYING' || ctx.ps.status === 'FINISHED' || ctx.ps.status === 'TIME_EXPIRED') {
          return await getState(ctx);
        }
        const cfg = await loadConfig(ctx.ps.config_version);
        const s = cfg.settings;
        if (s.lessons_mandatory && cfg.lessons.length > 0 && !(body.skip === true && s.allow_skip_lessons)) {
          const { data: done } = await db.from('lesson_progress').select('lesson_id').eq('player_session_id', ctx.ps.id);
          const doneIds = new Set((done ?? []).map((d: any) => d.lesson_id));
          if (!cfg.lessons.every((l) => doneIds.has(l.id))) throw new HttpError(409, 'LESSONS_REQUIRED');
        }
        const now = new Date();
        const expires = s.timer_enabled ? new Date(now.getTime() + s.total_duration_seconds * 1000).toISOString() : null;
        const { data: started } = await db
          .from('player_sessions')
          .update({ status: 'PLAYING', started_at: now.toISOString(), expires_at: expires, last_seen_at: now.toISOString() })
          .eq('id', ctx.ps.id)
          .in('status', ['REGISTERED', 'LEARNING'])
          .select('*')
          .maybeSingle();
        if (started) {
          await emitEvents([{ type: 'PLAYER_STARTED', player_id: ctx.player.id, session_id: ctx.player.game_session_id, payload: { name: ctx.player.display_name } }]);
        }
        const fresh = await loadPlayerContext(user.id);
        return await getState(fresh);
      }

      case 'start_level': {
        requireOpen(ctx);
        requirePlaying(ctx);
        const cfg = await loadConfig(ctx.ps.config_version);
        const level = cfg.levels.find((l) => l.id === body.level_id);
        if (!level) throw new HttpError(404, 'LEVEL_NOT_FOUND');
        const { data: rows } = await db.from('player_level_progress').select('*').eq('player_session_id', ctx.ps.id);
        const completed = new Set((rows ?? []).filter((r: any) => r.status === 'COMPLETED').map((r: any) => r.level_id));
        if (!isLevelUnlocked(level, cfg.levels, { completedLevelIds: completed, totalScore: ctx.ps.total_score })) {
          throw new HttpError(403, 'LEVEL_LOCKED');
        }
        await db.from('player_level_progress').upsert({ player_session_id: ctx.ps.id, level_id: level.id }, { onConflict: 'player_session_id,level_id', ignoreDuplicates: true });
        await db.from('player_sessions').update({ current_level_id: level.id, last_seen_at: new Date().toISOString() }).eq('id', ctx.ps.id);
        const { data: prog } = await db.from('player_level_progress').select('*').eq('player_session_id', ctx.ps.id).eq('level_id', level.id).single();
        return { progress: prog, server_now: new Date().toISOString() };
      }

      case 'get_hints':
      case 'use_hint': {
        requireOpen(ctx);
        requirePlaying(ctx);
        const cfg = await loadConfig(ctx.ps.config_version);
        const level = cfg.levels.find((l) => l.id === body.level_id);
        if (!level) throw new HttpError(404, 'LEVEL_NOT_FOUND');
        const hints = [...level.hints].sort((a, b) => a.position - b.position);
        await db.from('player_level_progress').upsert({ player_session_id: ctx.ps.id, level_id: level.id }, { onConflict: 'player_session_id,level_id', ignoreDuplicates: true });
        let { data: prog } = await db.from('player_level_progress').select('*').eq('player_session_id', ctx.ps.id).eq('level_id', level.id).single();
        let penalty = 0;
        if (action === 'use_hint' && prog.hints_used < hints.length) {
          const free = prog.status === 'COMPLETED';
          if (free) {
            // Hints after completion cost nothing and do not change the score.
          } else {
            const { data: bumped } = await db
              .from('player_level_progress')
              .update({ hints_used: prog.hints_used + 1 })
              .eq('id', prog.id)
              .eq('hints_used', prog.hints_used)
              .select('*')
              .maybeSingle();
            if (bumped) {
              prog = bumped;
              penalty = cfg.settings.score_rules.hint_penalty;
              const { data: all } = await db.from('player_level_progress').select('hints_used').eq('player_session_id', ctx.ps.id);
              await db.from('player_sessions').update({ hints_used: (all ?? []).reduce((n: number, r: any) => n + r.hints_used, 0) }).eq('id', ctx.ps.id);
            }
          }
        }
        const revealed = Math.min(prog.status === 'COMPLETED' && action === 'use_hint' ? hints.length : prog.hints_used, hints.length);
        return {
          hints: hints.slice(0, revealed).map((h) => h.text),
          hints_used: prog.hints_used,
          hints_total: hints.length,
          penalty,
        };
      }

      case 'finish_game': {
        if (ctx.ps.status === 'PLAYING') {
          const { data } = await db
            .from('player_sessions')
            .update({ status: 'FINISHED', finished_at: new Date().toISOString() })
            .eq('id', ctx.ps.id)
            .eq('status', 'PLAYING')
            .select('*')
            .maybeSingle();
          if (data) {
            await emitEvents([
              {
                type: 'PLAYER_FINISHED',
                player_id: ctx.player.id,
                session_id: ctx.player.game_session_id,
                payload: { reason: 'MANUAL', score: data.total_score, levels_completed: data.levels_completed },
              },
            ]);
          }
        }
        return await getState(await loadPlayerContext(user.id));
      }

      default:
        throw new HttpError(400, 'UNKNOWN_ACTION');
    }
  }),
);

function requireOpen(ctx: PlayerContext) {
  if (ctx.session.status !== 'ACTIVE') throw new HttpError(403, 'SESSION_CLOSED');
}

function requirePlaying(ctx: PlayerContext) {
  if (ctx.ps.status === 'TIME_EXPIRED') throw new HttpError(403, 'TIME_EXPIRED');
  if (ctx.ps.status !== 'PLAYING') throw new HttpError(409, 'NOT_PLAYING');
}

async function getState(ctx: PlayerContext) {
  const db = adminClient();
  await db.from('player_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', ctx.ps.id);
  const [{ data: progress }, { data: lessons }, { data: claim }] = await Promise.all([
    db.from('player_level_progress').select('*').eq('player_session_id', ctx.ps.id),
    db.from('lesson_progress').select('lesson_id').eq('player_session_id', ctx.ps.id),
    db.from('reward_claims').select('id, reward_id, claim_code, status').eq('player_id', ctx.player.id).neq('status', 'CANCELLED').maybeSingle(),
  ]);
  const { data: fresh } = await db.from('player_sessions').select('*').eq('id', ctx.ps.id).single();
  return {
    server_now: new Date().toISOString(),
    player: ctx.player,
    player_session: fresh ?? ctx.ps,
    session: ctx.session,
    progress: progress ?? [],
    lessons_done: (lessons ?? []).map((l: any) => l.lesson_id),
    claim: claim ?? null,
    latest_version: await latestConfigVersion(),
  };
}
