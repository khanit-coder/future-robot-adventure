import type { Command, Localized } from '../functions/_shared/engine/types.ts';

/** Original sample content used to generate supabase/seed.sql. Everything here is editable in Admin. */

export interface SeedWorld {
  name: Localized;
  description: Localized;
  theme: 'training' | 'energy' | 'station' | 'final';
  color: string;
}

export const SEED_WORLDS: SeedWorld[] = [
  {
    name: { en: 'Robot Training Station', th: 'สถานีฝึกหุ่นยนต์' },
    description: { en: 'Learn your first commands.', th: 'เรียนรู้คำสั่งแรกของคุณ' },
    theme: 'training',
    color: '#38bdf8',
  },
  {
    name: { en: 'Energy Planet', th: 'ดาวพลังงาน' },
    description: { en: 'Collect crystals and power up machines.', th: 'เก็บคริสตัลและเปิดเครื่องจักรพลังงาน' },
    theme: 'energy',
    color: '#f59e0b',
  },
  {
    name: { en: 'Lost Space Station', th: 'สถานีอวกาศที่สาบสูญ' },
    description: { en: 'Solve puzzles and rescue a friend.', th: 'ไขปริศนาและช่วยเพื่อนหุ่นยนต์' },
    theme: 'station',
    color: '#a78bfa',
  },
  {
    name: { en: 'Final Robot Mission', th: 'ภารกิจหุ่นยนต์ขั้นสุดท้าย' },
    description: { en: 'Use everything you learned!', th: 'ใช้ทุกอย่างที่คุณเรียนรู้มา!' },
    theme: 'final',
    color: '#f43f5e',
  },
];

export interface SeedLesson {
  title: Localized;
  summary: Localized;
  body: Localized;
  demo: Command[] | null;
}

const f = (steps: number): Command => ({ type: 'MOVE_FORWARD', steps });

export const SEED_LESSONS: SeedLesson[] = [
  {
    title: { en: 'What is Programming?', th: 'การเขียนโปรแกรมคืออะไร?' },
    summary: { en: 'Giving clear instructions to a computer.', th: 'การสั่งงานคอมพิวเตอร์อย่างชัดเจน' },
    body: {
      en: `## Programming = clear instructions\nProgramming means telling a computer **exactly** what to do, one step at a time.\n\n- A computer cannot guess what you want.\n- It does only what you tell it.\n- A list of instructions is called a **program**.\n\nToday *you* are the programmer, and the robot will follow your program!`,
      th: `## การเขียนโปรแกรม = การสั่งงานอย่างชัดเจน\nการเขียนโปรแกรมคือการบอกคอมพิวเตอร์ว่าต้องทำ **อะไร** ทีละขั้นตอน\n\n- คอมพิวเตอร์เดาใจเราไม่ได้\n- มันทำตามที่เราสั่งเท่านั้น\n- รายการคำสั่งเรียกว่า **โปรแกรม**\n\nวันนี้ *คุณ* คือโปรแกรมเมอร์ และหุ่นยนต์จะทำตามโปรแกรมของคุณ!`,
    },
    demo: null,
  },
  {
    title: { en: 'Understanding Commands', th: 'ทำความรู้จักคำสั่ง' },
    summary: { en: 'Each block is one command.', th: 'บล็อกแต่ละอันคือคำสั่งหนึ่งคำสั่ง' },
    body: {
      en: `## Blocks are commands\nIn this game every colorful **block** is a command for the robot.\n\n- **Move Forward** makes the robot walk.\n- **Wave** makes it say hello.\n- Some blocks have a number, like *how many steps*.\n\nDrag blocks into the workspace and snap them together. Then press **COMPILE** to run your program.`,
      th: `## บล็อกคือคำสั่ง\nในเกมนี้ **บล็อก** สีสันสดใสแต่ละอันคือคำสั่งสำหรับหุ่นยนต์\n\n- **เดินหน้า** ทำให้หุ่นยนต์เดิน\n- **โบกมือ** ทำให้หุ่นยนต์ทักทาย\n- บางบล็อกมีตัวเลข เช่น *จำนวนก้าว*\n\nลากบล็อกมาต่อกันในพื้นที่ทำงาน แล้วกด **COMPILE** เพื่อรันโปรแกรม`,
    },
    demo: [f(2), { type: 'WAVE' }],
  },
  {
    title: { en: 'Sequence and Order', th: 'ลำดับและการเรียงคำสั่ง' },
    summary: { en: 'Commands run from top to bottom.', th: 'คำสั่งทำงานจากบนลงล่าง' },
    body: {
      en: `## Order matters!\nThe robot runs your blocks **from top to bottom**.\n\n- Move 1, then turn left: the robot walks, then turns.\n- Turn left, then move 1: the robot turns, then walks somewhere else!\n\nChanging the order changes the result. If your robot goes the wrong way, check the order.`,
      th: `## ลำดับสำคัญมาก!\nหุ่นยนต์ทำตามบล็อกของคุณ **จากบนลงล่าง**\n\n- เดิน 1 แล้วเลี้ยวซ้าย: หุ่นยนต์เดินแล้วจึงเลี้ยว\n- เลี้ยวซ้ายแล้วเดิน 1: หุ่นยนต์เลี้ยวแล้วเดินไปอีกทางหนึ่ง!\n\nเปลี่ยนลำดับ ผลลัพธ์ก็เปลี่ยน ถ้าหุ่นยนต์เดินผิดทาง ให้ตรวจลำดับคำสั่ง`,
    },
    demo: [f(1), { type: 'TURN_LEFT' }, f(1)],
  },
  {
    title: { en: 'Movement Commands', th: 'คำสั่งการเคลื่อนที่' },
    summary: { en: 'Forward, backward and jump.', th: 'เดินหน้า ถอยหลัง และกระโดด' },
    body: {
      en: `## Moving the robot\n- **Move Forward** *(1–10 steps)* walks in the direction the robot faces.\n- **Move Backward** steps back without turning around.\n- **Jump** leaps over the square in front: over a barrier or a gap!\n\nCareful: walking into a wall, a barrier, or a gap means the mission fails. Use **Jump** to cross barriers and gaps.`,
      th: `## การเคลื่อนที่ของหุ่นยนต์\n- **เดินหน้า** *(1–10 ก้าว)* เดินไปตามทิศที่หุ่นยนต์หันหน้าอยู่\n- **ถอยหลัง** ก้าวถอยโดยไม่หมุนตัว\n- **กระโดด** ข้ามช่องข้างหน้า ทั้งสิ่งกีดขวางและหลุม!\n\nระวัง: ถ้าเดินชนกำแพง สิ่งกีดขวาง หรือตกหลุม ภารกิจจะล้มเหลว ใช้ **กระโดด** เพื่อข้ามสิ่งกีดขวางและหลุม`,
    },
    demo: [f(2), { type: 'JUMP' }, { type: 'MOVE_BACKWARD', steps: 1 }],
  },
  {
    title: { en: 'Turns and Directions', th: 'การเลี้ยวและทิศทาง' },
    summary: { en: 'Turn left or right by 90 degrees.', th: 'เลี้ยวซ้ายหรือขวา 90 องศา' },
    body: {
      en: `## Turning\n- **Turn Left** rotates the robot 90° to its left.\n- **Turn Right** rotates the robot 90° to its right.\n\nLeft and right are always from the **robot's** point of view, not yours.\n\nTip: Turning does not move the robot. Walk after you turn!`,
      th: `## การเลี้ยว\n- **เลี้ยวซ้าย** หมุนหุ่นยนต์ไปทางซ้าย 90°\n- **เลี้ยวขวา** หมุนหุ่นยนต์ไปทางขวา 90°\n\nซ้ายและขวานับจากมุมมองของ **หุ่นยนต์** ไม่ใช่ของเรา\n\nเคล็ดลับ: การเลี้ยวไม่ทำให้หุ่นยนต์เคลื่อนที่ ต้องเดินต่อหลังเลี้ยว!`,
    },
    demo: [{ type: 'TURN_LEFT' }, f(1), { type: 'TURN_RIGHT' }],
  },
  {
    title: { en: 'Repeating Commands', th: 'การทำคำสั่งซ้ำ' },
    summary: { en: 'Loops save time and blocks.', th: 'ลูปช่วยประหยัดเวลาและบล็อก' },
    body: {
      en: `## Loops\nSometimes you need the same commands again and again.\n\nInstead of 10 identical blocks, use one **Repeat** block and put the commands inside it. Set how many times to repeat.\n\n- Shorter programs\n- Fewer mistakes\n- Programmers love loops!`,
      th: `## ลูป\nบางครั้งเราต้องใช้คำสั่งเดิมซ้ำ ๆ\n\nแทนที่จะใช้บล็อกเหมือนกัน 10 อัน ให้ใช้บล็อก **ทำซ้ำ** อันเดียวแล้ววางคำสั่งไว้ข้างใน ตั้งจำนวนครั้งที่ต้องการทำซ้ำ\n\n- โปรแกรมสั้นลง\n- ผิดพลาดน้อยลง\n- โปรแกรมเมอร์ชอบลูป!`,
    },
    demo: [{ type: 'REPEAT', times: 3, body: [f(1), { type: 'WAVE' }] }],
  },
  {
    title: { en: 'Solving Problems', th: 'การแก้ปัญหา' },
    summary: { en: 'Plan, test, fix, try again.', th: 'วางแผน ทดลอง แก้ไข แล้วลองใหม่' },
    body: {
      en: `## Be a problem solver\n1. **Look** at the map and find the goal.\n2. **Plan** the path in small steps.\n3. **Build** your blocks.\n4. **Test** with COMPILE.\n5. **Fix** mistakes and try again. Every programmer does this!\n\nStuck? Use a **hint**. It costs a few points, but it can help you finish the mission.`,
      th: `## เป็นนักแก้ปัญหา\n1. **ดู** แผนที่และหาเป้าหมาย\n2. **วางแผน** เส้นทางเป็นขั้นตอนเล็ก ๆ\n3. **สร้าง** บล็อกของคุณ\n4. **ทดลอง** ด้วย COMPILE\n5. **แก้ไข** ข้อผิดพลาดแล้วลองใหม่ โปรแกรมเมอร์ทุกคนทำแบบนี้!\n\nติดขัดใช่ไหม? ใช้ **คำใบ้** ได้ เสียคะแนนเล็กน้อย แต่ช่วยให้ทำภารกิจสำเร็จ`,
    },
    demo: [f(2), { type: 'PICK_UP' }, { type: 'TURN_LEFT' }, f(1)],
  },
];

export interface SeedReward {
  name: Localized;
  description: Localized;
  min_score: number;
  stock: number;
}

export const SEED_REWARDS: SeedReward[] = [
  { name: { en: 'Robot Sticker Pack', th: 'ชุดสติกเกอร์หุ่นยนต์' }, description: { en: 'A pack of fun robot stickers.', th: 'สติกเกอร์หุ่นยนต์สุดน่ารัก' }, min_score: 300, stock: 100 },
  { name: { en: 'Robot Keychain', th: 'พวงกุญแจหุ่นยนต์' }, description: { en: 'A shiny robot keychain.', th: 'พวงกุญแจหุ่นยนต์แวววาว' }, min_score: 1000, stock: 50 },
  { name: { en: 'Champion Medal', th: 'เหรียญแชมป์' }, description: { en: 'For the best robot coders!', th: 'สำหรับนักเขียนโค้ดหุ่นยนต์ยอดเยี่ยม!' }, min_score: 1700, stock: 20 },
];

export const SEED_ROBOTS = [
  { name: { en: 'Bolt', th: 'โบลต์' }, style: 'bolt', color: '#38bdf8', isDefault: true },
  { name: { en: 'Nova', th: 'โนวา' }, style: 'nova', color: '#f472b6', isDefault: false },
  { name: { en: 'Gizmo', th: 'กิซโม่' }, style: 'gizmo', color: '#4ade80', isDefault: false },
];

export const SEED_SCENES = [
  { name: { en: 'Training Station', th: 'สถานีฝึก' }, theme: 'training' as const },
  { name: { en: 'Energy Planet', th: 'ดาวพลังงาน' }, theme: 'energy' as const },
  { name: { en: 'Lost Station', th: 'สถานีที่สาบสูญ' }, theme: 'station' as const },
  { name: { en: 'Final Mission', th: 'ภารกิจสุดท้าย' }, theme: 'final' as const },
];
