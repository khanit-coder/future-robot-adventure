-- =====================================================================
-- Functions, RPCs and audit triggers
-- =====================================================================

-- ---------- authorisation helpers -------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create or replace function public.owns_player_session(sid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.player_sessions ps
    join public.players p on p.id = ps.player_id
    where ps.id = sid and p.auth_user_id = auth.uid()
  );
$$;

create or replace function public.server_time()
returns timestamptz language sql stable as $$ select now(); $$;

-- ---------- level version bump ----------------------------------------
create or replace function public.bump_level_version()
returns trigger language plpgsql as $$
begin
  update public.levels set version = version + 1 where id = coalesce(new.level_id, old.level_id);
  return null;
end $$;

create trigger missions_bump_version after update on public.missions
  for each row execute function public.bump_level_version();

-- ---------- audit trail -------------------------------------------------
-- Records every admin-initiated change to admin-managed tables. Changes made by the service role
-- (Edge Functions / seed) have no auth.uid() and are logged explicitly by the function instead.
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rec jsonb;
  diff jsonb;
begin
  if uid is null or not exists (select 1 from public.admins where user_id = uid) then
    return null;
  end if;
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into diff
    from jsonb_each(to_jsonb(new)) n
    where to_jsonb(old) -> n.key is distinct from n.value and n.key <> 'updated_at';
    if diff = '{}'::jsonb then return null; end if;
  elsif tg_op = 'DELETE' then
    diff := jsonb_build_object('deleted', rec);
  else
    diff := jsonb_build_object('created', rec);
  end if;
  if length(diff::text) > 8000 then
    diff := jsonb_build_object('note', 'details omitted (too large)');
  end if;
  insert into public.audit_logs (admin_id, admin_email, action, entity, entity_id, details)
  values (uid, (select email from public.admins where user_id = uid), tg_op, tg_table_name, rec ->> 'id', diff);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'admins','game_settings','dashboard_settings','game_sessions','robot_assets','scene_assets','worlds','levels',
    'level_translations','missions','hints','lessons','lesson_translations','block_definitions','i18n_overrides',
    'rewards','reward_claims','players'
  ] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end $$;

-- ---------- rate limiting -----------------------------------------------
-- Fixed-window counter. Returns true when the call is allowed.
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  c integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into c;
  return c <= p_max;
end $$;

-- ---------- submissions (authoritative, transactional) ------------------
-- Called only by the submit-solution Edge Function (service role) AFTER it has validated and executed
-- the program on the server. All state changes happen in one transaction under a row lock.
create or replace function public.apply_submission(
  p_player_session_id    uuid,
  p_level_id             uuid,
  p_client_submission_id uuid,
  p_program              jsonb,
  p_result               jsonb,
  p_status               text,       -- INVALID | FAILED | SUCCESS
  p_score                integer,
  p_breakdown            jsonb,
  p_elapsed_ms           integer,
  p_expected_failed      integer,    -- optimistic concurrency: value the score was computed with
  p_expected_hints       integer,
  p_bonus_seconds        integer,
  p_total_levels         integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ps   public.player_sessions%rowtype;
  prog public.player_level_progress%rowtype;
  dup  public.submissions%rowtype;
  awarded integer := 0;
  new_status public.player_status;
  all_done boolean := false;
  total_failed integer := 0;
  out_of_hearts boolean := false;
begin
  select * into ps from public.player_sessions where id = p_player_session_id for update;
  if not found then
    return jsonb_build_object('accepted', false, 'reason', 'NOT_FOUND');
  end if;

  -- idempotency: replaying the same client submission returns the stored outcome
  select * into dup from public.submissions
    where player_session_id = p_player_session_id and client_submission_id = p_client_submission_id;
  if found then
    select coalesce(sum(failed_attempts), 0) into total_failed
    from public.player_level_progress where player_session_id = p_player_session_id;
    return jsonb_build_object('accepted', true, 'duplicate', true, 'status', dup.status, 'score_awarded', 0,
                              'total_score', ps.total_score, 'levels_completed', ps.levels_completed, 'result', dup.result,
                              'hearts_remaining', greatest(0, 5 - total_failed), 'out_of_hearts', (total_failed >= 5));
  end if;

  if ps.status <> 'PLAYING' then
    return jsonb_build_object('accepted', false, 'reason', case when ps.status in ('FINISHED','TIME_EXPIRED') then ps.status::text else 'NOT_STARTED' end);
  end if;

  -- server-authoritative clock
  if ps.expires_at is not null and now() > ps.expires_at then
    update public.player_sessions set status = 'TIME_EXPIRED', finished_at = ps.expires_at where id = ps.id;
    return jsonb_build_object('accepted', false, 'reason', 'TIME_EXPIRED');
  end if;

  insert into public.player_level_progress (player_session_id, level_id)
  values (p_player_session_id, p_level_id)
  on conflict (player_session_id, level_id) do nothing;
  select * into prog from public.player_level_progress
    where player_session_id = p_player_session_id and level_id = p_level_id for update;

  if p_status = 'SUCCESS' and prog.status = 'IN_PROGRESS'
     and (prog.failed_attempts <> p_expected_failed or prog.hints_used <> p_expected_hints) then
    -- state moved under us (parallel request); caller recomputes the score and retries
    return jsonb_build_object('accepted', false, 'reason', 'RETRY');
  end if;

  insert into public.submissions (player_session_id, level_id, client_submission_id, program, status, result)
  values (p_player_session_id, p_level_id, p_client_submission_id, p_program, p_status, p_result);

  update public.player_level_progress
     set attempts = attempts + 1,
         failed_attempts = failed_attempts + case when p_status = 'SUCCESS' then 0 else 1 end
   where id = prog.id;

  update public.player_sessions
     set total_attempts = total_attempts + 1, last_seen_at = now()
   where id = ps.id;

  if p_status = 'SUCCESS' and prog.status = 'IN_PROGRESS' then
    awarded := greatest(0, p_score);
    update public.player_level_progress
       set status = 'COMPLETED', completed_at = now(), completion_ms = p_elapsed_ms, score = awarded
     where id = prog.id;

    insert into public.score_records (player_id, player_session_id, level_id, kind, points, breakdown)
    values (ps.player_id, ps.id, p_level_id, 'MISSION', awarded, coalesce(p_breakdown, '{}'::jsonb));

    update public.player_sessions
       set total_score = total_score + awarded,
           levels_completed = levels_completed + 1,
           best_level_ms = least(coalesce(best_level_ms, p_elapsed_ms), p_elapsed_ms),
           expires_at = case when expires_at is null then null else expires_at + make_interval(secs => greatest(p_bonus_seconds, 0)) end,
           bonus_seconds = bonus_seconds + greatest(p_bonus_seconds, 0)
     where id = ps.id;

    select (levels_completed >= p_total_levels) into all_done from public.player_sessions where id = ps.id;
    if all_done then
      update public.player_sessions set status = 'FINISHED', finished_at = now() where id = ps.id;
    end if;
  end if;

  select coalesce(sum(failed_attempts), 0) into total_failed
  from public.player_level_progress
  where player_session_id = p_player_session_id;

  if p_status <> 'SUCCESS' and total_failed >= 5 then
    out_of_hearts := true;
    all_done := true;
    update public.player_sessions set status = 'FINISHED', finished_at = now() where id = ps.id;
  end if;

  select * into ps from public.player_sessions where id = p_player_session_id;
  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'status', p_status,
    'score_awarded', awarded, 'total_score', ps.total_score, 'levels_completed', ps.levels_completed,
    'player_status', ps.status, 'expires_at', ps.expires_at, 'already_completed', (p_status = 'SUCCESS' and awarded = 0 and prog.status = 'COMPLETED'),
    'finished', all_done, 'out_of_hearts', out_of_hearts, 'hearts_remaining', greatest(0, 5 - total_failed)
  );
end $$;

-- ---------- rewards ------------------------------------------------------
create or replace function public.reserve_reward(p_player_session_id uuid, p_reward_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ps public.player_sessions%rowtype;
  rw public.rewards%rowtype;
  enabled boolean;
  code text;
  i integer;
  claim public.reward_claims%rowtype;
begin
  select rewards_enabled into enabled from public.game_settings limit 1;
  if not coalesce(enabled, false) then
    return jsonb_build_object('ok', false, 'reason', 'REWARDS_DISABLED');
  end if;

  select * into ps from public.player_sessions where id = p_player_session_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
  if ps.status not in ('FINISHED', 'TIME_EXPIRED') then
    return jsonb_build_object('ok', false, 'reason', 'GAME_NOT_FINISHED');
  end if;

  -- existing active claim?
  select * into claim from public.reward_claims where player_id = ps.player_id and status <> 'CANCELLED';
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'claim_id', claim.id, 'claim_code', claim.claim_code, 'reward_id', claim.reward_id, 'status', claim.status);
  end if;

  -- row lock serialises concurrent reservations of the same reward
  select * into rw from public.rewards where id = p_reward_id and is_active for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
  if ps.total_score < rw.min_score then
    return jsonb_build_object('ok', false, 'reason', 'NOT_ELIGIBLE');
  end if;
  if rw.reserved_count + rw.claimed_count >= rw.stock_total then
    return jsonb_build_object('ok', false, 'reason', 'OUT_OF_STOCK');
  end if;

  code := '';
  for i in 1..6 loop
    code := code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1);
  end loop;
  insert into public.reward_claims (reward_id, player_id, player_session_id, claim_code)
  values (rw.id, ps.player_id, ps.id, code)
  returning * into claim;
  update public.rewards set reserved_count = reserved_count + 1 where id = rw.id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'claim_id', claim.id, 'claim_code', claim.claim_code, 'reward_id', rw.id, 'status', claim.status);
end $$;

-- Admin: mark a reservation as handed over, or cancel it (returns the stock).
create or replace function public.set_claim_status(p_claim_id uuid, p_status public.claim_status)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.reward_claims%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into c from public.reward_claims where id = p_claim_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); end if;
  perform 1 from public.rewards where id = c.reward_id for update;

  if c.status = p_status then
    return jsonb_build_object('ok', true, 'status', c.status);
  end if;
  if c.status = 'CANCELLED' then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_CANCELLED');
  end if;

  if p_status = 'CLAIMED' and c.status = 'RESERVED' then
    update public.rewards set reserved_count = reserved_count - 1, claimed_count = claimed_count + 1 where id = c.reward_id;
    update public.reward_claims set status = 'CLAIMED', claimed_at = now(), claimed_by = auth.uid() where id = c.id;
  elsif p_status = 'CANCELLED' then
    if c.status = 'RESERVED' then
      update public.rewards set reserved_count = reserved_count - 1 where id = c.reward_id;
    else
      update public.rewards set claimed_count = claimed_count - 1 where id = c.reward_id;
    end if;
    update public.reward_claims set status = 'CANCELLED' where id = c.id;
  else
    return jsonb_build_object('ok', false, 'reason', 'INVALID_TRANSITION');
  end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

-- ---------- public dashboard snapshot ------------------------------------
-- The only way anonymous clients can read player data. Exposes display name, school and progress only.
create or replace function public.dashboard_snapshot(p_session_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  sid uuid;
  sname text;
  sstatus text;
  sreg boolean;
  total_levels integer;
  result jsonb;
begin
  select id, name, status::text, registration_open into sid, sname, sstatus, sreg
  from public.game_sessions
  where (p_session_id is not null and id = p_session_id) or (p_session_id is null and status = 'ACTIVE')
  order by started_at desc limit 1;

  select coalesce(jsonb_array_length(snapshot -> 'levels'), 0) into total_levels
  from public.published_configs order by version desc limit 1;

  select jsonb_build_object(
    'server_now', now(),
    'session', jsonb_build_object('id', sid, 'name', sname, 'status', sstatus, 'registration_open', sreg),
    'last_seq', coalesce((select max(seq) from public.game_events where game_session_id = sid), 0),
    'total_levels', coalesce(total_levels, 0),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.display_name, 'school', p.school, 'status', ps.status,
        'score', ps.total_score, 'levels_completed', ps.levels_completed,
        'best_level_ms', ps.best_level_ms,
        'started_at', ps.started_at, 'finished_at', ps.finished_at, 'registered_at', p.created_at
      ) order by ps.total_score desc, ps.levels_completed desc, ps.best_level_ms asc nulls last, ps.finished_at asc nulls last, p.created_at)
      from public.players p join public.player_sessions ps on ps.player_id = p.id
      where p.game_session_id = sid
    ), '[]'::jsonb),
    'recent_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.sequence_number desc) from (
        select ev.id as event_id, ev.seq as sequence_number, ev.type, ev.player_id, ev.game_session_id as session_id,
               ev.created_at as timestamp, ev.payload
        from public.game_events ev
        where ev.game_session_id = sid and ev.type in ('PLAYER_LEVEL_COMPLETED','PLAYER_FINISHED','PLAYER_JOINED')
        order by ev.seq desc limit 30
      ) e
    ), '[]'::jsonb),
    'total_missions_completed', coalesce((select sum(ps.levels_completed) from public.player_sessions ps where ps.game_session_id = sid), 0)
  ) into result;
  return result;
end $$;

-- ---------- privileges ------------------------------------------------------
revoke all on function public.apply_submission(uuid, uuid, uuid, jsonb, jsonb, text, integer, jsonb, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.reserve_reward(uuid, uuid) from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.apply_submission(uuid, uuid, uuid, jsonb, jsonb, text, integer, jsonb, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.reserve_reward(uuid, uuid) to service_role;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.set_claim_status(uuid, public.claim_status) to authenticated;
grant execute on function public.dashboard_snapshot(uuid) to anon, authenticated;
grant execute on function public.server_time() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
