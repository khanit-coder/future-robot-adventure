import type { Lang } from '@engine';

export interface ShareCardData {
  name: string;
  school: string;
  score: number;
  levelsCompleted: number;
  totalLevels: number;
  heartsRemaining?: number;
  lang: Lang;
  dateStr?: string;
}

export const COLLEGE_NAME_TH = 'วิทยาลัยเทคโนโลยีขอนแก่น P-TECH';
export const FACULTY_NAME_TH = 'คณะเทคโนโลยีสารสนเทศ';
export const COLLEGE_NAME_EN = 'Khon Kaen Technological College P-TECH';
export const FACULTY_NAME_EN = 'Faculty of Information Technology';

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
  const heartsRemaining = hpRaw !== null ? Math.max(0, Math.min(5, parseInt(hpRaw, 10) || 0)) : undefined;
  const lang: Lang = p.get('lg') === 'en' ? 'en' : 'th';
  const dateStr = p.get('dt') || new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US');

  return {
    name,
    school,
    score,
    levelsCompleted,
    totalLevels,
    heartsRemaining,
    lang,
    dateStr,
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

  // 1. Deep space gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#090d1f');
  bgGrad.addColorStop(0.45, '#1e1b4b');
  bgGrad.addColorStop(0.8, '#0f172a');
  bgGrad.addColorStop(1, '#090d1f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Decorative nebula glows
  const glow1 = ctx.createRadialGradient(W * 0.85, H * 0.18, 20, W * 0.85, H * 0.18, 420);
  glow1.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
  glow1.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.15, H * 0.75, 20, W * 0.15, H * 0.75, 450);
  glow2.addColorStop(0, 'rgba(244, 114, 182, 0.22)');
  glow2.addColorStop(1, 'rgba(244, 114, 182, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // 3. Starfield (deterministic positions)
  for (let i = 0; i < 65; i++) {
    const sx = ((i * 173 + 41) % (W - 80)) + 40;
    const sy = ((i * 251 + 83) % (H - 80)) + 40;
    const sr = (i % 3) + 1.2;
    ctx.fillStyle = i % 5 === 0 ? '#fde047' : i % 3 === 0 ? '#7dd3fc' : 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Outer futuristic frame border
  drawRoundedRect(ctx, 36, 36, W - 72, H - 72, 44);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 4;
  ctx.stroke();

  drawRoundedRect(ctx, 50, 50, W - 100, H - 100, 36);
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 5. Top College & Faculty Header Banner
  drawRoundedRect(ctx, 84, 82, W - 168, 162, 28);
  const headerGrad = ctx.createLinearGradient(84, 82, W - 84, 244);
  headerGrad.addColorStop(0, 'rgba(30, 41, 59, 0.92)');
  headerGrad.addColorStop(0.5, 'rgba(49, 46, 129, 0.92)');
  headerGrad.addColorStop(1, 'rgba(30, 41, 59, 0.92)');
  ctx.fillStyle = headerGrad;
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde047';
  ctx.font = '800 36px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(COLLEGE_NAME_TH, W / 2, 145);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 30px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(FACULTY_NAME_TH, W / 2, 192);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 19px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(`${COLLEGE_NAME_EN} • ${FACULTY_NAME_EN}`, W / 2, 226);

  // 6. Game Title & Badge
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 48px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText('FUTURE ROBOT ADVENTURE', W / 2, 315);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 24px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    data.lang === 'th'
      ? 'เกียรติบัตรผู้พิชิตภารกิจเขียนโค้ดหุ่นยนต์แห่งอนาคต'
      : ' Robot Coding Mission Achievement Card ',
    W / 2,
    355,
  );

  // 7. Center Robot Illustration Emblem
  const rcx = W / 2;
  const rcy = 500;

  // Glowing ring behind robot
  const ringGrad = ctx.createRadialGradient(rcx, rcy, 30, rcx, rcy, 125);
  ringGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
  ringGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.2)');
  ringGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(rcx, rcy, 125, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(rcx, rcy, 98, 0, Math.PI * 2);
  ctx.stroke();

  // Draw Cute Robot inside emblem
  ctx.save();
  ctx.translate(rcx, rcy + 10);
  // Antenna
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.lineTo(0, -82);
  ctx.stroke();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(0, -86, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Head
  drawRoundedRect(ctx, -46, -56, 92, 62, 18);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();
  ctx.stroke();
  // Visor
  drawRoundedRect(ctx, -34, -44, 68, 34, 10);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  // Happy eyes
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(-15, -27, 7, 0, Math.PI * 2);
  ctx.arc(15, -27, 7, 0, Math.PI * 2);
  ctx.fill();
  // Body
  drawRoundedRect(ctx, -38, 10, 76, 46, 14);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();
  ctx.stroke();
  // Chest core
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(0, 33, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 8. Student Name & School Card Box
  drawRoundedRect(ctx, 84, 635, W - 168, 255, 32);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 22px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    data.lang === 'th' ? 'ชื่อนักเรียน / STUDENT NAME' : 'STUDENT NAME',
    W / 2,
    685,
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 54px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(truncateText(ctx, data.name, W - 240), W / 2, 752);

  // School pill
  drawRoundedRect(ctx, 144, 785, W - 288, 74, 20);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#7dd3fc';
  ctx.font = '700 30px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  const schoolLabel = data.lang === 'th' ? `โรงเรียน: ${data.school}` : `School: ${data.school}`;
  ctx.fillText(truncateText(ctx, schoolLabel, W - 330), W / 2, 833);

  // 9. Stats Row (Score, Levels Cleared, Rank Badge)
  const boxY = 925;
  const boxH = 185;
  const boxW = (W - 168 - 36) / 2;

  // Box 1: Total Score
  drawRoundedRect(ctx, 84, boxY, boxW, boxH, 26);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.font = '700 24px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(data.lang === 'th' ? '🏆 คะแนนที่ทำได้ (SCORE)' : '🏆 TOTAL SCORE', 84 + boxW / 2, boxY + 55);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(`${data.score}`, 84 + boxW / 2, boxY + 138);

  // Box 2: Missions Cleared
  const box2X = 84 + boxW + 36;
  drawRoundedRect(ctx, box2X, boxY, boxW, boxH, 26);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#4ade80';
  ctx.font = '700 24px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    data.lang === 'th' ? '🚀 ภารกิจที่สำเร็จ (MISSIONS)' : '🚀 MISSIONS SOLVED',
    box2X + boxW / 2,
    boxY + 55,
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(`${data.levelsCompleted} / ${data.totalLevels}`, box2X + boxW / 2, boxY + 138);

  // 10. Footer Banner
  drawRoundedRect(ctx, 84, 1145, W - 168, 120, 24);
  ctx.fillStyle = 'rgba(79, 70, 229, 0.28)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#e0e7ff';
  ctx.font = '700 26px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    data.lang === 'th'
      ? '✨ ขอแสดงความยินดีกับนักเขียนโค้ดรุ่นเยาว์แห่งโลกอนาคต! ✨'
      : '✨ Congratulations, Future Robot Programmer! ✨',
    W / 2,
    1195,
  );

  ctx.fillStyle = '#93c5fd';
  ctx.font = '600 21px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    `#KKTech #PTECH #คณะเทคโนโลยีสารสนเทศ #FutureRobotAdventure • ${data.dateStr ?? ''}`,
    W / 2,
    1238,
  );

  return canvas.toDataURL('image/png');
}
