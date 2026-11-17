# คู่มือการสร้าง Spritesheet ตัวละครหุ่นยนต์ด้วย AI สำหรับ Future Robot Adventure
*(AI Spritesheet Generation Guide)*

---

## 1. ข้อมูลจำเพาะของ Spritesheet (Spritesheet Specifications)

| คุณสมบัติ | ค่าที่แนะนำ (Recommended) |
|---|---|
| **ขนาดแต่ละเฟรม (Frame Size)** | **96 x 96 pixels** (หรือ 64 x 64 pixels) |
| **จำนวนเฟรมทั้งหมด (Total Frames)** | **16 เฟรม** |
| **รูปแบบการจัดวาง (Layout)** | **แบบแถวยาว (1x16 Strip - 1536 x 96 px)** หรือ **แบบตาราง (4x4 Grid - 384 x 384 px)** |
| **ชนิดไฟล์ (File Format)** | **PNG พื้นหลังโปร่งใส (Alpha Transparent PNG)** |
| **ทิศทางตัวละคร (Facing Direction)** | หันหน้าตรง หรือหันเอียงขวาเล็กน้อย (Isometric / Side view) |

---

## 2. ลำดับเฟรมและท่าทาง (Animation Frame Mapping)

ตารางลำดับเฟรมทั้ง 16 เฟรม (Index 0 ถึง 15):

```json
{
  "idle": { "start": 0, "end": 1, "frame_rate": 3, "repeat": -1 },
  "walk": { "start": 2, "end": 5, "frame_rate": 8, "repeat": -1 },
  "run": { "start": 2, "end": 5, "frame_rate": 12, "repeat": -1 },
  "jump": { "start": 6, "end": 7, "frame_rate": 6, "repeat": 0 },
  "turn": { "start": 8, "end": 9, "frame_rate": 8, "repeat": 0 },
  "wave": { "start": 10, "end": 11, "frame_rate": 6, "repeat": -1 },
  "celebrate": { "start": 12, "end": 13, "frame_rate": 7, "repeat": -1 },
  "fail": { "start": 14, "end": 15, "frame_rate": 6, "repeat": 1 }
}
```

### การจัดวางแบบตาราง 4x4 (4x4 Grid):
- **แถวที่ 1 (เฟรม 0 - 3)**:
  - `เฟรม 0, 1`: **IDLE** (ยืนนิ่ง ขยับตัว/ไฟกระพริบเบา ๆ)
  - `เฟรม 2, 3`: **WALK 1, 2** (ก้าวขวา, ท่าก้าวเดิน)
- **แถวที่ 2 (เฟรม 4 - 7)**:
  - `เฟรม 4, 5`: **WALK 3, 4** (ก้าวซ้าย, จังหวะจบก้าว)
  - `เฟรม 6, 7`: **JUMP** (ย่อตัวเตรียมกระโดด, กระโดดลอยตัว)
- **แถวที่ 3 (เฟรม 8 - 11)**:
  - `เฟรม 8, 9`: **TURN** (เอี้ยวตัวหันซ้าย, หันขวา)
  - `เฟรม 10, 11`: **WAVE** (ยกมือโบกทักทาย)
- **แถวที่ 4 (เฟรม 12 - 15)**:
  - `เฟรม 12, 13`: **CELEBRATE** (กระโดดดีใจ ชูมือฉลอง ตาเป็นประกาย)
  - `เฟรม 14, 15`: **FAIL** (คอตก ตาเป็นกากบาท X_X เสียใจ)

---

## 3. ตัวอย่าง Prompt สำหรับสั่ง AI (Prompt Templates)

### 🤖 แบบที่ 1: Midjourney v6 (แนะนำที่สุดสำหรับงานภาพเกม 2D)
```text
2D video game character sprite sheet, cute retro sci-fi robot, 16 frames in a 4x4 grid, each frame evenly spaced, 96x96 pixels per cell, cyan and yellow colors, clean flat vector illustration style, video game asset, isolated on pure white background, no gradients, sharp outlines, showing idle, walking, jumping, waving, celebrating, and defeat poses --ar 1:1 --v 6.0 --style raw
```

### 🎨 แบบที่ 2: ChatGPT (DALL-E 3)
```text
Generate a clean 2D game character spritesheet of a friendly futuristic robot.
Format: A 4x4 grid with exactly 16 square frames, transparent or plain white background.
The character design must remain 100% consistent across all 16 frames.
- Row 1 (Frames 0-3): Robot standing idle, breathing/bobbing, then starting to walk.
- Row 2 (Frames 4-7): Robot walking cycle, then crouching and jumping in the air.
- Row 3 (Frames 8-11): Robot turning side to side, then waving hand happily.
- Row 4 (Frames 12-15): Robot celebrating victory with arms raised, then looking sad with X eyes (failure pose).
Vector style, bright friendly colors (blue and neon green), no shadows or background scenery.
```

### ⚡ แบบที่ 3: Stable Diffusion / Leonardo.ai / Recraft
```text
(masterpiece, best quality:1.2), character spritesheet, 4x4 grid of 16 frames, cute futuristic robot mascot, flat 2d game art, clean outlines, consistent character, idle walk jump wave celebrate poses, isolated, transparent background, sprite sheet, game asset
Negative prompt: (photo, 3d, realistic, blurry, cut off frames, inconsistent character, noisy background, text, watermark)
```

---

## 4. เคล็ดลับการเตรียมไฟล์ก่อนอัปโหลดเข้าเกม (Tips)
1. **ตัดพื้นหลังให้โปร่งใส (Transparent Background)**:
   - ใช้เครื่องมือฟรี เช่น [remove.bg](https://www.remove.bg) หรือ [Adobe Express Background Remover](https://www.adobe.com/express/feature/image/remove-background) หรือ Photoshop/Canva เพื่อลบพื้นหลังสีขาวออกให้เหลือเฉพาะตัวหุ่นยนต์
2. **ปรับขนาดให้ลงตัว (Grid Alignment)**:
   - ตรวจสอบว่าความกว้างและความสูงสามารถหารด้วยจำนวนแถวและคอลัมน์ได้ลงตัว เช่น:
     - หากเป็น 4x4 Grid: ขนาดภาพรวมควรเป็น 384x384 px (แต่ละเฟรม 96x96 px)
     - หากเป็น 1x16 Strip: ขนาดภาพรวมควรเป็น 1536x96 px (แต่ละเฟรม 96x96 px)
3. **อัปโหลดที่เมนู Admin -> Asset Manager -> Robots**:
   - เลือก **Asset Type: Uploaded Spritesheet**
   - อัปโหลดไฟล์ PNG ที่ได้ ระบบจะบันทึกอัตโนมัติ
   - ตั้งค่า Frame Width = 96, Frame Height = 96
   - ตรวจสอบการเคลื่อนไหวผ่านช่อง Animation Preview ด้านบน
