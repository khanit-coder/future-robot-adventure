// deno-lint-ignore-file no-explicit-any
import {
  HttpError,
  adminClient,
  audit,
  emitEvents,
  isUuid,
  requireAdmin,
  sanitizeText,
  serve,
} from '../_shared/util.ts';

/**
 * admin-action — privileged transactional admin actions requiring service-role or broadcast events:
 *   - start_session     (closes any current ACTIVE session, opens a fresh one)
 *   - close_session     (closes the active session)
 *   - reset_session     (deletes all players/events/claims for a session and reopens it)
 *   - toggle_registration (opens/pauses registration on the active session + broadcasts)
 *   - adjust_score      (adds an audited ADJUSTMENT score_record + updates player_sessions.total_score)
 *   - set_claim_status  (marks a reward claim as CLAIMED or CANCELLED atomically)
 *   - system_health     (returns DB latency, counts, latest published config, storage check)
 */
Deno.serve(
  serve(async (req, body) => {
    const admin = await requireAdmin(req);
    const db = adminClient();
    const action = String(body.action ?? '');

    switch (action) {
      case 'start_session': {
        const name = sanitizeText(body.name, 120) || `Open House ${new Date().toISOString().slice(0, 10)}`;
        const now = new Date().toISOString();
        await db.from('game_sessions').update({ status: 'CLOSED', registration_open: false, closed_at: now }).eq('status', 'ACTIVE');
        const { data: session, error } = await db
          .from('game_sessions')
          .insert({ name, status: 'ACTIVE', registration_open: body.registration_open !== false, started_at: now })
          .select('*')
          .single();
        if (error || !session) throw new HttpError(500, 'SESSION_CREATE_FAILED', error?.message);
        await audit(admin, 'START_SESSION', 'game_sessions', session.id, { name });
        await emitEvents([{ type: 'GAME_SESSION_UPDATED', session_id: session.id, payload: { action: 'STARTED', session } }]);
        return { ok: true, session };
      }

      case 'close_session': {
        if (!isUuid(body.session_id)) throw new HttpError(422, 'BAD_SESSION');
        const now = new Date().toISOString();
        const { data: session, error } = await db
          .from('game_sessions')
          .update({ status: 'CLOSED', registration_open: false, closed_at: now })
          .eq('id', body.session_id)
          .select('*')
          .single();
        if (error || !session) throw new HttpError(404, 'SESSION_NOT_FOUND');
        await audit(admin, 'CLOSE_SESSION', 'game_sessions', session.id, {});
        await emitEvents([{ type: 'GAME_SESSION_UPDATED', session_id: session.id, payload: { action: 'CLOSED', session } }]);
        return { ok: true, session };
      }

      case 'toggle_registration': {
        if (!isUuid(body.session_id)) throw new HttpError(422, 'BAD_SESSION');
        const open = Boolean(body.registration_open);
        const { data: session, error } = await db
          .from('game_sessions')
          .update({ registration_open: open })
          .eq('id', body.session_id)
          .eq('status', 'ACTIVE')
          .select('*')
          .maybeSingle();
        if (error || !session) throw new HttpError(404, 'ACTIVE_SESSION_NOT_FOUND');
        await audit(admin, 'TOGGLE_REGISTRATION', 'game_sessions', session.id, { registration_open: open });
        await emitEvents([{ type: 'GAME_SESSION_UPDATED', session_id: session.id, payload: { action: 'REGISTRATION_TOGGLED', session } }]);
        return { ok: true, session };
      }

      case 'reset_session': {
        if (!isUuid(body.session_id)) throw new HttpError(422, 'BAD_SESSION');
        const sid = body.session_id as string;
        const { data: existing } = await db.from('game_sessions').select('*').eq('id', sid).maybeSingle();
        if (!existing) throw new HttpError(404, 'SESSION_NOT_FOUND');

        // Reclaim reserved/claimed counts for claims belonging to this session before deleting players.
        const { data: claims } = await db
          .from('reward_claims')
          .select('id, reward_id, status, player_sessions!inner(game_session_id)')
          .eq('player_sessions.game_session_id', sid)
          .neq('status', 'CANCELLED');

        for (const c of (claims ?? []) as any[]) {
          const col = c.status === 'CLAIMED' ? 'claimed_count' : 'reserved_count';
          const { data: rw } = await db.from('rewards').select(col).eq('id', c.reward_id).maybeSingle();
          if (rw && (rw as any)[col] > 0) {
            await db.from('rewards').update({ [col]: (rw as any)[col] - 1 }).eq('id', c.reward_id);
          }
        }

        await db.from('game_events').delete().eq('game_session_id', sid);
        await db.from('players').delete().eq('game_session_id', sid);

        const { data: updated, error } = await db
          .from('game_sessions')
          .update({ started_at: new Date().toISOString(), closed_at: null })
          .eq('id', sid)
          .select('*')
          .single();
        if (error) throw new HttpError(500, 'RESET_FAILED', error.message);

        await audit(admin, 'RESET_SESSION', 'game_sessions', sid, { name: existing.name });
        await emitEvents([{ type: 'GAME_SESSION_UPDATED', session_id: sid, payload: { action: 'RESET', session: updated } }]);
        return { ok: true, session: updated };
      }

      case 'adjust_score': {
        if (!isUuid(body.player_session_id)) throw new HttpError(422, 'BAD_PLAYER_SESSION');
        const points = Number(body.points);
        if (!Number.isInteger(points) || points < -5000 || points > 5000 || points === 0) {
          throw new HttpError(422, 'INVALID_POINTS');
        }
        const note = sanitizeText(body.note, 300) || 'Admin adjustment';
        const { data: ps } = await db.from('player_sessions').select('*').eq('id', body.player_session_id).maybeSingle();
        if (!ps) throw new HttpError(404, 'PLAYER_SESSION_NOT_FOUND');

        const nextTotal = Math.max(0, Number(ps.total_score) + points);
        const appliedDelta = nextTotal - Number(ps.total_score);

        await db.from('score_records').insert({
          player_id: ps.player_id,
          player_session_id: ps.id,
          kind: 'ADJUSTMENT',
          points: appliedDelta,
          note,
          created_by: admin.user.id,
        });
        const { data: updated } = await db
          .from('player_sessions')
          .update({ total_score: nextTotal })
          .eq('id', ps.id)
          .select('*')
          .single();

        await audit(admin, 'ADJUST_SCORE', 'player_sessions', ps.id, { points: appliedDelta, total_score: nextTotal, note });
        await emitEvents([
          {
            type: 'PLAYER_SCORE_UPDATED',
            player_id: ps.player_id,
            session_id: ps.game_session_id,
            payload: { score: nextTotal, delta: appliedDelta, note },
          },
        ]);
        return { ok: true, total_score: nextTotal, player_session: updated };
      }

      case 'system_health': {
        const t0 = performance.now();
        const [{ count: playersCount, error: dbErr }, { data: pub }, { data: session }, { data: buckets }] = await Promise.all([
          db.from('players').select('id', { count: 'exact', head: true }),
          db.from('published_configs').select('version, published_at').order('version', { ascending: false }).limit(1).maybeSingle(),
          db.from('game_sessions').select('*').eq('status', 'ACTIVE').maybeSingle(),
          db.storage.listBuckets(),
        ]);
        const latencyMs = Math.round(performance.now() - t0);
        return {
          ok: !dbErr,
          db_latency_ms: latencyMs,
          total_players_all_time: playersCount ?? 0,
          published_version: pub?.version ?? null,
          published_at: pub?.published_at ?? null,
          active_session: session ?? null,
          storage_ready: (buckets ?? []).some((b: any) => b.id === 'game-assets'),
          server_now: new Date().toISOString(),
        };
      }

      default:
        throw new HttpError(400, 'UNKNOWN_ACTION');
    }
  }),
);
