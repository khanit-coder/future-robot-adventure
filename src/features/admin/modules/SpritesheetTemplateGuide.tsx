import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
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

interface TemplateItem {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  url: string;
  filename: string;
  badge: string;
  badgeColor: string;
  frameWidth: number;
  frameHeight: number;
  featured?: boolean;
}

const TEMPLATES: TemplateItem[] = [
  {
    id: 'cyber-ai-384',
    title: 'หุ่นยนต์ไซเบอร์ AI (จากรูปที่คุณอัปโหลด)',
    subtitle: '384 x 384 px • ตาราง 4x4 โปร่งใส (เฟรมละ 96x96)',
    desc: '🌟 หุ่นยนต์ไซเบอร์สุดเท่ที่คุณเจนจาก AI ลบพื้นหลังสีดำให้โปร่งใสเรียบร้อย พร้อมใช้งานในเกมทันที!',
    url: '/templates/robot-cyber-ai-384.png',
    filename: 'robot-cyber-ai-384.png',
    badge: 'Your AI Bot ⭐',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    frameWidth: 96,
    frameHeight: 96,
    featured: true,
  },
  {
    id: 'cyber-ai-1024',
    title: 'หุ่นยนต์ไซเบอร์ AI (HD ต้นฉบับ 1024px)',
    subtitle: '1024 x 1024 px • ตาราง 4x4 โปร่งใส (เฟรมละ 256x256)',
    desc: 'ขนาดดั้งเดิมคมชัดสูงระดับ HD ตัดพื้นหลังโปร่งใส (ต้องใช้ Frame Size 256x256 px)',
    url: '/templates/robot-cyber-ai-1024.png',
    filename: 'robot-cyber-ai-1024.png',
    badge: '1024px HD',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    frameWidth: 256,
    frameHeight: 256,
  },
  {
    id: 'grid',
    title: 'แบบตารางต้นแบบ (4x4 Grid)',
    subtitle: '384 x 384 px • 16 เฟรมสี่เหลี่ยมจัตุรัส',
    desc: 'ไฟล์ต้นแบบมาตรฐานสำหรับแนบให้ AI (Midjourney / DALL-E) ใช้เป็น Reference สัดส่วน 1:1',
    url: '/templates/robot-spritesheet-4x4grid.png',
    filename: 'robot-spritesheet-4x4grid.png',
    badge: 'Best for AI',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    frameWidth: 96,
    frameHeight: 96,
  },
  {
    id: 'strip',
    title: 'แบบแถวยาว (1x16 Strip)',
    subtitle: '1536 x 96 px • 16 เฟรมแนวนอน',
    desc: 'ไฟล์ PNG พื้นหลังโปร่งใส แถวยาวมาตรฐานของเกม 2D',
    url: '/templates/robot-spritesheet-16strip.png',
    filename: 'robot-spritesheet-16strip.png',
    badge: '1x16 Strip',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    frameWidth: 96,
    frameHeight: 96,
  },
  {
    id: 'guide',
    title: 'ผังตารางไกด์ (Visual Guide)',
    subtitle: '440 x 440 px • ตารางพร้อมชื่อท่าทาง',
    desc: 'มีกรอบกำกับหมายเลขเฟรม [0]-[15] และชื่อท่าทางชัดเจน ให้ AI ดูตำแหน่ง',
    url: '/templates/robot-spritesheet-guide.png',
    filename: 'robot-spritesheet-guide.png',
    badge: 'Visual Guide',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    frameWidth: 96,
    frameHeight: 96,
  },
];

const AI_PROMPTS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT (DALL-E 3)',
    prompt: `Create a 2D game character spritesheet of a friendly futuristic robot mascot, arranged in a clean 4x4 grid (exactly 16 square frames), isolated on pure white background, flat color, clean vector game art style.
Row 1 (Frames 0-3): 2 idle standing frames with subtle breath/glow, followed by 2 beginning walk steps.
Row 2 (Frames 4-7): 2 walking run cycle frames, followed by 2 jumping in the air frames.
Row 3 (Frames 8-11): 2 turning side to side frames, followed by 2 waving hand greeting frames.
Row 4 (Frames 12-15): 2 victory celebration frames with arms up and stars, followed by 2 defeat/fail frames with red X eyes.
Every frame must keep the exact same character size, proportions, and colors. No perspective distortion.`,
  },
  {
    id: 'midjourney',
    name: 'Midjourney v6',
    prompt: `2D video game character sprite sheet of a cute cyber robot, 4x4 grid layout with 16 animation frames, walking, jumping, waving, celebrating, defeat poses, consistent character design, pixel-perfect clean vector art, isolated on pure white background, flat color, game asset --ar 1:1 --v 6.0 --style raw`,
  },
  {
    id: 'thai',
    name: 'คำสั่งภาษาไทย (Thai Prompt)',
    prompt: `สร้างภาพ Spritesheet ตัวละครหุ่นยนต์สำหรับเกม 2D ในรูปแบบตาราง 4x4 (ทั้งหมด 16 ช่องเฟรมเท่ากันเป๊ะ สัดส่วน 1:1)
สไตล์ Flat Vector การ์ตูนน่ารัก ลายเส้นคมชัด สีฟ้า-ขาวไฮเทค พื้นหลังสีขาวล้วน ไม่มีเงาฉากหลัง
- แถวที่ 1 (ช่อง 1-4): ท่ายืนนิ่ง 2 รูป และท่าเริ่มก้าวเดิน 2 รูป
- แถวที่ 2 (ช่อง 5-8): ท่าเดินก้าวสลับขา 2 รูป และท่าย่อตัวกระโดด 2 รูป
- แถวที่ 3 (ช่อง 9-12): ท่าหันข้างซ้ายขวา 2 รูป และท่ายกมือโบกทักทาย 2 รูป
- แถวที่ 4 (ช่อง 13-16): ท่าดีใจกระโดดชูมือฉลองชัยชนะ 2 รูป และท่าคอตกตาเป็นกากบาทสีแดง 2 รูป
ตัวละครต้องมีขนาดเท่ากันทุกช่อง และห้ามมีตัวหนังสือในภาพ`,
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const robotName = currentRobot?.name
    ? typeof currentRobot.name === 'string'
      ? currentRobot.name
      : currentRobot.name.th || currentRobot.name.en || ''
    : '';

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // fallback
    }
  };

  const activePrompt = AI_PROMPTS.find((p) => p.id === selectedPromptTab) ?? AI_PROMPTS[0];

  return (
    <div className="rounded-2xl border border-sky-500/30 bg-slate-900/95 p-5 text-slate-100 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">
              คลังไฟล์ต้นแบบและ Prompt สั่ง AI (Spritesheet Template & AI Guide)
              {robotName && <span className="ml-2 text-xs font-normal text-sky-300">({robotName})</span>}
            </h3>
            <p className="text-xs text-slate-400">
              ดาวน์โหลดภาพต้นแบบ หรือก็อปปี้ Prompt ไปสั่ง Midjourney / ChatGPT สร้างตัวละครหุ่นยนต์
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-800/80 p-1">
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
        <div className="space-y-4 pt-4">
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                  tmpl.featured
                    ? 'border-cyan-500/60 bg-cyan-950/30 ring-1 ring-cyan-500/40'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                }`}
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
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">{tmpl.desc}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
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

                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    onClick={() => {
                      onApplyTemplate(tmpl.url, tmpl.frameWidth, tmpl.frameHeight, BUILTIN_ANIMATIONS);
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    ใช้รูปนี้กับหุ่นยนต์นี้ทันที ({tmpl.frameWidth}×{tmpl.frameHeight}px)
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: AI Prompts */}
      {activeTab === 'prompts' && (
        <div className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            {AI_PROMPTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPromptTab(p.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  selectedPromptTab === p.id
                    ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 leading-relaxed">
            <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200">
              {activePrompt.prompt}
            </pre>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => void copyToClipboard(activePrompt.prompt, activePrompt.id)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold"
              >
                {copiedKey === activePrompt.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-800" />
                    คัดลอกเรียบร้อย!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    คัดลอก Prompt สำหรับ {activePrompt.name}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: JSON Spec */}
      {activeTab === 'json' && (
        <div className="space-y-4 pt-4">
          <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-400 leading-relaxed">
            <pre>{JSON.stringify(BUILTIN_ANIMATIONS, null, 2)}</pre>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => void copyToClipboard(JSON.stringify(BUILTIN_ANIMATIONS, null, 2), 'json')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                {copiedKey === 'json' ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-300" />
                    คัดลอก JSON แล้ว!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    คัดลอก Animation JSON
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
