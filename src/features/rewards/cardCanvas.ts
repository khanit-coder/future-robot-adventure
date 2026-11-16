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
  collegeName?: string;
  facultyName?: string;
  collegeNameTh?: string;
  collegeNameEn?: string;
  facultyNameTh?: string;
  facultyNameEn?: string;
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
  if (data.collegeName) params.set('col', data.collegeName);
  if (data.facultyName) params.set('fac', data.facultyName);
  if (data.collegeNameTh) params.set('colTh', data.collegeNameTh);
  if (data.collegeNameEn) params.set('colEn', data.collegeNameEn);
  if (data.facultyNameTh) params.set('facTh', data.facultyNameTh);
  if (data.facultyNameEn) params.set('facEn', data.facultyNameEn);

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
  const collegeName = p.get('col') || undefined;
  const facultyName = p.get('fac') || undefined;
  const collegeNameTh = p.get('colTh') || undefined;
  const collegeNameEn = p.get('colEn') || undefined;
  const facultyNameTh = p.get('facTh') || undefined;
  const facultyNameEn = p.get('facEn') || undefined;

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

  // 4. Outer futuristic frame border with cyber corner accents
  drawRoundedRect(ctx, 36, 36, W - 72, H - 72, 44);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 4;
  ctx.stroke();

  drawRoundedRect(ctx, 50, 50, W - 100, H - 100, 36);
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Cyber corner bracket accents ⌜ ⌝ ⌞ ⌟
  const cornerLen = 28;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
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

  // 5. Top College & Faculty Header Banner (Concise, punchy, high-contrast)
  drawRoundedRect(ctx, 76, 76, W - 152, 148, 26);
  const headerGrad = ctx.createLinearGradient(76, 76, W - 76, 224);
  headerGrad.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
  headerGrad.addColorStop(0.5, 'rgba(49, 46, 129, 0.92)');
  headerGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = headerGrad;
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const collegeTh = data.collegeNameTh || (data.lang === 'th' && data.collegeName ? data.collegeName : COLLEGE_NAME_TH);
  const collegeEn = data.collegeNameEn || (data.lang === 'en' && data.collegeName ? data.collegeName : COLLEGE_NAME_EN);
  const facultyTh = data.facultyNameTh || (data.lang === 'th' && data.facultyName ? data.facultyName : FACULTY_NAME_TH);
  const facultyEn = data.facultyNameEn || (data.lang === 'en' && data.facultyName ? data.facultyName : FACULTY_NAME_EN);

  ctx.textAlign = 'center';
  // College Title
  ctx.fillStyle = '#facc15';
  ctx.font = '800 38px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(data.lang === 'th' ? collegeTh : collegeEn, W / 2, 134);

  // Faculty Title
  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 28px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(data.lang === 'th' ? facultyTh : facultyEn, W / 2, 185);

  // 6. Game Title & Achievement Badge
  ctx.save();
  ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 52px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText('FUTURE ROBOT ADVENTURE', W / 2, 280);
  ctx.restore();

  // Achievement Badge Pill
  const badgeW = 560;
  const badgeH = 42;
  const badgeX = (W - badgeW) / 2;
  const badgeY = 305;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 21);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.font = '800 21px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    data.lang === 'th'
      ? '🏅 เกียรติบัตรสุดยอดนักโค้ดดิ้งหุ่นยนต์ 🏅'
      : '🏅 CERTIFICATE OF CODING EXCELLENCE 🏅',
    W / 2,
    badgeY + 28,
  );

  // 7. Center Robot Illustration Emblem & Rank Badge
  const rcx = W / 2;
  const rcy = 445;

  // Glowing ring behind robot
  const ringGrad = ctx.createRadialGradient(rcx, rcy, 25, rcx, rcy, 115);
  ringGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
  ringGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.25)');
  ringGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(rcx, rcy, 115, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(rcx, rcy, 90, 0, Math.PI * 2);
  ctx.stroke();

  // Draw Cute Robot inside emblem
  ctx.save();
  ctx.translate(rcx, rcy + 10);
  // Antenna
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(0, -78);
  ctx.stroke();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(0, -82, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Head
  drawRoundedRect(ctx, -44, -52, 88, 60, 18);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();
  ctx.stroke();
  // Visor
  drawRoundedRect(ctx, -32, -40, 64, 32, 10);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  // Happy eyes
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(-14, -24, 7, 0, Math.PI * 2);
  ctx.arc(14, -24, 7, 0, Math.PI * 2);
  ctx.fill();
  // Body
  drawRoundedRect(ctx, -36, 12, 72, 44, 14);
  ctx.fillStyle = '#38bdf8';
  ctx.fill();
  ctx.stroke();
  // Chest core
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(0, 34, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Coder Rank Badge (ลูกเล่นฉายานักพัฒนา)
  let rankText = '⭐ ระดับ: นักโค้ดดาวรุ่ง (RISING STAR)';
  let rankColor = '#4ade80';
  let rankBg = 'rgba(74, 222, 128, 0.16)';
  let rankBorder = 'rgba(74, 222, 128, 0.65)';

  if (data.score >= 1200 || data.levelsCompleted >= data.totalLevels) {
    rankText = data.lang === 'th' ? '🏆 ระดับ: ปรมาจารย์โค้ดดิ้ง (MASTER)' : '🏆 RANK: CODING MASTER';
    rankColor = '#facc15';
    rankBg = 'rgba(250, 204, 21, 0.18)';
    rankBorder = 'rgba(250, 204, 21, 0.7)';
  } else if (data.score >= 600 || data.levelsCompleted >= Math.ceil(data.totalLevels / 2)) {
    rankText = data.lang === 'th' ? '🚀 ระดับ: ยอดนักโค้ดมือโปร (PRO)' : '🚀 RANK: PRO CODER';
    rankColor = '#38bdf8';
    rankBg = 'rgba(56, 189, 248, 0.18)';
    rankBorder = 'rgba(56, 189, 248, 0.7)';
  } else {
    rankText = data.lang === 'th' ? '⭐ ระดับ: นักโค้ดดาวรุ่ง (RISING STAR)' : '⭐ RANK: RISING STAR';
  }

  const rankW = 440;
  const rankH = 42;
  const rankX = (W - rankW) / 2;
  const rankY = 562;
  drawRoundedRect(ctx, rankX, rankY, rankW, rankH, 21);
  ctx.fillStyle = rankBg;
  ctx.fill();
  ctx.strokeStyle = rankBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = rankColor;
  ctx.font = '800 20px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(rankText, W / 2, rankY + 28);

  // 8. Student Name & School Card Box (Enlarged, high-contrast, prestigious)
  const studentBoxY = 626;
  const studentBoxH = 265;
  drawRoundedRect(ctx, 76, studentBoxY, W - 152, studentBoxH, 32);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner cyber ticks in student box
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(96, studentBoxY + 36);
  ctx.lineTo(96, studentBoxY + 20);
  ctx.lineTo(112, studentBoxY + 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(W - 96, studentBoxY + 36);
  ctx.lineTo(W - 96, studentBoxY + 20);
  ctx.lineTo(W - 112, studentBoxY + 20);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Label
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 22px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    data.lang === 'th' ? 'ชื่อผู้เข้าร่วมภารกิจ / STUDENT NAME' : 'STUDENT NAME',
    W / 2,
    studentBoxY + 52,
  );

  // Big Student Name
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 66px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
  ctx.shadowBlur = 10;
  ctx.fillText(truncateText(ctx, data.name, W - 220), W / 2, studentBoxY + 130);
  ctx.restore();

  // School Pill
  const schoolPillY = studentBoxY + 165;
  const schoolPillH = 72;
  const schoolPillW = W - 240;
  const schoolPillX = (W - schoolPillW) / 2;
  drawRoundedRect(ctx, schoolPillX, schoolPillY, schoolPillW, schoolPillH, 20);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#7dd3fc';
  ctx.font = '700 32px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  const schoolLabel = data.lang === 'th' ? `🏫 โรงเรียน: ${data.school}` : `🏫 School: ${data.school}`;
  ctx.fillText(truncateText(ctx, schoolLabel, schoolPillW - 40), W / 2, schoolPillY + 47);

  // 9. Stats Row (Score & Missions Cleared - Extra Large & Punchy)
  const boxY = 915;
  const boxH = 195;
  const boxW = (W - 152 - 32) / 2;

  // Box 1: Total Score
  drawRoundedRect(ctx, 76, boxY, boxW, boxH, 28);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Radial score glow
  const scoreGlow = ctx.createRadialGradient(
    76 + boxW / 2,
    boxY + 130,
    10,
    76 + boxW / 2,
    boxY + 130,
    120,
  );
  scoreGlow.addColorStop(0, 'rgba(250, 204, 21, 0.18)');
  scoreGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = scoreGlow;
  ctx.fillRect(76, boxY, boxW, boxH);

  ctx.fillStyle = '#fde047';
  ctx.font = '700 24px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(data.lang === 'th' ? '🏆 คะแนนรวม (SCORE)' : '🏆 TOTAL SCORE', 76 + boxW / 2, boxY + 54);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 80px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(`${data.score}`, 76 + boxW / 2, boxY + 148);

  // Box 2: Missions Cleared
  const box2X = 76 + boxW + 32;
  drawRoundedRect(ctx, box2X, boxY, boxW, boxH, 28);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.65)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Radial missions glow
  const missionGlow = ctx.createRadialGradient(
    box2X + boxW / 2,
    boxY + 130,
    10,
    box2X + boxW / 2,
    boxY + 130,
    120,
  );
  missionGlow.addColorStop(0, 'rgba(74, 222, 128, 0.18)');
  missionGlow.addColorStop(1, 'rgba(74, 222, 128, 0)');
  ctx.fillStyle = missionGlow;
  ctx.fillRect(box2X, boxY, boxW, boxH);

  ctx.fillStyle = '#4ade80';
  ctx.font = '700 24px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    data.lang === 'th' ? '🎯 ภารกิจสำเร็จ (MISSIONS)' : '🎯 MISSIONS SOLVED',
    box2X + boxW / 2,
    boxY + 54,
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 80px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(`${data.levelsCompleted} / ${data.totalLevels}`, box2X + boxW / 2, boxY + 148);

  // 10. Footer Banner (Concise, neat, high-tech)
  const footerY = 1135;
  const footerH = 125;
  drawRoundedRect(ctx, 76, footerY, W - 152, footerH, 24);
  ctx.fillStyle = 'rgba(79, 70, 229, 0.28)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#e0e7ff';
  ctx.font = '800 26px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    data.lang === 'th'
      ? '✨ ขอแสดงความยินดีกับยอดนักเขียนโค้ดแห่งอนาคต! ✨'
      : '✨ Congratulations, Future Robot Programmer! ✨',
    W / 2,
    footerY + 52,
  );

  ctx.fillStyle = '#93c5fd';
  ctx.font = '600 21px "Plus Jakarta Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    `#KKTech #PTECH #คณะเทคโนโลยีสารสนเทศ • ${data.dateStr ?? ''}`,
    W / 2,
    footerY + 95,
  );

  return canvas.toDataURL('image/png');
}
