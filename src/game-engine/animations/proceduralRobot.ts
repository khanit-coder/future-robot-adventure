import * as Phaser from 'phaser';
import type { RobotAnimationRange } from '@engine';

export const BUILTIN_FRAME_SIZE = 96;

/** Frame map for procedurally generated builtin robot spritesheets (16 frames total). */
export const BUILTIN_ANIMATIONS: Record<string, RobotAnimationRange> = {
  idle: { start: 0, end: 1, frame_rate: 3, repeat: -1 },
  walk: { start: 2, end: 5, frame_rate: 8, repeat: -1 },
  run: { start: 2, end: 5, frame_rate: 12, repeat: -1 },
  jump: { start: 6, end: 7, frame_rate: 6, repeat: 0 },
  turn: { start: 8, end: 9, frame_rate: 8, repeat: 0 },
  wave: { start: 10, end: 11, frame_rate: 6, repeat: -1 },
  celebrate: { start: 12, end: 13, frame_rate: 7, repeat: -1 },
  fail: { start: 14, end: 15, frame_rate: 6, repeat: 1 },
};

/**
 * Generates a crisp 16-frame 96x96 spritesheet texture on an offscreen HTML5 Canvas
 * for any builtin robot style/color, so Phaser animates every state smoothly with zero external assets.
 */
export function ensureBuiltinRobotSheet(
  scene: Phaser.Scene,
  key: string,
  colorHex: string,
  style: string,
): void {
  if (scene.textures.exists(key)) return;

  const frames = 16;
  const size = BUILTIN_FRAME_SIZE;
  const canvasTex = scene.textures.createCanvas(key, size * frames, size);
  if (!canvasTex) return;
  const ctx = canvasTex.getContext();

  for (let i = 0; i < frames; i++) {
    ctx.save();
    ctx.translate(i * size, 0);
    drawRobotFrame(ctx, size, colorHex, style, i);
    ctx.restore();
  }
  canvasTex.refresh();

  // Slice into individual spritesheet frames
  const texture = scene.textures.get(key);
  for (let i = 0; i < frames; i++) {
    texture.add(i, 0, i * size, 0, size, size);
  }
}

export function registerRobotAnims(
  scene: Phaser.Scene,
  textureKey: string,
  prefix: string,
  ranges: Record<string, RobotAnimationRange>,
): void {
  const effective = Object.keys(ranges).length > 0 ? ranges : BUILTIN_ANIMATIONS;
  for (const [state, spec] of Object.entries(effective)) {
    const animKey = `${prefix}:${state}`;
    if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    const frames: Phaser.Types.Animations.AnimationFrame[] = [];
    const start = Math.max(0, spec.start);
    const end = Math.max(start, spec.end);
    for (let f = start; f <= end; f++) {
      frames.push({ key: textureKey, frame: f });
    }
    scene.anims.create({
      key: animKey,
      frames,
      frameRate: Math.max(1, spec.frame_rate || 6),
      repeat: spec.repeat ?? -1,
    });
  }
}

function drawRobotFrame(
  ctx: CanvasRenderingContext2D,
  s: number,
  color: string,
  style: string,
  frame: number,
): void {
  const cx = s / 2;
  const bob = frame === 1 ? -2 : frame === 3 || frame === 5 ? -3 : frame === 6 || frame === 7 ? -8 : 0;
  const tilt =
    frame === 8
      ? -0.14
      : frame === 9
        ? 0.14
        : frame === 12
          ? -0.1
          : frame === 13
            ? 0.1
            : frame === 14
              ? -0.12
              : frame === 15
                ? 0.12
                : 0;
  const legStride = frame === 2 ? -4 : frame === 4 ? 4 : 0;
  const waveRight = frame === 10 || frame === 11 || frame === 12 || frame === 13;
  const waveOffset = frame === 11 || frame === 13 ? -12 : -7;
  const isFail = frame === 14 || frame === 15;
  const isCelebrate = frame === 12 || frame === 13;

  ctx.translate(cx, s * 0.56 + bob);
  ctx.rotate(tilt);

  // Legs / hover base
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  if (style === 'gizmo') {
    roundRect(ctx, -14, 15, 28, 9, 4, true, true);
  } else {
    roundRect(ctx, -15 + legStride, 15, 11, 9, 3, true, true);
    roundRect(ctx, 4 - legStride, 15, 11, 9, 3, true, true);
  }

  // Left arm
  ctx.fillStyle = color;
  roundRect(ctx, -28, -2, 8, 17, 4, true, true);

  // Right arm (waves/celebrates)
  if (waveRight) {
    ctx.save();
    ctx.translate(24, 2);
    ctx.rotate((waveOffset * Math.PI) / 45);
    roundRect(ctx, -4, -18, 8, 17, 4, true, true);
    ctx.restore();
  } else {
    roundRect(ctx, 20, -2, 8, 17, 4, true, true);
  }

  // Body
  ctx.fillStyle = color;
  roundRect(ctx, -20, -2, 40, 20, 7, true, true);
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, -11, 3, 22, 10, 4, true, false);
  ctx.fillStyle = isCelebrate ? '#4ade80' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(-5, 8, 2.2, 0, Math.PI * 2);
  ctx.arc(0, 8, 2.2, 0, Math.PI * 2);
  ctx.arc(5, 8, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Antenna
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (style === 'nova') {
    ctx.moveTo(-10, -28);
    ctx.lineTo(-14, -38);
    ctx.moveTo(10, -28);
    ctx.lineTo(14, -38);
  } else {
    ctx.moveTo(0, -28);
    ctx.lineTo(0, -39);
  }
  ctx.stroke();

  ctx.fillStyle = isCelebrate ? '#4ade80' : isFail ? '#fb7185' : '#fbbf24';
  if (style === 'nova') {
    ctx.beginPath();
    ctx.arc(-14, -39, 3.5, 0, Math.PI * 2);
    ctx.arc(14, -39, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(0, -40, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head
  ctx.fillStyle = color;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  roundRect(ctx, -23, -30, 46, 30, style === 'nova' ? 13 : 9, true, true);

  // Visor
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, -17, -24, 34, 18, 6, true, false);

  // Eyes & mouth
  ctx.strokeStyle = isFail ? '#fb7185' : '#38bdf8';
  ctx.fillStyle = isFail ? '#fb7185' : '#38bdf8';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  if (isFail) {
    ctx.beginPath();
    ctx.moveTo(-11, -19);
    ctx.lineTo(-5, -13);
    ctx.moveTo(-5, -19);
    ctx.lineTo(-11, -13);
    ctx.moveTo(5, -19);
    ctx.lineTo(11, -13);
    ctx.moveTo(11, -19);
    ctx.lineTo(5, -13);
    ctx.stroke();
  } else if (isCelebrate) {
    ctx.strokeStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(-8, -14, 4, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, -14, 4, Math.PI, 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-8, -16, 3.3, 0, Math.PI * 2);
    ctx.arc(8, -16, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-7, -17, 1.1, 0, Math.PI * 2);
    ctx.arc(9, -17, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: boolean,
  stroke: boolean,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
