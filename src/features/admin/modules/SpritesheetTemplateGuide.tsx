import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  HelpCircle,
  Image as ImageIcon,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BUILTIN_ANIMATIONS } from '@/game-engine/animations/animationConstants';
import type { RobotConfig } from '@engine';

interface SpritesheetTemplateGuideProps {
  onApplyTemplate: (url: string, frameWidth: number, frameHeight: number, anims: typeof BUILTIN_ANIMATIONS) => void;
  currentRobot?: Partial<RobotConfig> | null;
}

const TEMPLATES = [
  {
    id: 'strip',
    title: 'แบบแถวยาว (1x16 Strip)',
    subtitle: '1536 x 96 px • 16 เฟรมแนวนอน',
    desc: 'ไฟล์ PNG พื้นหลังโปร่งใส สำหรับใช้เป็นสไปรต์หลักในเกม',
    url: '/templates/robot-spritesheet-16strip.png',
    filename: 'robot-spritesheet-16strip.png',
    badge: 'Game Native',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    aspect: 'aspect-[16/1]',
  },
  {
    id: 'grid',
    title: 'แบบตาราง (4x4 Grid)',
    subtitle: '384 x 384 px • 16 เฟรมสี่เหลี่ยมจัตุรัส',
    desc: 'แนะนำอย่างยิ่งสำหรับสั่ง AI (Midjourney / DALL-E) เจนได้แม่นยำที่สุด',
    url: '/templates/robot-spritesheet-4x4grid.png',
    filename: 'robot-spritesheet-4x4grid.png',
    badge: 'Best for AI',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    aspect: 'aspect-square',
  },
  {
    id: 'guide',
    title: 'ผังตารางไกด์ (Visual Guide)',
    subtitle: '440 x 440 px • ตารางพร้อมชื่อท่าทาง',
    desc: 'มีกรอบกำกับหมายเลขเฟรม 0-15 และชื่อท่าทางชัดเจน ให้ AI ดูเป็นตัวอย่าง',
    url: '/templates/robot-spritesheet-guide.png',
    filename: 'robot-spritesheet-guide.png',
    badge: 'Guide Reference',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    aspect: 'aspect-square',
  },
];

const AI_PROMPTS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT (DALL-E 3)',
    prompt: `Generate a clean 2D game character spritesheet of a friendly futuristic robot.
Format: A 4x4 grid with exactly 16 square frames, transparent or plain white background.
The character design must remain 100% consistent across all 16 frames.
- Row 1 (Frames 0-3): Robot standing idle, breathing/bobbing, then starting to walk.
- Row 2 (Frames 4-7): Robot walking cycle, then crouching and jumping in the air.
- Row 3 (Frames 8-11): Robot turning side to side, then waving hand happily.
- Row 4 (Frames 12-15): Robot celebrating victory with arms raised, then looking sad with X eyes (failure pose).
Vector style, bright friendly colors (cyan and yellow), no shadows or background scenery.`,
  },
  {
    id: 'midjourney',
    name: 'Midjourney v6',
    prompt: `2D video game character sprite sheet, cute retro sci-fi robot, 16 frames in a 4x4 grid, each frame evenly spaced, 96x96 pixels per cell, cyan and yellow colors, clean flat vector illustration style, video game asset, isolated on pure white background, no gradients, sharp outlines, showing idle, walking, jumping, waving, celebrating, and defeat poses --ar 1:1 --v 6.0 --style raw`,
  },
  {
    id: 'thai',
    name: 'คำสั่งภาษาไทย (Thai Prompt)',
    prompt: `สร้างภาพ Spritesheet ตัวละครหุ่นยนต์สำหรับเกม 2D ในรูปแบบตาราง 4x4 (ทั้งหมด 16 เฟรม ขนาดช่องเท่ากันทุกช่อง)
สไตล์ Flat Vector ลายเส้นคมชัด น่ารัก สีฟ้า-เหลือง พื้นหลังสีขาวล้วน ไม่มีเงาฉากหลัง
- แถวที่ 1 (เฟรม 0-3): ท่ายืนนิ่ง ขยับตัวเบา ๆ และเริ่มก้าวเดิน
- แถวที่ 2 (เฟรม 4-7): ท่าเดินต่อเนื่อง และท่าย่อตัวกระโดดขึ้น
- แถวที่ 3 (เฟรม 8-11): ท่าเอี้ยวตัวหันซ้ายขวา และท่ายกมือโบกทักทาย
- แถวที่ 4 (เฟรม 12-15): ท่าดีใจกระโดดชูมือฉลองชัยชนะ และท่าคอตกตาเป็นกากบาทเมื่อแพ้
ตัวละครต้องมีขนาดและดีไซน์เหมือนกันทุกช่องอย่างแม่นยำ`,
  },
  {
    id: 'sd',
    name: 'Stable Diffusion / Recraft',
    prompt: `(masterpiece, best quality:1.2), character spritesheet, 4x4 grid of 16 frames, cute futuristic robot mascot, flat 2d game art, clean outlines, consistent character, idle walk jump wave celebrate poses, isolated, transparent background, sprite sheet, game asset
Negative prompt: (photo, 3d, realistic, blurry, cut off frames, inconsistent character, noisy background, text, watermark)`,
  },
];

export function SpritesheetTemplateGuide({
  onApplyTemplate,
  currentRobot,
}: SpritesheetTemplateGuideProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'prompts' | 'json'>('templates');
  const [selectedPromptTab, setSelectedPromptTab] = useState<string>('chatgpt');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="rounded-2xl border border-sky-500/30 bg-slate-950/80 p-4 sm:p-5 text-white shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-sky-200">
              ตัวอย่างต้นแบบ Spritesheet & คู่มือสั่ง AI เจนเนอเรต
            </h3>
            <p className="text-xs text-slate-400">
              ดาวน์โหลดภาพต้นแบบไปส่งให้ AI (ChatGPT, Midjourney) เจนรูปใหม่ หรือคัดลอก Prompt ได้ทันที
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900/90 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'templates' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>ภาพต้นแบบ (PNG)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'prompts' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Prompt สั่ง AI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span>Animation JSON</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Download Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="grid gap-3.5 md:grid-cols-3">
            {TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 transition-all hover:border-slate-700"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${tmpl.badgeColor}`}>
                      {tmpl.badge}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{tmpl.subtitle}</span>
                  </div>

                  {/* Thumbnail / Image Preview */}
                  <div className="relative flex items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950 p-2 overflow-hidden h-32">
                    <img
                      src={tmpl.url}
                      alt={tmpl.title}
                      className="max-h-full max-w-full object-contain select-none"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm text-slate-200">{tmpl.title}</h4>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">{tmpl.desc}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <a
                    href={tmpl.url}
                    download={tmpl.filename}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors shadow-sm cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>ดาวน์โหลด PNG</span>
                  </a>
                  <a
                    href={tmpl.url}
                    target="_blank"
                    rel="noreferrer"
                    title="เปิดดูขนาดจริงในแท็บใหม่"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Apply Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-emerald-200">
                  ต้องการลองใช้ตัวอย่างต้นแบบกับหุ่นยนต์ตัวนี้ทันทีหรือไม่?
                </span>
                <p className="text-[11px] text-emerald-300/80">
                  ระบบจะตั้งค่า Spritesheet URL, Frame Size (96x96 px) และ Animation JSON ให้โดยอัตโนมัติ
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400 shadow-sm cursor-pointer shrink-0"
              onClick={() => {
                onApplyTemplate('/templates/robot-spritesheet-16strip.png', 96, 96, BUILTIN_ANIMATIONS);
              }}
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              {currentRobot ? 'ใช้ต้นแบบนี้กับหุ่นยนต์นี้ทันที' : 'ใช้ต้นแบบนี้'}
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: AI Prompts */}
      {activeTab === 'prompts' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
            {AI_PROMPTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPromptTab(p.id)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                  selectedPromptTab === p.id
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {(() => {
            const current = AI_PROMPTS.find((p) => p.id === selectedPromptTab) ?? AI_PROMPTS[0]!;
            return (
              <div className="space-y-2">
                <div className="relative rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                  <pre className="font-mono text-xs text-sky-200 whitespace-pre-wrap leading-relaxed select-all">
                    {current.prompt}
                  </pre>
                  <Button
                    type="button"
                    size="sm"
                    className="absolute top-2.5 right-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                    onClick={() => copyToClipboard(current.prompt, current.id)}
                  >
                    {copiedId === current.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                        <span className="text-emerald-300">คัดลอกแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        <span>คัดลอก Prompt</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="rounded-lg bg-slate-900/60 p-2.5 text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-sky-400" />
                    คำแนะนำในการส่งภาพใหั AI:
                  </p>
                  <ol className="list-decimal pl-5 space-y-0.5">
                    <li>
                      ดาวน์โหลดไฟล์ <code className="text-sky-300">robot-spritesheet-4x4grid.png</code> หรือ{' '}
                      <code className="text-sky-300">robot-spritesheet-guide.png</code> จากแท็บแรก
                    </li>
                    <li>แนบรูปภาพดังกล่าวเข้าไปในช่องแชทของ ChatGPT หรือ Midjourney เป็นรูปอ้างอิง (Image Reference)</li>
                    <li>วาง Prompt ด้านบนเพื่อสั่งให้ AI เจนหุ่นยนต์ตัวใหม่ตามตาราง 4x4</li>
                    <li>เมื่อได้รูปแล้ว นำไปลบพื้นหลัง (เช่นที่ remove.bg) แล้วอัปโหลดกลับเข้าเกมได้เลย!</li>
                  </ol>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab 3: JSON Animation Ranges */}
      {activeTab === 'json' && (
        <div className="space-y-2">
          <div className="relative rounded-xl border border-slate-800 bg-slate-900/90 p-3">
            <pre className="font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed select-all">
              {JSON.stringify(BUILTIN_ANIMATIONS, null, 2)}
            </pre>
            <Button
              type="button"
              size="sm"
              className="absolute top-2.5 right-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              onClick={() => copyToClipboard(JSON.stringify(BUILTIN_ANIMATIONS, null, 2), 'json')}
            >
              {copiedId === 'json' ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                  <span className="text-emerald-300">คัดลอกแล้ว!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  <span>คัดลอก JSON</span>
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-slate-400">
            * คัดลอกค่านี้ไปวางในช่อง <strong>Animation Frame Ranges (JSON)</strong> หากต้องการรีเซ็ตเฟรมเป็นค่ามาตรฐาน 16 เฟรม
          </p>
        </div>
      )}
    </div>
  );
}
