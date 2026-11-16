import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Home, Play, Rocket, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Command, CommandType } from '@engine';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FullscreenButton } from '@/components/common/FullscreenButton';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { MarkdownText } from '@/components/common/MarkdownText';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import { localizedBlockLabel } from '@/blockly/toolbox/buildToolbox';
import { useAppStore } from '@/stores/appStore';
import { usePlayerStore } from '@/stores/playerStore';
import { currentLang } from '@/i18n/config';
import { pickLocalized } from '@/utils/localize';
import { toast } from '@/stores/toastStore';

function flattenDemoSteps(cmds: Command[]): { type: CommandType; param?: number }[] {
  const out: { type: CommandType; param?: number }[] = [];
  for (const c of cmds) {
    if (c.type === 'REPEAT' && c.body) {
      const times = c.times ?? 2;
      for (let i = 0; i < times; i++) out.push(...flattenDemoSteps(c.body));
    } else {
      out.push({ type: c.type, param: c.steps ?? c.seconds ?? c.times });
    }
  }
  return out;
}

export function LessonsView({ reviewMode = false }: { reviewMode?: boolean }) {
  const { t } = useTranslation(['player', 'common']);
  const lang = currentLang();
  const settings = useAppStore((s) => s.settings);
  const config = usePlayerStore((s) => s.config);
  const lessonsDone = usePlayerStore((s) => s.lessonsDone);
  const completeLesson = usePlayerStore((s) => s.completeLesson);
  const markLessonsStarted = usePlayerStore((s) => s.markLessonsStarted);
  const startGame = usePlayerStore((s) => s.startGame);
  const setShowLessonReview = usePlayerStore((s) => s.setShowLessonReview);
  const resetToHome = usePlayerStore((s) => s.resetToHome);

  const lessons = useMemo(
    () => [...(config?.lessons ?? [])].sort((a, b) => a.position - b.position),
    [config?.lessons],
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [demoStep, setDemoStep] = useState<{ lessonId: string; step: number }>({
    lessonId: '',
    step: -1,
  });
  const [demoRobot, setDemoRobot] = useState<{ lessonId: string; state: RobotVisualState }>({
    lessonId: '',
    state: 'idle',
  });

  useEffect(() => {
    if (!reviewMode) {
      void markLessonsStarted().catch(() => {});
    }
  }, [reviewMode, markLessonsStarted]);

  const lesson = lessons[index];
  const fallback = settings?.default_language ?? 'en';
  const defaultRobot = config?.robots.find((r) => r.is_default) ?? config?.robots[0] ?? null;

  const isCurrentDone = lesson ? lessonsDone.includes(lesson.id) : false;
  const allLessonsCompleted = lessons.every((l) => lessonsDone.includes(l.id));
  const canSkip = Boolean(config?.settings.allow_skip_lessons || !config?.settings.lessons_mandatory);
  const progressPct = lessons.length > 0 ? Math.round((lessonsDone.length / lessons.length) * 100) : 100;

  const flatDemo = useMemo(
    () => (lesson?.demo_program ? flattenDemoSteps(lesson.demo_program) : []),
    [lesson],
  );

  const activeDemoStep = lesson && demoStep.lessonId === lesson.id ? demoStep.step : -1;
  const activeDemoRobotState: RobotVisualState =
    lesson && demoRobot.lessonId === lesson.id ? demoRobot.state : 'idle';

  const runDemo = async () => {
    if (!lesson || flatDemo.length === 0) return;
    const lid = lesson.id;
    for (let i = 0; i < flatDemo.length; i++) {
      setDemoStep({ lessonId: lid, step: i });
      const cmd = flatDemo[i].type;
      if (cmd === 'MOVE_FORWARD' || cmd === 'MOVE_BACKWARD') setDemoRobot({ lessonId: lid, state: 'walk' });
      else if (cmd === 'JUMP') setDemoRobot({ lessonId: lid, state: 'jump' });
      else if (cmd === 'WAVE' || cmd === 'PICK_UP' || cmd === 'ACTIVATE')
        setDemoRobot({ lessonId: lid, state: 'wave' });
      else if (cmd === 'CELEBRATE') setDemoRobot({ lessonId: lid, state: 'celebrate' });
      else if (cmd === 'TURN_LEFT' || cmd === 'TURN_RIGHT') setDemoRobot({ lessonId: lid, state: 'turn' });
      else setDemoRobot({ lessonId: lid, state: 'idle' });
      await new Promise((r) => setTimeout(r, 650));
    }
    setDemoStep({ lessonId: lid, step: -1 });
    setDemoRobot({ lessonId: lid, state: 'celebrate' });
    setTimeout(() => setDemoRobot({ lessonId: lid, state: 'idle' }), 900);
  };

  const handleNextOrDone = async () => {
    if (!lesson || busy) return;
    setBusy(true);
    try {
      if (!isCurrentDone) {
        await completeLesson(lesson.id);
      }
      if (index < lessons.length - 1) {
        setIndex((i) => i + 1);
      } else if (reviewMode) {
        setShowLessonReview(false);
      } else {
        await startGame(false);
      }
    } catch (e) {
      toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleStartAdventure = async (skip = false) => {
    if (busy) return;
    setBusy(true);
    try {
      if (lesson && !skip && !isCurrentDone) {
        await completeLesson(lesson.id);
      }
      await startGame(skip);
    } catch (e) {
      toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
      setBusy(false);
    }
  };

  if (!lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <Button size="lg" onClick={() => void handleStartAdventure(true)}>
          <Rocket className="h-5 w-5" />
          {t('player:lessons.startAdventure')}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900">{t('player:lessons.header')}</h1>
              <p className="text-xs font-medium text-slate-500">
                {t('player:lessons.step', { current: index + 1, total: lessons.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reviewMode ? (
              <Button variant="outline" size="sm" onClick={() => setShowLessonReview(false)}>
                {t('common:app.back')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void resetToHome()}>
                <Home className="h-4 w-4 text-indigo-600" />
                {t('common:app.home')}
              </Button>
            )}
            {!reviewMode && canSkip && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void handleStartAdventure(true)}
              >
                {t('player:lessons.skipAll')}
              </Button>
            )}
            <FullscreenButton />
            <LanguageSwitcher />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <Progress value={progressPct} className="h-2.5" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {/* Step dots */}
        <div className="flex flex-wrap items-center gap-2">
          {lessons.map((l, i) => {
            const done = lessonsDone.includes(l.id);
            const active = i === index;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  if (done || i <= lessonsDone.length || reviewMode || canSkip) setIndex(i);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : done
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Lesson content */}
          <Card className="lg:col-span-7">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={isCurrentDone ? 'success' : 'default'}>
                  {isCurrentDone
                    ? t('player:lessons.completed')
                    : t('player:lessons.step', { current: index + 1, total: lessons.length })}
                </Badge>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                {pickLocalized(lesson.title, lang, fallback)}
              </h2>
              <p className="text-sm font-semibold text-indigo-700">
                {pickLocalized(lesson.summary, lang, fallback)}
              </p>

              {lesson.image_url && (
                <img
                  src={lesson.image_url}
                  alt={pickLocalized(lesson.title, lang, fallback)}
                  className="max-h-60 w-full rounded-2xl border border-slate-200 object-cover"
                />
              )}

              {lesson.video_url && /^https?:\/\//i.test(lesson.video_url) && (
                <a
                  href={lesson.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <Play className="h-4 w-4" />
                  {lesson.video_url}
                </a>
              )}

              <MarkdownText text={pickLocalized(lesson.body, lang, fallback)} />
            </CardContent>
          </Card>

          {/* Interactive block demonstration */}
          <Card className="lg:col-span-5 bg-slate-900 text-white border-slate-800">
            <CardContent className="flex h-full flex-col justify-between space-y-5 p-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-300">
                  <Sparkles className="h-4 w-4" />
                  {t('player:lessons.demoTitle')}
                </div>

                <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-slate-950/70 p-6 border border-slate-800">
                  <RobotIllustration robot={defaultRobot} state={activeDemoRobotState} size={112} />
                </div>

                {lesson.demo_program && lesson.demo_program.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {lesson.demo_program.map((cmd, ci) => (
                        <div
                          key={ci}
                          className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-100"
                        >
                          {localizedBlockLabel(config?.blocks ?? [], cmd.type, lang, fallback)}
                          {cmd.steps ? ` (${cmd.steps})` : ''}
                          {cmd.times ? ` ×${cmd.times}` : ''}
                          {cmd.body
                            ? ` [ ${cmd.body
                                .map((b) => localizedBlockLabel(config?.blocks ?? [], b.type, lang, fallback))
                                .join(' → ')} ]`
                            : ''}
                        </div>
                      ))}
                    </div>

                    {activeDemoStep >= 0 && flatDemo[activeDemoStep] && (
                      <p className="text-xs font-semibold text-amber-300">
                        ▶{' '}
                        {localizedBlockLabel(
                          config?.blocks ?? [],
                          flatDemo[activeDemoStep].type,
                          lang,
                          fallback,
                        )}
                      </p>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => void runDemo()}
                    >
                      <Play className="h-4 w-4" />
                      {t('player:lessons.runDemo')}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-slate-800/60 p-3.5 text-sm text-slate-300">
                    {t('player:lessons.noDemo')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0 || busy}
                  className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('common:app.previous')}
                </Button>

                {index < lessons.length - 1 ? (
                  <Button onClick={() => void handleNextOrDone()} disabled={busy} data-testid="lesson-next">
                    {t('player:lessons.markDone')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : reviewMode ? (
                  <Button variant="success" onClick={() => setShowLessonReview(false)}>
                    {t('common:app.back')}
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    disabled={busy}
                    onClick={() => void handleStartAdventure(false)}
                    data-testid="start-adventure"
                  >
                    <Rocket className="h-4 w-4" />
                    {busy ? t('player:lessons.starting') : t('player:lessons.startAdventure')}
                  </Button>
                )}
              </div>

              {!reviewMode && allLessonsCompleted && index < lessons.length - 1 && (
                <Button
                  variant="success"
                  disabled={busy}
                  onClick={() => void handleStartAdventure(false)}
                  className="w-full"
                >
                  <Rocket className="h-4 w-4" />
                  {t('player:lessons.startAdventure')}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
