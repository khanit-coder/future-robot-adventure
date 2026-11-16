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
