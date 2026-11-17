import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  Copy,
  Flag,
  Heart,
  HeartCrack,
  HelpCircle,
  Home,
  Lightbulb,
  Loader2,
  Map as MapIcon,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { countBlocks, parseProgram, limitsFromBlocks } from '@engine';
import type {
  Command,
  ExecutionResult,
  LevelConfig,
  Localized,
  ScoreBreakdown,
  ValidationIssue,
} from '@engine';
import { BlocklyEditor } from '@/blockly/BlocklyEditor';
import {
  generateRealCodeSamples,
  type CodeLanguageId,
} from '@/blockly/generators/codeTranspiler';
import { localizedBlockLabel } from '@/blockly/toolbox/buildToolbox';
import { PhaserViewport } from '@/game-engine/PhaserViewport';
import type { RobotGameEngine } from '@/game-engine/RobotGameEngine';
import { FullscreenButton } from '@/components/common/FullscreenButton';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SettingsMenu } from '@/components/common/SettingsMenu';
import { useFullscreen } from '@/hooks/useFullscreen';
import { sfx } from '@/services/audio/soundEffects';
import { cn } from '@/utils/cn';
import { getAssignedRobotForStudent } from '@/utils/robotAssignment';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/stores/toastStore';
import { useServerTimer } from '@/hooks/useServerTimer';
import { currentLang } from '@/i18n/config';
import { ApiError } from '@/services/api/edge';
import { playerApi } from '@/services/api/playerApi';
import { useAppStore } from '@/stores/appStore';
import { loadSavedWorkspace, saveWorkspaceState, usePlayerStore } from '@/stores/playerStore';
import { formatDuration, pickLocalized } from '@/utils/localize';
import { HowToPlayGuideModal } from './HowToPlayGuideModal';
import { LevelMap } from './LevelMap';
import { useGameTheme } from './useGameTheme';

const MAX_HEARTS = 5;

export function PlayWorkspace() {
  const config = usePlayerStore((s) => s.config)!;
  const selectedLevelId = usePlayerStore((s) => s.selectedLevelId);
  const level = useMemo(
    () => config.levels.find((l) => l.id === selectedLevelId) ?? config.levels[0],
    [config.levels, selectedLevelId],
  );
  if (!level) return null;
  return <PlayLevelSession key={level.id} level={level} />;
}

function PlayLevelSession({ level }: { level: LevelConfig }) {
  const { t } = useTranslation(['player', 'game', 'common']);
  const lang = currentLang();
  const { isFullscreen } = useFullscreen();
  const { isCyber, isEsports, isAcademy, isArcade, isDark } = useGameTheme();

  const settings = useAppStore((s) => s.settings);
  const player = usePlayerStore((s) => s.player)!;
  const playerSession = usePlayerStore((s) => s.playerSession)!;
  const config = usePlayerStore((s) => s.config)!;
  const latestVersion = usePlayerStore((s) => s.latestVersion);
  const progress = usePlayerStore((s) => s.progress);
  const serverOffsetMs = usePlayerStore((s) => s.serverOffsetMs);
  const selectLevel = usePlayerStore((s) => s.selectLevel);
  const refreshState = usePlayerStore((s) => s.refreshState);
  const finishGame = usePlayerStore((s) => s.finishGame);
  const resetToHome = usePlayerStore((s) => s.resetToHome);
  const setShowLessonReview = usePlayerStore((s) => s.setShowLessonReview);

  const fallbackLang = settings?.default_language ?? 'en';
  const levelProgress = useMemo(
    () => progress.find((p) => p.level_id === level.id),
    [progress, level.id],
  );

  // Show ALL enabled coding blocks in every level to increase block-selection challenge
  const allEnabledCommands = useMemo(
    () => config.blocks.filter((b) => b.enabled).map((b) => b.command_type),
    [config.blocks],
  );

  // Total 5 hearts shared across all levels in the game
  const totalFailedAttempts = useMemo(
    () => progress.reduce((sum, p) => sum + (p.failed_attempts ?? 0), 0),
    [progress],
  );
  const [optimisticHearts, setOptimisticHearts] = useState<number | null>(null);
  const heartsRemaining =
    optimisticHearts !== null ? optimisticHearts : Math.max(0, MAX_HEARTS - totalFailedAttempts);

  const assignedRobot = useMemo(
    () => getAssignedRobotForStudent(playerSession?.player_id, config.robots),
    [playerSession?.player_id, config.robots],
  );

  const robotCfg = useMemo(
    () =>
      config.robots.find((r) => r.id === level.robot_id) ??
      assignedRobot ??
      config.robots.find((r) => r.is_default) ??
      config.robots[0] ??
      null,
    [config.robots, level.robot_id, assignedRobot],
  );
  const sceneCfg = useMemo(
    () => config.scenes.find((s) => s.id === level.scene_id) ?? config.scenes[0] ?? null,
    [config.scenes, level.scene_id],
  );

  const engineRef = useRef<RobotGameEngine | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [hints, setHints] = useState<Localized[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintsTotal, setHintsTotal] = useState(level.hints.length);
  const [showMap, setShowMap] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [activeCodeLang, setActiveCodeLang] = useState<CodeLanguageId>('python');
  const [copiedLang, setCopiedLang] = useState<string | null>(null);
  const [victoryModal, setVictoryModal] = useState<{
    scoreAwarded: number;
    breakdown: ScoreBreakdown | null;
    alreadyCompleted: boolean;
    finished: boolean;
    commandsSnapshot: Command[];
  } | null>(null);

  const handleTimerExpire = useCallback(() => {
    void refreshState();
  }, [refreshState]);

  const secondsLeft = useServerTimer(
    playerSession.expires_at,
    serverOffsetMs,
    playerSession.status === 'PLAYING',
    handleTimerExpire,
  );

  useEffect(() => {
    let active = true;
    void playerApi
      .getHints(level.id)
      .then((res) => {
        if (!active) return;
        setHints(res.hints);
        setHintsUsed(res.hints_used);
        setHintsTotal(res.hints_total);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [level.id]);

  const savedInitialState = useMemo(
    () => loadSavedWorkspace(playerSession.id, level.id),
    [playerSession.id, level.id],
  );

  const handleWorkspaceChange = useCallback(
    (cmds: Command[], serialized: Record<string, unknown>) => {
      setCommands(cmds);
      if (level) saveWorkspaceState(playerSession.id, level.id, serialized);
    },
    [playerSession.id, level],
  );

  const formatValidationIssue = (issue: ValidationIssue): string => {
    const cmdLabel = issue.params?.command
      ? localizedBlockLabel(config.blocks, issue.params.command as Command['type'], lang, fallbackLang)
      : '';
    return t(`game:feedback.validation.${issue.code}`, {
      ...issue.params,
      command: cmdLabel,
    });
  };

  const handleCompile = async () => {
    if (!level || compiling) return;
    setFeedbackError(null);
    setVictoryModal(null);

    // Validate against all enabled blocks so distractor blocks can be compiled & tested
    const gameplayRules = {
      ...level.mission.rules,
      allowed_commands: allEnabledCommands,
    };
    const localCheck = parseProgram(commands, gameplayRules, limitsFromBlocks(config.blocks));
    if (!localCheck.ok) {
      setFeedbackError(formatValidationIssue(localCheck.issues[0]));
      return;
    }

    setCompiling(true);
    try {
      const submissionId = crypto.randomUUID();
      const res = await playerApi.submitSolution({
        level_id: level.id,
        client_submission_id: submissionId,
        program: commands,
      });
      if (res.server_now) usePlayerStore.getState().applyServerTime(res.server_now);

      if (!res.accepted) {
        if (res.reason === 'TIME_EXPIRED' || res.reason === 'FINISHED') {
          await refreshState();
          return;
        }
        setFeedbackError(t(`common:errors.${res.reason}`, res.reason ?? ''));
        setCompiling(false);
        return;
      }

      if (res.status === 'INVALID' && res.issues?.length) {
        setFeedbackError(formatValidationIssue(res.issues[0]));
        setCompiling(false);
        return;
      }

      const execResult = res.result;
      if (!execResult) {
        setCompiling(false);
        return;
      }

      setLastResult(execResult);

      // Play the authoritative trace returned by the backend inside Phaser!
      if (engineRef.current) {
        await engineRef.current.playTrace(execResult, {
          onStep: (ev) => setHighlightedBlockId(ev.block_id ?? null),
        });
      }
      setHighlightedBlockId(null);

      if (typeof res.hearts_remaining === 'number') {
        setOptimisticHearts(res.hearts_remaining);
      }

      // If the player lost their last heart on this failed compile, show Game Over modal first!
      const lostAllHearts =
        !execResult.success &&
        (Boolean(res.out_of_hearts) ||
          res.hearts_remaining === 0 ||
          totalFailedAttempts + 1 >= MAX_HEARTS);

      if (lostAllHearts) {
        setOptimisticHearts(0);
        sfx.playHeartLost();
        if (execResult.failure) {
          setFeedbackError(t(`game:feedback.failures.${execResult.failure.code}`));
        }
        setShowGameOverModal(true);
        return;
      }

      await refreshState();
      setOptimisticHearts(null);

      if (execResult.success) {
        sfx.playSuccess();
        setVictoryModal({
          scoreAwarded: res.score?.awarded ?? 0,
          breakdown: res.score?.breakdown ?? null,
          alreadyCompleted: Boolean(res.already_completed),
          finished: Boolean(res.finished),
          commandsSnapshot: commands,
        });
      } else if (execResult.failure) {
        const failMsg = t(`game:feedback.failures.${execResult.failure.code}`);
        const left =
          typeof res.hearts_remaining === 'number'
            ? res.hearts_remaining
            : Math.max(0, MAX_HEARTS - (totalFailedAttempts + 1));
        setFeedbackError(`${failMsg} (${t('player:workspace.heartLostNote', { count: left })})`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const key = `common:errors.${err.code}`;
        const translated = t(key);
        setFeedbackError(translated !== key ? translated : err.message);
      } else {
        setFeedbackError(t('common:errors.NETWORK'));
      }
    } finally {
      setCompiling(false);
    }
  };

  const handleRevealHint = async () => {
    if (!level) return;
    try {
      const res = await playerApi.useHint(level.id);
      setHints(res.hints);
      setHintsUsed(res.hints_used);
      setHintsTotal(res.hints_total);
    } catch (e) {
      toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
    }
  };

  const nextLevel = useMemo(() => {
    if (!level) return null;
    const idx = config.levels.findIndex((l) => l.id === level.id);
    return idx >= 0 && idx < config.levels.length - 1 ? config.levels[idx + 1] : null;
  }, [config.levels, level]);

  const codeSamples = useMemo(
    () =>
      generateRealCodeSamples(
        victoryModal?.commandsSnapshot ?? commands,
        level.code,
        lang,
      ),
    [victoryModal?.commandsSnapshot, commands, level.code, lang],
  );

  const activeSample = useMemo(
    () => codeSamples.find((s) => s.id === activeCodeLang) ?? codeSamples[0],
    [codeSamples, activeCodeLang],
  );

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedLang(id);
      setTimeout(() => setCopiedLang(null), 1800);
    } catch {
      // Ignore clipboard errors
    }
  };

  if (!level) return null;

  const blocksUsed = countBlocks(commands);
  const overBlockLimit = blocksUsed > level.mission.rules.max_blocks;
  const announcementText = settings?.announcement
    ? pickLocalized(settings.announcement, lang, fallbackLang)
    : '';

  return (
    <div
      className={cn(
        'flex flex-col transition-colors duration-300',
        isCyber && 'bg-slate-950 text-slate-100',
        isEsports && 'bg-slate-950 text-slate-100',
        isAcademy && 'bg-slate-100 text-slate-900',
        isArcade && 'bg-indigo-950 text-slate-100',
        isFullscreen ? 'h-screen max-h-screen overflow-hidden fra-play-workspace' : 'min-h-screen',
      )}
    >
      {/* Announcement bar */}
      {announcementText && (
        <div className="bg-amber-400 px-4 py-1 text-center text-xs font-bold text-slate-950 shrink-0">
          📢 {announcementText}
        </div>
      )}

      {/* Top HUD */}
      <header
        className={cn(
          'border-b shrink-0 transition-colors duration-300',
          isCyber && 'border-sky-500/25 bg-slate-900/95 backdrop-blur-md shadow-[0_4px_20px_rgba(56,189,248,0.12)] text-white',
          isEsports && 'border-violet-500/35 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-lg text-white',
          isAcademy && 'border-slate-200 bg-white shadow-xs text-slate-900',
          isArcade && 'border-pink-400/40 bg-indigo-950/95 shadow-md text-white',
          isFullscreen ? 'px-3 py-1' : 'px-4 py-2.5',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between',
            isFullscreen ? 'w-full gap-2' : 'mx-auto max-w-[1600px] flex-wrap gap-3',
          )}
        >
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHomeConfirm(true)}
              data-testid="workspace-home-btn"
              title={t('common:app.backToHome')}
              className={cn(
                isFullscreen ? 'h-7 px-2 text-xs' : '',
                isCyber && 'border-sky-500/40 bg-slate-800/80 text-sky-200 hover:border-sky-400 hover:bg-slate-800',
                isEsports && 'border-violet-500/40 bg-slate-900 text-violet-200 hover:border-amber-400',
                isArcade && 'border-pink-400/40 bg-indigo-900/80 text-pink-200 hover:border-pink-300',
              )}
            >
              <Home className={cn('h-3.5 w-3.5', isCyber ? 'text-sky-400' : isEsports ? 'text-amber-400' : isArcade ? 'text-pink-400' : 'text-indigo-600')} />
              <span className="hidden sm:inline">{t('common:app.home')}</span>
            </Button>

            {settings?.college_logo_url ? (
              <img
                src={settings.college_logo_url}
                alt="College Logo"
                className={cn(
                  'rounded-full object-contain overflow-hidden bg-transparent shrink-0',
                  isFullscreen ? 'h-7 w-7' : 'h-9 w-9',
                )}
              />
            ) : settings?.game_logo_url ? (
              <img
                src={settings.game_logo_url}
                alt=""
                className={cn('rounded-lg object-contain', isFullscreen ? 'h-7 w-7' : 'h-9 w-9')}
              />
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl bg-indigo-600 text-white font-extrabold',
                  isFullscreen ? 'h-7 w-7 text-sm' : 'h-9 w-9',
                )}
              >
                🤖
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'font-extrabold text-sm sm:text-base',
                    isCyber && 'text-sky-200 font-black drop-shadow-[0_0_8px_rgba(56,189,248,0.4)] tracking-wide',
                    isEsports && 'text-white font-black uppercase tracking-tight',
                    isAcademy && 'text-slate-900',
                    isArcade && 'text-amber-300 font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]',
                  )}
                >
                  {player.display_name}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs font-semibold py-0.5 px-2',
                    isCyber && 'border border-sky-400/30 bg-sky-500/15 text-sky-200',
                    isEsports && 'border border-violet-400/40 bg-violet-950/60 text-violet-200 font-bold',
                    isArcade && 'border border-pink-400/40 bg-pink-500/20 text-pink-200',
                  )}
                >
                  {player.school}
                </Badge>
              </div>
              {!isFullscreen && (
                <p className={cn('text-xs', isCyber ? 'text-sky-300/70' : isEsports ? 'text-slate-400' : isArcade ? 'text-pink-300/80' : 'text-slate-500')}>
                  {settings ? pickLocalized(settings.game_title, lang, fallbackLang) : t('common:app.title')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 5 Hearts Indicator */}
            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-xl border font-extrabold px-2.5 sm:px-3 py-1 text-sm transition-all',
                heartsRemaining <= 1
                  ? 'border-rose-400 bg-rose-50 text-rose-700 animate-pulse'
                  : isCyber
                    ? 'border-rose-500/40 bg-rose-950/30 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                    : isEsports
                      ? 'border-rose-500/40 bg-slate-900 text-rose-400'
                      : isArcade
                        ? 'border-pink-500/40 bg-pink-950/50 text-pink-300'
                        : 'border-rose-200 bg-rose-50/70 text-rose-800',
              )}
              data-testid="player-hearts"
              title={t('player:workspace.heartsLabel', { count: heartsRemaining, max: MAX_HEARTS })}
            >
              {Array.from({ length: MAX_HEARTS }).map((_, idx) => (
                <Heart
                  key={idx}
                  className={`transition-transform h-4 w-4 ${
                    idx < heartsRemaining
                      ? 'fill-rose-500 text-rose-500 scale-100'
                      : 'fill-slate-300 text-slate-300 scale-90'
                  }`}
                />
              ))}
              <span className="ml-1 text-xs sm:text-sm font-black">
                {heartsRemaining}/{MAX_HEARTS}
              </span>
            </div>

            {/* Timer */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border font-extrabold px-2.5 sm:px-3 py-1 text-sm',
                secondsLeft !== null && secondsLeft <= 120
                  ? 'border-rose-300 bg-rose-50 text-rose-700 animate-pulse'
                  : isCyber
                    ? 'border-sky-500/35 bg-slate-800/90 text-sky-200 font-mono shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                    : isEsports
                      ? 'border-violet-500/35 bg-slate-900 text-slate-200'
                      : isArcade
                        ? 'border-purple-400/40 bg-purple-950/60 text-purple-200'
                        : 'border-slate-200 bg-slate-50 text-slate-800',
              )}
              data-testid="player-timer"
            >
              <Clock className={cn('h-4 w-4', isCyber ? 'text-sky-400' : isEsports ? 'text-amber-400' : isArcade ? 'text-pink-400' : 'text-indigo-600')} />
              {secondsLeft === null ? t('player:workspace.unlimitedTime') : formatDuration(secondsLeft)}
            </div>

            {/* Score */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border font-extrabold px-2.5 sm:px-3 py-1 text-sm',
                isCyber && 'border-amber-400/40 bg-amber-950/30 text-amber-300 font-mono shadow-[0_0_8px_rgba(245,158,11,0.25)]',
                isEsports && 'border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 font-black',
                isAcademy && 'border-amber-200 bg-amber-50 text-amber-900',
                isArcade && 'border-amber-400/50 bg-amber-950/50 text-amber-300 font-black',
              )}
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              <span data-testid="player-score">{playerSession.total_score}</span>
            </div>

            {/* Progress */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMap(true)}
              className={cn(
                'h-8 px-2.5 text-xs sm:text-sm font-bold',
                isCyber && 'border-sky-500/30 bg-slate-800/80 text-sky-200 hover:border-sky-400',
                isEsports && 'border-violet-500/30 bg-slate-900 text-slate-200 hover:border-violet-400',
                isArcade && 'border-pink-400/30 bg-indigo-900/80 text-pink-200 hover:border-pink-300',
              )}
            >
              <MapIcon className={cn('h-3.5 w-3.5', isCyber ? 'text-sky-400' : isEsports ? 'text-amber-400' : isArcade ? 'text-pink-400' : 'text-indigo-600')} />
              <span>{t('player:workspace.levelMapBtn')}</span>
              <span className={cn('text-xs', isCyber ? 'text-sky-400/70' : isEsports ? 'text-slate-400' : isArcade ? 'text-pink-300/70' : 'text-slate-500')}>
                ({playerSession.levels_completed}/{config.levels.length})
              </span>
            </Button>

            {config.lessons.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLessonReview(true)}
                className={cn(
                  'h-8 px-2.5 text-xs sm:text-sm font-bold',
                  isCyber && 'border-sky-500/30 bg-slate-800/80 text-sky-200 hover:border-sky-400',
                  isEsports && 'border-violet-500/30 bg-slate-900 text-slate-200 hover:border-violet-400',
                  isArcade && 'border-pink-400/30 bg-indigo-900/80 text-pink-200 hover:border-pink-300',
                )}
              >
                <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                <span className="hidden xl:inline">{t('player:workspace.lessonsBtn')}</span>
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowFinishConfirm(true)}
              data-testid="finish-game-btn"
              className="h-8 px-2.5 text-xs sm:text-sm font-bold"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>{t('player:workspace.finishGame')}</span>
            </Button>

            <FullscreenButton dark={isDark} />
            <SettingsMenu dark={isDark} />
          </div>
        </div>
      </header>

      {latestVersion && latestVersion > config.version && (
        <div className="bg-indigo-50 px-4 py-1 text-center text-xs font-medium text-indigo-800 border-b border-indigo-100 shrink-0">
          {t('player:workspace.newConfigBanner', { version: config.version })}
        </div>
      )}

      {/* Main Split Workspace */}
      <main
        className={cn(
          'mx-auto grid w-full flex-1 lg:grid-cols-12',
          isFullscreen
            ? 'h-[calc(100vh-46px)] max-h-[calc(100vh-46px)] min-h-0 max-w-none px-3 py-1.5 gap-2.5 overflow-hidden'
            : 'max-w-[1600px] p-4 gap-4',
        )}
      >
        {/* Left: Phaser Stage + Mission Info + Hints */}
        <div
          className={cn(
            'flex flex-col min-h-0 h-full overflow-hidden',
            isFullscreen ? 'lg:col-span-5 gap-2' : 'lg:col-span-5 gap-4',
          )}
        >
          <div
            className={cn(
              'relative rounded-xl overflow-hidden shadow-xs shrink-0',
              isFullscreen ? 'h-[36vh] min-h-[170px] max-h-[300px]' : 'h-[340px] sm:h-[380px]',
            )}
          >
            <PhaserViewport
              mission={level.mission}
              robot={robotCfg}
              scene={sceneCfg}
              completionAnimation={level.completion_animation}
              className={isFullscreen ? 'min-h-[170px]' : 'min-h-[280px]'}
              onEngineReady={(eng) => {
                engineRef.current = eng;
              }}
            />
            {compiling && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px] transition-all">
                <LoadingSpinner size="md" message={t('game:compiling')} dark />
              </div>
            )}
          </div>

          <Card
            className={cn(
              'flex flex-col border shadow-xs rounded-xl transition-all',
              isCyber && 'border-sky-500/25 bg-slate-900/90 text-white shadow-[0_0_15px_rgba(56,189,248,0.1)]',
              isEsports && 'border-violet-500/30 bg-slate-900/90 text-white shadow-md',
              isAcademy && 'border-slate-200 bg-white text-slate-900',
              isArcade && 'border-2 border-pink-400/30 bg-indigo-900/80 text-white shadow-md',
              isFullscreen ? 'flex-1 min-h-0 overflow-hidden' : '',
            )}
          >
            <CardContent
              className={cn(
                'flex flex-col',
                isFullscreen ? 'p-2.5 space-y-1.5 flex-1 min-h-0 overflow-y-auto' : 'p-5 space-y-4',
              )}
            >
              <div className="flex items-center justify-between gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5 truncate">
                  <Badge
                    className={cn(
                      'text-xs font-bold py-0.5 px-2',
                      isCyber && 'border border-sky-400/30 bg-sky-500/15 text-sky-200',
                      isEsports && 'border border-violet-400/30 bg-violet-950/60 text-violet-200',
                      isArcade && 'border border-pink-400/30 bg-pink-500/20 text-pink-200',
                    )}
                  >
                    {t('game:level', { n: level.position })}
                  </Badge>
                  {levelProgress?.status === 'COMPLETED' && (
                    <Badge variant="success" className="text-xs font-bold py-0.5 px-2">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('game:status.completed')} ({levelProgress.score})
                    </Badge>
                  )}
                  <h2
                    className={cn(
                      'font-black text-base sm:text-lg lg:text-xl truncate',
                      isCyber && 'text-sky-200 drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]',
                      isEsports && 'text-white font-black uppercase tracking-tight',
                      isAcademy && 'text-slate-900',
                      isArcade && 'text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]',
                    )}
                  >
                    {pickLocalized(level.title, lang, fallbackLang, level.code)}
                  </h2>
                </div>

                {levelProgress?.status === 'COMPLETED' && commands.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCodeModal(true)}
                    className={cn(
                      'shrink-0 h-7 text-xs px-2.5 font-bold',
                      isCyber && 'border-sky-500/30 bg-slate-800 text-sky-200 hover:border-sky-400',
                      isEsports && 'border-violet-500/30 bg-slate-900 text-slate-200 hover:border-amber-400',
                      isArcade && 'border-pink-400/30 bg-indigo-900 text-pink-200',
                    )}
                  >
                    <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                    {t('game:realCode.viewBtn')}
                  </Button>
                )}
              </div>

              <p
                className={cn(
                  'shrink-0 text-sm line-clamp-2',
                  isCyber ? 'text-sky-200/80' : isEsports ? 'text-slate-300' : isArcade ? 'text-pink-100/90' : 'text-slate-600',
                )}
              >
                {pickLocalized(level.description, lang, fallbackLang)}
              </p>

              {/* Objectives checklist */}
              <div
                className={cn(
                  'rounded-lg shrink-0 transition-colors',
                  isCyber && 'bg-slate-950/60 border border-sky-500/20 text-slate-200',
                  isEsports && 'bg-slate-950/60 border border-violet-500/20 text-slate-200',
                  isAcademy && 'bg-slate-50 border border-slate-200/80 text-slate-800',
                  isArcade && 'bg-indigo-950/70 border border-pink-400/20 text-slate-200',
                  isFullscreen ? 'p-2 space-y-1' : 'p-3.5 space-y-2',
                )}
              >
                <p
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    isCyber ? 'text-sky-400' : isEsports ? 'text-amber-400' : isArcade ? 'text-pink-400' : 'text-slate-500',
                  )}
                >
                  {t('game:objectives')}
                </p>
                <div className="space-y-1">
                  {level.mission.objectives.map((obj, idx) => {
                    const status = lastResult?.objectives[idx];
                    const done = Boolean(status?.done);
                    const target =
                      status?.target ??
                      (obj.type === 'COLLECT_CRYSTALS'
                        ? (obj.count ?? level.mission.map.crystals.length)
                        : obj.type === 'ACTIVATE_GENERATORS'
                          ? level.mission.map.generators.length
                          : obj.type === 'RESCUE_FRIENDS'
                            ? level.mission.map.friends.length
                            : 1);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2
                          className={cn('shrink-0 h-4 w-4', done ? 'text-emerald-400' : isDark ? 'text-slate-600' : 'text-slate-300')}
                        />
                        <span
                          className={cn(
                            done
                              ? isDark ? 'font-bold text-emerald-300' : 'font-semibold text-emerald-800'
                              : isDark ? 'text-slate-300' : 'text-slate-700',
                          )}
                        >
                          {t(`game:objectiveTypes.${obj.type}`, {
                            current: status?.current ?? 0,
                            target,
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error / failure feedback */}
              {feedbackError && (
                <div
                  role="alert"
                  className={cn(
                    'flex items-start gap-2 rounded-lg font-semibold shrink-0 p-2.5 sm:p-3 text-sm',
                    isDark
                      ? 'border border-rose-500/40 bg-rose-950/40 text-rose-200'
                      : 'border border-rose-200 bg-rose-50 text-rose-800',
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>{feedbackError}</span>
                </div>
              )}

              {/* Hints */}
              {hintsTotal > 0 && (
                <div
                  className={cn(
                    'rounded-lg shrink-0 p-2.5 sm:p-3 space-y-1.5',
                    isDark
                      ? 'border border-amber-500/30 bg-amber-950/30 text-amber-200'
                      : 'border border-amber-200 bg-amber-50/70 text-amber-950',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                      <Lightbulb className="h-4 w-4 text-amber-400" />
                      {t('game:hints')} ({hintsUsed}/{hintsTotal})
                    </span>
                    {hintsUsed < hintsTotal ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleRevealHint()}
                        className="h-7 text-xs px-2.5 py-0.5 font-bold"
                      >
                        {levelProgress?.status === 'COMPLETED'
                          ? t('game:revealHintFree')
                          : t('game:revealHint', { penalty: config.settings.score_rules.hint_penalty })}
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-amber-400">{t('game:noHintsLeft')}</span>
                    )}
                  </div>
                  {hints.length > 0 ? (
                    <ul className="space-y-1 text-xs sm:text-sm">
                      {hints.map((h, i) => (
                        <li
                          key={i}
                          className={cn(
                            'rounded-lg px-2.5 py-1',
                            isDark
                              ? 'bg-slate-900/90 border border-amber-500/25 text-amber-200'
                              : 'bg-white/80 border border-amber-200/80 text-amber-950',
                          )}
                        >
                          💡 {pickLocalized(h, lang, fallbackLang)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={cn('text-xs', isDark ? 'text-amber-300/80' : 'text-amber-800')}>
                      {t('game:hintPenaltyNote', { penalty: config.settings.score_rules.hint_penalty })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Blockly Visual Coding Area + COMPILE */}
        <div
          className={cn(
            'flex flex-col min-h-0 h-full overflow-hidden',
            isFullscreen ? 'lg:col-span-7 gap-1.5' : 'lg:col-span-7 gap-3',
          )}
        >
          <div
            className={cn(
              'flex items-center justify-between gap-1.5 rounded-xl border shrink-0 transition-colors',
              isCyber && 'border-sky-500/25 bg-slate-900/90 shadow-[0_0_15px_rgba(56,189,248,0.1)] text-white',
              isEsports && 'border-violet-500/30 bg-slate-900/90 shadow-md text-white',
              isAcademy && 'border-slate-200 bg-white shadow-xs text-slate-900',
              isArcade && 'border-2 border-pink-400/30 bg-indigo-900/80 shadow-md text-white',
              isFullscreen ? 'px-2.5 py-1.5' : 'flex-wrap px-4 py-3 gap-2 rounded-2xl',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={overBlockLimit ? 'danger' : 'info'} className="text-xs sm:text-sm py-1 px-2.5 font-bold">
                {t('game:blocksUsed', { used: blocksUsed, max: level.mission.rules.max_blocks })}
              </Badge>
              {(level.mission.rules.required_commands ?? []).length > 0 && (
                <Badge variant="warning" className="text-xs sm:text-sm py-1 px-2.5 font-bold">
                  {t('game:requiredBlocks')}{' '}
                  {(level.mission.rules.required_commands ?? [])
                    .map((c) => localizedBlockLabel(config.blocks, c, lang, fallbackLang))
                    .join(', ')}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowHowToPlay(true)}
                data-testid="how-to-play-btn"
                className={cn(
                  'h-8 px-2.5 sm:px-3 text-xs sm:text-sm font-bold',
                  isCyber && 'border-sky-500/30 bg-sky-950/60 text-sky-200 hover:border-sky-400',
                  isEsports && 'border-violet-500/30 bg-violet-950/60 text-violet-200 hover:border-amber-400',
                  isArcade && 'border-pink-400/30 bg-pink-950/60 text-pink-200',
                )}
              >
                <Compass className={cn('h-4 w-4', isCyber ? 'text-sky-400' : isEsports ? 'text-amber-400' : isArcade ? 'text-pink-400' : 'text-indigo-700')} />
                <span>{lang === 'th' ? 'วิธีเล่น 4 ขั้นตอน' : 'How to Play'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGuide(true)}
                className={cn(
                  'h-8 px-2.5 sm:px-3 text-xs sm:text-sm font-bold hidden sm:inline-flex',
                  isCyber && 'border-sky-500/30 bg-slate-800 text-sky-200 hover:border-sky-400',
                  isEsports && 'border-violet-500/30 bg-slate-900 text-slate-200',
                  isArcade && 'border-pink-400/30 bg-indigo-900 text-pink-200',
                )}
              >
                <HelpCircle className="h-4 w-4" />
                <span>{t('game:commandGuide')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => engineRef.current?.reset()}
                disabled={compiling}
                className={cn(
                  'h-8 px-2.5 text-xs sm:text-sm font-bold',
                  isCyber && 'border-sky-500/30 bg-slate-800 text-sky-200 hover:border-sky-400',
                  isEsports && 'border-violet-500/30 bg-slate-900 text-slate-200',
                  isArcade && 'border-pink-400/30 bg-indigo-900 text-pink-200',
                )}
                title={t('game:resetScene')}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden xl:inline">{t('game:resetScene')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetSignal((n) => n + 1)}
                disabled={compiling}
                className={cn(
                  'h-8 px-2.5 text-xs sm:text-sm font-bold',
                  isCyber && 'border-sky-500/30 bg-slate-800 text-sky-200 hover:border-sky-400',
                  isEsports && 'border-violet-500/30 bg-slate-900 text-slate-200',
                  isArcade && 'border-pink-400/30 bg-indigo-900 text-pink-200',
                )}
                title={t('game:resetWorkspace')}
              >
                <span className="hidden xl:inline">{t('game:resetWorkspace')}</span>
                <span className="xl:hidden">Reset</span>
              </Button>
              <Button
                variant="success"
                onClick={() => void handleCompile()}
                disabled={compiling}
                data-testid="compile-btn"
                className={cn(
                  'h-9 px-5 sm:px-6 text-sm sm:text-base font-black tracking-wide shadow-md transition-all cursor-pointer',
                  isCyber && 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 hover:from-emerald-300 hover:to-cyan-300 shadow-[0_0_15px_rgba(52,211,153,0.4)]',
                  isEsports && 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-md',
                  isArcade && 'bg-gradient-to-r from-pink-500 via-purple-500 to-amber-400 text-white shadow-md',
                )}
              >
                {compiling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                {compiling ? t('game:compiling') : t('game:compile')}
              </Button>
            </div>
          </div>

          {/* Interactive 4-Step Gameplay Guide Strip */}
          <div
            className={cn(
              'flex items-center justify-between gap-1.5 rounded-xl border px-3 py-1.5 shadow-2xs shrink-0 transition-colors',
              isCyber && 'border-sky-500/35 bg-gradient-to-r from-slate-900 via-sky-950/50 to-slate-900 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.15)]',
              isEsports && 'border-amber-500/30 bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 text-amber-200',
              isAcademy && 'border-indigo-200 bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 text-slate-800',
              isArcade && 'border-pink-400/35 bg-gradient-to-r from-indigo-900 via-pink-950/50 to-indigo-900 text-pink-200',
            )}
            data-testid="step-by-step-guide-bar"
          >
            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-extrabold overflow-x-auto">
              <button
                type="button"
                onClick={() => setShowHowToPlay(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 transition-all cursor-pointer whitespace-nowrap',
                  blocksUsed === 0
                    ? isCyber ? 'bg-sky-500 text-slate-950 font-black shadow-xs' : 'bg-indigo-600 text-white shadow-xs'
                    : isDark ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800' : 'bg-white/80 text-slate-700 hover:bg-white',
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-[10px] font-black text-slate-950">
                  1
                </span>
                <span>{lang === 'th' ? 'วางแผนดูแผนที่' : 'Plan on Map'}</span>
              </button>
              <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>➔</span>
              <button
                type="button"
                onClick={() => setShowHowToPlay(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 transition-all cursor-pointer whitespace-nowrap',
                  blocksUsed === 0
                    ? isCyber ? 'bg-cyan-400 text-slate-950 font-black shadow-xs animate-pulse' : 'bg-sky-600 text-white shadow-xs animate-pulse'
                    : isDark ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800' : 'bg-white/80 text-slate-700 hover:bg-white',
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-[10px] font-black text-slate-950">
                  2
                </span>
                <span>{lang === 'th' ? 'เปิดถาดคำสั่งซ้ายมือ' : 'Open Block Tray'}</span>
              </button>
              <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>➔</span>
              <button
                type="button"
                onClick={() => setShowHowToPlay(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 transition-all cursor-pointer whitespace-nowrap',
                  blocksUsed > 0 && !overBlockLimit
                    ? isCyber ? 'bg-sky-500 text-slate-950 font-black shadow-xs' : 'bg-indigo-600 text-white shadow-xs'
                    : isDark ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800' : 'bg-white/80 text-slate-700 hover:bg-white',
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-[10px] font-black text-slate-950">
                  3
                </span>
                <span>{lang === 'th' ? 'ลากบล็อกมาเรียงต่อกัน' : 'Drag & Snap Blocks'}</span>
              </button>
              <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>➔</span>
              <button
                type="button"
                onClick={() => setShowHowToPlay(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 transition-all cursor-pointer whitespace-nowrap',
                  blocksUsed > 0 && !overBlockLimit
                    ? isCyber ? 'bg-emerald-400 text-slate-950 font-black shadow-xs animate-pulse' : 'bg-emerald-600 text-white shadow-xs animate-pulse'
                    : isDark ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800' : 'bg-white/80 text-slate-700 hover:bg-white',
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-[10px] font-black text-slate-950">
                  4
                </span>
                <span>{lang === 'th' ? 'กดปุ่ม COMPILE' : 'Press COMPILE'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowHowToPlay(true)}
              className={cn(
                'text-xs font-extrabold underline cursor-pointer shrink-0 hidden sm:inline',
                isCyber ? 'text-sky-300 hover:text-sky-200' : isEsports ? 'text-amber-300 hover:text-amber-200' : isArcade ? 'text-pink-300 hover:text-pink-200' : 'text-indigo-700 hover:text-indigo-900',
              )}
            >
              {lang === 'th' ? 'ดูภาพตัวอย่างวิธีเล่น →' : 'See Visual Guide →'}
            </button>
          </div>

          <div
            className={cn(
              'rounded-xl border shadow-xs overflow-hidden transition-colors',
              isCyber && 'border-sky-500/25 bg-slate-900 shadow-[0_0_15px_rgba(56,189,248,0.1)]',
              isEsports && 'border-violet-500/30 bg-slate-900 shadow-md',
              isAcademy && 'border-slate-200 bg-white shadow-xs',
              isArcade && 'border-2 border-pink-400/30 bg-indigo-950 shadow-md',
              isFullscreen ? 'flex-1 min-h-0 h-full' : 'rounded-2xl flex-1 min-h-[420px]',
            )}
          >
            <BlocklyEditor
              workspaceKey={`${playerSession.id}:${level.id}`}
              blocks={config.blocks}
              allowedCommands={allEnabledCommands}
              lang={lang}
              fallbackLang={fallbackLang}
              initialState={savedInitialState}
              highlightedBlockId={highlightedBlockId}
              readOnly={compiling}
              onChange={handleWorkspaceChange}
              resetSignal={resetSignal}
            />
          </div>
        </div>
      </main>

      {/* How to Play 4-Step Visual Guide Modal */}
      <HowToPlayGuideModal
        open={showHowToPlay}
        onOpenChange={setShowHowToPlay}
        lang={lang}
      />

      {/* Level Selector Modal */}
      <LevelMap
        open={showMap}
        onOpenChange={setShowMap}
        config={config}
        progress={progress}
        totalScore={playerSession.total_score}
        selectedLevelId={level.id}
        fallbackLang={fallbackLang}
        onSelectLevel={(id) => void selectLevel(id)}
      />

      {/* Command Reference Modal (shows all enabled blocks) */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('game:commandGuide')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.blocks
              .filter((b) => b.enabled)
              .map((b) => (
                <div key={b.command_type} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="font-bold text-slate-900">
                      {pickLocalized(b.label, lang, fallbackLang)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {pickLocalized(b.description, lang, fallbackLang)}
                  </p>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mission Complete Modal (with Real Code Viewer) */}
      <Dialog open={Boolean(victoryModal)} onOpenChange={(o) => !o && setVictoryModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Sparkles className="h-6 w-6 text-amber-500" />
              {t('game:feedback.successTitle')}
            </DialogTitle>
          </DialogHeader>

          {victoryModal && (
            <div className="space-y-4">
              {victoryModal.alreadyCompleted ? (
                <p className="text-sm font-medium text-slate-600">{t('game:feedback.alreadyCleared')}</p>
              ) : (
                victoryModal.breakdown && (
                  <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm border border-slate-200">
                    <Row
                      label={t('game:feedback.scoreBreakdown.base')}
                      val={`+${victoryModal.breakdown.base}`}
                    />
                    {victoryModal.breakdown.no_hint_bonus > 0 && (
                      <Row
                        label={t('game:feedback.scoreBreakdown.noHint')}
                        val={`+${victoryModal.breakdown.no_hint_bonus}`}
                      />
                    )}
                    {victoryModal.breakdown.no_error_bonus > 0 && (
                      <Row
                        label={t('game:feedback.scoreBreakdown.noError')}
                        val={`+${victoryModal.breakdown.no_error_bonus}`}
                      />
                    )}
                    <Row
                      label={t('game:feedback.scoreBreakdown.time')}
                      val={`+${victoryModal.breakdown.time_bonus}`}
                    />
                    {victoryModal.breakdown.hint_penalty > 0 && (
                      <Row
                        label={t('game:feedback.scoreBreakdown.hintPenalty')}
                        val={`-${victoryModal.breakdown.hint_penalty}`}
                        danger
                      />
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-extrabold text-base text-indigo-700">
                      <span>{t('game:feedback.scoreBreakdown.total')}</span>
                      <span>+{victoryModal.scoreAwarded}</span>
                    </div>
                  </div>
                )
              )}

              {/* Real Code Showcase in Victory Modal */}
              <div
                className="rounded-2xl border border-indigo-200 bg-slate-900 p-4 text-white space-y-3"
                data-testid="real-code-viewer"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-sky-400" />
                    <span className="text-sm font-extrabold text-sky-300">
                      {t('game:realCode.title')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {codeSamples.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => setActiveCodeLang(sample.id)}
                        data-testid={`code-tab-${sample.id}`}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                          activeCodeLang === sample.id
                            ? 'bg-sky-500 text-slate-950 shadow-xs'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {sample.badge}
                      </button>
                    ))}
                  </div>
                </div>

                {activeSample && (
                  <>
                    <p className="text-xs text-slate-300">
                      {activeSample.description[lang] ?? activeSample.description.en}
                    </p>
                    <div className="relative">
                      <pre className="max-h-48 overflow-auto rounded-xl bg-slate-950 p-3.5 font-mono text-xs leading-relaxed text-emerald-300 border border-slate-800">
                        <code>{activeSample.code}</code>
                      </pre>
                      <button
                        type="button"
                        onClick={() => void handleCopyCode(activeSample.code, activeSample.id)}
                        className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-slate-800/90 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        {copiedLang === activeSample.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            {t('game:realCode.copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            {t('game:realCode.copy')}
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCodeModal(true);
                  }}
                >
                  <Code2 className="h-4 w-4 text-indigo-600" />
                  {t('game:realCode.viewAllBtn')}
                </Button>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setVictoryModal(null)}>
                    {t('common:app.close')}
                  </Button>
                  {nextLevel && !victoryModal.finished ? (
                    <Button
                      variant="success"
                      onClick={() => {
                        setVictoryModal(null);
                        void selectLevel(nextLevel.id);
                      }}
                    >
                      {t('game:feedback.nextLevel')}
                    </Button>
                  ) : (
                    <Button
                      variant="success"
                      onClick={() => {
                        setVictoryModal(null);
                        void finishGame();
                      }}
                    >
                      {t('game:feedback.finishAdventure')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Standalone Full Real Code Comparison Modal */}
      <Dialog open={showCodeModal} onOpenChange={setShowCodeModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <Code2 className="h-6 w-6 text-indigo-600" />
              {t('game:realCode.title')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">{t('game:realCode.subtitle')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {codeSamples.map((s) => (
              <div
                key={s.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 text-white"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sky-300">{s.badge}</span>
                    <button
                      type="button"
                      onClick={() => void handleCopyCode(s.code, s.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      {copiedLang === s.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          {t('game:realCode.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          {t('game:realCode.copy')}
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300">{s.description[lang] ?? s.description.en}</p>
                  <pre className="overflow-x-auto rounded-xl bg-slate-950 p-3 font-mono text-xs leading-relaxed text-emerald-300 border border-slate-800">
                    <code>{s.code}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setShowCodeModal(false)}>
              {t('common:app.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Out of Hearts (Game Over) Modal */}
      <Dialog
        open={showGameOverModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowGameOverModal(false);
            void refreshState();
          }
        }}
      >
        <DialogContent className="border-4 border-rose-600 bg-white max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600 animate-bounce">
            <HeartCrack className="h-12 w-12" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-black text-rose-600">
              {t('player:workspace.gameOverTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-base font-semibold text-slate-700">
            {t('player:workspace.gameOverDesc')}
          </p>
          <div className="flex justify-center gap-1.5 py-2">
            {Array.from({ length: MAX_HEARTS }).map((_, idx) => (
              <Heart key={idx} className="h-7 w-7 fill-slate-300 text-slate-300" />
            ))}
          </div>
          <div className="flex flex-col gap-2.5 pt-2">
            <Button
              variant="destructive"
              size="lg"
              className="w-full font-extrabold text-base py-5 cursor-pointer shadow-md"
              onClick={() => {
                setShowGameOverModal(false);
                void refreshState();
              }}
              data-testid="game-over-results-btn"
            >
              {t('player:workspace.gameOverBtn')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full font-bold text-base py-5 border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
              onClick={() => {
                setShowGameOverModal(false);
                void resetToHome();
              }}
              data-testid="game-over-restart-btn"
            >
              <RotateCcw className="h-4 w-4 text-indigo-600 mr-2" />
              {lang === 'th' ? 'ขอแก้ตัวใหม่ (เริ่มรอบใหม่)' : 'Try Again (Restart Game)'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BIG RED WARNING: Early Finish Confirmation */}
      <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <DialogContent
          className="border-4 border-rose-600 bg-white p-0 overflow-hidden max-w-lg shadow-2xl"
          data-testid="finish-warning-dialog"
        >
          <div className="bg-rose-600 px-6 py-5 text-white flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 animate-pulse">
              <AlertTriangle className="h-9 w-9 text-white" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-rose-900/60 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-rose-100">
                ⚠️ {t('player:workspace.finishWarningBadge')}
              </span>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-white mt-0.5">
                  {t('player:workspace.finishConfirmTitle')}
                </DialogTitle>
              </DialogHeader>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-4 text-center space-y-2">
              <p className="text-xl font-black text-rose-700">
                {t('player:workspace.finishWarningHeadline')}
              </p>
              <p className="text-sm font-bold text-rose-900 leading-relaxed">
                {t('player:workspace.finishConfirmDesc')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="lg"
                className="font-bold"
                onClick={() => setShowFinishConfirm(false)}
              >
                {t('common:app.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="bg-rose-600 hover:bg-rose-700 font-black text-base px-6 shadow-lg"
                onClick={() => {
                  setShowFinishConfirm(false);
                  void finishGame();
                }}
              >
                <AlertTriangle className="h-5 w-5" />
                {t('player:workspace.finishConfirmBtn')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Back to Home Confirmation */}
      <Dialog open={showHomeConfirm} onOpenChange={setShowHomeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-indigo-600" />
              {t('player:workspace.homeConfirmTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">{t('player:workspace.homeConfirmDesc')}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowHomeConfirm(false)}>
              {t('common:app.cancel')}
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setShowHomeConfirm(false);
                void resetToHome();
              }}
            >
              {t('common:app.backToHome')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, val, danger = false }: { label: string; val: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`font-bold ${danger ? 'text-rose-600' : 'text-emerald-700'}`}>{val}</span>
    </div>
  );
}
