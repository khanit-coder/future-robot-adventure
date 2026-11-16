/**
 * Row types mirroring the PostgreSQL tables (see supabase/migrations).
 * Hand-written because the generated Supabase types need a live project; kept in the shared
 * folder so the Edge Functions and the frontend agree on the exact same shapes.
 */
import type {
  BlockParamSpec,
  CommandType,
  Command,
  GameplaySettings,
  Localized,
  MapSpec,
  Objective,
  MissionRules,
  RobotAnimationRange,
  RobotStart,
  ScoreRules,
  UnlockRequirement,
} from './types.ts';

export type PlayerStatus = 'REGISTERED' | 'LEARNING' | 'PLAYING' | 'FINISHED' | 'TIME_EXPIRED';
export type SessionStatus = 'ACTIVE' | 'CLOSED';
export type ClaimStatus = 'RESERVED' | 'CLAIMED' | 'CANCELLED';
export type DashboardMode = 'GRID' | 'PLANET' | 'SPOTLIGHT';
export type ThemeKey = 'training' | 'energy' | 'station' | 'final';

interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface AdminRow extends Timestamps {
  id: string;
  user_id: string;
  email: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN';
}

export interface GameSettingsRow extends Timestamps {
  id: string;
  singleton: true;
  game_title: Localized;
  tagline: Localized;
  event_title: Localized;
  college_name: Localized;
  college_logo_url: string | null;
  game_logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  default_language: 'th' | 'en';
  maintenance_mode: boolean;
  maintenance_message: Localized;
  announcement: Localized | null;
  score_rules: ScoreRules;
  timer_enabled: boolean;
  total_duration_seconds: number;
  lesson_timer_seconds: number | null;
  level_timer_seconds: number | null;
  bonus_seconds_per_level: number;
  lessons_mandatory: boolean;
  allow_skip_lessons: boolean;
  rewards_enabled: boolean;
}

export interface DashboardSettingsRow extends Timestamps {
  id: string;
  singleton: true;
  mode: DashboardMode;
  columns: number;
  robot_size: number;
  page_size: number;
  rotate_seconds: number;
  show_school: boolean;
  show_leaderboard: boolean;
  show_scores: boolean;
  show_online_count: boolean;
  animations_enabled: boolean;
  theme: 'space' | 'lab' | 'planet' | 'light';
  background_url: string | null;
  spotlight_interval_seconds: number;
}

export interface GameSessionRow extends Timestamps {
  id: string;
  name: string;
  status: SessionStatus;
  registration_open: boolean;
  started_at: string;
  closed_at: string | null;
}

export interface RobotAssetRow extends Timestamps {
  id: string;
  name: Localized;
  kind: 'builtin' | 'spritesheet';
  builtin_style: string | null;
  sprite_url: string | null;
  frame_width: number | null;
  frame_height: number | null;
  animations: Record<string, RobotAnimationRange>;
  scale: number;
  move_speed_ms: number;
  primary_color: string;
  is_default: boolean;
  is_active: boolean;
}

export interface SceneAssetRow extends Timestamps {
  id: string;
  name: Localized;
  kind: 'builtin' | 'image';
  theme: ThemeKey;
  image_url: string | null;
  width: number;
  height: number;
  parallax: { url: string; speed: number }[];
  is_active: boolean;
}

export interface WorldRow extends Timestamps {
  id: string;
  position: number;
  name: Localized;
  description: Localized;
  theme: ThemeKey;
  color: string;
  is_active: boolean;
}

export interface LevelRow extends Timestamps {
  id: string;
  code: string;
  world_id: string;
  position: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  max_score: number;
  time_limit_seconds: number | null;
  scene_asset_id: string | null;
  robot_asset_id: string | null;
  completion_animation: 'celebrate' | 'wave' | 'jump';
  unlock: UnlockRequirement;
  is_active: boolean;
  version: number;
}

export interface LevelTranslationRow extends Timestamps {
  id: string;
  level_id: string;
  lang: 'th' | 'en';
  title: string;
  description: string;
}

export interface MissionRow extends Timestamps {
  id: string;
  level_id: string;
  map: MapSpec;
  robot_start: RobotStart;
  objectives: Objective[];
  rules: MissionRules;
  expected_solutions: Command[][];
}

export interface HintRow extends Timestamps {
  id: string;
  level_id: string;
  position: number;
  text: Localized;
}

export interface LessonRow extends Timestamps {
  id: string;
  position: number;
  image_url: string | null;
  video_url: string | null;
  demo_program: Command[] | null;
  is_active: boolean;
}

export interface LessonTranslationRow extends Timestamps {
  id: string;
  lesson_id: string;
  lang: 'th' | 'en';
  title: string;
  summary: string;
  body: string;
}

export interface BlockDefinitionRow extends Timestamps {
  id: string;
  command_type: CommandType;
  category: 'movement' | 'actions' | 'logic';
  label: Localized;
  description: Localized;
  color: string;
  icon: string;
  params: BlockParamSpec[];
  enabled: boolean;
  position: number;
}

export interface I18nOverrideRow extends Timestamps {
  id: string;
  lang: 'th' | 'en';
  namespace: string;
  key: string;
  value: string;
}

export interface PublishedConfigRow {
  id: string;
  version: number;
  snapshot: import('./types.ts').PublishedConfig;
  note: string | null;
  published_by: string | null;
  published_at: string;
}

export interface PlayerRow extends Timestamps {
  id: string;
  game_session_id: string;
  auth_user_id: string;
  display_name: string;
  school: string;
  grade: string | null;
  lang: 'th' | 'en';
}

export interface PlayerSessionRow extends Timestamps {
  id: string;
  player_id: string;
  game_session_id: string;
  status: PlayerStatus;
  config_version: number;
  started_at: string | null;
  expires_at: string | null;
  finished_at: string | null;
  bonus_seconds: number;
  total_score: number;
  levels_completed: number;
  total_attempts: number;
  hints_used: number;
  lessons_completed: number;
  best_level_ms: number | null;
  current_level_id: string | null;
  last_seen_at: string;
}

export interface PlayerLevelProgressRow extends Timestamps {
  id: string;
  player_session_id: string;
  level_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  attempts: number;
  failed_attempts: number;
  hints_used: number;
  started_at: string;
  completed_at: string | null;
  completion_ms: number | null;
  score: number;
}

export interface SubmissionRow {
  id: string;
  player_session_id: string;
  level_id: string;
  client_submission_id: string;
  program: Command[];
  status: 'INVALID' | 'FAILED' | 'SUCCESS';
  result: unknown;
  created_at: string;
}

export interface LessonProgressRow {
  id: string;
  player_session_id: string;
  lesson_id: string;
  completed_at: string;
}

export interface ScoreRecordRow extends Timestamps {
  id: string;
  player_id: string;
  player_session_id: string;
  level_id: string | null;
  kind: 'MISSION' | 'ADJUSTMENT';
  points: number;
  breakdown: Record<string, unknown>;
  note: string | null;
  created_by: string | null;
}

export interface RewardRow extends Timestamps {
  id: string;
  position: number;
  name: Localized;
  description: Localized;
  image_url: string | null;
  min_score: number;
  stock_total: number;
  reserved_count: number;
  claimed_count: number;
  is_active: boolean;
}

export interface RewardClaimRow extends Timestamps {
  id: string;
  reward_id: string;
  player_id: string;
  player_session_id: string;
  status: ClaimStatus;
  claim_code: string;
  claimed_at: string | null;
  claimed_by: string | null;
}

export interface GameEventRow {
  id: string;
  seq: number;
  game_session_id: string | null;
  player_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/** Everything the publisher needs to freeze a gameplay configuration. */
export interface DraftData {
  settings: Pick<
    GameSettingsRow,
    | 'score_rules'
    | 'timer_enabled'
    | 'total_duration_seconds'
    | 'lesson_timer_seconds'
    | 'level_timer_seconds'
    | 'bonus_seconds_per_level'
    | 'lessons_mandatory'
    | 'allow_skip_lessons'
    | 'rewards_enabled'
  >;
  worlds: WorldRow[];
  levels: LevelRow[];
  level_translations: LevelTranslationRow[];
  missions: MissionRow[];
  hints: HintRow[];
  lessons: LessonRow[];
  lesson_translations: LessonTranslationRow[];
  blocks: BlockDefinitionRow[];
  robots: RobotAssetRow[];
  scenes: SceneAssetRow[];
}

export type { GameplaySettings };
