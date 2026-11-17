import type { GameTheme } from '@engine';

export interface ThemeOption {
  id: GameTheme;
  number: number;
  name: string;
  nameEn: string;
  desc: string;
  cardPreviewClass: string;
  textColor: string;
  badgeText: string;
  accentBg: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'space',
    number: 1,
    name: 'แบบที่ 1: Cyber Futuristic',
    nameEn: 'Hologram Space',
    desc: 'สไตล์ไซไฟอวกาศล้ำยุค นีออนสีฟ้า-ทอง เรืองแสงดิจิทัล (ค่าแนะนำ)',
    cardPreviewClass: 'border-sky-500/40 bg-slate-900 shadow-[0_0_15px_rgba(56,189,248,0.2)]',
    textColor: 'text-sky-300',
    badgeText: 'NEON CYBER HUD',
    accentBg: '#38bdf8',
  },
  {
    id: 'lab',
    number: 2,
    name: 'แบบที่ 2: Modern eSports',
    nameEn: 'Championship',
    desc: 'สไตล์สังเวียนเกมเมอร์/อีสปอร์ต โทนม่วงเข้มตัดทอง ทรงพลังและดุดัน',
    cardPreviewClass: 'border-violet-500/40 bg-slate-950 shadow-md',
    textColor: 'text-amber-400',
    badgeText: 'PRO TOURNAMENT',
    accentBg: '#a855f7',
  },
  {
    id: 'light',
    number: 3,
    name: 'แบบที่ 3: Clean Tech Academy',
    nameEn: 'Bright Classroom',
    desc: 'สไตล์มินิมอลเทคโนโลยีสะอาดตา พื้นขาว อ่านง่าย เหมาะกับห้องเรียน',
    cardPreviewClass: 'border-slate-300 bg-white shadow-xs',
    textColor: 'text-indigo-600',
    badgeText: 'CLEAN ACADEMY',
    accentBg: '#4f46e5',
  },
  {
    id: 'planet',
    number: 4,
    name: 'แบบที่ 4: Comic Arcade Quest',
    nameEn: 'Retro Arcade',
    desc: 'สไตล์เกมตู้การ์ตูนเรโทร ขอบมน สีสันสดใส ชมพู-ม่วง-เหลือง สนุกสนาน',
    cardPreviewClass: 'border-pink-400/40 bg-indigo-950 shadow-md',
    textColor: 'text-pink-300',
    badgeText: 'ARCADE RETRO',
    accentBg: '#ec4899',
  },
];
