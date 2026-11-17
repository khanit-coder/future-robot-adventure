/**
 * Shared, framework-free domain types.
 *
 * This folder is imported by BOTH the browser (Vite) and the Supabase Edge Functions (Deno),
 * so it must stay pure TypeScript: no DOM, no Deno globals, no npm imports.
 * Relative imports therefore always include the `.ts` extension.
 */

export const LANGS = ['th', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export type Localized = Partial<Record<Lang, string>>;

export type Direction = 'N' | 'E' | 'S' | 'W';

export interface Pos {
  x: number;
  y: number;
}

/** Language-independent command identifiers. Only these can ever be executed. */
export const COMMAND_TYPES = [
  'MOVE_FORWARD',
  'MOVE_BACKWARD',
  'TURN_LEFT',
  'TURN_RIGHT',
  'JUMP',
  'WAVE',
  'PICK_UP',
  'ACTIVATE',
  'CELEBRATE',
  'REPEAT',
  'WAIT',
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

export interface Command {
  type: CommandType;
  /** MOVE_FORWARD / MOVE_BACKWARD */
  steps?: number;
  /** REPEAT */
  times?: number;
  /** REPEAT body */
  body?: Command[];
  /** WAIT */
  seconds?: number;
  /** Optional Blockly block id, echoed back in the trace so the UI can highlight the running block. */
  id?: string;
}

/** Tile characters used in `MapSpec.rows`. */
export type TileChar = '.' | '#' | 'H' | 'O' | 'G' | 'D' | '_';

export interface MapSpec {
  width: number;
  height: number;
  /** One string per row (top to bottom). `.` floor `#` wall `H` hurdle `O` gap `G` goal `D` door `_` void */
  rows: string[];
  crystals: Pos[];
  generators: Pos[];
  friends: Pos[];
}

export interface RobotStart extends Pos {
  dir: Direction;
}

export const OBJECTIVE_TYPES = [
  'REACH_GOAL',
  'COLLECT_CRYSTALS',
  'ACTIVATE_GENERATORS',
  'RESCUE_FRIENDS',
  'CELEBRATE',
] as const;
export type ObjectiveType = (typeof OBJECTIVE_TYPES)[number];

export interface Objective {
  type: ObjectiveType;
  /** COLLECT_CRYSTALS only: how many crystals are required (defaults to all). */
  count?: number;
}

export interface MissionRules {
  allowed_commands: CommandType[];
  max_blocks: number;
  /** Commands that must appear in the program (e.g. REPEAT in the "repeat" level). */
  required_commands?: CommandType[];
}

export interface MissionSpec {
  map: MapSpec;
  robot_start: RobotStart;
  objectives: Objective[];
  rules: MissionRules;
}

/* ------------------------------------------------------------------ */
/* Execution trace                                                     */
/* ------------------------------------------------------------------ */

export type FailureCode =
  | 'HIT_WALL'
  | 'HIT_EDGE'
  | 'HIT_HURDLE'
  | 'DOOR_CLOSED'
  | 'FELL_IN_GAP'
  | 'JUMP_BLOCKED'
  | 'TOO_MANY_STEPS'
  | 'OBJECTIVES_INCOMPLETE';

interface TraceBase {
  /** Blockly block id of the command that produced this event (if supplied). */
  block_id?: string;
}

export type TraceEvent =
  | (TraceBase & { kind: 'move'; from: Pos; to: Pos; dir: Direction; backwards: boolean })
  | (TraceBase & { kind: 'turn'; side: 'left' | 'right'; from_dir: Direction; to_dir: Direction; at: Pos })
  | (TraceBase & { kind: 'jump'; from: Pos; to: Pos; dir: Direction })
  | (TraceBase & { kind: 'wave'; at: Pos; dir: Direction })
  | (TraceBase & { kind: 'celebrate'; at: Pos; dir: Direction })
  | (TraceBase & { kind: 'wait'; seconds: number; at: Pos })
  | (TraceBase & { kind: 'pickup'; at: Pos; item: 'crystal' | 'friend'; index: number })
  | (TraceBase & { kind: 'pickup_none'; at: Pos })
  | (TraceBase & { kind: 'activate'; at: Pos; index: number; doors_open: boolean })
  | (TraceBase & { kind: 'activate_none'; at: Pos })
  | (TraceBase & { kind: 'bump'; at: Pos; target: Pos; reason: FailureCode })
  | (TraceBase & { kind: 'fall'; from: Pos; to: Pos });

export interface ObjectiveStatus {
  type: ObjectiveType;
  done: boolean;
  current: number;
  target: number;
}

export interface FinalState {
  x: number;
  y: number;
  dir: Direction;
  collected: number[];
  rescued: number[];
  activated: number[];
  doors_open: boolean;
  celebrated_at_goal: boolean;
}

export interface ExecutionResult {
  success: boolean;
  trace: TraceEvent[];
  objectives: ObjectiveStatus[];
  failure?: { code: FailureCode };
  final: FinalState;
  /** Number of primitive commands executed (loops expanded). */
  steps_executed: number;
  /** Number of blocks in the submitted program (loops count as one plus their body). */
  blocks_used: number;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type ValidationCode =
  | 'MALFORMED'
  | 'EMPTY_PROGRAM'
  | 'UNKNOWN_COMMAND'
  | 'COMMAND_NOT_ALLOWED'
  | 'PARAM_RANGE'
  | 'REPEAT_EMPTY'
  | 'TOO_DEEP'
  | 'TOO_MANY_BLOCKS'
  | 'MISSING_REQUIRED';

export interface ValidationIssue {
  code: ValidationCode;
  params?: Record<string, string | number>;
}

export type ProgramParseResult =
  | { ok: true; commands: Command[]; blocks: number }
  | { ok: false; issues: ValidationIssue[] };

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export type GameTheme = 'space' | 'lab' | 'planet' | 'light';

export interface ScoreRules {
  mission_base: number;
  no_hint_bonus: number;
  no_error_bonus: number;
  time_bonus_max: number;
  /** Full time bonus when solved within this many seconds. */
  time_bonus_full_seconds: number;
  /** No time bonus when solving takes this long or more. */
  time_bonus_zero_seconds: number;
  hint_penalty: number;
  game_theme?: GameTheme;
}

export interface ScoreBreakdown {
  base: number;
  no_hint_bonus: number;
  no_error_bonus: number;
  time_bonus: number;
  hint_penalty: number;
  capped_at?: number;
  total: number;
}

/* ------------------------------------------------------------------ */
/* Published (versioned) gameplay configuration                       */
/* ------------------------------------------------------------------ */

export interface BlockParamSpec {
  name: 'steps' | 'times' | 'seconds';
  min: number;
  max: number;
  default: number;
}

export interface BlockDefinition {
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

export type UnlockRequirement =
  | { type: 'NONE' }
  | { type: 'PREVIOUS_LEVEL' }
  | { type: 'MIN_SCORE'; score: number }
  | { type: 'LEVEL'; level_id: string };

export interface HintConfig {
  id: string;
  position: number;
  text: Localized;
}

export interface LevelConfig {
  id: string;
  /** Stable human-readable code, e.g. "level_01". */
  code: string;
  world_id: string;
  position: number;
  version: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  max_score: number;
  time_limit_seconds: number | null;
  scene_id: string | null;
  robot_id: string | null;
  completion_animation: 'celebrate' | 'wave' | 'jump';
  unlock: UnlockRequirement;
  title: Localized;
  description: Localized;
  mission: MissionSpec;
  hints: HintConfig[];
}

export interface WorldConfig {
  id: string;
  position: number;
  name: Localized;
  description: Localized;
  theme: string;
  color: string;
}

export interface LessonConfig {
  id: string;
  position: number;
  image_url: string | null;
  video_url: string | null;
  /** Optional block demonstration program shown in the lesson. */
  demo_program: Command[] | null;
  title: Localized;
  summary: Localized;
  body: Localized;
}

export interface RobotAnimationRange {
  start: number;
  end: number;
  frame_rate: number;
  repeat: number;
}

export interface RobotConfig {
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
}

export interface SceneConfig {
  id: string;
  name: Localized;
  kind: 'builtin' | 'image';
  theme: string;
  image_url: string | null;
  width: number;
  height: number;
  parallax: { url: string; speed: number }[];
}

export interface GameplaySettings {
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

export interface PublishedConfig {
  version: number;
  published_at: string;
  settings: GameplaySettings;
  worlds: WorldConfig[];
  levels: LevelConfig[];
  blocks: BlockDefinition[];
  lessons: LessonConfig[];
  robots: RobotConfig[];
  scenes: SceneConfig[];
}

/* ------------------------------------------------------------------ */
/* Realtime events                                                     */
/* ------------------------------------------------------------------ */

export const EVENT_TYPES = [
  'PLAYER_JOINED',
  'PLAYER_STARTED',
  'PLAYER_LESSON_PROGRESS',
  'PLAYER_COMPILE_SUCCESS',
  'PLAYER_COMPILE_FAILED',
  'PLAYER_LEVEL_COMPLETED',
  'PLAYER_SCORE_UPDATED',
  'PLAYER_FINISHED',
  'PLAYER_DISCONNECTED',
  'GAME_SESSION_UPDATED',
  'CONFIG_PUBLISHED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface GameEvent<P = Record<string, unknown>> {
  event_id: string;
  type: EventType;
  player_id: string | null;
  session_id: string | null;
  /** Monotonic database sequence number (identity column). */
  sequence_number: number;
  timestamp: string;
  payload: P;
}
