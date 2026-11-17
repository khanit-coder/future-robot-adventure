import * as Phaser from 'phaser';
import type { RobotAnimationRange } from '@engine';
import { BUILTIN_FRAME_SIZE, BUILTIN_ANIMATIONS } from './animationConstants';
import { isGradient, parseGradientStops } from './robotStyles';

export { BUILTIN_FRAME_SIZE, BUILTIN_ANIMATIONS };

/**
 * Generates a crisp 16-frame 96x96 spritesheet texture on an offscreen HTML5 Canvas
 * for any builtin robot style/color, so Phaser animates every state smoothly with zero external assets.
 * Styled with "Style A: Cute & Expressive Chibi Bot" for lively, adorable animations.
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

  // Animation State Flags (16-frame 4x4 Grid Standard)
  const isIdle = frame === 0 || frame === 1;
  const isBlink = frame === 1;
  const isWalk = frame >= 2 && frame <= 5;
  const isCrouch = frame === 6;
  const isJumpApex = frame === 7;
  const isTurnLeft = frame === 8;
  const isTurnRight = frame === 9;
  const isWave = frame === 10 || frame === 11;
  const isCelebrate = frame === 12 || frame === 13;
  const isShock = frame === 14;
  const isSlump = frame === 15;
  const isFail = isShock || isSlump;

  // Kinematic parameters (Bob, Tilt, Squash/Stretch)
  let bob = 0;
  let tilt = 0;
  let scaleX = 1;
  let scaleY = 1;

  if (isIdle) {
    bob = isBlink ? 1.5 : 0;
    scaleX = isBlink ? 1.02 : 1;
    scaleY = isBlink ? 0.98 : 1;
  } else if (isWalk) {
    bob = frame === 3 || frame === 5 ? -3 : -0.5;
    tilt = 0.05; // dynamic forward lean
  } else if (isCrouch) {
    bob = 4; // anticipation squash down
    scaleX = 1.08;
    scaleY = 0.9;
  } else if (isJumpApex) {
    bob = -11; // high in air stretch
    scaleX = 0.95;
    scaleY = 1.05;
  } else if (isTurnLeft) {
    tilt = -0.15;
  } else if (isTurnRight) {
    tilt = 0.15;
  } else if (isWave) {
    bob = frame === 11 ? -2 : -1;
    tilt = frame === 11 ? 0.12 : 0.08; // cute chibi head tilt
  } else if (isCelebrate) {
    bob = frame === 13 ? -8 : -5;
    tilt = frame === 13 ? 0.05 : -0.05;
    scaleX = 0.96;
    scaleY = 1.04;
  } else if (isShock) {
    bob = 1;
    tilt = -0.15;
  } else if (isSlump) {
    bob = 6; // collapsed sitting on ground
    scaleX = 1.08;
    scaleY = 0.88;
    tilt = 0.04;
  }

  // Base canvas transformation
  ctx.translate(cx, s * 0.54 + bob);
  ctx.rotate(tilt);
  ctx.scale(scaleX, scaleY);

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

  // 0. Background Micro-Effects (Particles, Jet Flames, Sparkles)
  if (isJumpApex) {
    drawBoosterFlame(ctx, 0, 21);
  }
  if (isCelebrate && frame === 13) {
    drawStar(ctx, -26, -26, 4, 6, 2.5, '#fbbf24');
    drawStar(ctx, 26, -26, 4, 6, 2.5, '#fde047');
  }
  if (isWave && frame === 11) {
    drawStar(ctx, 28, -22, 4, 5, 2, '#38bdf8');
  }
  if (isShock) {
    drawSpark(ctx, 16, -34);
  }
  if (isSlump) {
    drawSmoke(ctx, -14, -20);
  }
  if (isWalk && (frame === 3 || frame === 5)) {
    drawDustPuff(ctx, frame === 3 ? -14 : 14, 21);
  }
  if (isTurnLeft) {
    drawScanRings(ctx, -20, -15, true);
  }
  if (isTurnRight) {
    drawScanRings(ctx, 20, -15, false);
  }

  // 1. Movement Base / Legs / Thrusters
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
    ctx.fillStyle = isCelebrate ? 'rgba(74, 222, 128, 0.4)' : 'rgba(56, 189, 248, 0.4)';
    ctx.fill();
  } else if (style === 'retro') {
    // Boxy accordion boots
    ctx.fillStyle = '#475569';
    if (isSlump) {
      ctx.fillRect(-20, 16, 13, 8);
      ctx.strokeRect(-20, 16, 13, 8);
      ctx.fillRect(7, 16, 13, 8);
      ctx.strokeRect(7, 16, 13, 8);
    } else {
      const legStride = frame === 2 ? -4 : frame === 4 ? 4 : 0;
      ctx.fillRect(-17 + legStride, 14, 12, 10);
      ctx.strokeRect(-17 + legStride, 14, 12, 10);
      ctx.fillRect(5 - legStride, 14, 12, 10);
      ctx.strokeRect(5 - legStride, 14, 12, 10);
    }
  } else {
    // Standard dual bipedal legs (bolt, nova, cyber, spark, shadow, astro)
    if (isSlump) {
      // Sitting down splayed chibi feet
      roundRect(ctx, -19, 16, 13, 8, 3, true, true);
      roundRect(ctx, 6, 16, 13, 8, 3, true, true);
    } else if (isJumpApex) {
      // Tucked feet in air
      roundRect(ctx, -12, 12, 9, 8, 3, true, true);
      roundRect(ctx, 3, 12, 9, 8, 3, true, true);
    } else if (isCrouch) {
      // Squatting bent knees
      roundRect(ctx, -17, 15, 12, 7, 3, true, true);
      roundRect(ctx, 5, 15, 12, 7, 3, true, true);
    } else if (isWalk) {
      // Natural walking stride
      const legStride = frame === 2 ? -5 : frame === 4 ? 5 : 0;
      roundRect(ctx, -15 + legStride, 15, 10, 9, 3, true, true);
      roundRect(ctx, 5 - legStride, 15, 10, 9, 3, true, true);
    } else {
      // Normal standing
      roundRect(ctx, -14, 15, 10, 9, 3, true, true);
      roundRect(ctx, 4, 15, 10, 9, 3, true, true);
    }
  }

  // 2. Left Arm
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;

  let leftArmAngle = 0;
  let leftArmX = -24;
  let leftArmY = 0;
  if (isCelebrate) {
    leftArmAngle = -1.9; // raised high in victory \
    leftArmX = -20;
    leftArmY = 4;
  } else if (isJumpApex) {
    leftArmAngle = -0.7; // outstretched for balance
    leftArmX = -22;
    leftArmY = 3;
  } else if (isCrouch) {
    leftArmAngle = 0.5; // pulled back before jump
  } else if (isWalk) {
    leftArmAngle = frame === 2 ? 0.35 : frame === 4 ? -0.35 : 0; // swings opposite to left leg
  } else if (isSlump) {
    leftArmAngle = 0.6; // limp on ground
    leftArmY = 6;
  }

  ctx.save();
  ctx.translate(leftArmX, leftArmY);
  ctx.rotate(leftArmAngle);
  if (style === 'titan') {
    roundRect(ctx, -7, -4, 12, 10, 3, true, true);
    roundRect(ctx, -5, 4, 9, 14, 3, true, true);
  } else if (style === 'echo') {
    roundRect(ctx, -4, 0, 7, 12, 3.5, true, true);
  } else {
    roundRect(ctx, -4, 0, 8, 17, 4, true, true);
  }
  ctx.restore();

  // 3. Right Arm (Waves / Celebrates / Swings)
  let rightArmAngle = 0;
  let rightArmX = 24;
  let rightArmY = 0;
  if (isCelebrate) {
    rightArmAngle = 1.9; // raised high in victory /
    rightArmX = 20;
    rightArmY = 4;
  } else if (isWave) {
    rightArmAngle = frame === 10 ? 2.2 : 2.55; // high energetic wave
    rightArmX = 21;
    rightArmY = 4;
  } else if (isJumpApex) {
    rightArmAngle = 0.7; // outstretched for balance
    rightArmX = 22;
    rightArmY = 3;
  } else if (isCrouch) {
    rightArmAngle = -0.5; // pulled back
  } else if (isWalk) {
    rightArmAngle = frame === 2 ? -0.35 : frame === 4 ? 0.35 : 0; // swings opposite to right leg
  } else if (isSlump) {
    rightArmAngle = -0.6; // limp on ground
    rightArmY = 6;
  }

  ctx.save();
  ctx.translate(rightArmX, rightArmY);
  ctx.rotate(rightArmAngle);
  if (style === 'titan') {
    roundRect(ctx, -5, -4, 12, 10, 3, true, true);
    roundRect(ctx, -4, 4, 9, 14, 3, true, true);
  } else if (style === 'echo') {
    roundRect(ctx, -3, 0, 7, 12, 3.5, true, true);
  } else {
    roundRect(ctx, -4, 0, 8, 17, 4, true, true);
  }
  ctx.restore();

  // 4. Body & Chest Core
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;

  if (style === 'echo') {
    // Round capsule body
    roundRect(ctx, -19, -2, 38, 22, 11, true, true);
    // Glowing core
    ctx.fillStyle = isCelebrate ? '#4ade80' : isFail ? '#fb7185' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 9, isBlink ? 6 : 5, 0, Math.PI * 2);
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
    ctx.fillStyle = isCelebrate ? '#4ade80' : '#f59e0b';
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
    ctx.fillStyle = isCelebrate ? '#4ade80' : '#06b6d4';
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
    ctx.lineTo(isCelebrate ? -3 : 3, 3);
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
    ctx.fillStyle = isCelebrate ? '#4ade80' : '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Classic (bolt, nova, gizmo, astro)
    roundRect(ctx, -20, -2, 40, 20, 7, true, true);
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, -11, 3, 22, 10, 4, true, false);
    ctx.fillStyle = isCelebrate ? '#4ade80' : isFail ? '#fb7185' : '#38bdf8';
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

  const antennaBend = isShock ? -6 : isSlump ? 8 : 0;

  if (style === 'nova') {
    ctx.moveTo(-10, -28);
    ctx.lineTo(-14 + antennaBend, -38);
    ctx.moveTo(10, -28);
    ctx.lineTo(14 + antennaBend, -38);
    ctx.stroke();
    ctx.fillStyle = isCelebrate ? '#4ade80' : isFail ? '#fb7185' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(-14 + antennaBend, -39, 3.5, 0, Math.PI * 2);
    ctx.arc(14 + antennaBend, -39, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'spark') {
    // Sharp lightning horns
    ctx.fillStyle = isCelebrate ? '#4ade80' : '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-14, -28);
    ctx.lineTo(-20 + antennaBend, -42);
    ctx.lineTo(-11, -33);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -28);
    ctx.lineTo(20 + antennaBend, -42);
    ctx.lineTo(11, -33);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'retro') {
    // Spring antenna
    ctx.moveTo(0, -28);
    ctx.lineTo(0 + antennaBend * 0.3, -32);
    ctx.lineTo(3 + antennaBend * 0.6, -34);
    ctx.lineTo(-3 + antennaBend * 0.8, -37);
    ctx.lineTo(0 + antennaBend, -40);
    ctx.stroke();
    ctx.fillStyle = isCelebrate ? '#4ade80' : '#ef4444';
    ctx.beginPath();
    ctx.arc(0 + antennaBend, -42, 3.5, 0, Math.PI * 2);
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
    ctx.lineTo(antennaBend, -39);
    ctx.stroke();
    ctx.fillStyle = isCelebrate ? '#4ade80' : isFail ? '#fb7185' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(antennaBend, -40, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Head
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;

  if (style === 'echo') {
    roundRect(ctx, -22, -29, 44, 28, 14, true, true);
  } else if (style === 'titan') {
    roundRect(ctx, -24, -30, 48, 28, 5, true, true);
  } else if (style === 'retro') {
    roundRect(ctx, -21, -30, 42, 28, 3, true, true);
  } else if (style === 'nova') {
    roundRect(ctx, -23, -30, 46, 30, 13, true, true);
  } else {
    roundRect(ctx, -23, -30, 46, 30, 9, true, true);
  }

  // 7. Visor / Face Plate
  ctx.fillStyle = '#0f172a';
  if (style === 'cyber') {
    roundRect(ctx, -20, -24, 40, 16, 4, true, false);
  } else if (style === 'shadow') {
    roundRect(ctx, -19, -23, 38, 10, 3, true, false);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-17, -13, 34, 10);
  } else if (style === 'titan') {
    roundRect(ctx, -18, -22, 36, 11, 2, true, false);
  } else {
    roundRect(ctx, -17, -24, 34, 18, 6, true, false);
  }

  // 8. Eyes & Expression (Chibi Style A: Cute, Alive & Expressive)
  const eyeColor = isFail
    ? '#fb7185'
    : isCelebrate
      ? '#4ade80'
      : style === 'cyber'
        ? '#00f0ff'
        : style === 'shadow'
          ? '#ef4444'
          : '#38bdf8';

  ctx.strokeStyle = eyeColor;
  ctx.fillStyle = eyeColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

  if (isShock) {
    // Startled electric dizzy X-X eyes
    ctx.beginPath();
    ctx.moveTo(-12, -19);
    ctx.lineTo(-4, -13);
    ctx.moveTo(-4, -19);
    ctx.lineTo(-12, -13);
    ctx.moveTo(4, -19);
    ctx.lineTo(12, -13);
    ctx.moveTo(12, -19);
    ctx.lineTo(4, -13);
    ctx.stroke();
    // Wobbly mouth
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.lineTo(-2, -10);
    ctx.lineTo(1, -8);
    ctx.lineTo(4, -10);
    ctx.stroke();
  } else if (isSlump) {
    // Defeat closed X-X eyes with sad frown
    ctx.beginPath();
    ctx.moveTo(-11, -18);
    ctx.lineTo(-5, -14);
    ctx.moveTo(-5, -18);
    ctx.lineTo(-11, -14);
    ctx.moveTo(5, -18);
    ctx.lineTo(11, -14);
    ctx.moveTo(11, -18);
    ctx.lineTo(5, -14);
    ctx.stroke();
    // Sad inverted curved mouth
    ctx.beginPath();
    ctx.arc(0, -6, 4, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  } else if (isCelebrate) {
    // Victory happy anime curves (^ ^) + joyful open mouth
    ctx.beginPath();
    ctx.arc(-8, -15, 4.2, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, -15, 4.2, Math.PI, 0);
    ctx.stroke();
    // Happy open mouth (^o^)
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -10, 2.5, 0, Math.PI);
    ctx.fill();
  } else if (isWave) {
    // Friendly sweet smiling eyes (^ ^)
    ctx.beginPath();
    ctx.arc(-8, -15, 3.8, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, -15, 3.8, Math.PI, 0);
    ctx.stroke();
    // Cute pink blush cheek dots
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.ellipse(-12, -11, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.ellipse(12, -11, 2.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cute smile mouth
    ctx.strokeStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(0, -11, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (isBlink) {
    // Gentle blinking smile (- -)
    ctx.beginPath();
    ctx.moveTo(-11, -16);
    ctx.lineTo(-5, -16);
    ctx.moveTo(5, -16);
    ctx.lineTo(11, -16);
    ctx.stroke();
    // Friendly mouth
    ctx.strokeStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(0, -11, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (isTurnLeft) {
    // Eyes looking to the left
    ctx.beginPath();
    ctx.arc(-10, -16, 3.2, 0, Math.PI * 2);
    ctx.arc(6, -16, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-11, -17, 1.2, 0, Math.PI * 2);
    ctx.arc(5, -17, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (isTurnRight) {
    // Eyes looking to the right
    ctx.beginPath();
    ctx.arc(-6, -16, 3.2, 0, Math.PI * 2);
    ctx.arc(10, -16, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-5, -17, 1.2, 0, Math.PI * 2);
    ctx.arc(11, -17, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'cyber') {
    // Glowing horizontal cyber visor bar
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-16, -18, 32, 5);
  } else if (style === 'shadow') {
    // Twin sharp red sensor slits
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-13, -19, 9, 3);
    ctx.fillRect(4, -19, 9, 3);
  } else {
    // Standard friendly glowing circle eyes with anime shine reflection + smile
    ctx.beginPath();
    ctx.arc(-8, -16, 3.5, 0, Math.PI * 2);
    ctx.arc(8, -16, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-7, -17.2, 1.3, 0, Math.PI * 2);
    ctx.arc(9, -17.2, 1.3, 0, Math.PI * 2);
    ctx.fill();
    // Cute smile mouth
    ctx.strokeStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(0, -11, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
}

// Helper Drawing Functions
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

function drawBoosterFlame(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Outer jet flame
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.quadraticCurveTo(x - 5, y + 9, x, y + 13);
  ctx.quadraticCurveTo(x + 5, y + 9, x + 8, y);
  ctx.closePath();
  ctx.fill();

  // Inner core flame
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.quadraticCurveTo(x - 2, y + 6, x, y + 8);
  ctx.quadraticCurveTo(x + 2, y + 6, x + 4, y);
  ctx.closePath();
  ctx.fill();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number,
  color: string,
) {
  let rot = (Math.PI / 2) * 3;
  let x: number;
  let y: number;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, color = '#facc15') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 4, y - 5);
  ctx.lineTo(x + 1, y - 5);
  ctx.lineTo(x + 6, y - 11);
  ctx.stroke();
}

function drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.arc(x + 3, y - 3, 4, 0, Math.PI * 2);
  ctx.arc(x + 1, y - 7, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawDustPuff(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(203, 213, 225, 0.5)';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.arc(x - 4, y + 1, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawScanRings(ctx: CanvasRenderingContext2D, x: number, y: number, isLeft: boolean) {
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 1.5;
  const startAngle = isLeft ? Math.PI * 0.75 : -Math.PI * 0.25;
  const endAngle = isLeft ? Math.PI * 1.25 : Math.PI * 0.25;

  ctx.beginPath();
  ctx.arc(x, y, 9, startAngle, endAngle);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 15, startAngle, endAngle);
  ctx.stroke();
}
