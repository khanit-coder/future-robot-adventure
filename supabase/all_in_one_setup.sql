-- ========================================================
-- FUTURE ROBOT ADVENTURE: ALL-IN-ONE SUPABASE SETUP SCRIPT
-- Run this entire file in your Supabase project SQL Editor
-- ========================================================



-- >>> FILE: supabase/migrations/20260101000000_schema.sql <<<

-- =====================================================================
-- Future Robot Adventure — core schema
-- =====================================================================
-- Conventions
--  * UUID primary keys, created_at / updated_at everywhere.
--  * Localised short strings use JSONB {"th": "...", "en": "..."}; long, per-language
--    content (levels, lessons) uses translation tables.
--  * JSONB is only used for genuinely flexible structures (maps, objectives, animations).
--  * Admin-managed tables are the DRAFT. Gameplay config is frozen into
--    published_configs (versioned snapshots) when an admin publishes.
-- =====================================================================

-- ---------- enums ----------------------------------------------------
create type public.admin_role      as enum ('SUPER_ADMIN', 'ADMIN');
create type public.session_status  as enum ('ACTIVE', 'CLOSED');
create type public.player_status   as enum ('REGISTERED', 'LEARNING', 'PLAYING', 'FINISHED', 'TIME_EXPIRED');
create type public.score_kind      as enum ('MISSION', 'ADJUSTMENT');
create type public.claim_status    as enum ('RESERVED', 'CLAIMED', 'CANCELLED');
create type public.dashboard_mode  as enum ('GRID', 'PLANET', 'SPOTLIGHT');

-- ---------- helpers --------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- admins ---------------------------------------------------
create table public.admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  email       text,
  role        public.admin_role not null default 'ADMIN',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- global settings (singleton) -------------------------------
create table public.game_settings (
  id                       uuid primary key default gen_random_uuid(),
  singleton                boolean not null default true unique check (singleton),
  -- branding / global (applies live)
  game_title               jsonb not null default '{"th":"ผจญภัยหุ่นยนต์แห่งอนาคต","en":"Future Robot Adventure"}',
  tagline                  jsonb not null default '{"th":"เรียนรู้การเขียนโค้ด ผจญภัยสู่โลกอนาคต","en":"Learn to Code. Explore the Future."}',
  event_title              jsonb not null default '{"th":"เปิดบ้านวิทยาลัย","en":"College Open House"}',
  college_name             jsonb not null default '{"th":"วิทยาลัยของเรา","en":"Our College"}',
  college_logo_url         text,
  game_logo_url            text,
  primary_color            text not null default '#4f46e5' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color          text not null default '#f59e0b' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  default_language         text not null default 'th' check (default_language in ('th', 'en')),
  maintenance_mode         boolean not null default false,
  maintenance_message      jsonb not null default '{"th":"ระบบกำลังปรับปรุง กรุณารอสักครู่","en":"We are doing some maintenance. Please wait a moment."}',
  announcement             jsonb,
  -- gameplay (snapshotted on publish)
  score_rules              jsonb not null default '{"mission_base":100,"no_hint_bonus":30,"no_error_bonus":20,"time_bonus_max":50,"time_bonus_full_seconds":30,"time_bonus_zero_seconds":180,"hint_penalty":10}',
  timer_enabled            boolean not null default true,
  total_duration_seconds   integer not null default 1200 check (total_duration_seconds between 60 and 14400),
  lesson_timer_seconds     integer check (lesson_timer_seconds is null or lesson_timer_seconds > 0),
  level_timer_seconds      integer check (level_timer_seconds is null or level_timer_seconds > 0),
  bonus_seconds_per_level  integer not null default 0 check (bonus_seconds_per_level between 0 and 600),
  lessons_mandatory        boolean not null default true,
  allow_skip_lessons       boolean not null default false,
  rewards_enabled          boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table public.dashboard_settings (
  id                         uuid primary key default gen_random_uuid(),
  singleton                  boolean not null default true unique check (singleton),
  mode                       public.dashboard_mode not null default 'GRID',
  columns                    integer not null default 8 check (columns between 3 and 14),
  robot_size                 integer not null default 96 check (robot_size between 48 and 200),
  page_size                  integer not null default 48 check (page_size between 8 and 200),
  rotate_seconds             integer not null default 12 check (rotate_seconds between 3 and 120),
  show_school                boolean not null default true,
  show_leaderboard           boolean not null default true,
  show_scores                boolean not null default true,
  show_online_count          boolean not null default true,
  animations_enabled         boolean not null default true,
  theme                      text not null default 'space' check (theme in ('space', 'lab', 'planet', 'light')),
  background_url             text,
  spotlight_interval_seconds integer not null default 8 check (spotlight_interval_seconds between 3 and 60),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- ---------- event sessions --------------------------------------------
create table public.game_sessions (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 120),
  status             public.session_status not null default 'ACTIVE',
  registration_open  boolean not null default true,
  started_at         timestamptz not null default now(),
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- Only one ACTIVE session at a time.
create unique index game_sessions_one_active on public.game_sessions ((status)) where status = 'ACTIVE';

-- ---------- assets -----------------------------------------------------
create table public.robot_assets (
  id             uuid primary key default gen_random_uuid(),
  name           jsonb not null default '{}',
  kind           text not null default 'builtin' check (kind in ('builtin', 'spritesheet')),
  builtin_style  text,
  sprite_url     text,
  frame_width    integer check (frame_width is null or frame_width > 0),
  frame_height   integer check (frame_height is null or frame_height > 0),
  animations     jsonb not null default '{}',
  scale          numeric(4, 2) not null default 1 check (scale between 0.2 and 4),
  move_speed_ms  integer not null default 450 check (move_speed_ms between 100 and 2000),
  primary_color  text not null default '#38bdf8' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  is_default     boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (kind <> 'spritesheet' or (sprite_url is not null and frame_width is not null and frame_height is not null))
);
create unique index robot_assets_one_default on public.robot_assets ((is_default)) where is_default;

create table public.scene_assets (
  id          uuid primary key default gen_random_uuid(),
  name        jsonb not null default '{}',
  kind        text not null default 'builtin' check (kind in ('builtin', 'image')),
  theme       text not null default 'training' check (theme in ('training', 'energy', 'station', 'final')),
  image_url   text,
  width       integer not null default 960 check (width between 320 and 4096),
  height      integer not null default 540 check (height between 240 and 2304),
  parallax    jsonb not null default '[]',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (kind <> 'image' or image_url is not null)
);

-- ---------- worlds / levels / missions / hints ------------------------
create table public.worlds (
  id           uuid primary key default gen_random_uuid(),
  position     integer not null default 0,
  name         jsonb not null default '{}',
  description  jsonb not null default '{}',
  theme        text not null default 'training' check (theme in ('training', 'energy', 'station', 'final')),
  color        text not null default '#38bdf8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.levels (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  world_id              uuid not null references public.worlds (id) on delete cascade,
  position              integer not null default 0,
  difficulty            smallint not null default 1 check (difficulty between 1 and 5),
  max_score             integer not null default 200 check (max_score between 0 and 10000),
  time_limit_seconds    integer check (time_limit_seconds is null or time_limit_seconds > 0),
  scene_asset_id        uuid references public.scene_assets (id) on delete set null,
  robot_asset_id        uuid references public.robot_assets (id) on delete set null,
  completion_animation  text not null default 'celebrate' check (completion_animation in ('celebrate', 'wave', 'jump')),
  unlock                jsonb not null default '{"type":"PREVIOUS_LEVEL"}',
  is_active             boolean not null default true,
  version               integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index levels_world_idx on public.levels (world_id, position);

create table public.level_translations (
  id           uuid primary key default gen_random_uuid(),
  level_id     uuid not null references public.levels (id) on delete cascade,
  lang         text not null check (lang in ('th', 'en')),
  title        text not null default '' check (char_length(title) <= 120),
  description  text not null default '' check (char_length(description) <= 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (level_id, lang)
);

create table public.missions (
  id                  uuid primary key default gen_random_uuid(),
  level_id            uuid not null unique references public.levels (id) on delete cascade,
  map                 jsonb not null,
  robot_start         jsonb not null,
  objectives          jsonb not null,
  rules               jsonb not null,
  expected_solutions  jsonb not null default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.hints (
  id          uuid primary key default gen_random_uuid(),
  level_id    uuid not null references public.levels (id) on delete cascade,
  position    integer not null default 0,
  text        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index hints_level_idx on public.hints (level_id, position);

-- ---------- lessons ----------------------------------------------------
create table public.lessons (
  id            uuid primary key default gen_random_uuid(),
  position      integer not null default 0,
  image_url     text,
  video_url     text,
  demo_program  jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index lessons_position_idx on public.lessons (position);

create table public.lesson_translations (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  lang        text not null check (lang in ('th', 'en')),
  title       text not null default '' check (char_length(title) <= 160),
  summary     text not null default '' check (char_length(summary) <= 400),
  body        text not null default '' check (char_length(body) <= 8000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (lesson_id, lang)
);

-- ---------- blocks -----------------------------------------------------
create table public.block_definitions (
  id            uuid primary key default gen_random_uuid(),
  command_type  text not null unique check (command_type in
                  ('MOVE_FORWARD','MOVE_BACKWARD','TURN_LEFT','TURN_RIGHT','JUMP','WAVE','PICK_UP','ACTIVATE','CELEBRATE','REPEAT','WAIT')),
  category      text not null check (category in ('movement', 'actions', 'logic')),
  label         jsonb not null default '{}',
  description   jsonb not null default '{}',
  color         text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon          text not null default 'box',
  params        jsonb not null default '[]',
  enabled       boolean not null default true,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- translation overrides (Language Manager) -------------------
create table public.i18n_overrides (
  id          uuid primary key default gen_random_uuid(),
  lang        text not null check (lang in ('th', 'en')),
  namespace   text not null check (namespace ~ '^[a-z]{2,20}$'),
  key         text not null check (char_length(key) between 1 and 200),
  value       text not null check (char_length(value) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (lang, namespace, key)
);

-- ---------- versioned configuration -----------------------------------
create table public.published_configs (
  id            uuid primary key default gen_random_uuid(),
  version       integer generated always as identity unique,
  snapshot      jsonb not null,
  note          text check (note is null or char_length(note) <= 500),
  published_by  uuid,
  published_at  timestamptz not null default now()
);

-- ---------- players ----------------------------------------------------
create table public.players (
  id               uuid primary key default gen_random_uuid(),
  game_session_id  uuid not null references public.game_sessions (id) on delete cascade,
  auth_user_id     uuid not null references auth.users (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 1 and 40),
  school           text not null check (char_length(school) between 1 and 80),
  grade            text check (grade is null or char_length(grade) <= 20),
  lang             text not null default 'th' check (lang in ('th', 'en')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- one registration per browser identity per event session: stops accidental double submits
  unique (game_session_id, auth_user_id)
);
create index players_session_idx on public.players (game_session_id);
create index players_school_idx  on public.players (game_session_id, school);

create table public.player_sessions (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null unique references public.players (id) on delete cascade,
  game_session_id   uuid not null references public.game_sessions (id) on delete cascade,
  status            public.player_status not null default 'REGISTERED',
  config_version    integer not null references public.published_configs (version),
  started_at        timestamptz,
  expires_at        timestamptz,
  finished_at       timestamptz,
  bonus_seconds     integer not null default 0,
  total_score       integer not null default 0 check (total_score >= 0),
  levels_completed  integer not null default 0,
  total_attempts    integer not null default 0,
  hints_used        integer not null default 0,
  lessons_completed integer not null default 0,
  best_level_ms     integer,
  current_level_id  uuid,
  last_seen_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index player_sessions_rank_idx   on public.player_sessions (game_session_id, total_score desc, finished_at);
create index player_sessions_status_idx on public.player_sessions (game_session_id, status);

-- level_id columns below reference levels *inside the pinned published snapshot*, which can outlive
-- a deleted draft level, so they intentionally carry no foreign key to public.levels.
create table public.player_level_progress (
  id                 uuid primary key default gen_random_uuid(),
  player_session_id  uuid not null references public.player_sessions (id) on delete cascade,
  level_id           uuid not null,
  status             text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED')),
  attempts           integer not null default 0,
  failed_attempts    integer not null default 0,
  hints_used         integer not null default 0,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  completion_ms      integer,
  score              integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (player_session_id, level_id)
);

create table public.submissions (
  id                    uuid primary key default gen_random_uuid(),
  player_session_id     uuid not null references public.player_sessions (id) on delete cascade,
  level_id              uuid not null,
  client_submission_id  uuid not null,
  program               jsonb not null,
  status                text not null check (status in ('INVALID', 'FAILED', 'SUCCESS')),
  result                jsonb,
  created_at            timestamptz not null default now(),
  -- the same submission can never be applied twice (double clicks, retries)
  unique (player_session_id, client_submission_id)
);
create index submissions_level_idx on public.submissions (player_session_id, level_id, created_at);

create table public.lesson_progress (
  id                 uuid primary key default gen_random_uuid(),
  player_session_id  uuid not null references public.player_sessions (id) on delete cascade,
  lesson_id          uuid not null,
  completed_at       timestamptz not null default now(),
  unique (player_session_id, lesson_id)
);

create table public.score_records (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references public.players (id) on delete cascade,
  player_session_id  uuid not null references public.player_sessions (id) on delete cascade,
  level_id           uuid,
  kind               public.score_kind not null,
  points             integer not null,
  breakdown          jsonb not null default '{}',
  note               text check (note is null or char_length(note) <= 300),
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- A mission can only ever be scored once per player session (duplicate submission protection).
create unique index score_records_one_mission on public.score_records (player_session_id, level_id) where kind = 'MISSION';
create index score_records_player_idx on public.score_records (player_session_id, created_at);

-- ---------- rewards ----------------------------------------------------
create table public.rewards (
  id              uuid primary key default gen_random_uuid(),
  position        integer not null default 0,
  name            jsonb not null default '{}',
  description     jsonb not null default '{}',
  image_url       text,
  min_score       integer not null default 0 check (min_score >= 0),
  stock_total     integer not null default 0 check (stock_total >= 0),
  reserved_count  integer not null default 0 check (reserved_count >= 0),
  claimed_count   integer not null default 0 check (claimed_count >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- inventory can never go negative or be over-committed
  constraint rewards_inventory_ok check (reserved_count + claimed_count <= stock_total)
);

create table public.reward_claims (
  id                 uuid primary key default gen_random_uuid(),
  reward_id          uuid not null references public.rewards (id) on delete restrict,
  player_id          uuid not null references public.players (id) on delete cascade,
  player_session_id  uuid not null references public.player_sessions (id) on delete cascade,
  status             public.claim_status not null default 'RESERVED',
  claim_code         text not null unique,
  claimed_at         timestamptz,
  claimed_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- One active (non-cancelled) reward per player.
create unique index reward_claims_one_per_player on public.reward_claims (player_id) where status <> 'CANCELLED';
create index reward_claims_reward_idx on public.reward_claims (reward_id, status);

-- ---------- realtime event log ----------------------------------------
create table public.game_events (
  id               uuid primary key default gen_random_uuid(),
  seq              bigint generated always as identity unique,
  game_session_id  uuid references public.game_sessions (id) on delete cascade,
  player_id        uuid references public.players (id) on delete cascade,
  type             text not null,
  payload          jsonb not null default '{}',
  created_at       timestamptz not null default now()
);
create index game_events_session_seq_idx on public.game_events (game_session_id, seq desc);

-- ---------- audit + rate limiting -------------------------------------
create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid,
  admin_email  text,
  action       text not null,
  entity       text not null,
  entity_id    text,
  details      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create table public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         integer not null default 0
);

-- ---------- updated_at triggers ---------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'admins','game_settings','dashboard_settings','game_sessions','robot_assets','scene_assets','worlds','levels',
    'level_translations','missions','hints','lessons','lesson_translations','block_definitions','i18n_overrides',
    'players','player_sessions','player_level_progress','score_records','rewards','reward_claims'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;


-- >>> FILE: supabase/migrations/20260101000100_functions.sql <<<

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


-- >>> FILE: supabase/migrations/20260101000150_snapshot_version.sql <<<

-- keep snapshot.version in lockstep with the identity version
create or replace function public.sync_snapshot_version()
returns trigger language plpgsql as $$
begin
  new.snapshot := jsonb_set(new.snapshot, '{version}', to_jsonb(new.version));
  return new;
end $$;

create trigger published_configs_sync_version before insert on public.published_configs
  for each row execute function public.sync_snapshot_version();


-- >>> FILE: supabase/migrations/20260101000200_rls.sql <<<

-- =====================================================================
-- Row Level Security, storage and realtime configuration
-- =====================================================================
-- Model
--   * anon / authenticated (incl. anonymous-sign-in players) can READ public configuration only.
--   * Players can read ONLY their own rows. They can never write scores, progress or sessions —
--     all writes go through Edge Functions using the service role.
--   * Admins (rows in public.admins) can manage draft content. Published configs, score records,
--     submissions and sessions are read-only even for admins (changes go through audited functions).
--   * Public dashboards read through the dashboard_snapshot() RPC, which exposes only display
--     name, school and progress.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'admins','game_settings','dashboard_settings','game_sessions','robot_assets','scene_assets','worlds','levels',
    'level_translations','missions','hints','lessons','lesson_translations','block_definitions','i18n_overrides',
    'published_configs','players','player_sessions','player_level_progress','submissions','lesson_progress',
    'score_records','rewards','reward_claims','game_events','audit_logs','rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- public read (configuration shown to everyone) -------------------
create policy "public read settings"        on public.game_settings      for select to anon, authenticated using (true);
create policy "public read dashboard cfg"   on public.dashboard_settings for select to anon, authenticated using (true);
create policy "public read sessions"        on public.game_sessions      for select to anon, authenticated using (true);
-- Published snapshots are NOT publicly readable: players fetch their pinned version through the
-- player-action Edge Function, which strips hints and enforces version pinning.
create policy "admin read published"        on public.published_configs  for select to authenticated using (public.is_admin());
create policy "public read robots"          on public.robot_assets       for select to anon, authenticated using (is_active or public.is_admin());
create policy "public read scenes"          on public.scene_assets       for select to anon, authenticated using (is_active or public.is_admin());
create policy "public read rewards"         on public.rewards            for select to anon, authenticated using (is_active or public.is_admin());
create policy "public read i18n overrides"  on public.i18n_overrides     for select to anon, authenticated using (true);

-- ---------- admin-managed draft content (full control) -----------------------
do $$
declare t text;
begin
  foreach t in array array[
    'game_settings','dashboard_settings','game_sessions','robot_assets','scene_assets','worlds','levels',
    'level_translations','missions','hints','lessons','lesson_translations','block_definitions','i18n_overrides','rewards'
  ] loop
    execute format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- draft-only tables: players must NOT read them (they read the published snapshot instead)
create policy "admin read worlds"              on public.worlds              for select to authenticated using (public.is_admin());
create policy "admin read levels"              on public.levels              for select to authenticated using (public.is_admin());
create policy "admin read level translations"  on public.level_translations  for select to authenticated using (public.is_admin());
create policy "admin read missions"            on public.missions            for select to authenticated using (public.is_admin());
create policy "admin read hints"               on public.hints               for select to authenticated using (public.is_admin());
create policy "admin read lessons"             on public.lessons             for select to authenticated using (public.is_admin());
create policy "admin read lesson translations" on public.lesson_translations for select to authenticated using (public.is_admin());
create policy "admin read blocks"              on public.block_definitions   for select to authenticated using (public.is_admin());

-- ---------- admins table ------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.role = 'SUPER_ADMIN');
$$;
grant execute on function public.is_super_admin() to authenticated;

create policy "admin read admins"   on public.admins for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "super admin insert admins" on public.admins for insert to authenticated with check (public.is_super_admin());
create policy "super admin update admins" on public.admins for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "super admin delete admins" on public.admins for delete to authenticated using (public.is_super_admin());

-- ---------- player-owned data (read own, admins read all, nobody writes directly) --
create policy "own player"            on public.players               for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());
create policy "admin delete players"  on public.players               for delete to authenticated using (public.is_admin());
create policy "own player session"    on public.player_sessions       for select to authenticated using (public.owns_player_session(id) or public.is_admin());
create policy "own level progress"    on public.player_level_progress for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());
create policy "own submissions"       on public.submissions           for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());
create policy "own lesson progress"   on public.lesson_progress       for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());
create policy "own score records"     on public.score_records         for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());
create policy "own reward claims"     on public.reward_claims         for select to authenticated using (public.owns_player_session(player_session_id) or public.is_admin());

-- ---------- admin-only read ------------------------------------------------------
create policy "admin read events"     on public.game_events  for select to authenticated using (public.is_admin());
create policy "admin read audit"      on public.audit_logs   for select to authenticated using (public.is_admin());
-- rate_limits: no policies at all => only the service role can touch it.

-- ---------- column hardening: even with RLS, forbid direct DML by players -----------
revoke insert, update, delete, truncate on
  public.players, public.player_sessions, public.player_level_progress, public.submissions,
  public.lesson_progress, public.score_records, public.reward_claims, public.game_events,
  public.audit_logs, public.rate_limits, public.published_configs
from anon, authenticated;
-- admins may delete players (GDPR-style cleanup / session reset)
grant delete on public.players to authenticated;
revoke all on public.rate_limits from anon, authenticated;

-- ---------- storage -----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-assets', 'game-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "game assets public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'game-assets');
create policy "game assets admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'game-assets' and public.is_admin());
create policy "game assets admin update" on storage.objects for update to authenticated
  using (bucket_id = 'game-assets' and public.is_admin()) with check (bucket_id = 'game-assets' and public.is_admin());
create policy "game assets admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'game-assets' and public.is_admin());

-- ---------- realtime ---------------------------------------------------------------------
-- Global (live) configuration changes are pushed to clients through postgres_changes.
-- Gameplay events travel over Broadcast; presence tracks who is online.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.game_settings, public.dashboard_settings, public.game_sessions, public.i18n_overrides;
  end if;
end $$;


-- >>> FILE: supabase/seed.sql <<<

-- GENERATED by scripts/generate-seed.ts — do not edit by hand. Run: npm run seed:generate
-- Intended for an EMPTY database (supabase db reset runs it automatically).
begin;
insert into public.scene_assets (id, name, kind, theme, width, height, parallax) values
  ('00000003-0000-4000-8000-000000000001', '{"en":"Training Station","th":"สถานีฝึก"}'::jsonb, 'builtin', 'training', 960, 540, '[]'::jsonb),
  ('00000003-0000-4000-8000-000000000002', '{"en":"Energy Planet","th":"ดาวพลังงาน"}'::jsonb, 'builtin', 'energy', 960, 540, '[]'::jsonb),
  ('00000003-0000-4000-8000-000000000003', '{"en":"Lost Station","th":"สถานีที่สาบสูญ"}'::jsonb, 'builtin', 'station', 960, 540, '[]'::jsonb),
  ('00000003-0000-4000-8000-000000000004', '{"en":"Final Mission","th":"ภารกิจสุดท้าย"}'::jsonb, 'builtin', 'final', 960, 540, '[]'::jsonb);
insert into public.robot_assets (id, name, kind, builtin_style, scale, move_speed_ms, primary_color, is_default) values
  ('00000004-0000-4000-8000-000000000001', '{"en":"Bolt","th":"โบลต์"}'::jsonb, 'builtin', 'bolt', 1, 450, '#38bdf8', true),
  ('00000004-0000-4000-8000-000000000002', '{"en":"Nova","th":"โนวา"}'::jsonb, 'builtin', 'nova', 1, 450, '#f472b6', false),
  ('00000004-0000-4000-8000-000000000003', '{"en":"Gizmo","th":"กิซโม่"}'::jsonb, 'builtin', 'gizmo', 1, 450, '#4ade80', false);
insert into public.worlds (id, position, name, description, theme, color) values
  ('00000001-0000-4000-8000-000000000001', 1, '{"en":"Robot Training Station","th":"สถานีฝึกหุ่นยนต์"}'::jsonb, '{"en":"Learn your first commands.","th":"เรียนรู้คำสั่งแรกของคุณ"}'::jsonb, 'training', '#38bdf8'),
  ('00000001-0000-4000-8000-000000000002', 2, '{"en":"Energy Planet","th":"ดาวพลังงาน"}'::jsonb, '{"en":"Collect crystals and power up machines.","th":"เก็บคริสตัลและเปิดเครื่องจักรพลังงาน"}'::jsonb, 'energy', '#f59e0b'),
  ('00000001-0000-4000-8000-000000000003', 3, '{"en":"Lost Space Station","th":"สถานีอวกาศที่สาบสูญ"}'::jsonb, '{"en":"Solve puzzles and rescue a friend.","th":"ไขปริศนาและช่วยเพื่อนหุ่นยนต์"}'::jsonb, 'station', '#a78bfa'),
  ('00000001-0000-4000-8000-000000000004', 4, '{"en":"Final Robot Mission","th":"ภารกิจหุ่นยนต์ขั้นสุดท้าย"}'::jsonb, '{"en":"Use everything you learned!","th":"ใช้ทุกอย่างที่คุณเรียนรู้มา!"}'::jsonb, 'final', '#f43f5e');
insert into public.levels (id, code, world_id, position, difficulty, max_score, scene_asset_id, completion_animation, unlock, version) values
  ('00000002-0000-4000-8000-000000000001', 'level_01', '00000001-0000-4000-8000-000000000001', 1, 1, 200, '00000003-0000-4000-8000-000000000001', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-000000000002', 'level_02', '00000001-0000-4000-8000-000000000001', 2, 1, 200, '00000003-0000-4000-8000-000000000001', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-000000000003', 'level_03', '00000001-0000-4000-8000-000000000001', 3, 2, 200, '00000003-0000-4000-8000-000000000001', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-000000000004', 'level_04', '00000001-0000-4000-8000-000000000002', 4, 2, 200, '00000003-0000-4000-8000-000000000002', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-000000000005', 'level_05', '00000001-0000-4000-8000-000000000002', 5, 2, 200, '00000003-0000-4000-8000-000000000002', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-000000000006', 'level_06', '00000001-0000-4000-8000-000000000002', 6, 3, 200, '00000003-0000-4000-8000-000000000002', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-000000000007', 'level_07', '00000001-0000-4000-8000-000000000003', 7, 3, 200, '00000003-0000-4000-8000-000000000003', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-000000000008', 'level_08', '00000001-0000-4000-8000-000000000003', 8, 3, 200, '00000003-0000-4000-8000-000000000003', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-000000000009', 'level_09', '00000001-0000-4000-8000-000000000003', 9, 4, 200, '00000003-0000-4000-8000-000000000003', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1),
  ('00000002-0000-4000-8000-00000000000a', 'level_10', '00000001-0000-4000-8000-000000000004', 10, 5, 200, '00000003-0000-4000-8000-000000000004', 'celebrate', '{"type":"PREVIOUS_LEVEL"}'::jsonb, 1);
insert into public.level_translations (id, level_id, lang, title, description) values
  ('00000009-0000-4000-8000-00000000000a', '00000002-0000-4000-8000-000000000001', 'th', 'ปลุกหุ่นยนต์!', 'สั่งให้หุ่นยนต์เดินหน้าไปจนถึงเป้าหมายที่เรืองแสง'),
  ('00000009-0000-4000-8000-00000000000b', '00000002-0000-4000-8000-000000000001', 'en', 'Wake Up, Robot!', 'Move the robot forward until it reaches the glowing goal.'),
  ('00000009-0000-4000-8000-000000000014', '00000002-0000-4000-8000-000000000002', 'th', 'กระโดดข้ามไป', 'มีสิ่งกีดขวางอยู่ข้างหน้า เดิน กระโดดข้ามไป แล้วไปให้ถึงเป้าหมาย'),
  ('00000009-0000-4000-8000-000000000015', '00000002-0000-4000-8000-000000000002', 'en', 'Hop Over It', 'A barrier blocks the path. Walk, jump over it, and reach the goal.'),
  ('00000009-0000-4000-8000-00000000001e', '00000002-0000-4000-8000-000000000003', 'th', 'เลี้ยวซ้ายไปให้ถึง', 'เป้าหมายอยู่หลังหัวโค้ง เลี้ยวซ้ายเพื่อไปให้ถึง'),
  ('00000009-0000-4000-8000-00000000001f', '00000002-0000-4000-8000-000000000003', 'en', 'Turn the Corner', 'The goal is around the corner. Turn left to reach it.'),
  ('00000009-0000-4000-8000-000000000028', '00000002-0000-4000-8000-000000000004', 'th', 'นักสะสมคริสตัล', 'เก็บคริสตัลพลังงานให้ครบทั้ง 3 ก้อน ยืนบนคริสตัลแล้วใช้คำสั่งเก็บ'),
  ('00000009-0000-4000-8000-000000000029', '00000002-0000-4000-8000-000000000004', 'en', 'Crystal Collector', 'Collect all three energy crystals. Stand on a crystal and use Pick Up.'),
  ('00000009-0000-4000-8000-000000000032', '00000002-0000-4000-8000-000000000005', 'th', 'หลบสิ่งกีดขวาง', 'มีกำแพงขวางทาง! หาทางอ้อมไปยังเป้าหมายให้ได้'),
  ('00000009-0000-4000-8000-000000000033', '00000002-0000-4000-8000-000000000005', 'en', 'Wall Dodger', 'A wall is in the way! Find a path around it to the goal.'),
  ('00000009-0000-4000-8000-00000000003c', '00000002-0000-4000-8000-000000000006', 'th', 'เปิดพลังงาน!', 'ประตูถูกล็อก เปิดเครื่องกำเนิดพลังงานเพื่อเปิดประตู แล้วไปให้ถึงเป้าหมาย'),
  ('00000009-0000-4000-8000-00000000003d', '00000002-0000-4000-8000-000000000006', 'en', 'Power Up!', 'The door is locked. Activate the energy generator to open it, then reach the goal.'),
  ('00000009-0000-4000-8000-000000000046', '00000002-0000-4000-8000-000000000007', 'th', 'เขาวงกตอวกาศ', 'ผสมคำสั่งเดิน เลี้ยว และกระโดด เพื่อผ่านเขาวงกตสถานีอวกาศ'),
  ('00000009-0000-4000-8000-000000000047', '00000002-0000-4000-8000-000000000007', 'en', 'Space Maze', 'Combine walking, turning and jumping to cross the space station maze.'),
  ('00000009-0000-4000-8000-000000000050', '00000002-0000-4000-8000-000000000008', 'th', 'ภารกิจช่วยเพื่อน', 'หุ่นยนต์เพื่อนติดอยู่บนสถานี ข้ามหลุมไปแล้วช่วยมันออกมา!'),
  ('00000009-0000-4000-8000-000000000051', '00000002-0000-4000-8000-000000000008', 'en', 'Rescue Mission', 'A friendly robot is stuck on the station. Cross the gap and rescue it!'),
  ('00000009-0000-4000-8000-00000000005a', '00000002-0000-4000-8000-000000000009', 'th', 'บันไดแห่งการวนซ้ำ', 'ปีนบันไดไปยังเป้าหมาย ใช้บล็อกทำซ้ำ — ถ้าไม่ใช้บล็อกจะไม่พอ!'),
  ('00000009-0000-4000-8000-00000000005b', '00000002-0000-4000-8000-000000000009', 'en', 'Staircase Loop', 'Climb the staircase to the goal. Use the Repeat block — you do not have enough blocks without it!'),
  ('00000009-0000-4000-8000-000000000064', '00000002-0000-4000-8000-00000000000a', 'th', 'ภารกิจสุดท้าย', 'เก็บคริสตัลทั้ง 2 ก้อน เปิดเครื่องกำเนิดพลังงาน ช่วยเพื่อน ไปที่เป้าหมาย แล้วฉลอง!'),
  ('00000009-0000-4000-8000-000000000065', '00000002-0000-4000-8000-00000000000a', 'en', 'The Final Mission', 'Collect both crystals, power up the generator, rescue your friend, reach the goal and celebrate!');
insert into public.missions (id, level_id, map, robot_start, objectives, rules, expected_solutions) values
  ('0000000a-0000-4000-8000-000000000001', '00000002-0000-4000-8000-000000000001', '{"width":7,"height":3,"rows":["_______","......G","_______"],"crystals":[],"generators":[],"friends":[]}'::jsonb, '{"x":0,"y":1,"dir":"E"}'::jsonb, '[{"type":"REACH_GOAL"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD"],"max_blocks":3}'::jsonb, '[[{"type":"MOVE_FORWARD","steps":6}],[{"type":"MOVE_FORWARD","steps":3},{"type":"MOVE_FORWARD","steps":3}]]'::jsonb),
  ('0000000a-0000-4000-8000-000000000002', '00000002-0000-4000-8000-000000000002', '{"width":7,"height":3,"rows":["_______","...H..G","_______"],"crystals":[],"generators":[],"friends":[]}'::jsonb, '{"x":0,"y":1,"dir":"E"}'::jsonb, '[{"type":"REACH_GOAL"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","JUMP"],"max_blocks":5}'::jsonb, '[[{"type":"MOVE_FORWARD","steps":2},{"type":"JUMP"},{"type":"MOVE_FORWARD","steps":2}]]'::jsonb),
  ('0000000a-0000-4000-8000-000000000003', '00000002-0000-4000-8000-000000000003', '{"width":6,"height":4,"rows":["_____G","_____.","_____.","......"],"crystals":[],"generators":[],"friends":[]}'::jsonb, '{"x":0,"y":3,"dir":"E"}'::jsonb, '[{"type":"REACH_GOAL"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT"],"max_blocks":5}'::jsonb, '[[{"type":"MOVE_FORWARD","steps":5},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":3}]]'::jsonb),
  ('0000000a-0000-4000-8000-000000000004', '00000002-0000-4000-8000-000000000004', '{"width":7,"height":3,"rows":["_______",".......","_______"],"crystals":[{"x":2,"y":1},{"x":4,"y":1},{"x":6,"y":1}],"generators":[],"friends":[]}'::jsonb, '{"x":0,"y":1,"dir":"E"}'::jsonb, '[{"type":"COLLECT_CRYSTALS"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","PICK_UP"],"max_blocks":8}'::jsonb, '[[{"type":"MOVE_FORWARD","steps":2},{"type":"PICK_UP"},{"type":"MOVE_FORWARD","steps":2},{"type":"PICK_UP"},{"type":"MOVE_FORWARD","steps":2},{"type":"PICK_UP"}]]'::jsonb),
  ('0000000a-0000-4000-8000-000000000005', '00000002-0000-4000-8000-000000000005', '{"width":7,"height":3,"rows":["...#...","......G","_______"],"crystals":[],"generators":[],"friends":[]}'::jsonb, '{"x":0,"y":0,"dir":"E"}'::jsonb, '[{"type":"REACH_GOAL"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT"],"max_blocks":8}'::jsonb, '[[{"type":"TURN_RIGHT"},{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":6}],[{"type":"MOVE_FORWARD","steps":2},{"type":"TURN_RIGHT"},{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":4}]]'::jsonb),
  ('0000000a-0000-4000-8000-000000000006', '00000002-0000-4000-8000-000000000006', '{"width":7,"height":3,"rows":["_______","....D.G","_______"],"crystals":[],"generators":[{"x":2,"y":1}],"friends":[]}'::jsonb, '{"x":0,"y":1,"dir":"E"}'::jsonb, '[{"type":"ACTIVATE_GENERATORS"},{"type":"REACH_GOAL"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","ACTIVATE","TURN_LEFT","TURN_RIGHT"],"max_blocks":6}'::jsonb, '[[{"type":"MOVE_FORWARD","steps":2},{"type":"ACTIVATE"},{"type":"MOVE_FORWARD","steps":4}]]'::jsonb),
  ('0000000a-0000-4000-8000-000000000007', '00000002-0000-4000-8000-000000000007', '{"width":7,"height":5,"rows":["_____G_","_____._","___.H._","___.___","....___"],"crystals":[],"generators":[],"friends":[]}'::jsonb, '{"x":0,"y":4,"dir":"E"}'::jsonb, '[{"type":"REACH_GOAL"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT","JUMP"],"max_blocks":12}'::jsonb, '[[{"type":"MOVE_FORWARD","steps":3},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":2},{"type":"TURN_RIGHT"},{"type":"JUMP"},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":2}]]'::jsonb),
  ('0000000a-0000-4000-8000-000000000008', '00000002-0000-4000-8000-000000000008', '{"width":7,"height":4,"rows":["_____._","_____._","_____._","...O..."],"crystals":[],"generators":[],"friends":[{"x":5,"y":0}]}'::jsonb, '{"x":0,"y":3,"dir":"E"}'::jsonb, '[{"type":"RESCUE_FRIENDS"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT","JUMP","PICK_UP"],"max_blocks":12}'::jsonb, '[[{"type":"MOVE_FORWARD","steps":2},{"type":"JUMP"},{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":3},{"type":"PICK_UP"}]]'::jsonb),
  ('0000000a-0000-4000-8000-000000000009', '00000002-0000-4000-8000-000000000009', '{"width":6,"height":6,"rows":["_____G","____..","___.._","__..__","_..___","..____"],"crystals":[],"generators":[],"friends":[]}'::jsonb, '{"x":0,"y":5,"dir":"E"}'::jsonb, '[{"type":"REACH_GOAL"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT","REPEAT"],"max_blocks":8,"required_commands":["REPEAT"]}'::jsonb, '[[{"type":"REPEAT","times":5,"body":[{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_RIGHT"}]}]]'::jsonb),
  ('0000000a-0000-4000-8000-00000000000a', '00000002-0000-4000-8000-00000000000a', '{"width":7,"height":5,"rows":["______G","______.","______.","______D","....O.."],"crystals":[{"x":2,"y":4},{"x":6,"y":2}],"generators":[{"x":6,"y":4}],"friends":[{"x":6,"y":1}]}'::jsonb, '{"x":0,"y":4,"dir":"E"}'::jsonb, '[{"type":"COLLECT_CRYSTALS"},{"type":"ACTIVATE_GENERATORS"},{"type":"RESCUE_FRIENDS"},{"type":"REACH_GOAL"},{"type":"CELEBRATE"}]'::jsonb, '{"allowed_commands":["MOVE_FORWARD","MOVE_BACKWARD","TURN_LEFT","TURN_RIGHT","JUMP","WAVE","PICK_UP","ACTIVATE","CELEBRATE","REPEAT","WAIT"],"max_blocks":20}'::jsonb, '[[{"type":"MOVE_FORWARD","steps":2},{"type":"PICK_UP"},{"type":"MOVE_FORWARD","steps":1},{"type":"JUMP"},{"type":"MOVE_FORWARD","steps":1},{"type":"ACTIVATE"},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":2},{"type":"PICK_UP"},{"type":"MOVE_FORWARD","steps":1},{"type":"PICK_UP"},{"type":"MOVE_FORWARD","steps":1},{"type":"CELEBRATE"}]]'::jsonb);
insert into public.hints (id, level_id, position, text) values
  ('00000008-0000-4000-8000-00000000000a', '00000002-0000-4000-8000-000000000001', 1, '{"en":"Count the squares between the robot and the goal.","th":"ลองนับช่องระหว่างหุ่นยนต์กับเป้าหมาย"}'::jsonb),
  ('00000008-0000-4000-8000-00000000000b', '00000002-0000-4000-8000-000000000001', 2, '{"en":"You need 6 steps. Use one Move Forward block and set it to 6.","th":"ต้องเดิน 6 ก้าว ใช้บล็อกเดินหน้า 1 อัน แล้วตั้งค่าเป็น 6"}'::jsonb),
  ('00000008-0000-4000-8000-000000000014', '00000002-0000-4000-8000-000000000002', 1, '{"en":"Walk right up to the barrier, then jump.","th":"เดินไปให้ชิดสิ่งกีดขวาง แล้วกระโดด"}'::jsonb),
  ('00000008-0000-4000-8000-000000000015', '00000002-0000-4000-8000-000000000002', 2, '{"en":"Move forward 2, Jump, then Move forward 2.","th":"เดินหน้า 2 กระโดด แล้วเดินหน้าอีก 2"}'::jsonb),
  ('00000008-0000-4000-8000-00000000001e', '00000002-0000-4000-8000-000000000003', 1, '{"en":"Walk to the end of the path first.","th":"เดินไปสุดทางก่อน"}'::jsonb),
  ('00000008-0000-4000-8000-00000000001f', '00000002-0000-4000-8000-000000000003', 2, '{"en":"Move forward 5, Turn Left, then Move forward 3.","th":"เดินหน้า 5 เลี้ยวซ้าย แล้วเดินหน้า 3"}'::jsonb),
  ('00000008-0000-4000-8000-000000000028', '00000002-0000-4000-8000-000000000004', 1, '{"en":"The robot must stand ON the crystal before using Pick Up.","th":"หุ่นยนต์ต้องยืนบนคริสตัลก่อนใช้คำสั่งเก็บ"}'::jsonb),
  ('00000008-0000-4000-8000-000000000029', '00000002-0000-4000-8000-000000000004', 2, '{"en":"Move 2, Pick Up. Repeat for each crystal.","th":"เดิน 2 เก็บ แล้วทำซ้ำสำหรับทุกก้อน"}'::jsonb),
  ('00000008-0000-4000-8000-000000000032', '00000002-0000-4000-8000-000000000005', 1, '{"en":"You cannot walk through walls. Step down one row.","th":"เดินทะลุกำแพงไม่ได้ ลองลงไปอีกแถว"}'::jsonb),
  ('00000008-0000-4000-8000-000000000033', '00000002-0000-4000-8000-000000000005', 2, '{"en":"Try: Turn Right, Move 1, Turn Left, Move 6.","th":"ลอง: เลี้ยวขวา เดิน 1 เลี้ยวซ้าย เดิน 6"}'::jsonb),
  ('00000008-0000-4000-8000-00000000003c', '00000002-0000-4000-8000-000000000006', 1, '{"en":"Stand on the generator, then use Activate.","th":"ยืนบนเครื่องกำเนิดพลังงานแล้วใช้คำสั่งเปิดใช้งาน"}'::jsonb),
  ('00000008-0000-4000-8000-00000000003d', '00000002-0000-4000-8000-000000000006', 2, '{"en":"Move 2, Activate, then Move 4.","th":"เดิน 2 เปิดใช้งาน แล้วเดิน 4"}'::jsonb),
  ('00000008-0000-4000-8000-000000000046', '00000002-0000-4000-8000-000000000007', 1, '{"en":"Follow the path: east, north, east (jump!), then north.","th":"ตามทางไป: ตะวันออก เหนือ ตะวันออก (กระโดด!) แล้วเหนือ"}'::jsonb),
  ('00000008-0000-4000-8000-000000000047', '00000002-0000-4000-8000-000000000007', 2, '{"en":"Move 3, Left, Move 2, Right, Jump, Left, Move 2.","th":"เดิน 3 ซ้าย เดิน 2 ขวา กระโดด ซ้าย เดิน 2"}'::jsonb),
  ('00000008-0000-4000-8000-000000000050', '00000002-0000-4000-8000-000000000008', 1, '{"en":"Never walk into the gap — jump over it!","th":"อย่าเดินลงหลุม — กระโดดข้ามไป!"}'::jsonb),
  ('00000008-0000-4000-8000-000000000051', '00000002-0000-4000-8000-000000000008', 2, '{"en":"Move 2, Jump, Move 1, Turn Left, Move 3, Pick Up.","th":"เดิน 2 กระโดด เดิน 1 เลี้ยวซ้าย เดิน 3 เก็บ"}'::jsonb),
  ('00000008-0000-4000-8000-00000000005a', '00000002-0000-4000-8000-000000000009', 1, '{"en":"Each step is the same: forward, left, forward, right.","th":"ทุกขั้นเหมือนกัน: เดินหน้า เลี้ยวซ้าย เดินหน้า เลี้ยวขวา"}'::jsonb),
  ('00000008-0000-4000-8000-00000000005b', '00000002-0000-4000-8000-000000000009', 2, '{"en":"Put those 4 blocks inside a Repeat that runs 5 times.","th":"ใส่ 4 บล็อกนั้นไว้ในบล็อกทำซ้ำ 5 ครั้ง"}'::jsonb),
  ('00000008-0000-4000-8000-000000000064', '00000002-0000-4000-8000-00000000000a', 1, '{"en":"Make a plan: crystal, jump the gap, generator, door, crystal, friend, goal.","th":"วางแผน: คริสตัล กระโดดข้ามหลุม เครื่องกำเนิด ประตู คริสตัล เพื่อน เป้าหมาย"}'::jsonb),
  ('00000008-0000-4000-8000-000000000065', '00000002-0000-4000-8000-00000000000a', 2, '{"en":"The door opens only after you Activate the generator.","th":"ประตูจะเปิดเมื่อคุณเปิดใช้งานเครื่องกำเนิดพลังงานแล้วเท่านั้น"}'::jsonb),
  ('00000008-0000-4000-8000-000000000066', '00000002-0000-4000-8000-00000000000a', 3, '{"en":"Finish with Celebrate while standing on the goal.","th":"จบด้วยการฉลองขณะยืนอยู่บนเป้าหมาย"}'::jsonb);
insert into public.lessons (id, position, demo_program) values
  ('00000005-0000-4000-8000-000000000001', 1, null),
  ('00000005-0000-4000-8000-000000000002', 2, '[{"type":"MOVE_FORWARD","steps":2},{"type":"WAVE"}]'::jsonb),
  ('00000005-0000-4000-8000-000000000003', 3, '[{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":1}]'::jsonb),
  ('00000005-0000-4000-8000-000000000004', 4, '[{"type":"MOVE_FORWARD","steps":2},{"type":"JUMP"},{"type":"MOVE_BACKWARD","steps":1}]'::jsonb),
  ('00000005-0000-4000-8000-000000000005', 5, '[{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_RIGHT"}]'::jsonb),
  ('00000005-0000-4000-8000-000000000006', 6, '[{"type":"REPEAT","times":3,"body":[{"type":"MOVE_FORWARD","steps":1},{"type":"WAVE"}]}]'::jsonb),
  ('00000005-0000-4000-8000-000000000007', 7, '[{"type":"MOVE_FORWARD","steps":2},{"type":"PICK_UP"},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":1}]'::jsonb);
insert into public.lesson_translations (id, lesson_id, lang, title, summary, body) values
  ('0000000b-0000-4000-8000-00000000000a', '00000005-0000-4000-8000-000000000001', 'th', 'การเขียนโปรแกรมคืออะไร?', 'การสั่งงานคอมพิวเตอร์อย่างชัดเจน', '## การเขียนโปรแกรม = การสั่งงานอย่างชัดเจน
การเขียนโปรแกรมคือการบอกคอมพิวเตอร์ว่าต้องทำ **อะไร** ทีละขั้นตอน

- คอมพิวเตอร์เดาใจเราไม่ได้
- มันทำตามที่เราสั่งเท่านั้น
- รายการคำสั่งเรียกว่า **โปรแกรม**

วันนี้ *คุณ* คือโปรแกรมเมอร์ และหุ่นยนต์จะทำตามโปรแกรมของคุณ!'),
  ('0000000b-0000-4000-8000-00000000000b', '00000005-0000-4000-8000-000000000001', 'en', 'What is Programming?', 'Giving clear instructions to a computer.', '## Programming = clear instructions
Programming means telling a computer **exactly** what to do, one step at a time.

- A computer cannot guess what you want.
- It does only what you tell it.
- A list of instructions is called a **program**.

Today *you* are the programmer, and the robot will follow your program!'),
  ('0000000b-0000-4000-8000-000000000014', '00000005-0000-4000-8000-000000000002', 'th', 'ทำความรู้จักคำสั่ง', 'บล็อกแต่ละอันคือคำสั่งหนึ่งคำสั่ง', '## บล็อกคือคำสั่ง
ในเกมนี้ **บล็อก** สีสันสดใสแต่ละอันคือคำสั่งสำหรับหุ่นยนต์

- **เดินหน้า** ทำให้หุ่นยนต์เดิน
- **โบกมือ** ทำให้หุ่นยนต์ทักทาย
- บางบล็อกมีตัวเลข เช่น *จำนวนก้าว*

ลากบล็อกมาต่อกันในพื้นที่ทำงาน แล้วกด **COMPILE** เพื่อรันโปรแกรม'),
  ('0000000b-0000-4000-8000-000000000015', '00000005-0000-4000-8000-000000000002', 'en', 'Understanding Commands', 'Each block is one command.', '## Blocks are commands
In this game every colorful **block** is a command for the robot.

- **Move Forward** makes the robot walk.
- **Wave** makes it say hello.
- Some blocks have a number, like *how many steps*.

Drag blocks into the workspace and snap them together. Then press **COMPILE** to run your program.'),
  ('0000000b-0000-4000-8000-00000000001e', '00000005-0000-4000-8000-000000000003', 'th', 'ลำดับและการเรียงคำสั่ง', 'คำสั่งทำงานจากบนลงล่าง', '## ลำดับสำคัญมาก!
หุ่นยนต์ทำตามบล็อกของคุณ **จากบนลงล่าง**

- เดิน 1 แล้วเลี้ยวซ้าย: หุ่นยนต์เดินแล้วจึงเลี้ยว
- เลี้ยวซ้ายแล้วเดิน 1: หุ่นยนต์เลี้ยวแล้วเดินไปอีกทางหนึ่ง!

เปลี่ยนลำดับ ผลลัพธ์ก็เปลี่ยน ถ้าหุ่นยนต์เดินผิดทาง ให้ตรวจลำดับคำสั่ง'),
  ('0000000b-0000-4000-8000-00000000001f', '00000005-0000-4000-8000-000000000003', 'en', 'Sequence and Order', 'Commands run from top to bottom.', '## Order matters!
The robot runs your blocks **from top to bottom**.

- Move 1, then turn left: the robot walks, then turns.
- Turn left, then move 1: the robot turns, then walks somewhere else!

Changing the order changes the result. If your robot goes the wrong way, check the order.'),
  ('0000000b-0000-4000-8000-000000000028', '00000005-0000-4000-8000-000000000004', 'th', 'คำสั่งการเคลื่อนที่', 'เดินหน้า ถอยหลัง และกระโดด', '## การเคลื่อนที่ของหุ่นยนต์
- **เดินหน้า** *(1–10 ก้าว)* เดินไปตามทิศที่หุ่นยนต์หันหน้าอยู่
- **ถอยหลัง** ก้าวถอยโดยไม่หมุนตัว
- **กระโดด** ข้ามช่องข้างหน้า ทั้งสิ่งกีดขวางและหลุม!

ระวัง: ถ้าเดินชนกำแพง สิ่งกีดขวาง หรือตกหลุม ภารกิจจะล้มเหลว ใช้ **กระโดด** เพื่อข้ามสิ่งกีดขวางและหลุม'),
  ('0000000b-0000-4000-8000-000000000029', '00000005-0000-4000-8000-000000000004', 'en', 'Movement Commands', 'Forward, backward and jump.', '## Moving the robot
- **Move Forward** *(1–10 steps)* walks in the direction the robot faces.
- **Move Backward** steps back without turning around.
- **Jump** leaps over the square in front: over a barrier or a gap!

Careful: walking into a wall, a barrier, or a gap means the mission fails. Use **Jump** to cross barriers and gaps.'),
  ('0000000b-0000-4000-8000-000000000032', '00000005-0000-4000-8000-000000000005', 'th', 'การเลี้ยวและทิศทาง', 'เลี้ยวซ้ายหรือขวา 90 องศา', '## การเลี้ยว
- **เลี้ยวซ้าย** หมุนหุ่นยนต์ไปทางซ้าย 90°
- **เลี้ยวขวา** หมุนหุ่นยนต์ไปทางขวา 90°

ซ้ายและขวานับจากมุมมองของ **หุ่นยนต์** ไม่ใช่ของเรา

เคล็ดลับ: การเลี้ยวไม่ทำให้หุ่นยนต์เคลื่อนที่ ต้องเดินต่อหลังเลี้ยว!'),
  ('0000000b-0000-4000-8000-000000000033', '00000005-0000-4000-8000-000000000005', 'en', 'Turns and Directions', 'Turn left or right by 90 degrees.', '## Turning
- **Turn Left** rotates the robot 90° to its left.
- **Turn Right** rotates the robot 90° to its right.

Left and right are always from the **robot''s** point of view, not yours.

Tip: Turning does not move the robot. Walk after you turn!'),
  ('0000000b-0000-4000-8000-00000000003c', '00000005-0000-4000-8000-000000000006', 'th', 'การทำคำสั่งซ้ำ', 'ลูปช่วยประหยัดเวลาและบล็อก', '## ลูป
บางครั้งเราต้องใช้คำสั่งเดิมซ้ำ ๆ

แทนที่จะใช้บล็อกเหมือนกัน 10 อัน ให้ใช้บล็อก **ทำซ้ำ** อันเดียวแล้ววางคำสั่งไว้ข้างใน ตั้งจำนวนครั้งที่ต้องการทำซ้ำ

- โปรแกรมสั้นลง
- ผิดพลาดน้อยลง
- โปรแกรมเมอร์ชอบลูป!'),
  ('0000000b-0000-4000-8000-00000000003d', '00000005-0000-4000-8000-000000000006', 'en', 'Repeating Commands', 'Loops save time and blocks.', '## Loops
Sometimes you need the same commands again and again.

Instead of 10 identical blocks, use one **Repeat** block and put the commands inside it. Set how many times to repeat.

- Shorter programs
- Fewer mistakes
- Programmers love loops!'),
  ('0000000b-0000-4000-8000-000000000046', '00000005-0000-4000-8000-000000000007', 'th', 'การแก้ปัญหา', 'วางแผน ทดลอง แก้ไข แล้วลองใหม่', '## เป็นนักแก้ปัญหา
1. **ดู** แผนที่และหาเป้าหมาย
2. **วางแผน** เส้นทางเป็นขั้นตอนเล็ก ๆ
3. **สร้าง** บล็อกของคุณ
4. **ทดลอง** ด้วย COMPILE
5. **แก้ไข** ข้อผิดพลาดแล้วลองใหม่ โปรแกรมเมอร์ทุกคนทำแบบนี้!

ติดขัดใช่ไหม? ใช้ **คำใบ้** ได้ เสียคะแนนเล็กน้อย แต่ช่วยให้ทำภารกิจสำเร็จ'),
  ('0000000b-0000-4000-8000-000000000047', '00000005-0000-4000-8000-000000000007', 'en', 'Solving Problems', 'Plan, test, fix, try again.', '## Be a problem solver
1. **Look** at the map and find the goal.
2. **Plan** the path in small steps.
3. **Build** your blocks.
4. **Test** with COMPILE.
5. **Fix** mistakes and try again. Every programmer does this!

Stuck? Use a **hint**. It costs a few points, but it can help you finish the mission.');
insert into public.block_definitions (id, command_type, category, label, description, color, icon, params, enabled, position) values
  ('00000007-0000-4000-8000-000000000001', 'MOVE_FORWARD', 'movement', '{"th":"เดินหน้า","en":"Move Forward"}'::jsonb, '{"th":"เดินไปข้างหน้าตามจำนวนก้าว","en":"Walk forward the given number of steps."}'::jsonb, '#3b82f6', 'arrow-up', '[{"name":"steps","min":1,"max":10,"default":1}]'::jsonb, true, 1),
  ('00000007-0000-4000-8000-000000000002', 'MOVE_BACKWARD', 'movement', '{"th":"ถอยหลัง","en":"Move Backward"}'::jsonb, '{"th":"ถอยหลังตามจำนวนก้าว โดยไม่หมุนตัว","en":"Step backward without turning around."}'::jsonb, '#6366f1', 'arrow-down', '[{"name":"steps","min":1,"max":10,"default":1}]'::jsonb, true, 2),
  ('00000007-0000-4000-8000-000000000003', 'TURN_LEFT', 'movement', '{"th":"เลี้ยวซ้าย","en":"Turn Left"}'::jsonb, '{"th":"หมุนตัวไปทางซ้าย 90 องศา","en":"Rotate 90 degrees to the left."}'::jsonb, '#0ea5e9', 'corner-up-left', '[]'::jsonb, true, 3),
  ('00000007-0000-4000-8000-000000000004', 'TURN_RIGHT', 'movement', '{"th":"เลี้ยวขวา","en":"Turn Right"}'::jsonb, '{"th":"หมุนตัวไปทางขวา 90 องศา","en":"Rotate 90 degrees to the right."}'::jsonb, '#0891b2', 'corner-up-right', '[]'::jsonb, true, 4),
  ('00000007-0000-4000-8000-000000000005', 'JUMP', 'actions', '{"th":"กระโดด","en":"Jump"}'::jsonb, '{"th":"กระโดดข้ามช่องข้างหน้า 1 ช่อง","en":"Leap over the cell in front of you."}'::jsonb, '#f97316', 'chevrons-up', '[]'::jsonb, true, 5),
  ('00000007-0000-4000-8000-000000000006', 'WAVE', 'actions', '{"th":"โบกมือ","en":"Wave"}'::jsonb, '{"th":"โบกมือทักทาย","en":"Wave hello."}'::jsonb, '#ec4899', 'hand', '[]'::jsonb, true, 6),
  ('00000007-0000-4000-8000-000000000007', 'PICK_UP', 'actions', '{"th":"เก็บ","en":"Pick Up"}'::jsonb, '{"th":"เก็บคริสตัลหรือช่วยหุ่นยนต์ในช่องที่ยืนอยู่","en":"Collect a crystal or rescue a robot on your cell."}'::jsonb, '#eab308', 'gem', '[]'::jsonb, true, 7),
  ('00000007-0000-4000-8000-000000000008', 'ACTIVATE', 'actions', '{"th":"เปิดใช้งาน","en":"Activate"}'::jsonb, '{"th":"เปิดเครื่องกำเนิดพลังงานในช่องที่ยืนอยู่","en":"Switch on the generator on your cell."}'::jsonb, '#22c55e', 'zap', '[]'::jsonb, true, 8),
  ('00000007-0000-4000-8000-000000000009', 'CELEBRATE', 'actions', '{"th":"ฉลอง","en":"Celebrate"}'::jsonb, '{"th":"ฉลองความสำเร็จ!","en":"Celebrate your success!"}'::jsonb, '#a855f7', 'party-popper', '[]'::jsonb, true, 9),
  ('00000007-0000-4000-8000-00000000000a', 'REPEAT', 'logic', '{"th":"ทำซ้ำ","en":"Repeat"}'::jsonb, '{"th":"ทำคำสั่งข้างในซ้ำตามจำนวนครั้ง","en":"Run the commands inside several times."}'::jsonb, '#14b8a6', 'repeat', '[{"name":"times","min":2,"max":20,"default":2}]'::jsonb, true, 10),
  ('00000007-0000-4000-8000-00000000000b', 'WAIT', 'logic', '{"th":"รอ","en":"Wait"}'::jsonb, '{"th":"หยุดรอตามจำนวนวินาที","en":"Pause for the given number of seconds."}'::jsonb, '#94a3b8', 'timer', '[{"name":"seconds","min":1,"max":5,"default":1}]'::jsonb, true, 11);
insert into public.rewards (id, position, name, description, min_score, stock_total) values
  ('00000006-0000-4000-8000-000000000001', 1, '{"en":"Robot Sticker Pack","th":"ชุดสติกเกอร์หุ่นยนต์"}'::jsonb, '{"en":"A pack of fun robot stickers.","th":"สติกเกอร์หุ่นยนต์สุดน่ารัก"}'::jsonb, 300, 100),
  ('00000006-0000-4000-8000-000000000002', 2, '{"en":"Robot Keychain","th":"พวงกุญแจหุ่นยนต์"}'::jsonb, '{"en":"A shiny robot keychain.","th":"พวงกุญแจหุ่นยนต์แวววาว"}'::jsonb, 1000, 50),
  ('00000006-0000-4000-8000-000000000003', 3, '{"en":"Champion Medal","th":"เหรียญแชมป์"}'::jsonb, '{"en":"For the best robot coders!","th":"สำหรับนักเขียนโค้ดหุ่นยนต์ยอดเยี่ยม!"}'::jsonb, 1700, 20);
insert into public.game_settings (score_rules, rewards_enabled) values ('{"mission_base":100,"no_hint_bonus":30,"no_error_bonus":20,"time_bonus_max":50,"time_bonus_full_seconds":30,"time_bonus_zero_seconds":180,"hint_penalty":10}'::jsonb, true) on conflict (singleton) do nothing;
insert into public.dashboard_settings default values on conflict (singleton) do nothing;
insert into public.game_sessions (name, status, registration_open) values ('Open House', 'ACTIVE', true);
insert into public.published_configs (snapshot, note) values ('{"version":1,"published_at":"2026-11-16T03:58:35.894Z","settings":{"score_rules":{"mission_base":100,"no_hint_bonus":30,"no_error_bonus":20,"time_bonus_max":50,"time_bonus_full_seconds":30,"time_bonus_zero_seconds":180,"hint_penalty":10},"timer_enabled":true,"total_duration_seconds":1200,"lesson_timer_seconds":null,"level_timer_seconds":null,"bonus_seconds_per_level":0,"lessons_mandatory":true,"allow_skip_lessons":false,"rewards_enabled":true},"worlds":[{"id":"00000001-0000-4000-8000-000000000001","position":1,"name":{"en":"Robot Training Station","th":"สถานีฝึกหุ่นยนต์"},"description":{"en":"Learn your first commands.","th":"เรียนรู้คำสั่งแรกของคุณ"},"theme":"training","color":"#38bdf8"},{"id":"00000001-0000-4000-8000-000000000002","position":2,"name":{"en":"Energy Planet","th":"ดาวพลังงาน"},"description":{"en":"Collect crystals and power up machines.","th":"เก็บคริสตัลและเปิดเครื่องจักรพลังงาน"},"theme":"energy","color":"#f59e0b"},{"id":"00000001-0000-4000-8000-000000000003","position":3,"name":{"en":"Lost Space Station","th":"สถานีอวกาศที่สาบสูญ"},"description":{"en":"Solve puzzles and rescue a friend.","th":"ไขปริศนาและช่วยเพื่อนหุ่นยนต์"},"theme":"station","color":"#a78bfa"},{"id":"00000001-0000-4000-8000-000000000004","position":4,"name":{"en":"Final Robot Mission","th":"ภารกิจหุ่นยนต์ขั้นสุดท้าย"},"description":{"en":"Use everything you learned!","th":"ใช้ทุกอย่างที่คุณเรียนรู้มา!"},"theme":"final","color":"#f43f5e"}],"levels":[{"id":"00000002-0000-4000-8000-000000000001","code":"level_01","world_id":"00000001-0000-4000-8000-000000000001","position":1,"version":1,"difficulty":1,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000001","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"ปลุกหุ่นยนต์!","en":"Wake Up, Robot!"},"description":{"th":"สั่งให้หุ่นยนต์เดินหน้าไปจนถึงเป้าหมายที่เรืองแสง","en":"Move the robot forward until it reaches the glowing goal."},"mission":{"map":{"width":7,"height":3,"rows":["_______","......G","_______"],"crystals":[],"generators":[],"friends":[]},"robot_start":{"x":0,"y":1,"dir":"E"},"objectives":[{"type":"REACH_GOAL"}],"rules":{"allowed_commands":["MOVE_FORWARD"],"max_blocks":3}},"hints":[{"id":"00000008-0000-4000-8000-00000000000a","position":1,"text":{"en":"Count the squares between the robot and the goal.","th":"ลองนับช่องระหว่างหุ่นยนต์กับเป้าหมาย"}},{"id":"00000008-0000-4000-8000-00000000000b","position":2,"text":{"en":"You need 6 steps. Use one Move Forward block and set it to 6.","th":"ต้องเดิน 6 ก้าว ใช้บล็อกเดินหน้า 1 อัน แล้วตั้งค่าเป็น 6"}}]},{"id":"00000002-0000-4000-8000-000000000002","code":"level_02","world_id":"00000001-0000-4000-8000-000000000001","position":2,"version":1,"difficulty":1,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000001","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"กระโดดข้ามไป","en":"Hop Over It"},"description":{"th":"มีสิ่งกีดขวางอยู่ข้างหน้า เดิน กระโดดข้ามไป แล้วไปให้ถึงเป้าหมาย","en":"A barrier blocks the path. Walk, jump over it, and reach the goal."},"mission":{"map":{"width":7,"height":3,"rows":["_______","...H..G","_______"],"crystals":[],"generators":[],"friends":[]},"robot_start":{"x":0,"y":1,"dir":"E"},"objectives":[{"type":"REACH_GOAL"}],"rules":{"allowed_commands":["MOVE_FORWARD","JUMP"],"max_blocks":5}},"hints":[{"id":"00000008-0000-4000-8000-000000000014","position":1,"text":{"en":"Walk right up to the barrier, then jump.","th":"เดินไปให้ชิดสิ่งกีดขวาง แล้วกระโดด"}},{"id":"00000008-0000-4000-8000-000000000015","position":2,"text":{"en":"Move forward 2, Jump, then Move forward 2.","th":"เดินหน้า 2 กระโดด แล้วเดินหน้าอีก 2"}}]},{"id":"00000002-0000-4000-8000-000000000003","code":"level_03","world_id":"00000001-0000-4000-8000-000000000001","position":3,"version":1,"difficulty":2,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000001","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"เลี้ยวซ้ายไปให้ถึง","en":"Turn the Corner"},"description":{"th":"เป้าหมายอยู่หลังหัวโค้ง เลี้ยวซ้ายเพื่อไปให้ถึง","en":"The goal is around the corner. Turn left to reach it."},"mission":{"map":{"width":6,"height":4,"rows":["_____G","_____.","_____.","......"],"crystals":[],"generators":[],"friends":[]},"robot_start":{"x":0,"y":3,"dir":"E"},"objectives":[{"type":"REACH_GOAL"}],"rules":{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT"],"max_blocks":5}},"hints":[{"id":"00000008-0000-4000-8000-00000000001e","position":1,"text":{"en":"Walk to the end of the path first.","th":"เดินไปสุดทางก่อน"}},{"id":"00000008-0000-4000-8000-00000000001f","position":2,"text":{"en":"Move forward 5, Turn Left, then Move forward 3.","th":"เดินหน้า 5 เลี้ยวซ้าย แล้วเดินหน้า 3"}}]},{"id":"00000002-0000-4000-8000-000000000004","code":"level_04","world_id":"00000001-0000-4000-8000-000000000002","position":4,"version":1,"difficulty":2,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000002","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"นักสะสมคริสตัล","en":"Crystal Collector"},"description":{"th":"เก็บคริสตัลพลังงานให้ครบทั้ง 3 ก้อน ยืนบนคริสตัลแล้วใช้คำสั่งเก็บ","en":"Collect all three energy crystals. Stand on a crystal and use Pick Up."},"mission":{"map":{"width":7,"height":3,"rows":["_______",".......","_______"],"crystals":[{"x":2,"y":1},{"x":4,"y":1},{"x":6,"y":1}],"generators":[],"friends":[]},"robot_start":{"x":0,"y":1,"dir":"E"},"objectives":[{"type":"COLLECT_CRYSTALS"}],"rules":{"allowed_commands":["MOVE_FORWARD","PICK_UP"],"max_blocks":8}},"hints":[{"id":"00000008-0000-4000-8000-000000000028","position":1,"text":{"en":"The robot must stand ON the crystal before using Pick Up.","th":"หุ่นยนต์ต้องยืนบนคริสตัลก่อนใช้คำสั่งเก็บ"}},{"id":"00000008-0000-4000-8000-000000000029","position":2,"text":{"en":"Move 2, Pick Up. Repeat for each crystal.","th":"เดิน 2 เก็บ แล้วทำซ้ำสำหรับทุกก้อน"}}]},{"id":"00000002-0000-4000-8000-000000000005","code":"level_05","world_id":"00000001-0000-4000-8000-000000000002","position":5,"version":1,"difficulty":2,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000002","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"หลบสิ่งกีดขวาง","en":"Wall Dodger"},"description":{"th":"มีกำแพงขวางทาง! หาทางอ้อมไปยังเป้าหมายให้ได้","en":"A wall is in the way! Find a path around it to the goal."},"mission":{"map":{"width":7,"height":3,"rows":["...#...","......G","_______"],"crystals":[],"generators":[],"friends":[]},"robot_start":{"x":0,"y":0,"dir":"E"},"objectives":[{"type":"REACH_GOAL"}],"rules":{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT"],"max_blocks":8}},"hints":[{"id":"00000008-0000-4000-8000-000000000032","position":1,"text":{"en":"You cannot walk through walls. Step down one row.","th":"เดินทะลุกำแพงไม่ได้ ลองลงไปอีกแถว"}},{"id":"00000008-0000-4000-8000-000000000033","position":2,"text":{"en":"Try: Turn Right, Move 1, Turn Left, Move 6.","th":"ลอง: เลี้ยวขวา เดิน 1 เลี้ยวซ้าย เดิน 6"}}]},{"id":"00000002-0000-4000-8000-000000000006","code":"level_06","world_id":"00000001-0000-4000-8000-000000000002","position":6,"version":1,"difficulty":3,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000002","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"เปิดพลังงาน!","en":"Power Up!"},"description":{"th":"ประตูถูกล็อก เปิดเครื่องกำเนิดพลังงานเพื่อเปิดประตู แล้วไปให้ถึงเป้าหมาย","en":"The door is locked. Activate the energy generator to open it, then reach the goal."},"mission":{"map":{"width":7,"height":3,"rows":["_______","....D.G","_______"],"crystals":[],"generators":[{"x":2,"y":1}],"friends":[]},"robot_start":{"x":0,"y":1,"dir":"E"},"objectives":[{"type":"ACTIVATE_GENERATORS"},{"type":"REACH_GOAL"}],"rules":{"allowed_commands":["MOVE_FORWARD","ACTIVATE","TURN_LEFT","TURN_RIGHT"],"max_blocks":6}},"hints":[{"id":"00000008-0000-4000-8000-00000000003c","position":1,"text":{"en":"Stand on the generator, then use Activate.","th":"ยืนบนเครื่องกำเนิดพลังงานแล้วใช้คำสั่งเปิดใช้งาน"}},{"id":"00000008-0000-4000-8000-00000000003d","position":2,"text":{"en":"Move 2, Activate, then Move 4.","th":"เดิน 2 เปิดใช้งาน แล้วเดิน 4"}}]},{"id":"00000002-0000-4000-8000-000000000007","code":"level_07","world_id":"00000001-0000-4000-8000-000000000003","position":7,"version":1,"difficulty":3,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000003","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"เขาวงกตอวกาศ","en":"Space Maze"},"description":{"th":"ผสมคำสั่งเดิน เลี้ยว และกระโดด เพื่อผ่านเขาวงกตสถานีอวกาศ","en":"Combine walking, turning and jumping to cross the space station maze."},"mission":{"map":{"width":7,"height":5,"rows":["_____G_","_____._","___.H._","___.___","....___"],"crystals":[],"generators":[],"friends":[]},"robot_start":{"x":0,"y":4,"dir":"E"},"objectives":[{"type":"REACH_GOAL"}],"rules":{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT","JUMP"],"max_blocks":12}},"hints":[{"id":"00000008-0000-4000-8000-000000000046","position":1,"text":{"en":"Follow the path: east, north, east (jump!), then north.","th":"ตามทางไป: ตะวันออก เหนือ ตะวันออก (กระโดด!) แล้วเหนือ"}},{"id":"00000008-0000-4000-8000-000000000047","position":2,"text":{"en":"Move 3, Left, Move 2, Right, Jump, Left, Move 2.","th":"เดิน 3 ซ้าย เดิน 2 ขวา กระโดด ซ้าย เดิน 2"}}]},{"id":"00000002-0000-4000-8000-000000000008","code":"level_08","world_id":"00000001-0000-4000-8000-000000000003","position":8,"version":1,"difficulty":3,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000003","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"ภารกิจช่วยเพื่อน","en":"Rescue Mission"},"description":{"th":"หุ่นยนต์เพื่อนติดอยู่บนสถานี ข้ามหลุมไปแล้วช่วยมันออกมา!","en":"A friendly robot is stuck on the station. Cross the gap and rescue it!"},"mission":{"map":{"width":7,"height":4,"rows":["_____._","_____._","_____._","...O..."],"crystals":[],"generators":[],"friends":[{"x":5,"y":0}]},"robot_start":{"x":0,"y":3,"dir":"E"},"objectives":[{"type":"RESCUE_FRIENDS"}],"rules":{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT","JUMP","PICK_UP"],"max_blocks":12}},"hints":[{"id":"00000008-0000-4000-8000-000000000050","position":1,"text":{"en":"Never walk into the gap — jump over it!","th":"อย่าเดินลงหลุม — กระโดดข้ามไป!"}},{"id":"00000008-0000-4000-8000-000000000051","position":2,"text":{"en":"Move 2, Jump, Move 1, Turn Left, Move 3, Pick Up.","th":"เดิน 2 กระโดด เดิน 1 เลี้ยวซ้าย เดิน 3 เก็บ"}}]},{"id":"00000002-0000-4000-8000-000000000009","code":"level_09","world_id":"00000001-0000-4000-8000-000000000003","position":9,"version":1,"difficulty":4,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000003","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"บันไดแห่งการวนซ้ำ","en":"Staircase Loop"},"description":{"th":"ปีนบันไดไปยังเป้าหมาย ใช้บล็อกทำซ้ำ — ถ้าไม่ใช้บล็อกจะไม่พอ!","en":"Climb the staircase to the goal. Use the Repeat block — you do not have enough blocks without it!"},"mission":{"map":{"width":6,"height":6,"rows":["_____G","____..","___.._","__..__","_..___","..____"],"crystals":[],"generators":[],"friends":[]},"robot_start":{"x":0,"y":5,"dir":"E"},"objectives":[{"type":"REACH_GOAL"}],"rules":{"allowed_commands":["MOVE_FORWARD","TURN_LEFT","TURN_RIGHT","REPEAT"],"max_blocks":8,"required_commands":["REPEAT"]}},"hints":[{"id":"00000008-0000-4000-8000-00000000005a","position":1,"text":{"en":"Each step is the same: forward, left, forward, right.","th":"ทุกขั้นเหมือนกัน: เดินหน้า เลี้ยวซ้าย เดินหน้า เลี้ยวขวา"}},{"id":"00000008-0000-4000-8000-00000000005b","position":2,"text":{"en":"Put those 4 blocks inside a Repeat that runs 5 times.","th":"ใส่ 4 บล็อกนั้นไว้ในบล็อกทำซ้ำ 5 ครั้ง"}}]},{"id":"00000002-0000-4000-8000-00000000000a","code":"level_10","world_id":"00000001-0000-4000-8000-000000000004","position":10,"version":1,"difficulty":5,"max_score":200,"time_limit_seconds":null,"scene_id":"00000003-0000-4000-8000-000000000004","robot_id":null,"completion_animation":"celebrate","unlock":{"type":"PREVIOUS_LEVEL"},"title":{"th":"ภารกิจสุดท้าย","en":"The Final Mission"},"description":{"th":"เก็บคริสตัลทั้ง 2 ก้อน เปิดเครื่องกำเนิดพลังงาน ช่วยเพื่อน ไปที่เป้าหมาย แล้วฉลอง!","en":"Collect both crystals, power up the generator, rescue your friend, reach the goal and celebrate!"},"mission":{"map":{"width":7,"height":5,"rows":["______G","______.","______.","______D","....O.."],"crystals":[{"x":2,"y":4},{"x":6,"y":2}],"generators":[{"x":6,"y":4}],"friends":[{"x":6,"y":1}]},"robot_start":{"x":0,"y":4,"dir":"E"},"objectives":[{"type":"COLLECT_CRYSTALS"},{"type":"ACTIVATE_GENERATORS"},{"type":"RESCUE_FRIENDS"},{"type":"REACH_GOAL"},{"type":"CELEBRATE"}],"rules":{"allowed_commands":["MOVE_FORWARD","MOVE_BACKWARD","TURN_LEFT","TURN_RIGHT","JUMP","WAVE","PICK_UP","ACTIVATE","CELEBRATE","REPEAT","WAIT"],"max_blocks":20}},"hints":[{"id":"00000008-0000-4000-8000-000000000064","position":1,"text":{"en":"Make a plan: crystal, jump the gap, generator, door, crystal, friend, goal.","th":"วางแผน: คริสตัล กระโดดข้ามหลุม เครื่องกำเนิด ประตู คริสตัล เพื่อน เป้าหมาย"}},{"id":"00000008-0000-4000-8000-000000000065","position":2,"text":{"en":"The door opens only after you Activate the generator.","th":"ประตูจะเปิดเมื่อคุณเปิดใช้งานเครื่องกำเนิดพลังงานแล้วเท่านั้น"}},{"id":"00000008-0000-4000-8000-000000000066","position":3,"text":{"en":"Finish with Celebrate while standing on the goal.","th":"จบด้วยการฉลองขณะยืนอยู่บนเป้าหมาย"}}]}],"blocks":[{"command_type":"MOVE_FORWARD","category":"movement","label":{"th":"เดินหน้า","en":"Move Forward"},"description":{"th":"เดินไปข้างหน้าตามจำนวนก้าว","en":"Walk forward the given number of steps."},"color":"#3b82f6","icon":"arrow-up","params":[{"name":"steps","min":1,"max":10,"default":1}],"enabled":true,"position":1},{"command_type":"MOVE_BACKWARD","category":"movement","label":{"th":"ถอยหลัง","en":"Move Backward"},"description":{"th":"ถอยหลังตามจำนวนก้าว โดยไม่หมุนตัว","en":"Step backward without turning around."},"color":"#6366f1","icon":"arrow-down","params":[{"name":"steps","min":1,"max":10,"default":1}],"enabled":true,"position":2},{"command_type":"TURN_LEFT","category":"movement","label":{"th":"เลี้ยวซ้าย","en":"Turn Left"},"description":{"th":"หมุนตัวไปทางซ้าย 90 องศา","en":"Rotate 90 degrees to the left."},"color":"#0ea5e9","icon":"corner-up-left","params":[],"enabled":true,"position":3},{"command_type":"TURN_RIGHT","category":"movement","label":{"th":"เลี้ยวขวา","en":"Turn Right"},"description":{"th":"หมุนตัวไปทางขวา 90 องศา","en":"Rotate 90 degrees to the right."},"color":"#0891b2","icon":"corner-up-right","params":[],"enabled":true,"position":4},{"command_type":"JUMP","category":"actions","label":{"th":"กระโดด","en":"Jump"},"description":{"th":"กระโดดข้ามช่องข้างหน้า 1 ช่อง","en":"Leap over the cell in front of you."},"color":"#f97316","icon":"chevrons-up","params":[],"enabled":true,"position":5},{"command_type":"WAVE","category":"actions","label":{"th":"โบกมือ","en":"Wave"},"description":{"th":"โบกมือทักทาย","en":"Wave hello."},"color":"#ec4899","icon":"hand","params":[],"enabled":true,"position":6},{"command_type":"PICK_UP","category":"actions","label":{"th":"เก็บ","en":"Pick Up"},"description":{"th":"เก็บคริสตัลหรือช่วยหุ่นยนต์ในช่องที่ยืนอยู่","en":"Collect a crystal or rescue a robot on your cell."},"color":"#eab308","icon":"gem","params":[],"enabled":true,"position":7},{"command_type":"ACTIVATE","category":"actions","label":{"th":"เปิดใช้งาน","en":"Activate"},"description":{"th":"เปิดเครื่องกำเนิดพลังงานในช่องที่ยืนอยู่","en":"Switch on the generator on your cell."},"color":"#22c55e","icon":"zap","params":[],"enabled":true,"position":8},{"command_type":"CELEBRATE","category":"actions","label":{"th":"ฉลอง","en":"Celebrate"},"description":{"th":"ฉลองความสำเร็จ!","en":"Celebrate your success!"},"color":"#a855f7","icon":"party-popper","params":[],"enabled":true,"position":9},{"command_type":"REPEAT","category":"logic","label":{"th":"ทำซ้ำ","en":"Repeat"},"description":{"th":"ทำคำสั่งข้างในซ้ำตามจำนวนครั้ง","en":"Run the commands inside several times."},"color":"#14b8a6","icon":"repeat","params":[{"name":"times","min":2,"max":20,"default":2}],"enabled":true,"position":10},{"command_type":"WAIT","category":"logic","label":{"th":"รอ","en":"Wait"},"description":{"th":"หยุดรอตามจำนวนวินาที","en":"Pause for the given number of seconds."},"color":"#94a3b8","icon":"timer","params":[{"name":"seconds","min":1,"max":5,"default":1}],"enabled":true,"position":11}],"lessons":[{"id":"00000005-0000-4000-8000-000000000001","position":1,"image_url":null,"video_url":null,"demo_program":null,"title":{"th":"การเขียนโปรแกรมคืออะไร?","en":"What is Programming?"},"summary":{"th":"การสั่งงานคอมพิวเตอร์อย่างชัดเจน","en":"Giving clear instructions to a computer."},"body":{"th":"## การเขียนโปรแกรม = การสั่งงานอย่างชัดเจน\nการเขียนโปรแกรมคือการบอกคอมพิวเตอร์ว่าต้องทำ **อะไร** ทีละขั้นตอน\n\n- คอมพิวเตอร์เดาใจเราไม่ได้\n- มันทำตามที่เราสั่งเท่านั้น\n- รายการคำสั่งเรียกว่า **โปรแกรม**\n\nวันนี้ *คุณ* คือโปรแกรมเมอร์ และหุ่นยนต์จะทำตามโปรแกรมของคุณ!","en":"## Programming = clear instructions\nProgramming means telling a computer **exactly** what to do, one step at a time.\n\n- A computer cannot guess what you want.\n- It does only what you tell it.\n- A list of instructions is called a **program**.\n\nToday *you* are the programmer, and the robot will follow your program!"}},{"id":"00000005-0000-4000-8000-000000000002","position":2,"image_url":null,"video_url":null,"demo_program":[{"type":"MOVE_FORWARD","steps":2},{"type":"WAVE"}],"title":{"th":"ทำความรู้จักคำสั่ง","en":"Understanding Commands"},"summary":{"th":"บล็อกแต่ละอันคือคำสั่งหนึ่งคำสั่ง","en":"Each block is one command."},"body":{"th":"## บล็อกคือคำสั่ง\nในเกมนี้ **บล็อก** สีสันสดใสแต่ละอันคือคำสั่งสำหรับหุ่นยนต์\n\n- **เดินหน้า** ทำให้หุ่นยนต์เดิน\n- **โบกมือ** ทำให้หุ่นยนต์ทักทาย\n- บางบล็อกมีตัวเลข เช่น *จำนวนก้าว*\n\nลากบล็อกมาต่อกันในพื้นที่ทำงาน แล้วกด **COMPILE** เพื่อรันโปรแกรม","en":"## Blocks are commands\nIn this game every colorful **block** is a command for the robot.\n\n- **Move Forward** makes the robot walk.\n- **Wave** makes it say hello.\n- Some blocks have a number, like *how many steps*.\n\nDrag blocks into the workspace and snap them together. Then press **COMPILE** to run your program."}},{"id":"00000005-0000-4000-8000-000000000003","position":3,"image_url":null,"video_url":null,"demo_program":[{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":1}],"title":{"th":"ลำดับและการเรียงคำสั่ง","en":"Sequence and Order"},"summary":{"th":"คำสั่งทำงานจากบนลงล่าง","en":"Commands run from top to bottom."},"body":{"th":"## ลำดับสำคัญมาก!\nหุ่นยนต์ทำตามบล็อกของคุณ **จากบนลงล่าง**\n\n- เดิน 1 แล้วเลี้ยวซ้าย: หุ่นยนต์เดินแล้วจึงเลี้ยว\n- เลี้ยวซ้ายแล้วเดิน 1: หุ่นยนต์เลี้ยวแล้วเดินไปอีกทางหนึ่ง!\n\nเปลี่ยนลำดับ ผลลัพธ์ก็เปลี่ยน ถ้าหุ่นยนต์เดินผิดทาง ให้ตรวจลำดับคำสั่ง","en":"## Order matters!\nThe robot runs your blocks **from top to bottom**.\n\n- Move 1, then turn left: the robot walks, then turns.\n- Turn left, then move 1: the robot turns, then walks somewhere else!\n\nChanging the order changes the result. If your robot goes the wrong way, check the order."}},{"id":"00000005-0000-4000-8000-000000000004","position":4,"image_url":null,"video_url":null,"demo_program":[{"type":"MOVE_FORWARD","steps":2},{"type":"JUMP"},{"type":"MOVE_BACKWARD","steps":1}],"title":{"th":"คำสั่งการเคลื่อนที่","en":"Movement Commands"},"summary":{"th":"เดินหน้า ถอยหลัง และกระโดด","en":"Forward, backward and jump."},"body":{"th":"## การเคลื่อนที่ของหุ่นยนต์\n- **เดินหน้า** *(1–10 ก้าว)* เดินไปตามทิศที่หุ่นยนต์หันหน้าอยู่\n- **ถอยหลัง** ก้าวถอยโดยไม่หมุนตัว\n- **กระโดด** ข้ามช่องข้างหน้า ทั้งสิ่งกีดขวางและหลุม!\n\nระวัง: ถ้าเดินชนกำแพง สิ่งกีดขวาง หรือตกหลุม ภารกิจจะล้มเหลว ใช้ **กระโดด** เพื่อข้ามสิ่งกีดขวางและหลุม","en":"## Moving the robot\n- **Move Forward** *(1–10 steps)* walks in the direction the robot faces.\n- **Move Backward** steps back without turning around.\n- **Jump** leaps over the square in front: over a barrier or a gap!\n\nCareful: walking into a wall, a barrier, or a gap means the mission fails. Use **Jump** to cross barriers and gaps."}},{"id":"00000005-0000-4000-8000-000000000005","position":5,"image_url":null,"video_url":null,"demo_program":[{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":1},{"type":"TURN_RIGHT"}],"title":{"th":"การเลี้ยวและทิศทาง","en":"Turns and Directions"},"summary":{"th":"เลี้ยวซ้ายหรือขวา 90 องศา","en":"Turn left or right by 90 degrees."},"body":{"th":"## การเลี้ยว\n- **เลี้ยวซ้าย** หมุนหุ่นยนต์ไปทางซ้าย 90°\n- **เลี้ยวขวา** หมุนหุ่นยนต์ไปทางขวา 90°\n\nซ้ายและขวานับจากมุมมองของ **หุ่นยนต์** ไม่ใช่ของเรา\n\nเคล็ดลับ: การเลี้ยวไม่ทำให้หุ่นยนต์เคลื่อนที่ ต้องเดินต่อหลังเลี้ยว!","en":"## Turning\n- **Turn Left** rotates the robot 90° to its left.\n- **Turn Right** rotates the robot 90° to its right.\n\nLeft and right are always from the **robot''s** point of view, not yours.\n\nTip: Turning does not move the robot. Walk after you turn!"}},{"id":"00000005-0000-4000-8000-000000000006","position":6,"image_url":null,"video_url":null,"demo_program":[{"type":"REPEAT","times":3,"body":[{"type":"MOVE_FORWARD","steps":1},{"type":"WAVE"}]}],"title":{"th":"การทำคำสั่งซ้ำ","en":"Repeating Commands"},"summary":{"th":"ลูปช่วยประหยัดเวลาและบล็อก","en":"Loops save time and blocks."},"body":{"th":"## ลูป\nบางครั้งเราต้องใช้คำสั่งเดิมซ้ำ ๆ\n\nแทนที่จะใช้บล็อกเหมือนกัน 10 อัน ให้ใช้บล็อก **ทำซ้ำ** อันเดียวแล้ววางคำสั่งไว้ข้างใน ตั้งจำนวนครั้งที่ต้องการทำซ้ำ\n\n- โปรแกรมสั้นลง\n- ผิดพลาดน้อยลง\n- โปรแกรมเมอร์ชอบลูป!","en":"## Loops\nSometimes you need the same commands again and again.\n\nInstead of 10 identical blocks, use one **Repeat** block and put the commands inside it. Set how many times to repeat.\n\n- Shorter programs\n- Fewer mistakes\n- Programmers love loops!"}},{"id":"00000005-0000-4000-8000-000000000007","position":7,"image_url":null,"video_url":null,"demo_program":[{"type":"MOVE_FORWARD","steps":2},{"type":"PICK_UP"},{"type":"TURN_LEFT"},{"type":"MOVE_FORWARD","steps":1}],"title":{"th":"การแก้ปัญหา","en":"Solving Problems"},"summary":{"th":"วางแผน ทดลอง แก้ไข แล้วลองใหม่","en":"Plan, test, fix, try again."},"body":{"th":"## เป็นนักแก้ปัญหา\n1. **ดู** แผนที่และหาเป้าหมาย\n2. **วางแผน** เส้นทางเป็นขั้นตอนเล็ก ๆ\n3. **สร้าง** บล็อกของคุณ\n4. **ทดลอง** ด้วย COMPILE\n5. **แก้ไข** ข้อผิดพลาดแล้วลองใหม่ โปรแกรมเมอร์ทุกคนทำแบบนี้!\n\nติดขัดใช่ไหม? ใช้ **คำใบ้** ได้ เสียคะแนนเล็กน้อย แต่ช่วยให้ทำภารกิจสำเร็จ","en":"## Be a problem solver\n1. **Look** at the map and find the goal.\n2. **Plan** the path in small steps.\n3. **Build** your blocks.\n4. **Test** with COMPILE.\n5. **Fix** mistakes and try again. Every programmer does this!\n\nStuck? Use a **hint**. It costs a few points, but it can help you finish the mission."}}],"robots":[{"id":"00000004-0000-4000-8000-000000000001","name":{"en":"Bolt","th":"โบลต์"},"kind":"builtin","builtin_style":"bolt","sprite_url":null,"frame_width":null,"frame_height":null,"animations":{},"scale":1,"move_speed_ms":450,"primary_color":"#38bdf8","is_default":true},{"id":"00000004-0000-4000-8000-000000000002","name":{"en":"Nova","th":"โนวา"},"kind":"builtin","builtin_style":"nova","sprite_url":null,"frame_width":null,"frame_height":null,"animations":{},"scale":1,"move_speed_ms":450,"primary_color":"#f472b6","is_default":false},{"id":"00000004-0000-4000-8000-000000000003","name":{"en":"Gizmo","th":"กิซโม่"},"kind":"builtin","builtin_style":"gizmo","sprite_url":null,"frame_width":null,"frame_height":null,"animations":{},"scale":1,"move_speed_ms":450,"primary_color":"#4ade80","is_default":false}],"scenes":[{"id":"00000003-0000-4000-8000-000000000001","name":{"en":"Training Station","th":"สถานีฝึก"},"kind":"builtin","theme":"training","image_url":null,"width":960,"height":540,"parallax":[]},{"id":"00000003-0000-4000-8000-000000000002","name":{"en":"Energy Planet","th":"ดาวพลังงาน"},"kind":"builtin","theme":"energy","image_url":null,"width":960,"height":540,"parallax":[]},{"id":"00000003-0000-4000-8000-000000000003","name":{"en":"Lost Station","th":"สถานีที่สาบสูญ"},"kind":"builtin","theme":"station","image_url":null,"width":960,"height":540,"parallax":[]},{"id":"00000003-0000-4000-8000-000000000004","name":{"en":"Final Mission","th":"ภารกิจสุดท้าย"},"kind":"builtin","theme":"final","image_url":null,"width":960,"height":540,"parallax":[]}]}'::jsonb, 'Initial seed configuration');
commit;
