// deno-lint-ignore-file no-explicit-any
import { HttpError, adminClient, emitEvents } from './util.ts';

export interface PlayerContext {
  player: any;
  ps: any;
  session: any;
}

/** Find the caller's player, player-session and event session. */
export async function loadPlayerContext(userId: string): Promise<PlayerContext> {
  const db = adminClient();
  const { data: player } = await db
    .from('players')
    .select('*')
    .eq('auth_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!player) throw new HttpError(404, 'NOT_REGISTERED');
  const [{ data: ps }, { data: session }] = await Promise.all([
    db.from('player_sessions').select('*').eq('player_id', player.id).maybeSingle(),
    db.from('game_sessions').select('*').eq('id', player.game_session_id).maybeSingle(),
  ]);
  if (!ps || !session) throw new HttpError(404, 'NOT_REGISTERED');
  return { player, ps, session };
}

/**
 * Server-authoritative expiry. If the player's clock has run out, flip them to TIME_EXPIRED exactly once
 * (the conditional update guarantees a single event) and return the fresh row.
 */
export async function expireIfNeeded(ctx: PlayerContext): Promise<PlayerContext> {
  const { ps, player } = ctx;
  if (ps.status !== 'PLAYING' || !ps.expires_at) return ctx;
  if (Date.now() <= new Date(ps.expires_at).getTime()) return ctx;
  const db = adminClient();
  const { data } = await db
    .from('player_sessions')
    .update({ status: 'TIME_EXPIRED', finished_at: ps.expires_at })
    .eq('id', ps.id)
    .eq('status', 'PLAYING')
    .select('*')
    .maybeSingle();
  if (data) {
    await emitEvents([
      {
        type: 'PLAYER_FINISHED',
        player_id: player.id,
        session_id: player.game_session_id,
        payload: { reason: 'TIME_EXPIRED', score: data.total_score, levels_completed: data.levels_completed },
      },
    ]);
    return { ...ctx, ps: data };
  }
  const { data: fresh } = await db.from('player_sessions').select('*').eq('id', ps.id).single();
  return { ...ctx, ps: fresh ?? ps };
}
