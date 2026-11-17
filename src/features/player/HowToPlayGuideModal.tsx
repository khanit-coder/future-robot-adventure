import { useState } from 'react';
import {
  Compass,
  FolderOpen,
  Heart,
  Layers,
  Play,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import type { Lang } from '@engine';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/utils/cn';

interface HowToPlayGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
}

export function HowToPlayGuideModal({ open, onOpenChange, lang }: HowToPlayGuideModalProps) {
  const isTh = lang === 'th';
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      num: 1,
      icon: <Compass className="h-6 w-6 text-sky-400" />,
      badge: isTh ? 'ขั้นตอนที่ 1 • วางแผน' : 'STEP 1 • PLAN FIRST',
      title: isTh ? 'สังเกตแผนที่และวางแผนเส้นทาง' : 'Observe the Map & Plan Your Route',
      desc: isTh
        ? 'ดูหน้าจอสนามด้านซ้าย สังเกตว่าหุ่นยนต์หันหน้าไปทางไหน (ดูลูกศรสีเหลือง ▸) มีกำแพง สิ่งกีดขวาง หรือคริสตัลตรงไหน แล้วนับจำนวนช่องเดินไปถึงจุดเป้าหมายสีเขียว'
        : 'Look at the game stage on the left. Check which way the robot faces (yellow arrow ▸), spot walls or crystals, and count the tiles to the green goal.',
      color: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
      visual: (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#0f172a] p-4 border border-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#334155] border-[1.5px] border-[#38bdf8]/60 text-lg relative">
            🤖
            <span className="absolute -right-1.5 text-[#facc15] text-xs font-black">▶</span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#334155] border-[1.5px] border-[#38bdf8]/45 text-xs font-extrabold text-sky-300">
            1
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#334155] border-[1.5px] border-[#38bdf8]/45 text-xs font-extrabold text-sky-300">
            2
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#334155] border-[1.5px] border-[#38bdf8]/45 text-xs font-extrabold text-sky-300">
            3
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#334155] border-[1.5px] border-[#38bdf8]/45 relative">
            <div className="h-8 w-8 rounded-full border-[3px] border-[#4ade80] bg-[#22c55e]/30 animate-pulse" />
            <div className="absolute h-3.5 w-3.5 rounded-full bg-[#4ade80]" />
          </div>
        </div>
      ),
    },
    {
      num: 2,
      icon: <FolderOpen className="h-6 w-6 text-amber-400" />,
      badge: isTh ? 'ขั้นตอนที่ 2 • เปิดถาดคำสั่ง' : 'STEP 2 • OPEN COMMAND TRAY',
      title: isTh ? 'คลิกหมวดหมู่เพื่อเปิดถาดบล็อกโค้ด' : 'Click a Category to Open the Block Tray',
      desc: isTh
        ? 'คลิกที่แถบหมวดหมู่ด้านซ้ายของพื้นที่เขียนโค้ด (การเคลื่อนที่, การกระทำ, ตรรกะ) ถาดคำสั่งจะเลื่อนเปิดออกมาให้เลือกใช้'
        : 'Click the category tabs on the left of the coding area (Movement, Actions, Logic) to slide open the block tray.',
      color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      visual: (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-4 border border-slate-200 text-slate-900">
          <div className="space-y-1.5 text-left">
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border-l-[5px] border-[#3b82f6] px-3 py-1.5 text-xs font-extrabold text-slate-900 ring-2 ring-sky-400">
              <span>👆 {isTh ? 'การเคลื่อนที่' : 'Movement'}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border-l-[5px] border-[#f97316] px-3 py-1.5 text-xs font-bold text-slate-700">
              <span>{isTh ? 'การกระทำ' : 'Actions'}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border-l-[5px] border-[#14b8a6] px-3 py-1.5 text-xs font-bold text-slate-700">
              <span>{isTh ? 'ตรรกะ' : 'Logic'}</span>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-xl bg-[#3b82f6] px-3.5 py-1.5 text-xs font-extrabold text-white shadow">
              <span>{isTh ? 'เดินหน้า' : 'Move Forward'}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-900 font-extrabold">1</span>
            </div>
            <div className="block rounded-xl bg-[#0ea5e9] px-3.5 py-1.5 text-xs font-extrabold text-white shadow">
              {isTh ? 'เลี้ยวซ้าย' : 'Turn Left'}
            </div>
          </div>
        </div>
      ),
    },
    {
      num: 3,
      icon: <Layers className="h-6 w-6 text-indigo-400" />,
      badge: isTh ? 'ขั้นตอนที่ 3 • ลากมาเรียงต่อกัน' : 'STEP 3 • DRAG & SNAP BLOCKS',
      title: isTh ? 'ลากคำสั่งออกมาเรียงต่อกันจากบนลงล่าง' : 'Drag & Snap Blocks from Top to Bottom',
      desc: isTh
        ? 'ลากบล็อกที่ต้องการมาวางในพื้นที่จุดสีขาว แล้วต่อให้เข้าล็อกกัน (จะมีเสียงคลิก!) หุ่นยนต์จะทำงานตามลำดับจากบล็อกบนสุดลงมาล่างสุด และคลิกเปลี่ยนตัวเลขในช่องสีขาวได้'
        : 'Drag blocks into the dotted white workspace and snap them together! The robot runs blocks from top to bottom. Click the white number pill to change steps.',
      color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
      visual: (
        <div
          className="flex flex-col items-center justify-center rounded-2xl p-4 border border-slate-200"
          style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1.25px, transparent 1.25px)',
            backgroundSize: '18px 18px',
            backgroundColor: '#ffffff',
          }}
        >
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#3b82f6] px-4 py-2 text-xs font-extrabold text-white shadow-md ring-3 ring-[#facc15]">
            <span>{isTh ? 'เดินหน้า' : 'Move Forward'}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-slate-900 font-extrabold">3</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#f97316] px-4 py-2 text-xs font-extrabold text-white shadow-md -mt-0.5">
            <span>{isTh ? 'กระโดด' : 'Jump'}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#3b82f6] px-4 py-2 text-xs font-extrabold text-white shadow-md -mt-0.5">
            <span>{isTh ? 'เดินหน้า' : 'Move Forward'}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-slate-900 font-extrabold">2</span>
          </div>
        </div>
      ),
    },
    {
      num: 4,
      icon: <Play className="h-6 w-6 text-emerald-400 fill-current" />,
      badge: isTh ? 'ขั้นตอนที่ 4 • กด COMPILE' : 'STEP 4 • PRESS COMPILE',
      title: isTh ? 'ตรวจสอบให้ชัวร์ แล้วกดปุ่ม COMPILE!' : 'Double-Check & Press COMPILE!',
      desc: isTh
        ? 'กดปุ่มสีเขียว COMPILE เพื่อให้หุ่นยนต์เริ่มเดินตามโค้ดของคุณ! ระวัง: คุณมีหัวใจทั้งหมด 5 ดวงสำหรับทุกด่านรวมกัน หากโค้ดผิดจะเสียหัวใจ 1 ดวง จึงควรวางแผนให้ดีก่อนกด!'
        : 'Press the green COMPILE button to run your code! Careful: you share 5 Hearts across all levels. A failed run costs 1 Heart, so plan carefully before compiling!',
      color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      visual: (
        <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl bg-slate-950 p-4 border border-slate-800">
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg ring-2 ring-emerald-400/60">
            <Play className="h-4 w-4 fill-current" />
            COMPILE
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-950/60 px-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Heart key={i} className="h-4 w-4 fill-rose-500 text-rose-500" />
            ))}
            <span className="ml-1 text-xs font-black text-rose-300">5/5</span>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[activeStep] ?? steps[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl border-2 border-indigo-500/40 bg-slate-900 text-white p-0 overflow-hidden shadow-2xl"
        data-testid="how-to-play-modal"
      >
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-600 px-6 py-4">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            <Sparkles className="h-4 w-4" />
            {isTh ? 'คู่มือเริ่มต้นอย่างรวดเร็ว (4 ขั้นตอน)' : 'Quick Start Guide (4 Steps)'}
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {isTh
                ? 'วิธีเล่นเกมสั่งการหุ่นยนต์ให้พิชิตภารกิจ!'
                : 'How to Program Your Robot & Solve Missions!'}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* 4 Step Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {steps.map((s, idx) => {
              const isActive = idx === activeStep;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all cursor-pointer',
                    isActive
                      ? 'border-sky-400 bg-sky-500/20 text-white shadow-md'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800/70 hover:text-slate-200',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black',
                      isActive ? 'bg-sky-400 text-slate-950' : 'bg-slate-800 text-slate-300',
                    )}
                  >
                    {s.num}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase opacity-75 truncate">
                      {isTh ? `ขั้นที่ ${s.num}` : `Step ${s.num}`}
                    </p>
                    <p className="text-xs font-extrabold truncate">
                      {idx === 0
                        ? isTh
                          ? 'วางแผนก่อน'
                          : 'Plan Route'
                        : idx === 1
                          ? isTh
                            ? 'เปิดถาดคำสั่ง'
                            : 'Open Tray'
                          : idx === 2
                            ? isTh
                              ? 'ลากบล็อกเรียง'
                              : 'Snap Blocks'
                            : isTh
                              ? 'กด COMPILE'
                              : 'COMPILE'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Detail Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 border border-slate-700">
                {current.icon}
              </div>
              <div className="space-y-1">
                <span
                  className={cn(
                    'inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-black',
                    current.color,
                  )}
                >
                  {current.badge}
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">{current.title}</h3>
                <p className="text-sm leading-relaxed text-slate-300">{current.desc}</p>
              </div>
            </div>

            {current.visual}
          </div>

          {/* Summary 4-step strip */}
          <div className="rounded-xl bg-indigo-950/50 border border-indigo-500/30 px-4 py-2.5 text-center text-xs font-bold text-indigo-200">
            {isTh
              ? '💡 สูตรลับคนเก่ง: ① ดูแผนที่วางแผน ➔ ② คลิกเปิดถาดซ้ายมือ ➔ ③ ลากบล็อกมาต่อกัน ➔ ④ กดปุ่มสีเขียว COMPILE'
              : '💡 Pro Tip: ① Plan on Map ➔ ② Open Left Tray ➔ ③ Drag & Snap Blocks ➔ ④ Press Green COMPILE'}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex gap-2">
              {activeStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                  className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  {isTh ? '← ขั้นก่อนหน้า' : '← Previous'}
                </Button>
              )}
              {activeStep < steps.length - 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
                >
                  {isTh ? 'ขั้นถัดไป →' : 'Next Step →'}
                </Button>
              )}
            </div>

            <Button
              variant="success"
              size="lg"
              onClick={() => onOpenChange(false)}
              data-testid="close-how-to-play-btn"
              className="font-extrabold px-6 shadow-lg"
            >
              <CheckCircle2 className="h-5 w-5" />
              {isTh ? 'เข้าใจแล้ว! เริ่มเขียนโค้ดเลย' : 'Got It! Start Coding'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
