/**
 * Builtin robot styles and special color editions for Future Robot Adventure.
 * Shared between Admin panel, React SVG illustrations, and Phaser procedural animations.
 */

export interface BuiltinRobotStyleMeta {
  id: string;
  name: { th: string; en: string };
  desc: { th: string; en: string };
  badge: string;
}

export interface SpecialColorMeta {
  id: string;
  name: { th: string; en: string };
  hex: string;
  visor: string;
  badge: string;
}

export const BUILTIN_ROBOT_STYLES: BuiltinRobotStyleMeta[] = [
  {
    id: 'bolt',
    name: { th: 'โบลต์ (Bolt - คลาสสิก)', en: 'Bolt (Classic)' },
    desc: { th: 'หุ่นยนต์มิตรภาพ เสาอากาศกลม ทรงคลาสสิกขวัญใจทุกคน', en: 'Friendly classic robot with single antenna' },
    badge: '🤖',
  },
  {
    id: 'nova',
    name: { th: 'โนวา (Nova - นักสำรวจ)', en: 'Nova (Explorer)' },
    desc: { th: 'เสาอากาศคู่เรืองแสง ทรงมนสไตล์นักสำรวจอวกาศ', en: 'Dual glowing antennas, sleek astro-explorer' },
    badge: '🚀',
  },
  {
    id: 'gizmo',
    name: { th: 'กิซโม่ (Gizmo - ไอพ่นลอยตัว)', en: 'Gizmo (Hover Thruster)' },
    desc: { th: 'ฐานไอพ่นลอยฟ้าไฮเทค เคลื่อนที่นุ่มนวลไร้เสียง', en: 'High-tech hover thruster base, smooth floating' },
    badge: '🛸',
  },
  {
    id: 'titan',
    name: { th: 'ไททัน (Titan - เกราะหนัก Mecha)', en: 'Titan (Heavy Mecha)' },
    desc: { th: 'เกราะเหล็กหนา ไหล่บึกบึน ฐานตีนตะขาบทรงพลัง', en: 'Heavy armored shoulders with rugged tank treads' },
    badge: '🛡️',
  },
  {
    id: 'cyber',
    name: { th: 'ไซเบอร์ (Cyber - ไซเบอร์พังก์)', en: 'Cyber (Cyberpunk Visor)' },
    desc: { th: 'แว่นตาเรืองแสง VR Visor และหูฟังครอบหูไซเบอร์ล้ำยุค', en: 'Neon VR visor and cyber headphones' },
    badge: '🕶️',
  },
  {
    id: 'echo',
    name: { th: 'เอคโค่ (Echo - ทรงกลมสุดน่ารัก)', en: 'Echo (Cute Capsule Bot)' },
    desc: { th: 'หุ่นยนต์แคปซูลทรงกลม ตากลมโตแป๋ว ลอยตัวด้วยสนามแม่เหล็ก', en: 'Ultra-cute spherical bot with huge anime eyes' },
    badge: '✨',
  },
  {
    id: 'spark',
    name: { th: 'สปาร์ค (Spark - พลังสายฟ้า)', en: 'Spark (Energy Core)' },
    desc: { th: 'เขาพลังงานสายฟ้าคู่ พร้อมคอร์พลังงานสว่างสดใสที่หน้าอก', en: 'Dual lightning horns and bright energy chest core' },
    badge: '⚡',
  },
  {
    id: 'shadow',
    name: { th: 'ชาโดว์ (Shadow - นินจาสเตลธ์)', en: 'Shadow (Stealth Ninja)' },
    desc: { th: 'หน้ากากนินจาไซเบอร์ แถบเซนเซอร์ตาเฉี่ยว สไตล์สายลับลับเฉพาะ', en: 'Stealth ninja mask and sharp slit sensor visor' },
    badge: '🥷',
  },
  {
    id: 'astro',
    name: { th: 'แอสโตร (Astro - หมวกอวกาศ)', en: 'Astro (Space Helmet)' },
    desc: { th: 'หมวกอวกาศฟองน้ำกลมใหญ่ กระจกสะท้อนดวงดาว และถังออกซิเจน', en: 'Big bubble astronaut dome helmet' },
    badge: '👨‍🚀',
  },
  {
    id: 'retro',
    name: { th: 'เรโทร (Retro - วินเทจ 80s)', en: 'Retro (Vintage 80s)' },
    desc: { th: 'เสาอากาศสปริงขดลวด ตัวเหลี่ยมสังกะสี และมาตรวัดเข็มมิเตอร์', en: 'Vintage 80s tin box robot with spring antenna' },
    badge: '📻',
  },
];

export const SPECIAL_ROBOT_COLORS: SpecialColorMeta[] = [
  { id: 'gold', name: { th: 'ทองคำพรีเมียม', en: 'Royal Gold' }, hex: '#eab308', visor: '#fef08a', badge: '👑' },
  { id: 'ice', name: { th: 'ไดมอนด์ไอซ์', en: 'Diamond Ice' }, hex: '#e2e8f0', visor: '#38bdf8', badge: '💎' },
  { id: 'cyan', name: { th: 'ไซเบอร์ไซแอน', en: 'Cyber Cyan' }, hex: '#06b6d4', visor: '#67e8f9', badge: '⚡' },
  { id: 'sakura', name: { th: 'ซากุระนีออน', en: 'Neon Sakura' }, hex: '#ec4899', visor: '#f472b6', badge: '🌸' },
  { id: 'amethyst', name: { th: 'อเมทิสต์กาแล็กซี', en: 'Void Amethyst' }, hex: '#8b5cf6', visor: '#c084fc', badge: '🟣' },
  { id: 'emerald', name: { th: 'มรกตไซเบอร์', en: 'Matrix Emerald' }, hex: '#10b981', visor: '#4ade80', badge: '🟢' },
  { id: 'solar', name: { th: 'ส้มเพลิงสุริยะ', en: 'Solar Flare' }, hex: '#f97316', visor: '#fbbf24', badge: '🔥' },
  { id: 'obsidian', name: { th: 'ดำออบซิเดียนสเตลธ์', en: 'Stealth Obsidian' }, hex: '#334155', visor: '#ef4444', badge: '🖤' },
  { id: 'ruby', name: { th: 'ทับทิมเลือดมังกร', en: 'Crimson Ruby' }, hex: '#ef4444', visor: '#fca5a5', badge: '🔴' },
  { id: 'amber', name: { th: 'อำพันสายฟ้า', en: 'Electric Amber' }, hex: '#f59e0b', visor: '#fde047', badge: '🟡' },
];
