import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Gem,
  Hand,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import type { Command, Lang } from '@engine';
import { Button } from '@/components/ui/button';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import { sfx } from '@/services/audio/soundEffects';
import { cn } from '@/utils/cn';

interface InteractiveRobotDemoProps {
  demoProgram: Command[];
  lang: Lang;
  fallbackLang?: Lang;
  robotAsset?: unknown;
}

export function InteractiveRobotDemo({
  demoProgram,
  lang,
}: InteractiveRobotDemoProps) {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [running, setRunning] = useState<boolean>(false);

  // Robot virtual position on the demo grid
  const [robotPos, setRobotPos] = useState<{ x: number; y: number; dir: number }>({
    x: 0,
    y: 0,
    dir: 0, // 0 = East, 90 = South, 180 = West, -90 = North
  });
  const [robotState, setRobotState] = useState<RobotVisualState>('idle');
  const [isJumping, setIsJumping] = useState<boolean>(false);
  const [crystalCollected, setCrystalCollected] = useState<boolean>(false);
  const [generatorActive, setGeneratorActive] = useState<boolean>(false);
  const [reachedGoal, setReachedGoal] = useState<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);

  const resetArena = () => {
    isCancelledRef.current = true;
    setRunning(false);
    setActiveStepIndex(-1);
    setRobotPos({ x: 0, y: 0, dir: 0 });
    setRobotState('idle');
    setIsJumping(false);
    setCrystalCollected(false);
    setGeneratorActive(false);
    setReachedGoal(false);
  };

  const [prevDemoProgram, setPrevDemoProgram] = useState<Command[]>(demoProgram);
  if (prevDemoProgram !== demoProgram) {
    setPrevDemoProgram(demoProgram);
    setRunning(false);
    setActiveStepIndex(-1);
    setRobotPos({ x: 0, y: 0, dir: 0 });
    setRobotState('idle');
    setIsJumping(false);
    setCrystalCollected(false);
    setGeneratorActive(false);
    setReachedGoal(false);
  }

  useEffect(() => {
    isCancelledRef.current = true;
  }, [demoProgram]);

  // Check what special tiles exist in this demo
  const hasCrystal = useMemo(
    () => JSON.stringify(demoProgram).includes('PICK_UP'),
    [demoProgram],
  );
  const hasHurdle = useMemo(
    () => JSON.stringify(demoProgram).includes('JUMP'),
    [demoProgram],
  );
  const hasGenerator = useMemo(
    () => JSON.stringify(demoProgram).includes('ACTIVATE'),
    [demoProgram],
  );

  // Grid sizing: 5 tiles track
  const TOTAL_COLS = 5;
  const goalCol = 4;

  const runSimulation = async () => {
    if (running) return;
    isCancelledRef.current = false;
    setRunning(true);
    setReachedGoal(false);
    setCrystalCollected(false);
    setGeneratorActive(false);
    setRobotPos({ x: 0, y: 0, dir: 0 });
    setRobotState('idle');

    let curX = 0;
    let curY = 0;
    let curDir = 0; // 0 = East, 90 = South, 180 = West, -90 = North

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(resolve, ms);
        if (isCancelledRef.current) clearTimeout(id);
      });

    // Helper to execute atomic command
    const execCommand = async (cmd: Command, blockIdx: number) => {
      if (isCancelledRef.current) return;
      setActiveStepIndex(blockIdx);

      switch (cmd.type) {
        case 'MOVE_FORWARD': {
          const steps = cmd.steps ?? 1;
          for (let s = 0; s < steps; s++) {
            if (isCancelledRef.current) return;
            setRobotState('walk');
            sfx.playStep();
            // Move based on current angle
            const rad = (curDir * Math.PI) / 180;
            const dx = Math.round(Math.cos(rad));
            const dy = Math.round(Math.sin(rad));
            curX = Math.max(0, Math.min(TOTAL_COLS - 1, curX + dx));
            curY = Math.max(0, Math.min(1, curY + dy));
            setRobotPos({ x: curX, y: curY, dir: curDir });
            await wait(520);
          }
          setRobotState('idle');
          break;
        }
        case 'MOVE_BACKWARD': {
          const steps = cmd.steps ?? 1;
          for (let s = 0; s < steps; s++) {
            if (isCancelledRef.current) return;
            setRobotState('walk');
            sfx.playStep();
            const rad = (curDir * Math.PI) / 180;
            const dx = Math.round(Math.cos(rad));
            const dy = Math.round(Math.sin(rad));
            curX = Math.max(0, Math.min(TOTAL_COLS - 1, curX - dx));
            curY = Math.max(0, Math.min(1, curY - dy));
            setRobotPos({ x: curX, y: curY, dir: curDir });
            await wait(520);
          }
          setRobotState('idle');
          break;
        }
        case 'TURN_LEFT': {
          setRobotState('turn');
          sfx.playClick();
          curDir = (curDir - 90) % 360;
          setRobotPos({ x: curX, y: curY, dir: curDir });
          await wait(450);
          setRobotState('idle');
          break;
        }
        case 'TURN_RIGHT': {
          setRobotState('turn');
          sfx.playClick();
          curDir = (curDir + 90) % 360;
          setRobotPos({ x: curX, y: curY, dir: curDir });
          await wait(450);
          setRobotState('idle');
          break;
        }
        case 'JUMP': {
          setRobotState('jump');
          setIsJumping(true);
          sfx.playJump();
          const rad = (curDir * Math.PI) / 180;
          const dx = Math.round(Math.cos(rad));
          const dy = Math.round(Math.sin(rad));
          // Jump covers 2 tiles forward
          curX = Math.max(0, Math.min(TOTAL_COLS - 1, curX + dx * 2));
          curY = Math.max(0, Math.min(1, curY + dy * 2));
          setRobotPos({ x: curX, y: curY, dir: curDir });
          await wait(620);
          setIsJumping(false);
          setRobotState('idle');
          break;
        }
        case 'PICK_UP': {
          setRobotState('wave');
          sfx.playPickup();
          setCrystalCollected(true);
          await wait(600);
          setRobotState('idle');
          break;
        }
        case 'ACTIVATE': {
          setRobotState('wave');
          sfx.playActivate();
          setGeneratorActive(true);
          await wait(600);
          setRobotState('idle');
          break;
        }
        case 'WAVE': {
          setRobotState('wave');
          sfx.playSnap();
          await wait(650);
          setRobotState('idle');
          break;
        }
        case 'CELEBRATE': {
          setRobotState('celebrate');
          sfx.playSuccess();
          await wait(800);
          setRobotState('idle');
          break;
        }
        case 'WAIT': {
          setRobotState('idle');
          await wait(700);
          break;
        }
        case 'REPEAT': {
          const times = cmd.times ?? 2;
          const body = cmd.body ?? [];
          for (let r = 0; r < times; r++) {
            if (isCancelledRef.current) return;
            for (let b = 0; b < body.length; b++) {
              await execCommand(body[b], blockIdx);
            }
          }
          break;
        }
      }
    };

    // Run each top-level block in order
    for (let i = 0; i < demoProgram.length; i++) {
      if (isCancelledRef.current) break;
      await execCommand(demoProgram[i], i);
      await wait(180);
    }

    if (!isCancelledRef.current) {
      setActiveStepIndex(-1);
      setReachedGoal(true);
      setRobotState('celebrate');
      sfx.playSuccess();
      await wait(1200);
      setRobotState('idle');
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Interactive Demo Arena (Stage where robot moves) */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 p-4 shadow-xl">
        {/* Background stars / grid ambiance */}
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-sky-300">
              {lang === 'th' ? 'จำลองการเคลื่อนที่จริง (Robot Simulation)' : 'Robot Simulation Stage'}
            </span>
          </div>
          {reachedGoal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black text-amber-300 animate-bounce">
              <Trophy className="h-3.5 w-3.5" />
              {lang === 'th' ? 'สำเร็จเป้าหมาย!' : 'Goal Reached!'}
            </span>
          )}
        </div>

        {/* The Track Grid: 5 Tiles */}
        <div className="relative z-10 my-4 flex items-center justify-between gap-2 px-1">
          {Array.from({ length: TOTAL_COLS }).map((_, cIdx) => {
            const isStart = cIdx === 0;
            const isGoal = cIdx === goalCol;
            const hasHurdleTile = hasHurdle && cIdx === 2;
            const hasCrystalTile = hasCrystal && cIdx === 2;
            const hasGenTile = hasGenerator && cIdx === 3;

            return (
              <div
                key={cIdx}
                className={cn(
                  'relative flex h-20 flex-1 flex-col items-center justify-center rounded-xl border-2 transition-all',
                  isStart
                    ? 'border-emerald-500/50 bg-emerald-950/30'
                    : isGoal
                      ? 'border-amber-400/60 bg-amber-950/30 shadow-[0_0_15px_rgba(251,191,36,0.25)]'
                      : 'border-slate-700/70 bg-slate-900/60',
                )}
              >
                {/* Tile floor markings */}
                <span className="absolute bottom-1 right-1.5 font-mono text-[10px] font-bold text-slate-500">
                  {cIdx + 1}
                </span>

                {isStart && (
                  <span className="absolute top-1 text-[9px] font-black uppercase text-emerald-400">
                    START
                  </span>
                )}

                {/* Obstacle on hurdle tile */}
                {hasHurdleTile && (
                  <div className="flex flex-col items-center justify-center">
                    <div className="h-6 w-8 rounded-lg bg-rose-600/80 border border-rose-400 text-center text-[10px] font-black text-white flex items-center justify-center shadow-md animate-pulse">
                      ⚡ GAP
                    </div>
                  </div>
                )}

                {/* Crystal on tile */}
                {hasCrystalTile && !crystalCollected && (
                  <div className="flex flex-col items-center animate-bounce">
                    <Gem className="h-7 w-7 text-sky-300 fill-sky-400 drop-shadow-[0_0_8px_#38bdf8]" />
                  </div>
                )}

                {/* Generator on tile */}
                {hasGenTile && (
                  <div className="flex flex-col items-center">
                    <Zap
                      className={cn(
                        'h-7 w-7 transition-all',
                        generatorActive
                          ? 'text-emerald-400 fill-emerald-400 drop-shadow-[0_0_10px_#4ade80]'
                          : 'text-amber-400 animate-pulse',
                      )}
                    />
                  </div>
                )}

                {/* Goal Trophy/Star */}
                {isGoal && (
                  <div className="flex flex-col items-center">
                    <Trophy
                      className={cn(
                        'h-8 w-8 text-amber-300 fill-amber-400 transition-all',
                        reachedGoal
                          ? 'scale-125 drop-shadow-[0_0_15px_#facc15] animate-bounce'
                          : 'drop-shadow-[0_0_6px_#facc15]',
                      )}
                    />
                    <span className="mt-0.5 text-[9px] font-black text-amber-300">GOAL</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Real Animated Robot Moving along the Track */}
          <div
            className="absolute z-20 pointer-events-none transition-all ease-out"
            style={{
              left: `${(robotPos.x / (TOTAL_COLS - 1)) * 76 + 2}%`,
              transform: `translateY(${isJumping ? '-32px' : '0px'}) rotate(${robotPos.dir}deg)`,
              transitionDuration: isJumping ? '450ms' : '480ms',
            }}
          >
            <div
              className={cn(
                'relative flex items-center justify-center transition-transform',
                isJumping && 'scale-110 drop-shadow-[0_15px_12px_rgba(56,189,248,0.5)]',
              )}
            >
              <RobotIllustration state={robotState} size={64} />
              {/* Direction pointer arrowhead */}
              <div
                className="absolute -top-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow-md"
                title={`หันหน้า: ${robotPos.dir}°`}
              >
                ▲
              </div>
            </div>
          </div>
        </div>

        {/* Stage Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <Button
            size="sm"
            onClick={() => void runSimulation()}
            disabled={running}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold gap-1.5 shadow-md cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            {running
              ? lang === 'th'
                ? 'กำลังสาธิต...'
                : 'Running Demo...'
              : lang === 'th'
                ? 'กดดูหุ่นยนต์เดิน (Run Demo)'
                : 'Run Demo'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetArena}
            disabled={running && !reachedGoal}
            className="text-slate-400 hover:text-white text-xs gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
          </Button>
        </div>
      </div>

      {/* 2. Real Blockly-Style Vertical Snap Blocks (ต่อกันเรียงจากบนลงล่าง) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {lang === 'th' ? 'บล็อกคำสั่งที่ใช้ (Blockly Program)' : 'Blockly Program Stack'}
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            {lang === 'th' ? 'ต่อเรียงจากบนลงล่าง' : 'Stacked Top-to-Bottom'}
          </span>
        </div>

        {/* Vertical Stack of Scratch/Blockly Interlocking Blocks */}
        <div className="flex flex-col items-start gap-1 pl-2">
          {demoProgram.map((cmd, idx) => (
            <BlocklyVisualCard
              key={idx}
              cmd={cmd}
              isActive={activeStepIndex === idx}
              lang={lang}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Authentic Scratch/Blockly visual block with puzzle interlocking tabs and vibrant colors
 */
function BlocklyVisualCard({
  cmd,
  isActive,
  lang,
}: {
  cmd: Command;
  isActive: boolean;
  lang: Lang;
}) {
  const isTh = lang === 'th';

  if (cmd.type === 'REPEAT') {
    const times = cmd.times ?? 2;
    const body = cmd.body ?? [];

    return (
      <div
        className={cn(
          'w-full max-w-sm rounded-2xl border-2 transition-all shadow-md',
          isActive
            ? 'border-amber-300 ring-4 ring-amber-400/50 bg-amber-950/40 scale-102 z-10'
            : 'border-amber-600/80 bg-amber-600 text-white',
        )}
      >
        {/* Repeat Block Header */}
        <div className="flex items-center gap-2 px-3.5 py-2 font-black text-xs text-white">
          <Repeat className="h-4 w-4" />
          <span>{isTh ? 'ทำซ้ำ' : 'repeat'}</span>
          <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-black text-amber-900 shadow-xs">
            {times}
          </span>
          <span>{isTh ? 'ครั้ง' : 'times'}</span>
        </div>

        {/* Indented C-shape body */}
        <div className="my-1 ml-4 border-l-4 border-amber-400/80 bg-slate-950/80 p-2 rounded-r-xl space-y-1.5">
          {body.map((subCmd, subIdx) => (
            <BlocklyVisualCard
              key={subIdx}
              cmd={subCmd}
              isActive={isActive}
              lang={lang}
            />
          ))}
        </div>

        {/* Bottom bar of C-bracket */}
        <div className="h-3 rounded-b-xl bg-amber-600/90" />
      </div>
    );
  }

  // Determine Category, Color & Icon
  let bgClass: string;
  let Icon = ArrowRight;
  let title: string;
  let paramText = '';

  switch (cmd.type) {
    case 'MOVE_FORWARD':
      bgClass = 'bg-sky-600 border-sky-400 text-white';
      Icon = ArrowRight;
      title = isTh ? 'เดินหน้า' : 'move forward';
      paramText = `${cmd.steps ?? 1} ${isTh ? 'ก้าว' : 'steps'}`;
      break;
    case 'MOVE_BACKWARD':
      bgClass = 'bg-sky-600 border-sky-400 text-white';
      Icon = ArrowRight;
      title = isTh ? 'ถอยหลัง' : 'move backward';
      paramText = `${cmd.steps ?? 1} ${isTh ? 'ก้าว' : 'steps'}`;
      break;
    case 'TURN_LEFT':
      bgClass = 'bg-sky-500 border-sky-300 text-white';
      Icon = RotateCcw;
      title = isTh ? 'เลี้ยวซ้าย' : 'turn left';
      paramText = '90°';
      break;
    case 'TURN_RIGHT':
      bgClass = 'bg-sky-500 border-sky-300 text-white';
      Icon = RotateCw;
      title = isTh ? 'เลี้ยวขวา' : 'turn right';
      paramText = '90°';
      break;
    case 'JUMP':
      bgClass = 'bg-indigo-600 border-indigo-400 text-white';
      Icon = ArrowRight;
      title = isTh ? 'กระโดดข้าม' : 'jump';
      paramText = '2 ช่อง';
      break;
    case 'PICK_UP':
      bgClass = 'bg-emerald-600 border-emerald-400 text-white';
      Icon = Gem;
      title = isTh ? 'เก็บ/ช่วย' : 'Pick Up / Rescue';
      break;
    case 'ACTIVATE':
      bgClass = 'bg-emerald-600 border-emerald-400 text-white';
      Icon = Zap;
      title = isTh ? 'เปิดพลังงาน' : 'activate';
      break;
    case 'WAVE':
      bgClass = 'bg-emerald-500 border-emerald-300 text-white';
      Icon = Hand;
      title = isTh ? 'โบกมือ' : 'wave';
      break;
    case 'CELEBRATE':
      bgClass = 'bg-emerald-500 border-emerald-300 text-white';
      Icon = Sparkles;
      title = isTh ? 'ฉลองชัยชนะ' : 'celebrate';
      break;
    default:
      bgClass = 'bg-slate-700 border-slate-500 text-white';
      title = cmd.type;
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-between gap-3 rounded-xl border-2 px-3.5 py-2 font-black text-xs shadow-md transition-all select-none',
        bgClass,
        isActive
          ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-105 z-10 brightness-110'
          : 'hover:brightness-105',
      )}
      style={{ minWidth: '220px' }}
    >
      {/* Jigsaw connector tab notch on top */}
      <div className="absolute -top-1.5 left-5 h-2 w-4 rounded-t-sm bg-inherit border-t-2 border-inherit" />

      {/* Block content */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20">
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="tracking-wide">{title}</span>
      </div>

      {paramText && (
        <span className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[11px] font-black text-slate-900 shadow-xs">
          {paramText}
        </span>
      )}

      {/* Jigsaw connector tab notch on bottom */}
      <div className="absolute -bottom-1.5 left-5 h-2 w-4 rounded-b-sm bg-inherit border-b-2 border-inherit" />
    </div>
  );
}
