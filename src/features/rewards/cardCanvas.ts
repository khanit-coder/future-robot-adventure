import type { Lang } from '@engine';

export type CardThemeId = 'cyber' | 'gold' | 'aurora' | 'minimal';
export type CardFontId = 'modern' | 'tech' | 'classic';

export interface ShareCardData {
  name: string;
  school: string;
  score: number;
  levelsCompleted: number;
  totalLevels: number;
  heartsRemaining?: number;
  lang: Lang;
  dateStr?: string;
  collegeName?: string;
  facultyName?: string;
  collegeNameTh?: string;
  collegeNameEn?: string;
  facultyNameTh?: string;
  facultyNameEn?: string;
  theme?: CardThemeId;
  fontStyle?: CardFontId;
  customBadge?: string;
  customMessage?: string;
}

export const COLLEGE_NAME_TH = 'วิทยาลัยเทคโนโลยีขอนแก่น P-TECH';
export const FACULTY_NAME_TH = 'คณะเทคโนโลยีสารสนเทศ';
export const COLLEGE_NAME_EN = 'Khon Kaen Technological College P-TECH';
export const FACULTY_NAME_EN = 'Faculty of Information Technology';

export const CARD_THEMES: {
  id: CardThemeId;
  labelTh: string;
  labelEn: string;
  swatch: string;
}[] = [
  {
    id: 'cyber',
    labelTh: '⚡ ไซเบอร์นีออน',
    labelEn: '⚡ Cyber Neon',
    swatch: 'from-sky-500 to-indigo-600',
  },
  {
    id: 'gold',
    labelTh: '👑 เกียรติบัตรทองคำ',
    labelEn: '👑 Royal Gold',
    swatch: 'from-amber-400 to-yellow-600',
  },
  {
    id: 'aurora',
    labelTh: '🌌 กาแล็กซีออโรร่า',
    labelEn: '🌌 Nebula Aurora',
    swatch: 'from-fuchsia-500 to-emerald-400',
  },
  {
    id: 'minimal',
    labelTh: '💎 โมเดิร์นสว่างคลีน',
    labelEn: '💎 Modern Clean',
    swatch: 'from-slate-100 to-indigo-200',
  },
];

export const CARD_FONTS: {
  id: CardFontId;
  labelTh: string;
  labelEn: string;
}[] = [
  { id: 'modern', labelTh: 'ทันสมัย (Prompt)', labelEn: 'Modern (Prompt)' },
  { id: 'tech', labelTh: 'ไซไฟเทค (Orbitron + Kanit)', labelEn: 'Sci-Fi Tech (Orbitron + Kanit)' },
  { id: 'classic', labelTh: 'ทางการ (Sarabun)', labelEn: 'Formal (Sarabun)' },
];

export function buildCardDownloadUrl(data: ShareCardData, forceCurrentOrigin = false): string {
  const params = new URLSearchParams();
  params.set('n', data.name);
  params.set('s', data.school);
  params.set('sc', String(data.score));
  params.set('lv', String(data.levelsCompleted));
  params.set('tot', String(data.totalLevels));
  if (data.heartsRemaining !== undefined) {
    params.set('hp', String(data.heartsRemaining));
  }
  params.set('lg', data.lang);
  if (data.dateStr) {
    params.set('dt', data.dateStr);
  }
  if (data.collegeName) params.set('col', data.collegeName);
  if (data.facultyName) params.set('fac', data.facultyName);
  if (data.collegeNameTh) params.set('colTh', data.collegeNameTh);
  if (data.collegeNameEn) params.set('colEn', data.collegeNameEn);
  if (data.facultyNameTh) params.set('facTh', data.facultyNameTh);
  if (data.facultyNameEn) params.set('facEn', data.facultyNameEn);
  if (data.theme && data.theme !== 'cyber') params.set('thm', data.theme);
  if (data.fontStyle && data.fontStyle !== 'modern') params.set('fnt', data.fontStyle);
  if (data.customBadge?.trim()) params.set('bdg', data.customBadge.trim().slice(0, 60));
  if (data.customMessage?.trim()) params.set('msg', data.customMessage.trim().slice(0, 90));

  let origin = 'https://future-robot-adventure.pages.dev';
  if (typeof window !== 'undefined') {
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal || forceCurrentOrigin) {
      origin = window.location.origin;
    }
  }
  return `${origin}/card?${params.toString()}`;
}

export function parseCardParams(search: string): ShareCardData {
  const p = new URLSearchParams(search);
  const name = (p.get('n') || 'Young Coder').slice(0, 60);
  const school = (p.get('s') || 'Open House Participant').slice(0, 90);
  const score = Math.max(0, parseInt(p.get('sc') || '0', 10) || 0);
  const levelsCompleted = Math.max(0, parseInt(p.get('lv') || '0', 10) || 0);
  const totalLevels = Math.max(1, parseInt(p.get('tot') || '10', 10) || 10);
  const hpRaw = p.get('hp');
  const heartsRemaining =
    hpRaw !== null ? Math.max(0, Math.min(5, parseInt(hpRaw, 10) || 0)) : undefined;
  const lang: Lang = p.get('lg') === 'en' ? 'en' : 'th';
  const dateStr = p.get('dt') || new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US');
  const collegeName = p.get('col') || undefined;
  const facultyName = p.get('fac') || undefined;
  const collegeNameTh = p.get('colTh') || undefined;
  const collegeNameEn = p.get('colEn') || undefined;
  const facultyNameTh = p.get('facTh') || undefined;
  const facultyNameEn = p.get('facEn') || undefined;

  const thmRaw = p.get('thm');
  const theme: CardThemeId =
    thmRaw === 'gold' || thmRaw === 'aurora' || thmRaw === 'minimal' ? thmRaw : 'cyber';

  const fntRaw = p.get('fnt');
  const fontStyle: CardFontId =
    fntRaw === 'tech' || fntRaw === 'classic' ? fntRaw : 'modern';

  const customBadge = p.get('bdg') || undefined;
  const customMessage = p.get('msg') || undefined;

  return {
    name,
    school,
    score,
    levelsCompleted,
    totalLevels,
    heartsRemaining,
    lang,
    dateStr,
    collegeName,
    facultyName,
    collegeNameTh,
    collegeNameEn,
    facultyNameTh,
    facultyNameEn,
    theme,
    fontStyle,
    customBadge,
    customMessage,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 0 && ctx.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  filled: boolean,
  isLightTheme: boolean,
) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-12, -4, -14, -14, -6, -14);
  ctx.bezierCurveTo(-2, -14, 0, -10, 0, -8);
  ctx.bezierCurveTo(0, -10, 2, -14, 6, -14);
  ctx.bezierCurveTo(14, -14, 12, -4, 0, 6);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = 'rgba(244, 63, 94, 0.5)';
    ctx.shadowBlur = 8;
    ctx.fill();
  } else {
    ctx.fillStyle = isLightTheme ? '#cbd5e1' : 'rgba(148, 163, 184, 0.25)';
    ctx.fill();
  }
  ctx.restore();
}

interface PaletteConfig {
  isLight: boolean;
  bgStops: [string, string, string, string];
  glow1: string;
  glow2: string;
  frameOuter: string;
  frameInner: string;
  cornerAccent: string;
  headerBg: [string, string, string];
  headerBorder: string;
  collegeColor: string;
  facultyColor: string;
  gameTitleColor: string;
  gameTitleGlow: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  robotPrimary: string;
  robotAccent: string;
  cardBoxBg: string;
  cardBoxBorder: string;
  labelColor: string;
  studentNameColor: string;
  schoolPillBg: string;
  schoolPillBorder: string;
  schoolTextColor: string;
  statBoxBg: string;
  scoreBorder: string;
  scoreLabel: string;
  statValueColor: string;
  missionBorder: string;
  missionLabel: string;
  footerBg: string;
  footerBorder: string;
  footerTitle: string;
  footerSub: string;
}

function getThemePalette(theme: CardThemeId): PaletteConfig {
  switch (theme) {
    case 'gold':
      return {
        isLight: false,
        bgStops: ['#0c0a09', '#1c1917', '#271f10', '#0c0a09'],
        glow1: 'rgba(250, 204, 21, 0.25)',
        glow2: 'rgba(245, 158, 11, 0.2)',
        frameOuter: 'rgba(250, 204, 21, 0.7)',
        frameInner: 'rgba(253, 224, 71, 0.28)',
        cornerAccent: '#facc15',
        headerBg: ['rgba(28, 25, 23, 0.96)', 'rgba(69, 44, 10, 0.92)', 'rgba(28, 25, 23, 0.96)'],
        headerBorder: '#facc15',
        collegeColor: '#fde047',
        facultyColor: '#fed7aa',
        gameTitleColor: '#fef08a',
        gameTitleGlow: 'rgba(250, 204, 21, 0.65)',
        badgeBg: 'rgba(250, 204, 21, 0.2)',
        badgeBorder: '#facc15',
        badgeText: '#fef08a',
        robotPrimary: '#f59e0b',
        robotAccent: '#fef08a',
        cardBoxBg: 'rgba(24, 20, 15, 0.95)',
        cardBoxBorder: 'rgba(250, 204, 21, 0.8)',
        labelColor: '#d6d3d1',
        studentNameColor: '#ffffff',
        schoolPillBg: 'rgba(250, 204, 21, 0.14)',
        schoolPillBorder: 'rgba(250, 204, 21, 0.65)',
        schoolTextColor: '#fde047',
        statBoxBg: 'rgba(28, 25, 23, 0.95)',
        scoreBorder: '#facc15',
        scoreLabel: '#fde047',
        statValueColor: '#ffffff',
        missionBorder: '#fb923c',
        missionLabel: '#fdba74',
        footerBg: 'rgba(120, 53, 15, 0.35)',
        footerBorder: 'rgba(250, 204, 21, 0.5)',
        footerTitle: '#fef3c7',
        footerSub: '#fde68a',
      };
    case 'aurora':
      return {
        isLight: false,
        bgStops: ['#0f0728', '#2e1065', '#064e3b', '#090d1f'],
        glow1: 'rgba(236, 72, 153, 0.32)',
        glow2: 'rgba(52, 211, 153, 0.28)',
        frameOuter: 'rgba(244, 114, 182, 0.6)',
        frameInner: 'rgba(52, 211, 153, 0.35)',
        cornerAccent: '#34d399',
        headerBg: ['rgba(30, 10, 60, 0.94)', 'rgba(76, 29, 149, 0.9)', 'rgba(6, 78, 59, 0.92)'],
        headerBorder: '#f472b6',
        collegeColor: '#fde047',
        facultyColor: '#6ee7b7',
        gameTitleColor: '#ffffff',
        gameTitleGlow: 'rgba(244, 114, 182, 0.7)',
        badgeBg: 'rgba(236, 72, 153, 0.22)',
        badgeBorder: '#f472b6',
        badgeText: '#fbcfe8',
        robotPrimary: '#ec4899',
        robotAccent: '#6ee7b7',
        cardBoxBg: 'rgba(19, 12, 46, 0.92)',
        cardBoxBorder: 'rgba(52, 211, 153, 0.75)',
        labelColor: '#cbd5e1',
        studentNameColor: '#ffffff',
        schoolPillBg: 'rgba(52, 211, 153, 0.16)',
        schoolPillBorder: 'rgba(52, 211, 153, 0.65)',
        schoolTextColor: '#6ee7b7',
        statBoxBg: 'rgba(24, 16, 54, 0.92)',
        scoreBorder: '#f472b6',
        scoreLabel: '#f9a8d4',
        statValueColor: '#ffffff',
        missionBorder: '#34d399',
        missionLabel: '#6ee7b7',
        footerBg: 'rgba(131, 24, 67, 0.32)',
        footerBorder: 'rgba(244, 114, 182, 0.5)',
        footerTitle: '#fdf2f8',
        footerSub: '#a7f3d0',
      };
    case 'minimal':
      return {
        isLight: true,
        bgStops: ['#f8fafc', '#eef2ff', '#e0f2fe', '#f1f5f9'],
        glow1: 'rgba(99, 102, 241, 0.12)',
        glow2: 'rgba(14, 165, 233, 0.12)',
        frameOuter: '#4f46e5',
        frameInner: '#93c5fd',
        cornerAccent: '#4f46e5',
        headerBg: ['#1e1b4b', '#312e81', '#1e3a8a'],
        headerBorder: '#4f46e5',
        collegeColor: '#facc15',
        facultyColor: '#7dd3fc',
        gameTitleColor: '#1e1b4b',
        gameTitleGlow: 'rgba(79, 70, 229, 0.15)',
        badgeBg: '#eef2ff',
        badgeBorder: '#4f46e5',
        badgeText: '#312e81',
        robotPrimary: '#4f46e5',
        robotAccent: '#facc15',
        cardBoxBg: '#ffffff',
        cardBoxBorder: '#4f46e5',
        labelColor: '#64748b',
        studentNameColor: '#0f172a',
        schoolPillBg: '#f0f9ff',
        schoolPillBorder: '#0284c7',
        schoolTextColor: '#0369a1',
        statBoxBg: '#ffffff',
        scoreBorder: '#d97706',
        scoreLabel: '#b45309',
        statValueColor: '#0f172a',
        missionBorder: '#059669',
        missionLabel: '#047857',
        footerBg: '#1e1b4b',
        footerBorder: '#4f46e5',
        footerTitle: '#ffffff',
        footerSub: '#93c5fd',
      };
    case 'cyber':
    default:
      return {
        isLight: false,
        bgStops: ['#060b19', '#17153b', '#0f172a', '#050814'],
        glow1: 'rgba(56, 189, 248, 0.3)',
        glow2: 'rgba(139, 92, 246, 0.25)',
        frameOuter: 'rgba(56, 189, 248, 0.55)',
        frameInner: 'rgba(129, 140, 248, 0.25)',
        cornerAccent: '#38bdf8',
        headerBg: ['rgba(15, 23, 42, 0.96)', 'rgba(49, 46, 129, 0.92)', 'rgba(15, 23, 42, 0.96)'],
        headerBorder: '#38bdf8',
        collegeColor: '#facc15',
        facultyColor: '#38bdf8',
        gameTitleColor: '#ffffff',
        gameTitleGlow: 'rgba(56, 189, 248, 0.65)',
        badgeBg: 'rgba(250, 204, 21, 0.16)',
        badgeBorder: 'rgba(250, 204, 21, 0.7)',
        badgeText: '#fde047',
        robotPrimary: '#38bdf8',
        robotAccent: '#facc15',
        cardBoxBg: 'rgba(15, 23, 42, 0.94)',
        cardBoxBorder: 'rgba(56, 189, 248, 0.7)',
        labelColor: '#94a3b8',
        studentNameColor: '#ffffff',
        schoolPillBg: 'rgba(56, 189, 248, 0.16)',
        schoolPillBorder: 'rgba(56, 189, 248, 0.6)',
        schoolTextColor: '#7dd3fc',
        statBoxBg: 'rgba(23, 33, 53, 0.95)',
        scoreBorder: 'rgba(250, 204, 21, 0.7)',
        scoreLabel: '#fde047',
        statValueColor: '#ffffff',
        missionBorder: 'rgba(74, 222, 128, 0.7)',
        missionLabel: '#4ade80',
        footerBg: 'rgba(49, 46, 129, 0.45)',
        footerBorder: 'rgba(129, 140, 248, 0.55)',
        footerTitle: '#e0e7ff',
        footerSub: '#7dd3fc',
      };
  }
}

function getFontFamilies(fontStyle: CardFontId): {
  bodyFont: string;
  displayFont: string;
  numberFont: string;
} {
  switch (fontStyle) {
    case 'tech':
      return {
        bodyFont: '"Kanit", "Prompt", "Noto Sans Thai", sans-serif',
        displayFont: '"Orbitron", "Kanit", "Prompt", sans-serif',
        numberFont: '"Orbitron", "Kanit", sans-serif',
      };
    case 'classic':
      return {
        bodyFont: '"Sarabun", "Noto Sans Thai", sans-serif',
        displayFont: '"Sarabun", "Plus Jakarta Sans", sans-serif',
        numberFont: '"Plus Jakarta Sans", "Sarabun", sans-serif',
      };
    case 'modern':
    default:
      return {
        bodyFont: '"Prompt", "Plus Jakarta Sans", "Noto Sans Thai", sans-serif',
        displayFont: '"Prompt", "Plus Jakarta Sans", "Noto Sans Thai", sans-serif',
        numberFont: '"Plus Jakarta Sans", "Prompt", sans-serif',
      };
  }
}

/**
 * Renders a 1080x1350 (4:5 Social Media Portrait) commemorative achievement card onto a Canvas
 * and returns a PNG Data URL.
 */
export function renderShareCardToDataUrl(data: ShareCardData): string {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const theme = data.theme ?? 'cyber';
  const fontStyle = data.fontStyle ?? 'modern';
  const p = getThemePalette(theme);
  const f = getFontFamilies(fontStyle);

  // 1. Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, p.bgStops[0]);
  bgGrad.addColorStop(0.45, p.bgStops[1]);
  bgGrad.addColorStop(0.8, p.bgStops[2]);
  bgGrad.addColorStop(1, p.bgStops[3]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Decorative glows
  const glow1 = ctx.createRadialGradient(W * 0.85, H * 0.18, 20, W * 0.85, H * 0.18, 440);
  glow1.addColorStop(0, p.glow1);
  glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.15, H * 0.78, 20, W * 0.15, H * 0.78, 460);
  glow2.addColorStop(0, p.glow2);
  glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // 3. Subtle Tech Grid / Starfield background pattern
  if (p.isLight) {
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.07)';
    ctx.lineWidth = 1.5;
    for (let x = 60; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 60; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  } else {
    // Subtle perspective grid at bottom
    ctx.strokeStyle =
      theme === 'gold' ? 'rgba(250, 204, 21, 0.06)' : 'rgba(56, 189, 248, 0.07)';
    ctx.lineWidth = 1.5;
    for (let y = 980; y < H; y += 45) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(W - 40, y);
      ctx.stroke();
    }
    // Starfield
    for (let i = 0; i < 65; i++) {
      const sx = ((i * 173 + 41) % (W - 80)) + 40;
      const sy = ((i * 251 + 83) % (H - 80)) + 40;
      const sr = (i % 3) + 1.2;
      ctx.fillStyle =
        i % 5 === 0 ? '#fde047' : i % 3 === 0 ? '#7dd3fc' : 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. Outer frame border with corner accents
  drawRoundedRect(ctx, 36, 36, W - 72, H - 72, 44);
  ctx.strokeStyle = p.frameOuter;
  ctx.lineWidth = 4;
  ctx.stroke();

  drawRoundedRect(ctx, 50, 50, W - 100, H - 100, 36);
  ctx.strokeStyle = p.frameInner;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Corner bracket accents ⌜ ⌝ ⌞ ⌟
  const cornerLen = 32;
  ctx.strokeStyle = p.cornerAccent;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  // Top-left
  ctx.beginPath();
  ctx.moveTo(36, 36 + cornerLen);
  ctx.lineTo(36, 36);
  ctx.lineTo(36 + cornerLen, 36);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(W - 36 - cornerLen, 36);
  ctx.lineTo(W - 36, 36);
  ctx.lineTo(W - 36, 36 + cornerLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(36, H - 36 - cornerLen);
  ctx.lineTo(36, H - 36);
  ctx.lineTo(36 + cornerLen, H - 36);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(W - 36 - cornerLen, H - 36);
  ctx.lineTo(W - 36, H - 36);
  ctx.lineTo(W - 36, H - 36 - cornerLen);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // 5. Top College & Faculty Header Banner
  drawRoundedRect(ctx, 76, 74, W - 152, 146, 28);
  const headerGrad = ctx.createLinearGradient(76, 74, W - 76, 220);
  headerGrad.addColorStop(0, p.headerBg[0]);
  headerGrad.addColorStop(0.5, p.headerBg[1]);
  headerGrad.addColorStop(1, p.headerBg[2]);
  ctx.fillStyle = headerGrad;
  ctx.fill();
  ctx.strokeStyle = p.headerBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const collegeTh =
    data.collegeNameTh ||
    (data.lang === 'th' && data.collegeName ? data.collegeName : COLLEGE_NAME_TH);
  const collegeEn =
    data.collegeNameEn ||
    (data.lang === 'en' && data.collegeName ? data.collegeName : COLLEGE_NAME_EN);
  const facultyTh =
    data.facultyNameTh ||
    (data.lang === 'th' && data.facultyName ? data.facultyName : FACULTY_NAME_TH);
  const facultyEn =
    data.facultyNameEn ||
    (data.lang === 'en' && data.facultyName ? data.facultyName : FACULTY_NAME_EN);

  ctx.textAlign = 'center';
  ctx.fillStyle = p.collegeColor;
  ctx.font = `800 37px ${f.bodyFont}`;
  ctx.fillText(
    truncateText(ctx, data.lang === 'th' ? collegeTh : collegeEn, W - 190),
    W / 2,
    132,
  );

  ctx.fillStyle = p.facultyColor;
  ctx.font = `700 28px ${f.bodyFont}`;
  ctx.fillText(
    truncateText(ctx, data.lang === 'th' ? facultyTh : facultyEn, W - 190),
    W / 2,
    182,
  );

  // 6. Game Title & Achievement Badge
  ctx.save();
  ctx.shadowColor = p.gameTitleGlow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = p.gameTitleColor;
  ctx.font = `900 48px ${f.displayFont}`;
  ctx.fillText('FUTURE ROBOT ADVENTURE', W / 2, 276);
  ctx.restore();

  // Achievement Badge Pill (Supports Custom Badge Text!)
  const defaultBadge =
    data.lang === 'th'
      ? '🏅 เกียรติบัตรสุดยอดนักโค้ดดิ้งหุ่นยนต์ 🏅'
      : '🏅 CERTIFICATE OF CODING EXCELLENCE 🏅';
  const badgeLabel = data.customBadge?.trim() || defaultBadge;

  const badgeW = 640;
  const badgeH = 44;
  const badgeX = (W - badgeW) / 2;
  const badgeY = 300;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 22);
  ctx.fillStyle = p.badgeBg;
  ctx.fill();
  ctx.strokeStyle = p.badgeBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = p.badgeText;
  ctx.font = `800 21px ${f.bodyFont}`;
  ctx.fillText(truncateText(ctx, badgeLabel, badgeW - 36), W / 2, badgeY + 29);

  // 7. Center Robot Illustration Emblem & Rank Badge
  const rcx = W / 2;
  const rcy = 438;

  // Glowing ring behind robot
  const ringGrad = ctx.createRadialGradient(rcx, rcy, 20, rcx, rcy, 112);
  ringGrad.addColorStop(0, p.glow1);
  ringGrad.addColorStop(0.7, p.glow2);
  ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(rcx, rcy, 112, 0, Math.PI * 2);
  ctx.fill();

  // Outer tech ring
  ctx.strokeStyle = p.headerBorder;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(rcx, rcy, 86, 0, Math.PI * 2);
  ctx.stroke();

  // Draw Cute Robot inside emblem
  ctx.save();
  ctx.translate(rcx, rcy + 10);
  // Antenna
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(0, -76);
  ctx.stroke();
  ctx.fillStyle = p.robotAccent;
  ctx.beginPath();
  ctx.arc(0, -80, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Head
  drawRoundedRect(ctx, -44, -52, 88, 60, 18);
  ctx.fillStyle = p.robotPrimary;
  ctx.fill();
  ctx.stroke();
  // Visor
  drawRoundedRect(ctx, -32, -40, 64, 32, 10);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  // Happy glowing eyes
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(-14, -24, 7, 0, Math.PI * 2);
  ctx.arc(14, -24, 7, 0, Math.PI * 2);
  ctx.fill();
  // Body
  drawRoundedRect(ctx, -36, 12, 72, 42, 14);
  ctx.fillStyle = p.robotPrimary;
  ctx.fill();
  ctx.stroke();
  // Chest core
  ctx.fillStyle = p.robotAccent;
  ctx.beginPath();
  ctx.arc(0, 33, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Coder Rank Badge
  let rankText: string;
  let rankColor = p.isLight ? '#047857' : '#4ade80';
  let rankBg = p.isLight ? '#ecfdf5' : 'rgba(74, 222, 128, 0.16)';
  let rankBorder = p.isLight ? '#10b981' : 'rgba(74, 222, 128, 0.65)';

  if (data.score >= 1200 || data.levelsCompleted >= data.totalLevels) {
    rankText =
      data.lang === 'th' ? '🏆 ระดับ: ปรมาจารย์โค้ดดิ้ง (MASTER)' : '🏆 RANK: CODING MASTER';
    rankColor = p.isLight ? '#b45309' : '#facc15';
    rankBg = p.isLight ? '#fef3c7' : 'rgba(250, 204, 21, 0.18)';
    rankBorder = p.isLight ? '#f59e0b' : 'rgba(250, 204, 21, 0.7)';
  } else if (data.score >= 600 || data.levelsCompleted >= Math.ceil(data.totalLevels / 2)) {
    rankText = data.lang === 'th' ? '🚀 ระดับ: ยอดนักโค้ดมือโปร (PRO)' : '🚀 RANK: PRO CODER';
    rankColor = p.isLight ? '#0369a1' : '#38bdf8';
    rankBg = p.isLight ? '#e0f2fe' : 'rgba(56, 189, 248, 0.18)';
    rankBorder = p.isLight ? '#0284c7' : 'rgba(56, 189, 248, 0.7)';
  } else {
    rankText =
      data.lang === 'th' ? '⭐ ระดับ: นักโค้ดดาวรุ่ง (RISING STAR)' : '⭐ RANK: RISING STAR';
  }

  const rankW = 460;
  const rankH = 42;
  const rankX = (W - rankW) / 2;
  const rankY = 548;
  drawRoundedRect(ctx, rankX, rankY, rankW, rankH, 21);
  ctx.fillStyle = rankBg;
  ctx.fill();
  ctx.strokeStyle = rankBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = rankColor;
  ctx.font = `800 20px ${f.bodyFont}`;
  ctx.fillText(rankText, W / 2, rankY + 28);

  // 8. Student Name & School Card Box
  const studentBoxY = 608;
  const studentBoxH = 282;
  drawRoundedRect(ctx, 76, studentBoxY, W - 152, studentBoxH, 32);
  ctx.fillStyle = p.cardBoxBg;
  ctx.fill();
  ctx.strokeStyle = p.cardBoxBorder;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Label
  ctx.fillStyle = p.labelColor;
  ctx.font = `700 21px ${f.bodyFont}`;
  ctx.fillText(
    data.lang === 'th' ? 'ชื่อผู้พิชิตภารกิจ / CODER NAME' : 'ACHIEVED BY CODER',
    W / 2,
    studentBoxY + 46,
  );

  // Big Student Name
  ctx.save();
  ctx.fillStyle = p.studentNameColor;
  ctx.font = `800 64px ${f.bodyFont}`;
  if (!p.isLight) {
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 10;
  }
  ctx.fillText(truncateText(ctx, data.name, W - 210), W / 2, studentBoxY + 124);
  ctx.restore();

  // School Pill
  const schoolPillY = studentBoxY + 152;
  const schoolPillH = 66;
  const schoolPillW = W - 230;
  const schoolPillX = (W - schoolPillW) / 2;
  drawRoundedRect(ctx, schoolPillX, schoolPillY, schoolPillW, schoolPillH, 20);
  ctx.fillStyle = p.schoolPillBg;
  ctx.fill();
  ctx.strokeStyle = p.schoolPillBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = p.schoolTextColor;
  ctx.font = `700 30px ${f.bodyFont}`;
  const schoolLabel =
    data.lang === 'th' ? `🏫 โรงเรียน: ${data.school}` : `🏫 School: ${data.school}`;
  ctx.fillText(truncateText(ctx, schoolLabel, schoolPillW - 40), W / 2, schoolPillY + 43);

  // Hearts remaining row inside Student Box bottom
  const hpCount = data.heartsRemaining ?? 5;
  const heartSpacing = 36;
  const heartsStartX = W / 2 - (4 * heartSpacing) / 2;
  for (let i = 0; i < 5; i++) {
    drawHeart(
      ctx,
      heartsStartX + i * heartSpacing,
      studentBoxY + 256,
      24,
      i < hpCount,
      p.isLight,
    );
  }

  // 9. Stats Row (Score & Missions Cleared)
  const boxY = 914;
  const boxH = 196;
  const boxW = (W - 152 - 32) / 2;

  // Box 1: Total Score
  drawRoundedRect(ctx, 76, boxY, boxW, boxH, 28);
  ctx.fillStyle = p.statBoxBg;
  ctx.fill();
  ctx.strokeStyle = p.scoreBorder;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = p.scoreLabel;
  ctx.font = `700 24px ${f.bodyFont}`;
  ctx.fillText(
    data.lang === 'th' ? '🏆 คะแนนรวม (SCORE)' : '🏆 TOTAL SCORE',
    76 + boxW / 2,
    boxY + 54,
  );

  ctx.fillStyle = p.statValueColor;
  ctx.font = `900 78px ${f.numberFont}`;
  ctx.fillText(`${data.score}`, 76 + boxW / 2, boxY + 150);

  // Box 2: Missions Cleared
  const box2X = 76 + boxW + 32;
  drawRoundedRect(ctx, box2X, boxY, boxW, boxH, 28);
  ctx.fillStyle = p.statBoxBg;
  ctx.fill();
  ctx.strokeStyle = p.missionBorder;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = p.missionLabel;
  ctx.font = `700 24px ${f.bodyFont}`;
  ctx.fillText(
    data.lang === 'th' ? '🎯 ภารกิจสำเร็จ (MISSIONS)' : '🎯 MISSIONS SOLVED',
    box2X + boxW / 2,
    boxY + 54,
  );

  ctx.fillStyle = p.statValueColor;
  ctx.font = `900 78px ${f.numberFont}`;
  ctx.fillText(`${data.levelsCompleted} / ${data.totalLevels}`, box2X + boxW / 2, boxY + 150);

  // 10. Footer Banner (Supports Custom Message!)
  const footerY = 1134;
  const footerH = 128;
  drawRoundedRect(ctx, 76, footerY, W - 152, footerH, 24);
  ctx.fillStyle = p.footerBg;
  ctx.fill();
  ctx.strokeStyle = p.footerBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const defaultFooter =
    data.lang === 'th'
      ? '✨ ขอแสดงความยินดีกับยอดนักเขียนโค้ดแห่งอนาคต! ✨'
      : '✨ Congratulations, Future Robot Programmer! ✨';
  const footerMsg = data.customMessage?.trim() || defaultFooter;

  ctx.fillStyle = p.footerTitle;
  ctx.font = `800 26px ${f.bodyFont}`;
  ctx.fillText(truncateText(ctx, footerMsg, W - 190), W / 2, footerY + 52);

  ctx.fillStyle = p.footerSub;
  ctx.font = `600 21px ${f.bodyFont}`;
  ctx.fillText(
    `#KKTech #PTECH #คณะเทคโนโลยีสารสนเทศ • ${data.dateStr ?? ''}`,
    W / 2,
    footerY + 96,
  );

  return canvas.toDataURL('image/png');
}
