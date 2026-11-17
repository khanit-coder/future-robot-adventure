import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

// --- Pure Node PNG Encoder ---
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return c ^ 0xffffffff;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc >>> 0, 8 + len);
  return buf;
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const scanlineLength = width * 4 + 1;
  const scanlines = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    scanlines[y * scanlineLength] = 0; // Filter type 0
    rgba.copy(scanlines, y * scanlineLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatChunk = makeChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 }));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// --- Software Canvas ---
class SoftwareCanvas {
  width: number;
  height: number;
  buffer: Buffer;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4); // all 0 = transparent
  }

  setPixel(x: number, y: number, r: number, g: number, b: number, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a >= 255) {
      this.buffer[idx] = r;
      this.buffer[idx + 1] = g;
      this.buffer[idx + 2] = b;
      this.buffer[idx + 3] = a;
    } else if (a > 0) {
      const alpha = a / 255;
      const invAlpha = 1 - alpha;
      this.buffer[idx] = Math.round(r * alpha + this.buffer[idx]! * invAlpha);
      this.buffer[idx + 1] = Math.round(g * alpha + this.buffer[idx + 1]! * invAlpha);
      this.buffer[idx + 2] = Math.round(b * alpha + this.buffer[idx + 2]! * invAlpha);
      this.buffer[idx + 3] = Math.min(255, Math.round(a + this.buffer[idx + 3]! * invAlpha));
    }
  }

  fillRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ) {
    const startX = Math.max(0, Math.floor(x));
    const endX = Math.min(this.width, Math.ceil(x + w));
    const startY = Math.max(0, Math.floor(y));
    const endY = Math.min(this.height, Math.ceil(y + h));
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  fillCircle(
    cx: number,
    cy: number,
    radius: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ) {
    const startX = Math.max(0, Math.floor(cx - radius));
    const endX = Math.min(this.width, Math.ceil(cx + radius));
    const startY = Math.max(0, Math.floor(cy - radius));
    const endY = Math.min(this.height, Math.ceil(cy + radius));
    const r2 = radius * radius;
    for (let py = startY; py <= endY; py++) {
      for (let px = startX; px <= endX; px++) {
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r2) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  strokeRect(
    x: number,
    y: number,
    w: number,
    h: number,
    thickness: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ) {
    this.fillRect(x, y, w, thickness, r, g, b, a); // top
    this.fillRect(x, y + h - thickness, w, thickness, r, g, b, a); // bottom
    this.fillRect(x, y, thickness, h, r, g, b, a); // left
    this.fillRect(x + w - thickness, y, thickness, h, r, g, b, a); // right
  }

  drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thickness: number,
    r: number,
    g: number,
    b: number,
    a = 255,
  ) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;
    const rad = Math.max(0.5, thickness / 2);

    while (true) {
      this.fillCircle(cx, cy, rad, r, g, b, a);
      if (Math.round(cx) === Math.round(x1) && Math.round(cy) === Math.round(y1)) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  toPng(): Buffer {
    return encodePng(this.width, this.height, this.buffer);
  }
}

// Draw single robot frame into SoftwareCanvas at (ox, oy) with size 96
function renderRobotFrame(cvs: SoftwareCanvas, ox: number, oy: number, frame: number) {
  const s = 96;
  const cx = ox + s / 2;
  const bob = frame === 1 ? -2 : frame === 3 || frame === 5 ? -3 : frame === 6 || frame === 7 ? -7 : 0;
  const legStride = frame === 2 ? -4 : frame === 4 ? 4 : 0;
  const waveRight = frame === 10 || frame === 11 || frame === 12 || frame === 13;
  const isFail = frame === 14 || frame === 15;
  const isCelebrate = frame === 12 || frame === 13;

  const baseY = oy + s * 0.52 + bob;

  // Shadow
  cvs.fillCircle(cx, oy + 82, 16, 15, 23, 42, 60);

  // Legs
  cvs.fillRect(cx - 14 + legStride, baseY + 18, 9, 10, 71, 85, 105);
  cvs.strokeRect(cx - 14 + legStride, baseY + 18, 9, 10, 1.5, 15, 23, 42);

  cvs.fillRect(cx + 5 - legStride, baseY + 18, 9, 10, 71, 85, 105);
  cvs.strokeRect(cx + 5 - legStride, baseY + 18, 9, 10, 1.5, 15, 23, 42);

  // Body (Sky Blue #38bdf8 = 56, 189, 248)
  cvs.fillRect(cx - 18, baseY + 1, 36, 19, 56, 189, 248);
  cvs.strokeRect(cx - 18, baseY + 1, 36, 19, 2, 15, 23, 42);

  // Chest panel
  cvs.fillRect(cx - 10, baseY + 6, 20, 9, 15, 23, 42);
  // 3 LED dots
  cvs.fillCircle(cx - 5, baseY + 10, 1.8, 56, 189, 248);
  cvs.fillCircle(cx, baseY + 10, 1.8, isCelebrate ? 74 : 74, 222, 128); // Green
  cvs.fillCircle(cx + 5, baseY + 10, 1.8, 251, 191, 36); // Amber

  // Left Arm
  cvs.fillRect(cx - 26, baseY + 2, 7, 16, 56, 189, 248);
  cvs.strokeRect(cx - 26, baseY + 2, 7, 16, 1.5, 15, 23, 42);

  // Right Arm
  if (waveRight) {
    const waveY = frame === 11 || frame === 13 ? baseY - 12 : baseY - 7;
    cvs.fillRect(cx + 19, waveY, 7, 16, 56, 189, 248);
    cvs.strokeRect(cx + 19, waveY, 7, 16, 1.5, 15, 23, 42);
  } else {
    cvs.fillRect(cx + 19, baseY + 2, 7, 16, 56, 189, 248);
    cvs.strokeRect(cx + 19, baseY + 2, 7, 16, 1.5, 15, 23, 42);
  }

  // Antenna
  cvs.drawLine(cx, baseY - 26, cx, baseY - 37, 2, 100, 116, 139);
  const bulbColor = isCelebrate ? [74, 222, 128] : isFail ? [244, 63, 94] : [251, 191, 36];
  cvs.fillCircle(cx, baseY - 38, 3.5, bulbColor[0]!, bulbColor[1]!, bulbColor[2]!);

  // Head
  cvs.fillRect(cx - 20, baseY - 26, 40, 26, 56, 189, 248);
  cvs.strokeRect(cx - 20, baseY - 26, 40, 26, 2, 15, 23, 42);

  // Visor
  cvs.fillRect(cx - 15, baseY - 21, 30, 16, 15, 23, 42);

  // Eyes
  if (isFail) {
    // X eyes (Red)
    cvs.drawLine(cx - 11, baseY - 17, cx - 5, baseY - 11, 2, 244, 63, 94);
    cvs.drawLine(cx - 5, baseY - 17, cx - 11, baseY - 11, 2, 244, 63, 94);
    cvs.drawLine(cx + 5, baseY - 17, cx + 11, baseY - 11, 2, 244, 63, 94);
    cvs.drawLine(cx + 11, baseY - 17, cx + 5, baseY - 11, 2, 244, 63, 94);
  } else if (isCelebrate) {
    // Happy smile eyes (Green)
    cvs.fillCircle(cx - 8, baseY - 14, 3, 74, 222, 128);
    cvs.fillCircle(cx + 8, baseY - 14, 3, 74, 222, 128);
    cvs.fillRect(cx - 11, baseY - 17, 6, 3, 15, 23, 42); // cut top half
    cvs.fillRect(cx + 5, baseY - 17, 6, 3, 15, 23, 42);
  } else {
    // Normal glowing cyan eyes with pupil
    cvs.fillCircle(cx - 7, baseY - 14, 3.2, 56, 189, 248);
    cvs.fillCircle(cx + 7, baseY - 14, 3.2, 56, 189, 248);
    cvs.fillCircle(cx - 6, baseY - 15, 1, 255, 255, 255);
    cvs.fillCircle(cx + 8, baseY - 15, 1, 255, 255, 255);
  }
}

function run() {
  const outDir = path.resolve('public', 'templates');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Generating PNG templates with Pure Node Software Rasterizer...');

  const size = 96;

  // 1. Horizontal Strip: 1536 x 96 (Clean transparent PNG)
  const strip = new SoftwareCanvas(size * 16, size);
  for (let f = 0; f < 16; f++) {
    renderRobotFrame(strip, f * size, 0, f);
  }
  fs.writeFileSync(path.join(outDir, 'robot-spritesheet-16strip.png'), strip.toPng());

  // 2. 4x4 Grid: 384 x 384 (Clean transparent PNG)
  const grid = new SoftwareCanvas(size * 4, size * 4);
  for (let f = 0; f < 16; f++) {
    const col = f % 4;
    const row = Math.floor(f / 4);
    renderRobotFrame(grid, col * size, row * size, f);
  }
  fs.writeFileSync(path.join(outDir, 'robot-spritesheet-4x4grid.png'), grid.toPng());

  // 3. Visual Guide 4x4 Grid with Frame Borders & Dark Cyber Backdrop (440 x 440 px)
  const guide = new SoftwareCanvas(440, 440);
  // Dark backdrop
  guide.fillRect(0, 0, 440, 440, 11, 15, 25, 255);
  const pad = 28;
  const cellSize = 96;

  for (let f = 0; f < 16; f++) {
    const col = f % 4;
    const row = Math.floor(f / 4);
    const x = pad + col * cellSize;
    const y = pad + row * cellSize;

    // Grid cell border
    guide.strokeRect(x, y, cellSize, cellSize, 1, 30, 41, 59);
    guide.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2, 1, 2, 132, 199, 120);

    // Frame tag banner at top
    guide.fillRect(x + 2, y + 2, cellSize - 4, 14, 15, 23, 42, 230);

    // Small frame index marker
    guide.fillRect(x + 5, y + 5, 8, 8, 251, 191, 36);

    renderRobotFrame(guide, x, y, f);
  }
  fs.writeFileSync(path.join(outDir, 'robot-spritesheet-guide.png'), guide.toPng());

  console.log('✓ Successfully written:');
  console.log('  - public/templates/robot-spritesheet-16strip.png');
  console.log('  - public/templates/robot-spritesheet-4x4grid.png');
  console.log('  - public/templates/robot-spritesheet-guide.png');
}

run();
