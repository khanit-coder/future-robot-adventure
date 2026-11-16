import type { Command, CommandType, LevelConfig, Localized, MissionSpec } from './types.ts';

export interface SampleLevel {
  code: string;
  /** 0-based index into the sample worlds (see supabase/seed/content.ts). */
  worldIndex: number;
  difficulty: LevelConfig['difficulty'];
  max_score: number;
  title: Localized;
  description: Localized;
  mission: MissionSpec;
  hints: Localized[];
  /** One or more known-good programs. Used by tests and by the publish-time solvability check. */
  solutions: Command[][];
}

const MOVE: CommandType[] = ['MOVE_FORWARD', 'TURN_LEFT', 'TURN_RIGHT'];
const f = (steps: number): Command => ({ type: 'MOVE_FORWARD', steps });

export const SAMPLE_LEVELS: SampleLevel[] = [
  {
    code: 'level_01',
    worldIndex: 0,
    difficulty: 1,
    max_score: 200,
    title: { en: 'Wake Up, Robot!', th: 'ปลุกหุ่นยนต์!' },
    description: {
      en: 'Move the robot forward until it reaches the glowing goal.',
      th: 'สั่งให้หุ่นยนต์เดินหน้าไปจนถึงเป้าหมายที่เรืองแสง',
    },
    mission: {
      map: { width: 7, height: 3, rows: ['_______', '......G', '_______'], crystals: [], generators: [], friends: [] },
      robot_start: { x: 0, y: 1, dir: 'E' },
      objectives: [{ type: 'REACH_GOAL' }],
      rules: { allowed_commands: ['MOVE_FORWARD'], max_blocks: 3 },
    },
    hints: [
      { en: 'Count the squares between the robot and the goal.', th: 'ลองนับช่องระหว่างหุ่นยนต์กับเป้าหมาย' },
      { en: 'You need 6 steps. Use one Move Forward block and set it to 6.', th: 'ต้องเดิน 6 ก้าว ใช้บล็อกเดินหน้า 1 อัน แล้วตั้งค่าเป็น 6' },
    ],
    solutions: [[f(6)], [f(3), f(3)]],
  },
  {
    code: 'level_02',
    worldIndex: 0,
    difficulty: 1,
    max_score: 200,
    title: { en: 'Hop Over It', th: 'กระโดดข้ามไป' },
    description: {
      en: 'A barrier blocks the path. Walk, jump over it, and reach the goal.',
      th: 'มีสิ่งกีดขวางอยู่ข้างหน้า เดิน กระโดดข้ามไป แล้วไปให้ถึงเป้าหมาย',
    },
    mission: {
      map: { width: 7, height: 3, rows: ['_______', '...H..G', '_______'], crystals: [], generators: [], friends: [] },
      robot_start: { x: 0, y: 1, dir: 'E' },
      objectives: [{ type: 'REACH_GOAL' }],
      rules: { allowed_commands: ['MOVE_FORWARD', 'JUMP'], max_blocks: 5 },
    },
    hints: [
      { en: 'Walk right up to the barrier, then jump.', th: 'เดินไปให้ชิดสิ่งกีดขวาง แล้วกระโดด' },
      { en: 'Move forward 2, Jump, then Move forward 2.', th: 'เดินหน้า 2 กระโดด แล้วเดินหน้าอีก 2' },
    ],
    solutions: [[f(2), { type: 'JUMP' }, f(2)]],
  },
  {
    code: 'level_03',
    worldIndex: 0,
    difficulty: 2,
    max_score: 200,
    title: { en: 'Turn the Corner', th: 'เลี้ยวซ้ายไปให้ถึง' },
    description: {
      en: 'The goal is around the corner. Turn left to reach it.',
      th: 'เป้าหมายอยู่หลังหัวโค้ง เลี้ยวซ้ายเพื่อไปให้ถึง',
    },
    mission: {
      map: { width: 6, height: 4, rows: ['_____G', '_____.', '_____.', '......'], crystals: [], generators: [], friends: [] },
      robot_start: { x: 0, y: 3, dir: 'E' },
      objectives: [{ type: 'REACH_GOAL' }],
      rules: { allowed_commands: MOVE, max_blocks: 5 },
    },
    hints: [
      { en: 'Walk to the end of the path first.', th: 'เดินไปสุดทางก่อน' },
      { en: 'Move forward 5, Turn Left, then Move forward 3.', th: 'เดินหน้า 5 เลี้ยวซ้าย แล้วเดินหน้า 3' },
    ],
    solutions: [[f(5), { type: 'TURN_LEFT' }, f(3)]],
  },
  {
    code: 'level_04',
    worldIndex: 1,
    difficulty: 2,
    max_score: 200,
    title: { en: 'Crystal Collector', th: 'นักสะสมคริสตัล' },
    description: {
      en: 'Collect all three energy crystals. Stand on a crystal and use Pick Up.',
      th: 'เก็บคริสตัลพลังงานให้ครบทั้ง 3 ก้อน ยืนบนคริสตัลแล้วใช้คำสั่งเก็บ',
    },
    mission: {
      map: { width: 7, height: 3, rows: ['_______', '.......', '_______'], crystals: [{ x: 2, y: 1 }, { x: 4, y: 1 }, { x: 6, y: 1 }], generators: [], friends: [] },
      robot_start: { x: 0, y: 1, dir: 'E' },
      objectives: [{ type: 'COLLECT_CRYSTALS' }],
      rules: { allowed_commands: ['MOVE_FORWARD', 'PICK_UP'], max_blocks: 8 },
    },
    hints: [
      { en: 'The robot must stand ON the crystal before using Pick Up.', th: 'หุ่นยนต์ต้องยืนบนคริสตัลก่อนใช้คำสั่งเก็บ' },
      { en: 'Move 2, Pick Up. Repeat for each crystal.', th: 'เดิน 2 เก็บ แล้วทำซ้ำสำหรับทุกก้อน' },
    ],
    solutions: [[f(2), { type: 'PICK_UP' }, f(2), { type: 'PICK_UP' }, f(2), { type: 'PICK_UP' }]],
  },
  {
    code: 'level_05',
    worldIndex: 1,
    difficulty: 2,
    max_score: 200,
    title: { en: 'Wall Dodger', th: 'หลบสิ่งกีดขวาง' },
    description: {
      en: 'A wall is in the way! Find a path around it to the goal.',
      th: 'มีกำแพงขวางทาง! หาทางอ้อมไปยังเป้าหมายให้ได้',
    },
    mission: {
      map: { width: 7, height: 3, rows: ['...#...', '......G', '_______'], crystals: [], generators: [], friends: [] },
      robot_start: { x: 0, y: 0, dir: 'E' },
      objectives: [{ type: 'REACH_GOAL' }],
      rules: { allowed_commands: MOVE, max_blocks: 8 },
    },
    hints: [
      { en: 'You cannot walk through walls. Step down one row.', th: 'เดินทะลุกำแพงไม่ได้ ลองลงไปอีกแถว' },
      { en: 'Try: Turn Right, Move 1, Turn Left, Move 6.', th: 'ลอง: เลี้ยวขวา เดิน 1 เลี้ยวซ้าย เดิน 6' },
    ],
    solutions: [
      [{ type: 'TURN_RIGHT' }, f(1), { type: 'TURN_LEFT' }, f(6)],
      [f(2), { type: 'TURN_RIGHT' }, f(1), { type: 'TURN_LEFT' }, f(4)],
    ],
  },
  {
    code: 'level_06',
    worldIndex: 1,
    difficulty: 3,
    max_score: 200,
    title: { en: 'Power Up!', th: 'เปิดพลังงาน!' },
    description: {
      en: 'The door is locked. Activate the energy generator to open it, then reach the goal.',
      th: 'ประตูถูกล็อก เปิดเครื่องกำเนิดพลังงานเพื่อเปิดประตู แล้วไปให้ถึงเป้าหมาย',
    },
    mission: {
      map: { width: 7, height: 3, rows: ['_______', '....D.G', '_______'], crystals: [], generators: [{ x: 2, y: 1 }], friends: [] },
      robot_start: { x: 0, y: 1, dir: 'E' },
      objectives: [{ type: 'ACTIVATE_GENERATORS' }, { type: 'REACH_GOAL' }],
      rules: { allowed_commands: ['MOVE_FORWARD', 'ACTIVATE', 'TURN_LEFT', 'TURN_RIGHT'], max_blocks: 6 },
    },
    hints: [
      { en: 'Stand on the generator, then use Activate.', th: 'ยืนบนเครื่องกำเนิดพลังงานแล้วใช้คำสั่งเปิดใช้งาน' },
      { en: 'Move 2, Activate, then Move 4.', th: 'เดิน 2 เปิดใช้งาน แล้วเดิน 4' },
    ],
    solutions: [[f(2), { type: 'ACTIVATE' }, f(4)]],
  },
  {
    code: 'level_07',
    worldIndex: 2,
    difficulty: 3,
    max_score: 200,
    title: { en: 'Space Maze', th: 'เขาวงกตอวกาศ' },
    description: {
      en: 'Combine walking, turning and jumping to cross the space station maze.',
      th: 'ผสมคำสั่งเดิน เลี้ยว และกระโดด เพื่อผ่านเขาวงกตสถานีอวกาศ',
    },
    mission: {
      map: { width: 7, height: 5, rows: ['_____G_', '_____._', '___.H._', '___.___', '....___'], crystals: [], generators: [], friends: [] },
      robot_start: { x: 0, y: 4, dir: 'E' },
      objectives: [{ type: 'REACH_GOAL' }],
      rules: { allowed_commands: ['MOVE_FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'JUMP'], max_blocks: 12 },
    },
    hints: [
      { en: 'Follow the path: east, north, east (jump!), then north.', th: 'ตามทางไป: ตะวันออก เหนือ ตะวันออก (กระโดด!) แล้วเหนือ' },
      { en: 'Move 3, Left, Move 2, Right, Jump, Left, Move 2.', th: 'เดิน 3 ซ้าย เดิน 2 ขวา กระโดด ซ้าย เดิน 2' },
    ],
    solutions: [[f(3), { type: 'TURN_LEFT' }, f(2), { type: 'TURN_RIGHT' }, { type: 'JUMP' }, { type: 'TURN_LEFT' }, f(2)]],
  },
  {
    code: 'level_08',
    worldIndex: 2,
    difficulty: 3,
    max_score: 200,
    title: { en: 'Rescue Mission', th: 'ภารกิจช่วยเพื่อน' },
    description: {
      en: 'A friendly robot is stuck on the station. Cross the gap and rescue it!',
      th: 'หุ่นยนต์เพื่อนติดอยู่บนสถานี ข้ามหลุมไปแล้วช่วยมันออกมา!',
    },
    mission: {
      map: { width: 7, height: 4, rows: ['_____._', '_____._', '_____._', '...O...'], crystals: [], generators: [], friends: [{ x: 5, y: 0 }] },
      robot_start: { x: 0, y: 3, dir: 'E' },
      objectives: [{ type: 'RESCUE_FRIENDS' }],
      rules: { allowed_commands: ['MOVE_FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'JUMP', 'PICK_UP'], max_blocks: 12 },
    },
    hints: [
      { en: 'Never walk into the gap — jump over it!', th: 'อย่าเดินลงหลุม — กระโดดข้ามไป!' },
      { en: 'Move 2, Jump, Move 1, Turn Left, Move 3, Pick Up.', th: 'เดิน 2 กระโดด เดิน 1 เลี้ยวซ้าย เดิน 3 เก็บ' },
    ],
    solutions: [[f(2), { type: 'JUMP' }, f(1), { type: 'TURN_LEFT' }, f(3), { type: 'PICK_UP' }]],
  },
  {
    code: 'level_09',
    worldIndex: 2,
    difficulty: 4,
    max_score: 200,
    title: { en: 'Staircase Loop', th: 'บันไดแห่งการวนซ้ำ' },
    description: {
      en: 'Climb the staircase to the goal. Use the Repeat block — you do not have enough blocks without it!',
      th: 'ปีนบันไดไปยังเป้าหมาย ใช้บล็อกทำซ้ำ — ถ้าไม่ใช้บล็อกจะไม่พอ!',
    },
    mission: {
      map: { width: 6, height: 6, rows: ['_____G', '____..', '___.._', '__..__', '_..___', '..____'], crystals: [], generators: [], friends: [] },
      robot_start: { x: 0, y: 5, dir: 'E' },
      objectives: [{ type: 'REACH_GOAL' }],
      rules: { allowed_commands: ['MOVE_FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'REPEAT'], max_blocks: 8, required_commands: ['REPEAT'] },
    },
    hints: [
      { en: 'Each step is the same: forward, left, forward, right.', th: 'ทุกขั้นเหมือนกัน: เดินหน้า เลี้ยวซ้าย เดินหน้า เลี้ยวขวา' },
      { en: 'Put those 4 blocks inside a Repeat that runs 5 times.', th: 'ใส่ 4 บล็อกนั้นไว้ในบล็อกทำซ้ำ 5 ครั้ง' },
    ],
    solutions: [[{ type: 'REPEAT', times: 5, body: [f(1), { type: 'TURN_LEFT' }, f(1), { type: 'TURN_RIGHT' }] }]],
  },
  {
    code: 'level_10',
    worldIndex: 3,
    difficulty: 5,
    max_score: 200,
    title: { en: 'The Final Mission', th: 'ภารกิจสุดท้าย' },
    description: {
      en: 'Collect both crystals, power up the generator, rescue your friend, reach the goal and celebrate!',
      th: 'เก็บคริสตัลทั้ง 2 ก้อน เปิดเครื่องกำเนิดพลังงาน ช่วยเพื่อน ไปที่เป้าหมาย แล้วฉลอง!',
    },
    mission: {
      map: { width: 7, height: 5, rows: ['______G', '______.', '______.', '______D', '....O..'], crystals: [{ x: 2, y: 4 }, { x: 6, y: 2 }], generators: [{ x: 6, y: 4 }], friends: [{ x: 6, y: 1 }] },
      robot_start: { x: 0, y: 4, dir: 'E' },
      objectives: [
        { type: 'COLLECT_CRYSTALS' },
        { type: 'ACTIVATE_GENERATORS' },
        { type: 'RESCUE_FRIENDS' },
        { type: 'REACH_GOAL' },
        { type: 'CELEBRATE' },
      ],
      rules: {
        allowed_commands: ['MOVE_FORWARD', 'MOVE_BACKWARD', 'TURN_LEFT', 'TURN_RIGHT', 'JUMP', 'WAVE', 'PICK_UP', 'ACTIVATE', 'CELEBRATE', 'REPEAT', 'WAIT'],
        max_blocks: 20,
      },
    },
    hints: [
      { en: 'Make a plan: crystal, jump the gap, generator, door, crystal, friend, goal.', th: 'วางแผน: คริสตัล กระโดดข้ามหลุม เครื่องกำเนิด ประตู คริสตัล เพื่อน เป้าหมาย' },
      { en: 'The door opens only after you Activate the generator.', th: 'ประตูจะเปิดเมื่อคุณเปิดใช้งานเครื่องกำเนิดพลังงานแล้วเท่านั้น' },
      { en: 'Finish with Celebrate while standing on the goal.', th: 'จบด้วยการฉลองขณะยืนอยู่บนเป้าหมาย' },
    ],
    solutions: [
      [
        f(2), { type: 'PICK_UP' }, f(1), { type: 'JUMP' }, f(1), { type: 'ACTIVATE' },
        { type: 'TURN_LEFT' }, f(2), { type: 'PICK_UP' }, f(1), { type: 'PICK_UP' }, f(1), { type: 'CELEBRATE' },
      ],
    ],
  },
];
