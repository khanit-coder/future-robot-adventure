// deno-lint-ignore-file no-explicit-any
import { HttpError, adminClient, clientIp, emitEvents, latestConfigVersion, loadConfig, publicConfig, rateLimit, requireUser, sanitizeText, serve } from '../_shared/util.ts';

/**
 * register-player
 * Creates the player + player_session for the caller's (anonymous) auth identity.
 * Idempotent: a second call for the same identity in the same event session returns the existing player,
 * which protects against double clicks and lets a returning browser recover.
 */
Deno.serve(
  serve(async (req, body) => {
    const user = await requireUser(req);
    const db = adminClient();

    const display_name = sanitizeText(body.display_name, 40);
    const school = sanitizeText(body.school, 80);
    const gradeRaw = sanitizeText(body.grade, 20);
    const lang = body.lang === 'en' ? 'en' : 'th';

    const fields: Record<string, string> = {};
    if (display_name.length < 1) fields.display_name = 'REQUIRED';
    if (school.length < 1) fields.school = 'REQUIRED';
    if (Object.keys(fields).length > 0) throw new HttpError(422, 'VALIDATION', 'Missing required fields', { fields });

    await rateLimit(`register:user:${user.id}`, 10, 60);
    await rateLimit(`register:ip:${clientIp(req)}`, 300, 60);

    const [{ data: settings }, { data: session }] = await Promise.all([
      db.from('game_settings').select('maintenance_mode').maybeSingle(),
      db.from('game_sessions').select('*').eq('status', 'ACTIVE').maybeSingle(),
    ]);
    if (settings?.maintenance_mode) throw new HttpError(503, 'MAINTENANCE');
    if (!session) throw new HttpError(409, 'NO_ACTIVE_SESSION');

    // Returning player (same browser identity)?
    const { data: existing } = await db
      .from('players')
      .select('*, player_sessions(*)')
      .eq('game_session_id', session.id)
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (existing) {
      const { player_sessions, ...player } = existing as any;
      const ps = Array.isArray(player_sessions) ? player_sessions[0] : player_sessions;
      const version = await latestConfigVersion();
      const cfg = await loadConfig(ps?.config_version ?? version);
      return {
        player,
        player_session: ps,
        session,
        config: publicConfig(cfg),
        latest_version: version,
        server_now: new Date().toISOString(),
        existing: true,
        is_returning_player: true,
      };
    }

    if (!session.registration_open) throw new HttpError(403, 'REGISTRATION_CLOSED');

    // Check if this student (same display_name, school, and grade/room) has registered before
    let priorQuery = db
      .from('players')
      .select('id', { count: 'exact', head: true })
      .ilike('display_name', display_name)
      .ilike('school', school);
    if (gradeRaw) {
      priorQuery = priorQuery.ilike('grade', gradeRaw);
    } else {
      priorQuery = priorQuery.is('grade', null);
    }

    const [{ count: priorCount }, version] = await Promise.all([
      priorQuery,
      latestConfigVersion(),
    ]);
    const isReturningPlayer = (priorCount ?? 0) > 0;
    const cfg = await loadConfig(version);
    const { data: player, error } = await db
      .from('players')
      .insert({ game_session_id: session.id, auth_user_id: user.id, display_name, school, grade: gradeRaw || null, lang })
      .select('*')
      .single();
    if (error) {
      if ((error as any).code === '23505') {
        // lost a race with a parallel identical request: return the winner
        const { data: again } = await db
          .from('players')
          .select('*, player_sessions(*)')
          .eq('game_session_id', session.id)
          .eq('auth_user_id', user.id)
          .single();
        const { player_sessions, ...p } = again as any;
        return {
          player: p,
          player_session: Array.isArray(player_sessions) ? player_sessions[0] : player_sessions,
          session,
          config: publicConfig(cfg),
          latest_version: version,
          server_now: new Date().toISOString(),
          existing: true,
        };
      }
      console.error(error);
      throw new HttpError(500, 'REGISTER_FAILED');
    }

    const { data: ps, error: psErr } = await db
      .from('player_sessions')
      .insert({ player_id: player.id, game_session_id: session.id, config_version: version })
      .select('*')
      .single();
    if (psErr) {
      await db.from('players').delete().eq('id', player.id);
      console.error(psErr);
      throw new HttpError(500, 'REGISTER_FAILED');
    }

    await emitEvents([
      {
        type: 'PLAYER_JOINED',
        player_id: player.id,
        session_id: session.id,
        payload: { name: player.display_name, school: player.school },
      },
    ]);

    return {
      player,
      player_session: ps,
      session,
      config: publicConfig(cfg),
      latest_version: version,
      server_now: new Date().toISOString(),
      existing: false,
      is_returning_player: isReturningPlayer,
    };
  }),
);
