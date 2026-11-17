import type { BlockDefinition, BlockParamSpec, Command, CommandType } from './types.ts';

/** Hard safety caps. Admin block settings can only lower these, never raise them. */
export const HARD_LIMITS = {
  MAX_STEPS: 10,
  MAX_REPEAT: 20,
  MAX_WAIT_SECONDS: 5,
  MAX_NESTING: 3,
  MAX_BLOCKS: 60,
  /** Maximum primitive commands executed after expanding loops. */
  MAX_EXEC_STEPS: 400,
  MAX_BODY_ID_LENGTH: 64,
} as const;

export const CATEGORY_OF: Record<CommandType, BlockDefinition['category']> = {
  MOVE_FORWARD: 'movement',
  MOVE_BACKWARD: 'movement',
  TURN_LEFT: 'movement',
  TURN_RIGHT: 'movement',
  JUMP: 'actions',
  WAVE: 'actions',
  PICK_UP: 'actions',
  ACTIVATE: 'actions',
  CELEBRATE: 'actions',
  REPEAT: 'logic',
  WAIT: 'logic',
};

/** Which parameter (if any) each command accepts. */
export const PARAM_OF: Partial<Record<CommandType, BlockParamSpec['name']>> = {
  MOVE_FORWARD: 'steps',
  MOVE_BACKWARD: 'steps',
  REPEAT: 'times',
  WAIT: 'seconds',
};

export const HAS_BODY: ReadonlySet<CommandType> = new Set<CommandType>(['REPEAT']);

export type ParamLimits = Partial<Record<CommandType, { min: number; max: number }>>;

export function defaultLimits(): Record<'steps' | 'times' | 'seconds', { min: number; max: number }> {
  return {
    steps: { min: 1, max: HARD_LIMITS.MAX_STEPS },
    times: { min: 2, max: HARD_LIMITS.MAX_REPEAT },
    seconds: { min: 1, max: HARD_LIMITS.MAX_WAIT_SECONDS },
  };
}

/** Resolve the allowed range for a command parameter, clamped to the hard caps. */
export function limitFor(type: CommandType, overrides?: ParamLimits): { min: number; max: number } | null {
  const param = PARAM_OF[type];
  if (!param) return null;
  const base = defaultLimits()[param];
  const o = overrides?.[type];
  if (!o) return base;
  return {
    min: Math.max(base.min, Math.floor(o.min)),
    max: Math.min(base.max, Math.floor(o.max)),
  };
}

export function limitsFromBlocks(blocks: BlockDefinition[] | undefined): ParamLimits {
  const out: ParamLimits = {};
  for (const b of blocks ?? []) {
    const p = b.params?.[0];
    if (p) out[b.command_type] = { min: p.min, max: p.max };
  }
  return out;
}

/** The default definitions used for seeding and as a fallback. */
export const DEFAULT_BLOCKS: BlockDefinition[] = [
  def('MOVE_FORWARD', 'movement', 'เดินหน้า', 'Move Forward', 'เดินไปข้างหน้าตามจำนวนก้าว', 'Walk forward the given number of steps.', '#3b82f6', 'arrow-up', [{ name: 'steps', min: 1, max: 10, default: 1 }], 1),
  def('MOVE_BACKWARD', 'movement', 'ถอยหลัง', 'Move Backward', 'ถอยหลังตามจำนวนก้าว โดยไม่หมุนตัว', 'Step backward without turning around.', '#6366f1', 'arrow-down', [{ name: 'steps', min: 1, max: 10, default: 1 }], 2),
  def('TURN_LEFT', 'movement', 'เลี้ยวซ้าย', 'Turn Left', 'หมุนตัวไปทางซ้าย 90 องศา', 'Rotate 90 degrees to the left.', '#0ea5e9', 'corner-up-left', [], 3),
  def('TURN_RIGHT', 'movement', 'เลี้ยวขวา', 'Turn Right', 'หมุนตัวไปทางขวา 90 องศา', 'Rotate 90 degrees to the right.', '#0891b2', 'corner-up-right', [], 4),
  def('JUMP', 'actions', 'กระโดด', 'Jump', 'กระโดดข้ามช่องข้างหน้า 1 ช่อง', 'Leap over the cell in front of you.', '#f97316', 'chevrons-up', [], 5),
  def('WAVE', 'actions', 'โบกมือ', 'Wave', 'โบกมือทักทาย', 'Wave hello.', '#ec4899', 'hand', [], 6),
  def('PICK_UP', 'actions', 'เก็บ/ช่วย', 'Pick Up / Rescue', 'เก็บคริสตัลหรือช่วยหุ่นยนต์ในช่องที่ยืนอยู่', 'Collect a crystal or rescue a robot on your cell.', '#eab308', 'gem', [], 7),
  def('ACTIVATE', 'actions', 'เปิดใช้งาน', 'Activate', 'เปิดเครื่องกำเนิดพลังงานในช่องที่ยืนอยู่', 'Switch on the generator on your cell.', '#22c55e', 'zap', [], 8),
  def('CELEBRATE', 'actions', 'ฉลอง', 'Celebrate', 'ฉลองความสำเร็จ!', 'Celebrate your success!', '#a855f7', 'party-popper', [], 9),
  def('REPEAT', 'logic', 'ทำซ้ำ', 'Repeat', 'ทำคำสั่งข้างในซ้ำตามจำนวนครั้ง', 'Run the commands inside several times.', '#14b8a6', 'repeat', [{ name: 'times', min: 2, max: 20, default: 2 }], 10),
  def('WAIT', 'logic', 'รอ', 'Wait', 'หยุดรอตามจำนวนวินาที', 'Pause for the given number of seconds.', '#94a3b8', 'timer', [{ name: 'seconds', min: 1, max: 5, default: 1 }], 11),
];

function def(
  command_type: CommandType,
  category: BlockDefinition['category'],
  th: string,
  en: string,
  dth: string,
  den: string,
  color: string,
  icon: string,
  params: BlockParamSpec[],
  position: number,
): BlockDefinition {
  return {
    command_type,
    category,
    label: { th, en },
    description: { th: dth, en: den },
    color,
    icon,
    params,
    enabled: true,
    position,
  };
}

export function isCommandType(v: unknown): v is CommandType {
  return typeof v === 'string' && v in CATEGORY_OF;
}

/** Count blocks in a program (REPEAT counts as one plus its body). */
export function countBlocks(commands: Command[]): number {
  let n = 0;
  for (const c of commands) {
    n += 1;
    if (c.body) n += countBlocks(c.body);
  }
  return n;
}
