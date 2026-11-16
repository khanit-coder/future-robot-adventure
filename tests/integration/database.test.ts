import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
const readSql = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('PostgreSQL migrations, seed, transactions & RLS (PGlite)', () => {
  let db: PGlite;
  let activeSessionId: string;
  const adminUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const student1AuthId = '11111111-1111-4111-8111-111111111111';
  const student2AuthId = '22222222-2222-4222-8222-222222222222';
  let player1SessionId: string;
  let player2SessionId: string;
  let level1Id: string;
  let level2Id: string;

  beforeAll(async () => {
    db = new PGlite();

    // Stub Supabase-provided roles & schemas (`auth`, `storage`) inside PGlite.
    await db.exec(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
      end $$;
      grant usage on schema public to anon, authenticated, service_role;

      create schema if not exists auth;
      create table auth.users (
        id uuid primary key,
        email text
      );
      create or replace function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      create schema if not exists storage;
      create table storage.buckets (
        id text primary key,
        name text,
        public boolean,
        file_size_limit integer,
        allowed_mime_types text[]
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text,
        name text
      );

      insert into auth.users (id, email) values
        ('${adminUserId}', 'admin@college.ac.th'),
        ('${student1AuthId}', null),
        ('${student2AuthId}', null);
    `);

    await db.exec(readSql('supabase/migrations/20260101000000_schema.sql'));
    await db.exec(readSql('supabase/migrations/20260101000100_functions.sql'));
    await db.exec(readSql('supabase/migrations/20260101000150_snapshot_version.sql'));
    await db.exec(readSql('supabase/migrations/20260101000200_rls.sql'));
    await db.exec(readSql('supabase/seed.sql'));

    // Register an admin user and two sample players
    await db.query(
      `insert into public.admins (user_id, email, role) values ($1, 'admin@college.ac.th', 'SUPER_ADMIN')`,
      [adminUserId],
    );
    const sess = await db.query<{ id: string }>(
      `select id from public.game_sessions where status = 'ACTIVE'`,
    );
    activeSessionId = sess.rows[0].id;

    const lvls = await db.query<{ id: string }>(`select id from public.levels order by position limit 2`);
    level1Id = lvls.rows[0].id;
    level2Id = lvls.rows[1].id;

    const p1 = await db.query<{ id: string }>(
      `insert into public.players (game_session_id, auth_user_id, display_name, school, lang)
       values ($1, $2, 'Tonkla', 'Demo School', 'th') returning id`,
      [activeSessionId, student1AuthId],
    );
    const p2 = await db.query<{ id: string }>(
      `insert into public.players (game_session_id, auth_user_id, display_name, school, lang)
       values ($1, $2, 'Mint', 'Science High', 'en') returning id`,
      [activeSessionId, student2AuthId],
    );

    const ps1 = await db.query<{ id: string }>(
      `insert into public.player_sessions (player_id, game_session_id, config_version, status, started_at, expires_at)
       values ($1, $2, 1, 'PLAYING', now() - interval '10 seconds', now() + interval '15 minutes') returning id`,
      [p1.rows[0].id, activeSessionId],
    );
    const ps2 = await db.query<{ id: string }>(
      `insert into public.player_sessions (player_id, game_session_id, config_version, status, started_at, expires_at)
       values ($1, $2, 1, 'PLAYING', now() - interval '10 seconds', now() + interval '15 minutes') returning id`,
      [p2.rows[0].id, activeSessionId],
    );
    player1SessionId = ps1.rows[0].id;
    player2SessionId = ps2.rows[0].id;
  });

  it('loads seed content accurately', async () => {
    const counts = await db.query<{
      worlds: string;
      levels: string;
      lessons: string;
      blocks: string;
      rewards: string;
    }>(`
      select
        (select count(*) from public.worlds)::text as worlds,
        (select count(*) from public.levels)::text as levels,
        (select count(*) from public.lessons)::text as lessons,
        (select count(*) from public.block_definitions)::text as blocks,
        (select count(*) from public.rewards)::text as rewards
    `);
    expect(counts.rows[0]).toEqual({
      worlds: '4',
      levels: '10',
      lessons: '7',
      blocks: '11',
      rewards: '3',
    });

    const pub = await db.query<{ version: number; snap_version: string }>(
      `select version, snapshot->>'version' as snap_version from public.published_configs order by version desc limit 1`,
    );
    expect(pub.rows[0].version).toBe(1);
    expect(pub.rows[0].snap_version).toBe('1');
  });

  it('apply_submission prevents duplicate submissions and double mission scoring', async () => {
    const subId = '33333333-3333-4333-8333-333333333333';
    const first = await db.query<{ res: Record<string, unknown> }>(
      `select public.apply_submission($1, $2, $3, '[{"type":"MOVE_FORWARD","steps":6}]'::jsonb, '{"success":true}'::jsonb, 'SUCCESS', 200, '{"total":200}'::jsonb, 10000, 0, 0, 0, 10) as res`,
      [player1SessionId, level1Id, subId],
    );
    expect(first.rows[0].res).toMatchObject({
      accepted: true,
      duplicate: false,
      score_awarded: 200,
      total_score: 200,
      levels_completed: 1,
    });

    // Replaying exact same client_submission_id must be idempotent
    const replay = await db.query<{ res: Record<string, unknown> }>(
      `select public.apply_submission($1, $2, $3, '[{"type":"MOVE_FORWARD","steps":6}]'::jsonb, '{"success":true}'::jsonb, 'SUCCESS', 200, '{"total":200}'::jsonb, 10000, 0, 0, 0, 10) as res`,
      [player1SessionId, level1Id, subId],
    );
    expect(replay.rows[0].res).toMatchObject({
      accepted: true,
      duplicate: true,
      score_awarded: 0,
      total_score: 200,
    });

    // Submitting a different submission for the already-solved mission awards 0 extra points
    const secondSub = '44444444-4444-4444-8444-444444444444';
    const again = await db.query<{ res: Record<string, unknown> }>(
      `select public.apply_submission($1, $2, $3, '[{"type":"MOVE_FORWARD","steps":6}]'::jsonb, '{"success":true}'::jsonb, 'SUCCESS', 200, '{"total":200}'::jsonb, 5000, 0, 0, 0, 10) as res`,
      [player1SessionId, level1Id, secondSub],
    );
    expect(again.rows[0].res).toMatchObject({
      accepted: true,
      score_awarded: 0,
      already_completed: true,
      total_score: 200,
    });
  });

  it('apply_submission rejects expired sessions and marks TIME_EXPIRED', async () => {
    await db.query(
      `update public.player_sessions set expires_at = now() - interval '1 second' where id = $1`,
      [player2SessionId],
    );
    const res = await db.query<{ res: Record<string, unknown> }>(
      `select public.apply_submission($1, $2, '55555555-5555-4555-8555-555555555555', '[]'::jsonb, '{}'::jsonb, 'SUCCESS', 100, '{}'::jsonb, 1000, 0, 0, 0, 10) as res`,
      [player2SessionId, level2Id],
    );
    expect(res.rows[0].res).toEqual({ accepted: false, reason: 'TIME_EXPIRED' });

    const st = await db.query<{ status: string }>(`select status from public.player_sessions where id = $1`, [
      player2SessionId,
    ]);
    expect(st.rows[0].status).toBe('TIME_EXPIRED');
  });

  it('apply_submission deducts from 5 total hearts and ends the game when all 5 hearts are lost', async () => {
    for (let i = 1; i <= 5; i++) {
      const failSubId = `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`;
      const res = await db.query<{ res: Record<string, unknown> }>(
        `select public.apply_submission($1, $2, $3, '[{"type":"MOVE_FORWARD","steps":1}]'::jsonb, '{"success":false}'::jsonb, 'FAILED', 0, '{}'::jsonb, 1000, $4, 0, 0, 10) as res`,
        [player1SessionId, level2Id, failSubId, i - 1],
      );
      expect(res.rows[0].res).toMatchObject({
        accepted: true,
        status: 'FAILED',
        hearts_remaining: 5 - i,
        out_of_hearts: i === 5,
        finished: i === 5,
        player_status: i === 5 ? 'FINISHED' : 'PLAYING',
      });
    }
  });

  it('reserve_reward enforces stock limits atomically and prevents negative inventory', async () => {
    // Give both players enough score and mark player 1 FINISHED (player 2 is already TIME_EXPIRED)
    await db.query(`update public.player_sessions set status = 'FINISHED', total_score = 500 where id = $1`, [
      player1SessionId,
    ]);
    await db.query(`update public.player_sessions set total_score = 500 where id = $1`, [player2SessionId]);

    // Create a scarce reward with stock = 1
    const rw = await db.query<{ id: string }>(
      `insert into public.rewards (position, name, description, min_score, stock_total)
       values (99, '{"en":"Scarce Pin"}'::jsonb, '{}'::jsonb, 300, 1) returning id`,
    );
    const rewardId = rw.rows[0].id;

    // Simulate concurrent claims from two eligible players
    const [r1, r2] = await Promise.all([
      db.query<{ res: Record<string, unknown> }>(`select public.reserve_reward($1, $2) as res`, [
        player1SessionId,
        rewardId,
      ]),
      db.query<{ res: Record<string, unknown> }>(`select public.reserve_reward($1, $2) as res`, [
        player2SessionId,
        rewardId,
      ]),
    ]);
    const results = [r1.rows[0].res, r2.rows[0].res];
    expect(results.filter((x) => x.ok === true)).toHaveLength(1);
    expect(results.filter((x) => x.reason === 'OUT_OF_STOCK')).toHaveLength(1);

    const inv = await db.query<{ reserved_count: number; claimed_count: number; stock_total: number }>(
      `select reserved_count, claimed_count, stock_total from public.rewards where id = $1`,
      [rewardId],
    );
    expect(inv.rows[0]).toEqual({ reserved_count: 1, claimed_count: 0, stock_total: 1 });

    // Admin marks claim CLAIMED
    const winner = results.find((x) => x.ok === true)!;
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [adminUserId]);
    const claimed = await db.query<{ res: Record<string, unknown> }>(
      `select public.set_claim_status($1, 'CLAIMED') as res`,
      [winner.claim_id],
    );
    expect(claimed.rows[0].res).toEqual({ ok: true, status: 'CLAIMED' });

    // Admin cancels -> stock returns to 0 used
    const cancelled = await db.query<{ res: Record<string, unknown> }>(
      `select public.set_claim_status($1, 'CANCELLED') as res`,
      [winner.claim_id],
    );
    expect(cancelled.rows[0].res).toEqual({ ok: true, status: 'CANCELLED' });
    const afterCancel = await db.query<{ reserved_count: number; claimed_count: number }>(
      `select reserved_count, claimed_count from public.rewards where id = $1`,
      [rewardId],
    );
    expect(afterCancel.rows[0]).toEqual({ reserved_count: 0, claimed_count: 0 });
  });

  it('dashboard_snapshot exposes only safe public fields and RLS blocks student writes', async () => {
    const snap = await db.query<{ res: { players: Record<string, unknown>[]; total_levels: number } }>(
      `select public.dashboard_snapshot(null) as res`,
    );
    expect(snap.rows[0].res.total_levels).toBe(10);
    expect(snap.rows[0].res.players.length).toBe(2);
    expect(snap.rows[0].res.players[0]).not.toHaveProperty('auth_user_id');

    // Switch to student role inside a transaction so SET LOCAL ROLE stays active, and try manipulating score_records directly
    await db.exec(`begin`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [student1AuthId]);
    await db.exec(`set local role authenticated`);
    await expect(
      db.query(
        `insert into public.score_records (player_id, player_session_id, kind, points)
         values ($1, $2, 'ADJUSTMENT', 9999)`,
        [snap.rows[0].res.players[0].id, player1SessionId],
      ),
    ).rejects.toThrow();
    await db.exec(`rollback`);
  });
});
