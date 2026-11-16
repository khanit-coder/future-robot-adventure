import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
  Map as MapIcon,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Flag,
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
import { localizedBlockLabel } from '@/blockly/toolbox/buildToolbox';
import { PhaserViewport } from '@/game-engine/PhaserViewport';
import type { RobotGameEngine } from '@/game-engine/RobotGameEngine';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
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
  const setShowLessonReview = usePlayerStore((s) => s.setShowLessonReview);

  const fallbackLang = settings?.default_language ?? 'en';
  const levelProgress = useMemo(() => progress.find((p) => p.level_id === level.id), [progress, level.id]);

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
  const [victoryModal, setVictoryModal] = useState<{
    scoreAwarded: number;
    breakdown: ScoreBreakdown | null;
    alreadyCompleted: boolean;
    finished: boolean;
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

    // Quick local validation before hitting the server so empty/oversized clicks give instant friendly feedback.
    const localCheck = parseProgram(commands, level.mission.rules, limitsFromBlocks(config.blocks));
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

      await refreshState();

      if (execResult.success) {
        setVictoryModal({
          scoreAwarded: res.score?.awarded ?? 0,
          breakdown: res.score?.breakdown ?? null,
          alreadyCompleted: Boolean(res.already_completed),
          finished: Boolean(res.finished),
        });
      } else if (execResult.failure) {
        setFeedbackError(t(`game:feedback.failures.${execResult.failure.code}`));
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

  if (!level) return null;

  const blocksUsed = countBlocks(commands);
  const overBlockLimit = blocksUsed > level.mission.rules.max_blocks;
  const announcementText = settings?.announcement
    ? pickLocalized(settings.announcement, lang, fallbackLang)
    : '';

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Announcement bar */}
      {announcementText && (
        <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-slate-950">
          📢 {announcementText}
        </div>
      )}

      {/* Top HUD */}
      <header className="border-b border-slate-200 bg-white px-4 py-2.5 shadow-xs">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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

            <Button variant="ghost" size="sm" onClick={() => setShowFinishConfirm(true)}>
              <Flag className="h-4 w-4" />
              {t('player:workspace.finishGame')}
            </Button>

            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {latestVersion && latestVersion > config.version && (
        <div className="bg-indigo-50 px-4 py-1 text-center text-xs font-medium text-indigo-800 border-b border-indigo-100">
          {t('player:workspace.newConfigBanner', { version: config.version })}
        </div>
      )}

      {/* Main Split Workspace */}
      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 lg:grid-cols-12">
        {/* Left: Phaser Stage + Mission Info + Hints */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="relative h-[320px] sm:h-[360px] rounded-2xl overflow-hidden shadow-md">
            <PhaserViewport
              mission={level.mission}
              robot={robotCfg}
              scene={sceneCfg}
              completionAnimation={level.completion_animation}
              onEngineReady={(eng) => {
                engineRef.current = eng;
              }}
            />
          </div>

          <Card>
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
        <div className="flex flex-col gap-3 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
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
                <Play className="h-5 w-5 fill-current" />
                {compiling ? t('game:compiling') : t('game:compile')}
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-[420px]">
            <BlocklyEditor
              workspaceKey={`${playerSession.id}:${level.id}`}
              blocks={config.blocks}
              allowedCommands={level.mission.rules.allowed_commands}
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

      {/* Command Reference Modal */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('game:commandGuide')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.blocks
              .filter((b) => b.enabled && level.mission.rules.allowed_commands.includes(b.command_type))
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

      {/* Mission Complete Modal */}
      <Dialog open={Boolean(victoryModal)} onOpenChange={(o) => !o && setVictoryModal(null)}>
        <DialogContent>
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

              <div className="flex flex-wrap justify-end gap-2">
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
          )}
        </DialogContent>
      </Dialog>

      {/* Early Finish Confirmation */}
      <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('player:workspace.finishConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">{t('player:workspace.finishConfirmDesc')}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowFinishConfirm(false)}>
              {t('common:app.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowFinishConfirm(false);
                void finishGame();
              }}
            >
              {t('player:workspace.finishConfirmBtn')}
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
