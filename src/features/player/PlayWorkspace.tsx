import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Code2,
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
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SoundToggle } from '@/components/common/SoundToggle';
import { useFullscreen } from '@/hooks/useFullscreen';
import { sfx } from '@/services/audio/soundEffects';
import { cn } from '@/utils/cn';
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
import { LevelMap } from './LevelMap';

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

  const robotCfg = useMemo(
    () =>
      config.robots.find((r) => r.id === level.robot_id) ??
      config.robots.find((r) => r.is_default) ??
      config.robots[0] ??
      null,
    [config.robots, level.robot_id],
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
        'flex flex-col bg-slate-100',
        isFullscreen ? 'h-screen overflow-hidden' : 'min-h-screen',
      )}
    >
      {/* Announcement bar */}
      {announcementText && (
        <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-slate-950 shrink-0">
          📢 {announcementText}
        </div>
      )}

      {/* Top HUD */}
      <header
        className={cn(
          'border-b border-slate-200 bg-white shadow-xs shrink-0',
          isFullscreen ? 'px-4 py-1.5' : 'px-4 py-2.5',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3',
            isFullscreen ? 'w-full' : 'mx-auto max-w-[1600px]',
          )}
        >
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHomeConfirm(true)}
              data-testid="workspace-home-btn"
              title={t('common:app.backToHome')}
            >
              <Home className="h-4 w-4 text-indigo-600" />
              <span className="hidden sm:inline">{t('common:app.home')}</span>
            </Button>

            {settings?.game_logo_url ? (
              <img src={settings.game_logo_url} alt="" className="h-9 w-9 rounded-lg object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-extrabold">
                🤖
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900">{player.display_name}</span>
                <Badge variant="secondary">{player.school}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                {settings ? pickLocalized(settings.game_title, lang, fallbackLang) : t('common:app.title')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 5 Hearts Indicator */}
            <div
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm font-extrabold ${
                heartsRemaining <= 1
                  ? 'border-rose-400 bg-rose-50 text-rose-700 animate-pulse'
                  : 'border-rose-200 bg-rose-50/70 text-rose-800'
              }`}
              data-testid="player-hearts"
              title={t('player:workspace.heartsLabel', { count: heartsRemaining, max: MAX_HEARTS })}
            >
              {Array.from({ length: MAX_HEARTS }).map((_, idx) => (
                <Heart
                  key={idx}
                  className={`h-4 w-4 transition-transform ${
                    idx < heartsRemaining
                      ? 'fill-rose-500 text-rose-500 scale-100'
                      : 'fill-slate-300 text-slate-300 scale-90'
                  }`}
                />
              ))}
              <span className="ml-1 text-xs font-black">
                {heartsRemaining}/{MAX_HEARTS}
              </span>
            </div>

            {/* Timer */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-extrabold ${
                secondsLeft !== null && secondsLeft <= 120
                  ? 'border-rose-300 bg-rose-50 text-rose-700 animate-pulse'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
              data-testid="player-timer"
            >
              <Clock className="h-4 w-4 text-indigo-600" />
              {secondsLeft === null ? t('player:workspace.unlimitedTime') : formatDuration(secondsLeft)}
            </div>

            {/* Score */}
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-extrabold text-amber-900">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span data-testid="player-score">{playerSession.total_score}</span>
            </div>

            {/* Progress */}
            <Button variant="outline" size="sm" onClick={() => setShowMap(true)}>
              <MapIcon className="h-4 w-4 text-indigo-600" />
              {t('player:workspace.levelMapBtn')} ({playerSession.levels_completed}/{config.levels.length})
            </Button>

            {config.lessons.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowLessonReview(true)}>
                <BookOpen className="h-4 w-4 text-sky-600" />
                {t('player:workspace.lessonsBtn')}
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowFinishConfirm(true)}
              data-testid="finish-game-btn"
            >
              <Flag className="h-4 w-4" />
              {t('player:workspace.finishGame')}
            </Button>

            <SoundToggle />
            <FullscreenButton />
            <LanguageSwitcher />
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
          'mx-auto grid w-full flex-1 gap-4 lg:grid-cols-12',
          isFullscreen
            ? 'h-full min-h-0 max-w-none px-4 py-2 overflow-hidden'
            : 'max-w-[1600px] p-4',
        )}
      >
        {/* Left: Phaser Stage + Mission Info + Hints */}
        <div
          className={cn(
            'flex flex-col lg:col-span-5',
            isFullscreen ? 'h-full min-h-0 overflow-y-auto pr-1 gap-3' : 'gap-4',
          )}
        >
          <div
            className={cn(
              'relative rounded-2xl overflow-hidden shadow-md shrink-0',
              isFullscreen ? 'h-[36vh] min-h-[220px] max-h-[380px]' : 'h-[320px] sm:h-[360px]',
            )}
          >
            <PhaserViewport
              mission={level.mission}
              robot={robotCfg}
              scene={sceneCfg}
              completionAnimation={level.completion_animation}
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

          <Card className={cn(isFullscreen && 'flex-1 min-h-0 overflow-y-auto')}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge>{t('game:level', { n: level.position })}</Badge>
                    {levelProgress?.status === 'COMPLETED' && (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('game:status.completed')} ({levelProgress.score})
                      </Badge>
                    )}
                  </div>
                  <h2 className="mt-1.5 text-xl font-extrabold text-slate-900">
                    {pickLocalized(level.title, lang, fallbackLang, level.code)}
                  </h2>
                </div>

                {levelProgress?.status === 'COMPLETED' && commands.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setShowCodeModal(true)}>
                    <Code2 className="h-4 w-4 text-indigo-600" />
                    {t('game:realCode.viewBtn')}
                  </Button>
                )}
              </div>

              <p className="text-sm text-slate-600">{pickLocalized(level.description, lang, fallbackLang)}</p>

              {/* Objectives checklist */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('game:objectives')}
                </p>
                <div className="space-y-1.5">
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
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${done ? 'text-emerald-600' : 'text-slate-300'}`}
                        />
                        <span className={done ? 'font-semibold text-emerald-800' : 'text-slate-700'}>
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
                  className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-800"
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                  <span>{feedbackError}</span>
                </div>
              )}

              {/* Hints */}
              {hintsTotal > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                      <Lightbulb className="h-4 w-4 text-amber-600" />
                      {t('game:hints')} ({hintsUsed}/{hintsTotal})
                    </span>
                    {hintsUsed < hintsTotal ? (
                      <Button variant="secondary" size="sm" onClick={() => void handleRevealHint()}>
                        {levelProgress?.status === 'COMPLETED'
                          ? t('game:revealHintFree')
                          : t('game:revealHint', { penalty: config.settings.score_rules.hint_penalty })}
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700">{t('game:noHintsLeft')}</span>
                    )}
                  </div>
                  {hints.length > 0 ? (
                    <ul className="space-y-1.5 text-sm text-amber-950">
                      {hints.map((h, i) => (
                        <li key={i} className="rounded-lg bg-white/80 px-3 py-2 border border-amber-200/80">
                          💡 {pickLocalized(h, lang, fallbackLang)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-amber-800">
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
            'flex flex-col lg:col-span-7',
            isFullscreen ? 'h-full min-h-0 gap-2' : 'gap-3',
          )}
        >
          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white shadow-xs shrink-0',
              isFullscreen ? 'px-4 py-2' : 'px-4 py-3',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={overBlockLimit ? 'danger' : 'info'}>
                {t('game:blocksUsed', { used: blocksUsed, max: level.mission.rules.max_blocks })}
              </Badge>
              {(level.mission.rules.required_commands ?? []).length > 0 && (
                <Badge variant="warning">
                  {t('game:requiredBlocks')}{' '}
                  {(level.mission.rules.required_commands ?? [])
                    .map((c) => localizedBlockLabel(config.blocks, c, lang, fallbackLang))
                    .join(', ')}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowGuide(true)}>
                <HelpCircle className="h-4 w-4" />
                {t('game:commandGuide')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => engineRef.current?.reset()}
                disabled={compiling}
              >
                <RotateCcw className="h-4 w-4" />
                {t('game:resetScene')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetSignal((n) => n + 1)}
                disabled={compiling}
              >
                {t('game:resetWorkspace')}
              </Button>
              <Button
                variant="success"
                size="lg"
                onClick={() => void handleCompile()}
                disabled={compiling}
                data-testid="compile-btn"
                className="px-7 font-extrabold tracking-wide shadow-md"
              >
                {compiling ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Play className="h-5 w-5 fill-current" />
                )}
                {compiling ? t('game:compiling') : t('game:compile')}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              'rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden',
              isFullscreen ? 'flex-1 min-h-0 h-full' : 'flex-1 min-h-[420px]',
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
