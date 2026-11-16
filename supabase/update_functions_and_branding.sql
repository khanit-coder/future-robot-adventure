-- Update apply_submission (5 hearts across all levels) and dashboard_snapshot (Hall of Fame sorting)
create or replace function public.apply_submission(
  p_player_session_id    uuid,
  p_level_id             uuid,
  p_client_submission_id uuid,
  p_program              jsonb,
  p_result               jsonb,
  p_status               text,
  p_score                integer,
  p_breakdown            jsonb,
  p_elapsed_ms           integer,
  p_expected_failed      integer,
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

update public.game_settings
set college_name = '{"th":"วิทยาลัยเทคโนโลยีขอนแก่น P-TECH • คณะเทคโนโลยีสารสนเทศ","en":"Khon Kaen Technological College P-TECH • Faculty of Information Technology"}'::jsonb;
