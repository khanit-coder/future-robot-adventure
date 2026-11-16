// deno-lint-ignore-file no-explicit-any
import { loadPlayerContext, expireIfNeeded } from '../_shared/player.ts';
import { HttpError, adminClient, isUuid, rateLimit, requireUser, serve } from '../_shared/util.ts';

/**
 * claim-reward — reserves one reward for the caller using the atomic reserve_reward() SQL function.
 * Inventory can never go negative (CHECK constraint + row lock) and a player can only hold one active claim.
 */
Deno.serve(
  serve(async (req, body) => {
    const user = await requireUser(req);
    await rateLimit(`claim:${user.id}`, 20, 60);
    if (!isUuid(body.reward_id)) throw new HttpError(422, 'BAD_REWARD');

    let ctx = await loadPlayerContext(user.id);
    ctx = await expireIfNeeded(ctx);

    const { data, error } = await adminClient().rpc('reserve_reward', {
      p_player_session_id: ctx.ps.id,
      p_reward_id: body.reward_id,
    });
    if (error) {
      console.error('reserve_reward failed', error);
      throw new HttpError(500, 'CLAIM_FAILED');
    }
    return data;
  }),
);
