import * as Phaser from 'phaser';
import type { RobotAnimationRange } from '@engine';
import { BUILTIN_FRAME_SIZE, BUILTIN_ANIMATIONS } from './animationConstants';
import { isGradient, parseGradientStops } from './robotStyles';

export { BUILTIN_FRAME_SIZE, BUILTIN_ANIMATIONS };

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

export function drawRobotFrame(
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

  // Gradient support
  let fillStyle: string | CanvasGradient = color;
  if (isGradient(color)) {
    const stops = parseGradientStops(color);
    const grad = ctx.createLinearGradient(-25, -35, 25, 25);
    stops.forEach((c, idx) => {
      grad.addColorStop(idx / Math.max(1, stops.length - 1), c);
    });
    fillStyle = grad;
  }

  // 1. Movement Base / Legs
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;

  if (style === 'gizmo') {
    // Hover thruster base
    roundRect(ctx, -14, 15, 28, 9, 4, true, true);
    // Thruster glow
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 24, 4 + (frame % 2) * 2, 0, Math.PI);
    ctx.fill();
  } else if (style === 'titan') {
    // Heavy tank tread base
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, -22, 14, 44, 11, 5, true, true);
    // 3 inner tread wheels
    ctx.fillStyle = '#64748b';
    for (const wx of [-12, 0, 12]) {
      ctx.beginPath();
      ctx.arc(wx, 19.5, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else if (style === 'echo') {
    // Cute capsule anti-gravity float ring
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 18, 14, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Inner pulse
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.fill();
  } else if (style === 'retro') {
    // Boxy accordion boots
    ctx.fillStyle = '#475569';
    ctx.fillRect(-17 + legStride, 14, 12, 10);
    ctx.strokeRect(-17 + legStride, 14, 12, 10);
    ctx.fillRect(5 - legStride, 14, 12, 10);
    ctx.strokeRect(5 - legStride, 14, 12, 10);
  } else {
    // Standard dual legs (bolt, nova, cyber, spark, shadow, astro)
    roundRect(ctx, -15 + legStride, 15, 11, 9, 3, true, true);
    roundRect(ctx, 4 - legStride, 15, 11, 9, 3, true, true);
  }

  // 2. Left Arm
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  if (style === 'titan') {
    // Bulky shoulder plate + arm
    roundRect(ctx, -32, -4, 12, 10, 3, true, true);
    roundRect(ctx, -30, 4, 9, 14, 3, true, true);
  } else if (style === 'echo') {
    // Cute small flipper arm
    roundRect(ctx, -24, 2, 7, 12, 3.5, true, true);
  } else {
    roundRect(ctx, -28, -2, 8, 17, 4, true, true);
  }

  // 3. Right Arm (Waves / Celebrates)
  if (waveRight) {
    ctx.save();
    ctx.translate(24, 2);
    ctx.rotate((waveOffset * Math.PI) / 45);
    if (style === 'titan') {
      roundRect(ctx, 2, -18, 10, 16, 3, true, true);
    } else if (style === 'echo') {
      roundRect(ctx, 0, -14, 7, 12, 3.5, true, true);
    } else {
      roundRect(ctx, -4, -18, 8, 17, 4, true, true);
    }
    ctx.restore();
  } else {
    if (style === 'titan') {
      roundRect(ctx, 20, -4, 12, 10, 3, true, true);
      roundRect(ctx, 21, 4, 9, 14, 3, true, true);
    } else if (style === 'echo') {
      roundRect(ctx, 17, 2, 7, 12, 3.5, true, true);
    } else {
      roundRect(ctx, 20, -2, 8, 17, 4, true, true);
    }
  }

  // 4. Body
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;

  if (style === 'echo') {
    // Round capsule body
    roundRect(ctx, -19, -2, 38, 22, 11, true, true);
    // Glowing core
    ctx.fillStyle = isCelebrate ? '#4ade80' : isFail ? '#fb7185' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 9, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (style === 'titan') {
    // Heavy mecha chest with armor panel
    roundRect(ctx, -24, -4, 48, 22, 5, true, true);
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, -14, 2, 28, 12, 3, true, false);
    // Hazard power bars
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-10, 5, 5, 6);
    ctx.fillRect(-2, 5, 5, 6);
    ctx.fillRect(6, 5, 5, 6);
  } else if (style === 'spark') {
    // Lightning core body
    roundRect(ctx, -20, -2, 40, 20, 7, true, true);
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, -12, 2, 24, 12, 4, true, false);
    // Bright lightning diamond
    ctx.fillStyle = isCelebrate ? '#4ade80' : '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 12);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'cyber') {
    // Cyberpunk neon stripe chest
    roundRect(ctx, -20, -2, 40, 20, 7, true, true);
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, -15, 3, 30, 10, 3, true, false);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(-12, 7, 24, 3);
  } else if (style === 'retro') {
    // Vintage tin chest with analog dial
    roundRect(ctx, -20, -3, 40, 21, 4, true, true);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Meter needle
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(3, 3);
    ctx.stroke();
  } else if (style === 'shadow') {
    // Stealth diagonal chestplate
    roundRect(ctx, -20, -2, 40, 20, 6, true, true);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-12, 3);
    ctx.lineTo(12, 3);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Classic (bolt, nova, gizmo, astro)
    roundRect(ctx, -20, -2, 40, 20, 7, true, true);
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, -11, 3, 22, 10, 4, true, false);
    ctx.fillStyle = isCelebrate ? '#4ade80' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(-5, 8, 2.2, 0, Math.PI * 2);
    ctx.arc(0, 8, 2.2, 0, Math.PI * 2);
    ctx.arc(5, 8, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Antennas / Headpieces
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();

  if (style === 'nova') {
    ctx.moveTo(-10, -28);
    ctx.lineTo(-14, -38);
    ctx.moveTo(10, -28);
    ctx.lineTo(14, -38);
    ctx.stroke();
    ctx.fillStyle = isCelebrate ? '#4ade80' : isFail ? '#fb7185' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(-14, -39, 3.5, 0, Math.PI * 2);
    ctx.arc(14, -39, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'spark') {
    // Sharp lightning horns
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-14, -28);
    ctx.lineTo(-20, -42);
    ctx.lineTo(-11, -33);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -28);
    ctx.lineTo(20, -42);
    ctx.lineTo(11, -33);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'retro') {
    // Spring antenna
    ctx.moveTo(0, -28);
    ctx.lineTo(0, -32);
    ctx.lineTo(3, -34);
    ctx.lineTo(-3, -37);
    ctx.lineTo(0, -40);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -42, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'echo') {
    // Cute droplet ears
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    roundRect(ctx, -26, -26, 6, 12, 3, true, true);
    roundRect(ctx, 20, -26, 6, 12, 3, true, true);
  } else if (style === 'cyber') {
    // Dual cyber headphones
    ctx.fillStyle = '#06b6d4';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -27, -25, 7, 18, 3, true, true);
    roundRect(ctx, 20, -25, 7, 18, 3, true, true);
    // Headband
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -24, 21, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (style === 'titan') {
    // Mecha crown antennae
    ctx.fillStyle = '#475569';
    ctx.fillRect(-5, -34, 10, 6);
  } else if (style === 'astro') {
    // Bubble dome ring
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -15, 23, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Single antenna (bolt, gizmo, shadow)
    ctx.moveTo(0, -28);
    ctx.lineTo(0, -39);
    ctx.stroke();
    ctx.fillStyle = isCelebrate ? '#4ade80' : isFail ? '#fb7185' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -40, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Head
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;

  if (style === 'echo') {
    // Perfectly round cute head
    roundRect(ctx, -22, -29, 44, 28, 14, true, true);
  } else if (style === 'titan') {
    // Angular mecha head
    roundRect(ctx, -24, -30, 48, 28, 5, true, true);
  } else if (style === 'retro') {
    // Square tin box head
    roundRect(ctx, -21, -30, 42, 28, 3, true, true);
  } else if (style === 'nova') {
    roundRect(ctx, -23, -30, 46, 30, 13, true, true);
  } else {
    roundRect(ctx, -23, -30, 46, 30, 9, true, true);
  }

  // 7. Visor / Face Plate
  ctx.fillStyle = '#0f172a';
  if (style === 'cyber') {
    // Wide glowing cyber visor
    roundRect(ctx, -20, -24, 40, 16, 4, true, false);
  } else if (style === 'shadow') {
    // Sharp stealth slit visor
    roundRect(ctx, -19, -23, 38, 10, 3, true, false);
    // Lower ninja mask plate
    ctx.fillStyle = '#334155';
    ctx.fillRect(-17, -13, 34, 10);
  } else if (style === 'titan') {
    // Heavy battle slit visor
    roundRect(ctx, -18, -22, 36, 11, 2, true, false);
  } else {
    roundRect(ctx, -17, -24, 34, 18, 6, true, false);
  }

  // 8. Eyes & Expression
  const eyeColor = isFail ? '#fb7185' : isCelebrate ? '#4ade80' : style === 'cyber' ? '#00f0ff' : style === 'shadow' ? '#ef4444' : '#38bdf8';
  ctx.strokeStyle = eyeColor;
  ctx.fillStyle = eyeColor;
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
    ctx.beginPath();
    ctx.arc(-8, -14, 4, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, -14, 4, Math.PI, 0);
    ctx.stroke();
  } else if (style === 'cyber') {
    // Glowing horizontal cyber visor bar
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-16, -18, 32, 5);
  } else if (style === 'shadow') {
    // Twin sharp red sensor slits
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-13, -19, 9, 3);
    ctx.fillRect(4, -19, 9, 3);
  } else if (style === 'echo') {
    // Big sparkle anime eyes
    ctx.beginPath();
    ctx.arc(-8, -16, 4.2, 0, Math.PI * 2);
    ctx.arc(8, -16, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-7, -18, 1.8, 0, Math.PI * 2);
    ctx.arc(9, -18, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Standard friendly glowing circle eyes
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
