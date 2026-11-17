import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Sparkles } from 'lucide-react';
import { DEFAULT_BLOCKS } from '@engine';
import type { BlockDefinition, Command, CommandType, Lang, RobotConfig } from '@engine';
import { Button } from '@/components/ui/button';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import { sfx } from '@/services/audio/soundEffects';
import { pickLocalized } from '@/utils/localize';
import { cn } from '@/utils/cn';

interface InteractiveRobotDemoProps {
  demoProgram: Command[];
  lang: Lang;
  fallbackLang?: Lang;
  robotAsset?: RobotConfig | null;
  blocks?: BlockDefinition[];
  compact?: boolean;
}

interface DemoCellKey {
  x: number;
  y: number;
}

interface DemoStageLayout {
  cols: number;
  rows: number;
  startX: number;
  startY: number;
  goalX: number;
  goalY: number;
  floorSet: Set<string>;
  hurdleSet: Set<string>;
  crystalSet: Set<string>;
  generatorSet: Set<string>;
}

const keyOf = (x: number, y: number) => `${x},${y}`;

/**
 * Simulates the demoProgram on a 2D grid to build an authentic MissionScene-like stage
 * where every command (forward, backward, turn left/right, jump, pick up, activate, repeat)
 * walks along real 2D floor tiles and ends on the glowing green Goal tile.
 */
function buildDemoStage(program: Command[]): DemoStageLayout {
  let x = 0;
  let y = 0;
  let dir = 0; // 0 = E, 90 = S, 180 = W, -90/270 = N

  const visited: DemoCellKey[] = [{ x: 0, y: 0 }];
  const hurdles: DemoCellKey[] = [];
  const crystals: DemoCellKey[] = [];
  const generators: DemoCellKey[] = [];

  const stepDelta = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      dx: Math.round(Math.cos(rad)),
      dy: Math.round(Math.sin(rad)),
    };
  };

  const traceCommands = (cmds: Command[]) => {
    for (const cmd of cmds) {
      switch (cmd.type) {
        case 'MOVE_FORWARD': {
          const steps = cmd.steps ?? 1;
          const { dx, dy } = stepDelta(dir);
          for (let i = 0; i < steps; i++) {
            x += dx;
            y += dy;
            visited.push({ x, y });
          }
          break;
        }
        case 'MOVE_BACKWARD': {
          const steps = cmd.steps ?? 1;
          const { dx, dy } = stepDelta(dir);
          for (let i = 0; i < steps; i++) {
            x -= dx;
            y -= dy;
            visited.push({ x, y });
          }
          break;
        }
        case 'TURN_LEFT':
          dir = (dir - 90) % 360;
          break;
        case 'TURN_RIGHT':
          dir = (dir + 90) % 360;
          break;
        case 'JUMP': {
          const { dx, dy } = stepDelta(dir);
          const midX = x + dx;
          const midY = y + dy;
          hurdles.push({ x: midX, y: midY });
          visited.push({ x: midX, y: midY });
          x += dx * 2;
          y += dy * 2;
          visited.push({ x, y });
          break;
        }
        case 'PICK_UP':
          crystals.push({ x, y });
          break;
        case 'ACTIVATE':
          generators.push({ x, y });
          break;
        case 'REPEAT': {
          const times = cmd.times ?? 2;
          const body = cmd.body ?? [];
          for (let r = 0; r < times; r++) {
            traceCommands(body);
          }
          break;
        }
        default:
          break;
      }
    }
  };

  traceCommands(program);

  const allX = visited.map((p) => p.x);
  const allY = visited.map((p) => p.y);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const spanX = maxX - minX + 1;
  const spanY = maxY - minY + 1;

  const cols = Math.max(5, spanX + 2);
  const rows = Math.max(3, spanY + 2);

  const offsetX = Math.floor((cols - spanX) / 2) - minX;
  const offsetY = Math.floor((rows - spanY) / 2) - minY;

  const floorSet = new Set<string>();
  for (const p of visited) {
    floorSet.add(keyOf(p.x + offsetX, p.y + offsetY));
  }

  const hurdleSet = new Set<string>();
  for (const h of hurdles) {
    hurdleSet.add(keyOf(h.x + offsetX, h.y + offsetY));
  }

  const crystalSet = new Set<string>();
  for (const c of crystals) {
    crystalSet.add(keyOf(c.x + offsetX, c.y + offsetY));
  }

  const generatorSet = new Set<string>();
  for (const g of generators) {
    generatorSet.add(keyOf(g.x + offsetX, g.y + offsetY));
  }

  const last = visited[visited.length - 1] ?? { x: 0, y: 0 };

  return {
    cols,
    rows,
    startX: offsetX,
    startY: offsetY,
    goalX: last.x + offsetX,
    goalY: last.y + offsetY,
    floorSet,
    hurdleSet,
    crystalSet,
    generatorSet,
  };
}

export function InteractiveRobotDemo({
  demoProgram,
  lang,
  fallbackLang = 'en',
  robotAsset,
  blocks = DEFAULT_BLOCKS,
  compact = false,
}: InteractiveRobotDemoProps) {
  const stage = useMemo(() => buildDemoStage(demoProgram), [demoProgram]);

  const [activeBlockKey, setActiveBlockKey] = useState<string | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [robotPos, setRobotPos] = useState<{ x: number; y: number; dir: number }>({
    x: stage.startX,
    y: stage.startY,
    dir: 0,
  });
  const [robotState, setRobotState] = useState<RobotVisualState>('idle');
  const [isJumping, setIsJumping] = useState<boolean>(false);
  const [collectedCrystals, setCollectedCrystals] = useState<Set<string>>(() => new Set());
  const [activatedGenerators, setActivatedGenerators] = useState<Set<string>>(() => new Set());
  const [reachedGoal, setReachedGoal] = useState<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);

  const [prevDemoProgram, setPrevDemoProgram] = useState<Command[]>(demoProgram);
  if (prevDemoProgram !== demoProgram) {
    setPrevDemoProgram(demoProgram);
    setRunning(false);
    setActiveBlockKey(null);
    setRobotPos({ x: stage.startX, y: stage.startY, dir: 0 });
    setRobotState('idle');
    setIsJumping(false);
    setCollectedCrystals(new Set());
    setActivatedGenerators(new Set());
    setReachedGoal(false);
  }

  useEffect(() => {
    isCancelledRef.current = true;
  }, [demoProgram]);

  const resetArena = () => {
    isCancelledRef.current = true;
    setRunning(false);
    setActiveBlockKey(null);
    setRobotPos({ x: stage.startX, y: stage.startY, dir: 0 });
    setRobotState('idle');
    setIsJumping(false);
    setCollectedCrystals(new Set());
    setActivatedGenerators(new Set());
    setReachedGoal(false);
  };

  const runSimulation = async () => {
    if (running) return;
    isCancelledRef.current = false;
    setRunning(true);
    setReachedGoal(false);
    setCollectedCrystals(new Set());
    setActivatedGenerators(new Set());
    setRobotPos({ x: stage.startX, y: stage.startY, dir: 0 });
    setRobotState('idle');

    let curX = stage.startX;
    let curY = stage.startY;
    let curDir = 0;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(resolve, ms);
        if (isCancelledRef.current) clearTimeout(id);
      });

    const stepDelta = (angleDeg: number) => {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        dx: Math.round(Math.cos(rad)),
        dy: Math.round(Math.sin(rad)),
      };
    };

    const execCommand = async (cmd: Command, blockKey: string) => {
      if (isCancelledRef.current) return;
      setActiveBlockKey(blockKey);

      switch (cmd.type) {
        case 'MOVE_FORWARD': {
          const steps = cmd.steps ?? 1;
          const { dx, dy } = stepDelta(curDir);
          setRobotState('walk');
          for (let s = 0; s < steps; s++) {
            if (isCancelledRef.current) return;
            sfx.playStep();
            curX += dx;
            curY += dy;
            setRobotPos({ x: curX, y: curY, dir: curDir });
            await wait(440);
          }
          setRobotState('idle');
          break;
        }
        case 'MOVE_BACKWARD': {
          const steps = cmd.steps ?? 1;
          const { dx, dy } = stepDelta(curDir);
          setRobotState('walk');
          for (let s = 0; s < steps; s++) {
            if (isCancelledRef.current) return;
            sfx.playStep();
            curX -= dx;
            curY -= dy;
            setRobotPos({ x: curX, y: curY, dir: curDir });
            await wait(440);
          }
          setRobotState('idle');
          break;
        }
        case 'TURN_LEFT': {
          setRobotState('turn');
          sfx.playClick();
          curDir = curDir - 90;
          setRobotPos({ x: curX, y: curY, dir: curDir });
          await wait(420);
          setRobotState('idle');
          break;
        }
        case 'TURN_RIGHT': {
          setRobotState('turn');
          sfx.playClick();
          curDir = curDir + 90;
          setRobotPos({ x: curX, y: curY, dir: curDir });
          await wait(420);
          setRobotState('idle');
          break;
        }
        case 'JUMP': {
          setRobotState('jump');
          setIsJumping(true);
          sfx.playJump();
          const { dx, dy } = stepDelta(curDir);
          curX += dx * 2;
          curY += dy * 2;
          setRobotPos({ x: curX, y: curY, dir: curDir });
          await wait(560);
          setIsJumping(false);
          setRobotState('idle');
          break;
        }
        case 'PICK_UP': {
          setRobotState('wave');
          sfx.playPickup();
          const k = keyOf(curX, curY);
          setCollectedCrystals((prev) => new Set(prev).add(k));
          await wait(520);
          setRobotState('idle');
          break;
        }
        case 'ACTIVATE': {
          setRobotState('wave');
          sfx.playActivate();
          const k = keyOf(curX, curY);
          setActivatedGenerators((prev) => new Set(prev).add(k));
          await wait(520);
          setRobotState('idle');
          break;
        }
        case 'WAVE': {
          setRobotState('wave');
          sfx.playSnap();
          await wait(560);
          setRobotState('idle');
          break;
        }
        case 'CELEBRATE': {
          setRobotState('celebrate');
          sfx.playSuccess();
          await wait(700);
          setRobotState('idle');
          break;
        }
        case 'WAIT': {
          setRobotState('idle');
          await wait(600);
          break;
        }
        case 'REPEAT': {
          const times = cmd.times ?? 2;
          const body = cmd.body ?? [];
          for (let r = 0; r < times; r++) {
            if (isCancelledRef.current) return;
            setActiveBlockKey(blockKey);
            await wait(160);
            for (let b = 0; b < body.length; b++) {
              await execCommand(body[b], `${blockKey}-${b}`);
            }
          }
          break;
        }
      }
    };

    for (let i = 0; i < demoProgram.length; i++) {
      if (isCancelledRef.current) break;
      await execCommand(demoProgram[i], `root-${i}`);
      await wait(140);
    }

    if (!isCancelledRef.current) {
      setActiveBlockKey(null);
      setReachedGoal(true);
      setRobotState('celebrate');
      sfx.playSuccess();
      await wait(1100);
      if (!isCancelledRef.current) {
        setRobotState('idle');
        setRunning(false);
      }
    }
  };

  const isTh = lang === 'th';

  return (
    <div className={cn(compact ? 'space-y-2' : 'space-y-4')} data-testid="interactive-robot-demo">
      {/* 1. Authentic 2D Game Stage (Matches MissionScene.ts 100%) */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 border-sky-500/40 bg-gradient-to-b from-[#0f172a] to-[#1e293b] shadow-xl',
          compact ? 'p-2.5' : 'p-4',
        )}
      >
        {/* Ambient space stars & planet glow matching MissionScene.ts */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sky-400/20 blur-xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-indigo-500/20 blur-xl" />

        {/* Stage Header */}
        <div
          className={cn(
            'relative z-10 flex items-center justify-between border-b border-slate-800/90 pb-2.5',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
            <span
              className={cn(
                'font-extrabold tracking-wide text-sky-300 text-xs sm:text-sm',
              )}
            >
              {isTh ? 'สนามจำลองภารกิจ (เหมือนสนามจริงในเกม)' : 'Mission Stage Preview'}
            </span>
          </div>
          {reachedGoal ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/60 bg-emerald-500/25 px-3 py-1 text-xs font-black text-emerald-300 animate-bounce shadow-[0_0_12px_rgba(74,222,128,0.4)]">
              <Sparkles className="h-3.5 w-3.5" />
              {isTh ? 'ภารกิจสำเร็จ!' : 'Mission Complete!'}
            </span>
          ) : (
            <span
              className={cn(
                'font-bold text-slate-400 text-xs sm:text-sm',
              )}
            >
              {isTh ? 'เป้าหมาย: วงแหวนสีเขียว' : 'Goal: Green Portal'}
            </span>
          )}
        </div>

        {/* 2D Tile Map matching MissionScene.ts */}
        <div className={cn('relative z-10 flex items-center justify-center my-2 sm:my-3')}>
          <div
            className="relative grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${stage.cols}, minmax(0, 1fr))`,
              width: '100%',
              maxWidth: `${stage.cols * (compact ? 52 : 68)}px`,
            }}
          >
            {Array.from({ length: stage.rows }).map((_, rIdx) =>
              Array.from({ length: stage.cols }).map((__, cIdx) => {
                const k = keyOf(cIdx, rIdx);
                const isFloor = stage.floorSet.has(k);
                const isHurdle = stage.hurdleSet.has(k);
                const hasCrystal = stage.crystalSet.has(k) && !collectedCrystals.has(k);
                const hasGen = stage.generatorSet.has(k);
                const genActive = activatedGenerators.has(k);
                const isGoal = cIdx === stage.goalX && rIdx === stage.goalY;

                return (
                  <div
                    key={k}
                    className={cn(
                      'relative aspect-square w-full rounded-xl flex items-center justify-center transition-all',
                      isFloor
                        ? 'bg-[#334155] border-2 border-[#38bdf8]/50 shadow-inner'
                        : 'bg-slate-950/30 border border-slate-800/30 opacity-40',
                    )}
                  >
                    {/* Hurdle ('H') */}
                    {isHurdle && (
                      <div className="h-3.5 w-4/5 rounded-md bg-[#f97316] border-2 border-[#fef08a] shadow-[0_0_12px_rgba(249,115,22,0.7)]" />
                    )}

                    {/* Crystal */}
                    {hasCrystal && (
                      <div className="relative flex h-6 w-6 items-center justify-center animate-pulse">
                        <div className="h-5 w-5 rotate-45 rounded-[3px] bg-[#fde047] border-2 border-[#fef9c3] shadow-[0_0_14px_#fde047]" />
                        <div className="absolute h-2.5 w-2.5 rotate-45 bg-[#fef9c3]" />
                      </div>
                    )}

                    {/* Generator */}
                    {hasGen && (
                      <div
                        className={cn(
                          'flex items-center justify-center rounded-full border-2 transition-all',
                          compact ? 'h-6 w-6' : 'h-8 w-8',
                          genActive
                            ? 'bg-[#22c55e] border-[#fef08a] shadow-[0_0_14px_#22c55e]'
                            : 'bg-[#1e293b] border-[#a855f7] shadow-[0_0_8px_#a855f7]',
                        )}
                      >
                        <div
                          className={cn(
                            'rounded-full',
                            compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5',
                            genActive ? 'bg-[#fef08a]' : 'bg-[#facc15]',
                          )}
                        />
                      </div>
                    )}

                    {/* Goal ('G') */}
                    {isGoal && (
                      <div className="relative flex items-center justify-center">
                        <div
                          className={cn(
                            'rounded-full border-[3px] border-[#4ade80] bg-[#22c55e]/35 transition-transform',
                            compact ? 'h-7 w-7' : 'h-9 w-9',
                            reachedGoal
                              ? 'scale-125 shadow-[0_0_20px_#4ade80]'
                              : 'animate-pulse shadow-[0_0_12px_rgba(74,222,128,0.6)]',
                          )}
                        />
                        <div
                          className={cn(
                            'absolute rounded-full bg-[#4ade80]',
                            compact ? 'h-3 w-3' : 'h-4 w-4',
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              }),
            )}

            {/* Animated Robot Overlay on the 2D Grid */}
            <div
              className="pointer-events-none absolute left-0 top-0 z-20 flex items-center justify-center transition-all ease-linear"
              style={{
                width: `${100 / stage.cols}%`,
                height: `${100 / stage.rows}%`,
                transform: `translate(${robotPos.x * 100}%, ${robotPos.y * 100}%)`,
                transitionDuration: isJumping ? '520ms' : '400ms',
              }}
            >
              <div
                className={cn(
                  'relative flex items-center justify-center transition-transform duration-300',
                  isJumping &&
                    '-translate-y-3.5 scale-120 drop-shadow-[0_14px_10px_rgba(56,189,248,0.6)]',
                )}
              >
                <RobotIllustration robot={robotAsset} state={robotState} size={compact ? 44 : 54} />
                <div
                  className="absolute inset-0 flex items-center justify-center transition-transform duration-300"
                  style={{ transform: `rotate(${robotPos.dir}deg)` }}
                >
                  <div
                    className={cn(
                      'h-0 w-0 border-y-transparent border-l-[#facc15] drop-shadow-[0_0_5px_#0f172a]',
                      compact
                        ? 'translate-x-5 border-y-[5px] border-l-[7px]'
                        : 'translate-x-6 border-y-[6px] border-l-[9px]',
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Authentic Blockly Zelos Workspace & Blocks (Matches BlocklyEditor.tsx 100%) */}
      <div
        className={cn(
          'overflow-hidden rounded-2xl border-2 border-slate-200 bg-white text-slate-900 shadow-lg flex flex-col min-h-0',
        )}
      >
        {/* Top Compile Bar — Identical to PlayWorkspace.tsx */}
        <div
          className={cn(
            'flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 shrink-0 px-3.5 py-2.5 sm:px-4 sm:py-3',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs sm:text-sm font-black text-sky-900 border border-sky-300 shadow-2xs">
              {isTh
                ? `บล็อกที่ใช้: ${countDemoBlocks(demoProgram)}`
                : `Blocks: ${countDemoBlocks(demoProgram)}`}
            </span>
            <span
              className={cn(
                'font-bold text-slate-600 text-xs sm:text-sm hidden sm:inline',
              )}
            >
              {isTh ? 'เรียงต่อกันจากบนลงล่าง' : 'Snap top-to-bottom'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetArena}
              disabled={running && !reachedGoal}
              className="h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-bold border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{isTh ? 'รีเซ็ตฉาก' : 'Reset'}</span>
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => void runSimulation()}
              disabled={running}
              data-testid="demo-compile-btn"
              className="h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-black tracking-wide shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{running ? (isTh ? 'กำลังรัน...' : 'Running...') : 'COMPILE'}</span>
            </Button>
          </div>
        </div>

        {/* Workspace Body: Left Mini Category Tray + Right Dotted Blockly Canvas */}
        <div
          className={cn(
            'flex flex-1 min-h-[220px] sm:min-h-[260px] lg:min-h-[300px]',
          )}
        >
          {/* Left Toolbox Category Strip (Matches Blockly Toolbox in index.css) */}
          <div
            className={cn(
              'flex shrink-0 flex-col border-r border-slate-200 bg-[#f8fafc] select-none w-28 sm:w-34 gap-2 p-2 sm:p-2.5',
            )}
          >
            <div
              className={cn(
                'flex items-center rounded-lg border-l-[5px] border-[#3b82f6] bg-white text-slate-800 shadow-xs font-black px-2.5 py-2 text-xs sm:text-sm',
              )}
            >
              {isTh ? 'การเคลื่อนที่' : 'Movement'}
            </div>
            <div
              className={cn(
                'flex items-center rounded-lg border-l-[5px] border-[#f97316] bg-white text-slate-800 shadow-xs font-black px-2.5 py-2 text-xs sm:text-sm',
              )}
            >
              {isTh ? 'การกระทำ' : 'Actions'}
            </div>
            <div
              className={cn(
                'flex items-center rounded-lg border-l-[5px] border-[#14b8a6] bg-white text-slate-800 shadow-xs font-black px-2.5 py-2 text-xs sm:text-sm',
              )}
            >
              {isTh ? 'ตรรกะ' : 'Logic'}
            </div>
          </div>

          {/* Right Dotted Canvas with Authentic Zelos Puzzle Blocks */}
          <div
            className="flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-5"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
              backgroundSize: '20px 20px',
              backgroundColor: '#ffffff',
            }}
          >
            <div className="inline-flex flex-col items-start gap-1">
              {demoProgram.map((cmd, idx) => (
                <ZelosPuzzleBlock
                  key={idx}
                  cmd={cmd}
                  blockKey={`root-${idx}`}
                  activeBlockKey={activeBlockKey}
                  lang={lang}
                  fallbackLang={fallbackLang}
                  blocks={blocks}
                  compact={compact}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function countDemoBlocks(cmds: Command[]): number {
  let total = 0;
  for (const c of cmds) {
    total += 1;
    if (c.body) total += countDemoBlocks(c.body);
  }
  return total;
}

function findBlockDef(type: CommandType, blocks: BlockDefinition[]): BlockDefinition {
  return (
    blocks.find((b) => b.command_type === type) ??
    DEFAULT_BLOCKS.find((b) => b.command_type === type) ??
    DEFAULT_BLOCKS[0]
  );
}

/**
 * Renders a single Blockly Zelos block (including C-shaped REPEAT blocks)
 * with exact colors, labels, white oval parameter inputs, and puzzle notches
 * matching BlocklyEditor.tsx in the live game.
 */
function ZelosPuzzleBlock({
  cmd,
  blockKey,
  activeBlockKey,
  lang,
  fallbackLang,
  blocks,
}: {
  cmd: Command;
  blockKey: string;
  activeBlockKey: string | null;
  lang: Lang;
  fallbackLang: Lang;
  blocks: BlockDefinition[];
  compact?: boolean;
}) {
  const def = findBlockDef(cmd.type, blocks);
  const label = pickLocalized(def.label, lang, fallbackLang, cmd.type);
  const color = def.color;
  const isActive = activeBlockKey === blockKey;

  if (cmd.type === 'REPEAT') {
    const times = cmd.times ?? 2;
    const body = cmd.body ?? [];
    return (
      <div
        className={cn(
          'relative flex flex-col select-none transition-transform -mt-[4px] first:mt-0',
          isActive && 'z-20 scale-[1.02]',
        )}
      >
        {/* Top Header of C-Block */}
        <div
          className={cn(
            'relative flex items-center rounded-t-xl rounded-br-xl font-extrabold text-white shadow-sm gap-2.5 px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-base',
            isActive && 'ring-4 ring-[#facc15]',
          )}
          style={{ backgroundColor: color, minWidth: '160px' }}
        >
          {/* Top female puzzle notch indentation */}
          <div
            className="absolute -top-[1px] left-5 h-2 w-5 rounded-b-md bg-white/90"
            aria-hidden="true"
          />
          <span className="tracking-wide drop-shadow-2xs">{label}</span>
          <span
            className="inline-flex items-center justify-center rounded-full bg-white font-sans font-black text-slate-900 shadow-inner h-7 sm:h-8 min-w-[34px] sm:min-w-[40px] px-2.5 text-sm sm:text-base"
          >
            {times}
          </span>
        </div>

        {/* Middle C-Mouth Spine + Inner Statement Stack */}
        <div className="flex items-stretch">
          <div
            className={cn('w-5 sm:w-6 shrink-0', isActive && 'ring-l-4 ring-[#facc15]')}
            style={{ backgroundColor: color }}
          />
          <div className="flex flex-col items-start py-1 pl-1">
            {body.map((subCmd, subIdx) => (
              <ZelosPuzzleBlock
                key={subIdx}
                cmd={subCmd}
                blockKey={`${blockKey}-${subIdx}`}
                activeBlockKey={activeBlockKey}
                lang={lang}
                fallbackLang={fallbackLang}
                blocks={blocks}
              />
            ))}
          </div>
        </div>

        {/* Bottom C-Jaw Foot */}
        <div
          className={cn(
            'relative rounded-b-xl rounded-tr-lg shadow-sm h-4 sm:h-5 w-28 sm:w-36',
            isActive && 'ring-4 ring-[#facc15]',
          )}
          style={{ backgroundColor: color }}
        >
          {/* Bottom male puzzle tab */}
          <div
            className="absolute -bottom-2 left-5 h-2 w-5 rounded-b-md"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  const paramValue =
    cmd.type === 'MOVE_FORWARD' || cmd.type === 'MOVE_BACKWARD'
      ? (cmd.steps ?? 1)
      : cmd.type === 'WAIT'
        ? (cmd.seconds ?? 1)
        : null;

  return (
    <div
      className={cn(
        'relative flex items-center rounded-xl font-extrabold text-white shadow-sm select-none transition-all -mt-[4px] first:mt-0 gap-2.5 px-4 py-2.5 sm:px-5 sm:py-3 text-sm sm:text-base',
        isActive
          ? 'z-20 scale-[1.03] ring-4 ring-[#facc15] shadow-md'
          : 'border border-black/10',
      )}
      style={{ backgroundColor: color, minWidth: '150px' }}
    >
      {/* Top puzzle female indentation */}
      <div
        className="absolute -top-[1px] left-5 h-2 w-5 rounded-b-md bg-white/85"
        aria-hidden="true"
      />

      <span className="tracking-wide drop-shadow-2xs">{label}</span>

      {paramValue !== null && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-white font-sans font-black text-slate-900 shadow-inner h-7 sm:h-8 min-w-[32px] sm:min-w-[38px] px-2.5 text-sm sm:text-base"
        >
          {paramValue}
        </span>
      )}

      {/* Bottom puzzle male tab */}
      <div
        className="absolute -bottom-2 left-5 z-10 h-2 w-5 rounded-b-md"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    </div>
  );
}
