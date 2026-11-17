import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Grid,
  Maximize2,
  RefreshCw,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

interface SpritesheetAlignerProps {
  spriteUrl: string;
  frameWidth: number;
  frameHeight: number;
  onDimensionsChange: (width: number, height: number) => void;
  onSpriteUrlChange?: (newUrl: string) => void;
}

const FRAME_NAMES = [
  'Idle 1', 'Idle 2', 'Walk 1', 'Walk 2',
  'Walk 3', 'Walk 4', 'Jump 1', 'Jump 2',
  'Turn L', 'Turn R', 'Wave 1', 'Wave 2',
  'Win 1', 'Win 2', 'Fail 1', 'Fail 2',
];

export function SpritesheetAligner({
  spriteUrl,
  frameWidth,
  frameHeight,
  onDimensionsChange,
  onSpriteUrlChange,
}: SpritesheetAlignerProps) {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [showBgRemover, setShowBgRemover] = useState(false);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [bgThreshold, setBgThreshold] = useState<number>(30);
  const [removeColor, setRemoveColor] = useState<'black' | 'white'>('black');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load natural dimensions of current spriteUrl
  useEffect(() => {
    if (!spriteUrl) return;
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = spriteUrl;
    img.onload = () => {
      if (active) {
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    return () => {
      active = false;
    };
  }, [spriteUrl]);

  const nw = spriteUrl ? naturalSize?.w || 0 : 0;
  const nh = spriteUrl ? naturalSize?.h || 0 : 0;

  // Calculate expected dimensions for 4x4 grid
  const expectedGrid4x4Width = nw > 0 ? Math.round(nw / 4) : 96;
  const expectedGrid4x4Height = nh > 0 ? Math.round(nh / 4) : 96;
  const is4x4Mismatch =
    nw > 0 &&
    nh > 0 &&
    (Math.abs(frameWidth - expectedGrid4x4Width) > 2 || Math.abs(frameHeight - expectedGrid4x4Height) > 2) &&
    Math.abs(nw - nh) < 10; // Square image like 1024x1024

  // Handle client-side background removal
  const handleRemoveBackground = () => {
    if (!spriteUrl) return;
    setIsProcessingBg(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = spriteUrl;
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessingBg(false);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];

        if (removeColor === 'black') {
          const maxVal = Math.max(r, g, b);
          if (maxVal < bgThreshold) {
            d[i + 3] = 0; // Transparent
          } else if (maxVal < bgThreshold + 25) {
            // Feather edge
            d[i + 3] = Math.round(((maxVal - bgThreshold) / 25) * 255);
          }
        } else {
          // Remove white
          const minVal = Math.min(r, g, b);
          if (minVal > 255 - bgThreshold) {
            d[i + 3] = 0;
          } else if (minVal > 255 - bgThreshold - 25) {
            d[i + 3] = Math.round(((255 - minVal) / 25) * 255);
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setProcessedUrl(dataUrl);
      setIsProcessingBg(false);
    };
    img.onerror = () => {
      setIsProcessingBg(false);
    };
  };

  const cols = Math.max(1, Math.floor(nw / Math.max(16, frameWidth)));
  const rows = Math.max(1, Math.floor(nh / Math.max(16, frameHeight)));

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      {/* Title & Dimension Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
            <Grid className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            ระบบปรับจูนขนาดและจัดตารางตัดภาพ (Smart Grid Aligner)
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {nw > 0
              ? `ขนาดรูปภาพจริง: ${nw} × ${nh} px • ปัจจุบันตัดทีละ: ${frameWidth} × ${frameHeight} px (${cols} คอลัมน์ × ${rows} แถว)`
              : 'กำลังอ่านขนาดรูปภาพ...'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowGridOverlay(!showGridOverlay)}
            className="text-xs"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {showGridOverlay ? 'ซ่อนเส้นตาราง' : 'ตรวจดูเส้นตารางตัดภาพ'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowBgRemover(!showBgRemover)}
            className="text-xs"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {showBgRemover ? 'ปิดเครื่องมือลบพื้นหลัง' : 'ลบพื้นหลังดำ/ขาว'}
          </Button>
        </div>
      </div>

      {/* Warning Box when frameWidth doesn't match AI 1024x1024 */}
      {is4x4Mismatch && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-bold">
                ⚠️ ตรวจพบรูปภาพตารางสี่เหลี่ยมจัตุรัสขนาด {nw} × {nh} px (เช่น เจนจาก ChatGPT หรือ Midjourney)
              </p>
              <p className="text-xs leading-relaxed">
                เนื่องจากภาพนี้เป็นตาราง 4 คอลัมน์ × 4 แถว ขนาดของแต่ละเฟรมที่ถูกต้องคือ{' '}
                <strong className="underline font-bold text-amber-950 dark:text-amber-100">
                  {expectedGrid4x4Width} × {expectedGrid4x4Height} px
                </strong>{' '}
                แต่ในระบบตอนนี้ตั้งไว้ที่ <strong>{frameWidth} × {frameHeight} px</strong>{' '}
                ซึ่งจะทำให้ระบบตัดภาพผิดตำแหน่งและตัวละครขาดท่อน!
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => onDimensionsChange(expectedGrid4x4Width, expectedGrid4x4Height)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <Zap className="h-4 w-4" />
                🎯 ปรับขนาดเฟรมเป็น {expectedGrid4x4Width} × {expectedGrid4x4Height} px ทันที (แก้รูปไม่ตรง)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Dimension Buttons */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          ปุ่มลัดตั้งค่าขนาดเฟรมตามขนาดภาพ (Quick Dimension Presets):
        </Label>
        <div className="flex flex-wrap gap-2">
          {nw > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDimensionsChange(Math.round(nw / 4), Math.round(nh / 4))}
              className="text-xs bg-white dark:bg-slate-900"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              คำนวณ 4x4 จากภาพ ({Math.round(nw / 4)} × {Math.round(nh / 4)})
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDimensionsChange(256, 256)}
            className={`text-xs ${frameWidth === 256 && frameHeight === 256 ? 'border-indigo-600 bg-indigo-50 font-bold dark:bg-indigo-900/40' : 'bg-white dark:bg-slate-900'}`}
          >
            256 × 256 px (สำหรับรูป 1024x1024 AI)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDimensionsChange(128, 128)}
            className={`text-xs ${frameWidth === 128 && frameHeight === 128 ? 'border-indigo-600 bg-indigo-50 font-bold dark:bg-indigo-900/40' : 'bg-white dark:bg-slate-900'}`}
          >
            128 × 128 px (สำหรับรูป 512x512)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDimensionsChange(96, 96)}
            className={`text-xs ${frameWidth === 96 && frameHeight === 96 ? 'border-indigo-600 bg-indigo-50 font-bold dark:bg-indigo-900/40' : 'bg-white dark:bg-slate-900'}`}
          >
            96 × 96 px (มาตรฐาน / 384x384)
          </Button>

          {nw > 0 && nw >= 1000 && nh <= 200 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDimensionsChange(Math.round(nw / 16), nh)}
              className="text-xs bg-white dark:bg-slate-900"
            >
              แถวยาว 16 เฟรม ({Math.round(nw / 16)} × {nh})
            </Button>
          )}
        </div>
      </div>

      {/* Visual Grid Overlay View */}
      {showGridOverlay && nw > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-300 bg-slate-950 p-4 text-white dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              ผังแสดงเส้นตัดตาราง 16 เฟรม ({cols} คอลัมน์ × {rows} แถว)
            </span>
            <span className="text-xs text-slate-400">
              ตรวจดูว่าตัวละครแต่ละท่าอยู่ตรงกลางกรอบสีฟ้าหรือไม่
            </span>
          </div>

          <div className="relative mx-auto max-w-md overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
            {/* The base image */}
            <img src={spriteUrl} alt="Spritesheet source" className="w-full h-auto block select-none" />

            {/* Grid overlay */}
            <div
              className="absolute inset-0 grid pointer-events-none"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: cols * rows }).map((_, idx) => (
                <div
                  key={idx}
                  className="relative flex flex-col justify-between border border-cyan-400/70 p-1 text-[9px] font-mono text-cyan-300 bg-cyan-500/10"
                >
                  <span className="bg-slate-900/80 px-1 rounded self-start font-bold">[{idx}]</span>
                  <span className="bg-slate-900/80 px-1 rounded self-end truncate text-[8px] text-cyan-200">
                    {FRAME_NAMES[idx] || `F${idx}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In-Browser Background Color Remover Tool */}
      {showBgRemover && (
        <div className="space-y-4 rounded-xl border border-indigo-300 bg-white p-4 dark:border-indigo-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-indigo-500" />
              เครื่องมือแปลงพื้นหลังเป็นโปร่งใสในเบราว์เซอร์ (Remove Solid Background)
            </h5>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            หากรูปที่เจนจาก AI มีพื้นหลังสีดำหรือสีขาวล้วน คุณสามารถลบสีพื้นหลังให้โปร่งใสได้ทันทีที่นี่
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">สีพื้นหลังที่ต้องการลบ</Label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRemoveColor('black')}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-bold ${
                    removeColor === 'black'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  ลบสีดำ (Black)
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveColor('white')}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-bold ${
                    removeColor === 'white'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  ลบสีขาว (White)
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs">ความละเอียดในการตัดขอบ (Threshold: {bgThreshold})</Label>
              <Input
                type="range"
                min={10}
                max={90}
                value={bgThreshold}
                onChange={(e) => setBgThreshold(Number(e.target.value))}
                className="mt-2 h-7"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleRemoveBackground}
                disabled={isProcessingBg}
                className="w-full"
              >
                {isProcessingBg ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    กำลังประมวลผล...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    เริ่มลบพื้นหลัง
                  </>
                )}
              </Button>
            </div>
          </div>

          {processedUrl && (
            <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                แปลงเป็นภาพ PNG พื้นหลังโปร่งใสสำเร็จแล้ว!
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <div className="h-20 w-20 overflow-hidden rounded-lg border border-slate-700 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:8px_8px]">
                  <img src={processedUrl} alt="Processed Transparent PNG" className="h-full w-full object-contain" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={processedUrl}
                    download="robot-spritesheet-transparent.png"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    ดาวน์โหลดไฟล์ PNG โปร่งใส
                  </a>

                  {onSpriteUrlChange && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onSpriteUrlChange(processedUrl)}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    >
                      <Check className="h-3.5 w-3.5" />
                      ใช้รูปโปร่งใสนี้เป็นสไปรต์หลักทันที
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
