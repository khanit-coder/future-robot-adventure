import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Home, Play, Rocket, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FullscreenButton } from '@/components/common/FullscreenButton';
import { SettingsMenu } from '@/components/common/SettingsMenu';
import { useFullscreen } from '@/hooks/useFullscreen';
import { cn } from '@/utils/cn';
import { MarkdownText } from '@/components/common/MarkdownText';
import { RobotIllustration } from '@/components/common/RobotIllustration';
import { useGameTheme } from '@/features/player/useGameTheme';
import { InteractiveRobotDemo } from './InteractiveRobotDemo';
import { useAppStore } from '@/stores/appStore';
import { usePlayerStore } from '@/stores/playerStore';
import { currentLang } from '@/i18n/config';
import { pickLocalized } from '@/utils/localize';
import { toast } from '@/stores/toastStore';

export function LessonsView({ reviewMode = false }: { reviewMode?: boolean }) {
  const { t } = useTranslation(['player', 'common']);
  const lang = currentLang();
  const { isFullscreen } = useFullscreen();
  const { isCyber, isEsports, isAcademy, isArcade, isDark } = useGameTheme();
  const settings = useAppStore((s) => s.settings);
  const config = usePlayerStore((s) => s.config);
  const lessonsDone = usePlayerStore((s) => s.lessonsDone);
  const isReturningPlayer = usePlayerStore((s) => s.isReturningPlayer);
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
  const allowSkip = settings?.allow_skip_lessons ?? config?.settings.allow_skip_lessons ?? false;
  const lessonsMandatory = settings?.lessons_mandatory ?? config?.settings.lessons_mandatory ?? true;
  const canSkip = Boolean(isReturningPlayer || allowSkip || !lessonsMandatory);
  const progressPct = lessons.length > 0 ? Math.round((lessonsDone.length / lessons.length) * 100) : 100;

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
    <div
      className={cn(
        'flex flex-col transition-colors duration-300',
        isCyber && 'bg-slate-950 text-slate-100',
        isEsports && 'bg-slate-950 text-slate-100',
        isAcademy && 'bg-slate-50 text-slate-900',
        isArcade && 'bg-indigo-950 text-slate-100',
        isFullscreen ? 'h-screen max-h-screen overflow-hidden fra-lessons-workspace' : 'min-h-screen',
      )}
    >
      <header
        className={cn(
          'border-b shrink-0 transition-colors duration-300',
          isCyber && 'border-sky-500/25 bg-slate-900/95 text-white shadow-[0_4px_20px_rgba(56,189,248,0.1)]',
          isEsports && 'border-violet-500/30 bg-slate-900 text-white shadow-md',
          isAcademy && 'border-slate-200 bg-white text-slate-900 shadow-xs',
          isArcade && 'border-pink-400/40 bg-indigo-950 text-white shadow-md',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3',
            isFullscreen ? 'w-full max-w-[96vw] mx-auto px-4 py-2' : 'mx-auto max-w-6xl px-6 py-3',
          )}
        >
          <div className="flex items-center gap-2.5">
            {settings?.college_logo_url ? (
              <img
                src={settings.college_logo_url}
                alt="College Logo"
                className={cn(
                  'rounded-full object-contain overflow-hidden bg-transparent shrink-0',
                  isFullscreen ? 'h-9 w-9' : 'h-10 w-10',
                )}
              />
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl bg-indigo-600 text-white shrink-0',
                  isFullscreen ? 'h-9 w-9' : 'h-10 w-10',
                )}
              >
                <BookOpen className={isFullscreen ? 'h-4 w-4' : 'h-5 w-5'} />
              </div>
            )}
            <div>
              <h1
                className={cn(
                  'font-black text-sm sm:text-base',
                  isCyber && 'text-sky-200 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]',
                  isEsports && 'text-white font-black',
                  isAcademy && 'text-slate-900',
                  isArcade && 'text-amber-300',
                )}
              >
                {t('player:lessons.header')}
              </h1>
              <p
                className={cn(
                  'text-xs sm:text-sm font-semibold',
                  isCyber ? 'text-sky-400/80' : isEsports ? 'text-slate-400' : isArcade ? 'text-pink-300/80' : 'text-slate-500',
                )}
              >
                {t('player:lessons.step', { current: index + 1, total: lessons.length })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reviewMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLessonReview(false)}
                className={cn('h-9 text-xs sm:text-sm px-3.5', isDark && 'border-slate-700 bg-slate-800 text-slate-200')}
              >
                {t('common:app.back')}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void resetToHome()}
                className={cn('h-9 text-xs sm:text-sm px-3.5', isDark && 'border-slate-700 bg-slate-800 text-slate-200')}
              >
                <Home className={cn('h-4 w-4', isCyber ? 'text-sky-400' : isEsports ? 'text-amber-400' : isArcade ? 'text-pink-400' : 'text-indigo-600')} />
                <span className="hidden sm:inline">{t('common:app.home')}</span>
              </Button>
            )}
            {!reviewMode && canSkip && (
              <Button
                variant="success"
                size="sm"
                disabled={busy}
                onClick={() => void handleStartAdventure(true)}
                data-testid="skip-lessons-btn"
                className="font-extrabold shadow-sm h-9 text-xs sm:text-sm px-3.5"
              >
                <Rocket className="h-4 w-4" />
                <span>{lang === 'th' ? 'ข้ามเนื้อหาไปเล่นเกมเลย' : t('player:lessons.skipAll')}</span>
              </Button>
            )}
            <FullscreenButton dark={isDark} />
            <SettingsMenu dark={isDark} />
          </div>
        </div>
        <div
          className={cn(
            isFullscreen ? 'w-full max-w-[96vw] mx-auto px-4 pb-1.5' : 'mx-auto max-w-6xl px-6 pb-3',
          )}
        >
          <Progress value={progressPct} className={isFullscreen ? 'h-1.5' : 'h-2.5'} />
        </div>
      </header>

      <main
        className={cn(
          'flex flex-col',
          isFullscreen
            ? 'flex-1 min-h-0 w-full max-w-[96vw] mx-auto px-4 py-1.5 gap-2 overflow-hidden'
            : 'space-y-5 px-6 py-6 mx-auto max-w-6xl',
        )}
      >
        {/* Returning Student Quick-Skip Banner */}
        {!reviewMode && isReturningPlayer && (
          <div
            className={cn(
              'flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 shadow-2xs shrink-0',
              isFullscreen ? 'px-3 py-1' : 'px-4 py-2',
            )}
            data-testid="returning-player-skip-banner"
          >
            <div className="flex items-center gap-1.5 text-xs text-emerald-950 truncate">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] shrink-0">
                👋
              </span>
              <span className="font-extrabold truncate">
                {lang === 'th'
                  ? 'ยินดีต้อนรับกลับมา! คุณใช้ชื่อเดิม'
                  : 'Welcome back! Returning student detected'}
              </span>
              <span className="text-emerald-700 hidden sm:inline text-[11px]">
                {lang === 'th'
                  ? '— ข้ามบทเรียนและเริ่มเล่นเกมได้ทันที'
                  : '— skip lessons and jump straight to game'}
              </span>
            </div>
            <Button
              variant="success"
              size="sm"
              disabled={busy}
              onClick={() => void handleStartAdventure(true)}
              data-testid="returning-skip-btn"
              className={cn(
                'font-extrabold shadow-xs shrink-0 cursor-pointer',
                isFullscreen ? 'h-6 text-xs px-2.5' : 'h-7 text-xs px-3',
              )}
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>{lang === 'th' ? 'ข้ามเนื้อหา ไปเริ่มเล่นเกมเลย! ➔' : 'Skip Lessons & Play! ➔'}</span>
            </Button>
          </div>
        )}

        {/* Step dots */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
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
                className={cn(
                  'inline-flex items-center gap-1 rounded-full font-bold px-3 py-1 text-xs transition-all cursor-pointer',
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : done
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-slate-200 text-slate-600',
                )}
              >
                {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                {i + 1}
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            'grid w-full',
            isFullscreen
              ? 'grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden'
              : 'grid-cols-1 lg:grid-cols-12 gap-6',
          )}
        >
          {/* Lesson content */}
          <Card
            className={cn(
              'lg:col-span-6 xl:col-span-6 flex flex-col transition-colors',
              isCyber && 'border-sky-500/25 bg-slate-900/90 text-white shadow-[0_0_15px_rgba(56,189,248,0.1)]',
              isEsports && 'border-violet-500/30 bg-slate-900/90 text-white shadow-md',
              isAcademy && 'border-slate-200 bg-white text-slate-900',
              isArcade && 'border-2 border-pink-400/30 bg-indigo-900/80 text-white shadow-md',
              isFullscreen ? 'h-full min-h-0 overflow-hidden' : '',
            )}
          >
            <CardContent
              className={cn(
                'flex flex-col',
                isFullscreen ? 'p-4 sm:p-5 space-y-3 flex-1 min-h-0 overflow-y-auto' : 'space-y-4 p-6',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <Badge variant={isCurrentDone ? 'success' : 'default'} className="text-xs sm:text-sm font-bold py-1 px-3">
                  {isCurrentDone
                    ? t('player:lessons.completed')
                    : t('player:lessons.step', { current: index + 1, total: lessons.length })}
                </Badge>
              </div>
              <h2
                className={cn(
                  'shrink-0 text-2xl sm:text-3xl font-black',
                  isCyber ? 'text-sky-200 font-black drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]' : isEsports ? 'text-white font-black' : isArcade ? 'text-amber-300 font-black' : 'font-extrabold text-slate-900',
                )}
              >
                {pickLocalized(lesson.title, lang, fallback)}
              </h2>
              <p
                className={cn(
                  'shrink-0 text-base sm:text-lg font-bold',
                  isCyber ? 'text-sky-400' : isEsports ? 'text-amber-400' : isArcade ? 'text-pink-300' : 'text-indigo-700',
                )}
              >
                {pickLocalized(lesson.summary, lang, fallback)}
              </p>

              {lesson.image_url && (
                <img
                  src={lesson.image_url}
                  alt={pickLocalized(lesson.title, lang, fallback)}
                  className={cn(
                    'w-full rounded-xl border border-slate-200 object-cover shrink-0',
                    isFullscreen ? 'max-h-40' : 'max-h-60',
                  )}
                />
              )}

              {lesson.video_url && /^https?:\/\//i.test(lesson.video_url) && (
                <a
                  href={lesson.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 shrink-0"
                >
                  <Play className="h-4 w-4" />
                  {lesson.video_url}
                </a>
              )}

              <div className="prose prose-slate max-w-none text-slate-700 text-base sm:text-lg leading-relaxed">
                <MarkdownText
                  text={pickLocalized(lesson.body, lang, fallback)}
                  className="text-base sm:text-lg font-medium text-slate-800"
                />
              </div>
            </CardContent>
          </Card>

          {/* Interactive block demonstration */}
          <Card
            className={cn(
              'lg:col-span-6 xl:col-span-6 bg-slate-900 text-white border-slate-800 flex flex-col',
              isFullscreen ? 'h-full min-h-0 overflow-hidden' : '',
            )}
          >
            <CardContent
              className={cn(
                'flex h-full flex-col justify-between',
                isFullscreen ? 'p-3.5 sm:p-4 space-y-3 flex-1 min-h-0 overflow-hidden' : 'space-y-5 p-6',
              )}
            >
              <div className={cn('flex flex-col', isFullscreen ? 'flex-1 min-h-0 overflow-hidden' : '')}>
                <div className="flex items-center gap-2 text-sm sm:text-base font-black uppercase tracking-wider text-sky-300 shrink-0">
                  <Sparkles className="h-4 w-4" />
                  {t('player:lessons.demoTitle')}
                </div>

                {lesson.demo_program && lesson.demo_program.length > 0 ? (
                  <div className={cn('mt-2', isFullscreen ? 'flex-1 min-h-0 overflow-hidden flex flex-col' : 'mt-3')}>
                    <InteractiveRobotDemo
                      key={lesson.id}
                      demoProgram={lesson.demo_program}
                      lang={lang}
                      fallbackLang={fallback}
                      robotAsset={defaultRobot}
                      blocks={config?.blocks}
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-slate-950/70 p-6 border border-slate-800">
                    <RobotIllustration robot={defaultRobot} state="wave" size={72} />
                    <p className="mt-2 text-sm text-slate-400">{t('player:lessons.noDemo')}</p>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  'flex items-center justify-between gap-3 border-t border-slate-800 shrink-0 pt-3',
                )}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0 || busy}
                  className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700 cursor-pointer h-9 sm:h-10 px-3.5 sm:px-4 text-xs sm:text-sm font-bold flex items-center gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('common:app.previous')}
                </Button>

                {index < lessons.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => void handleNextOrDone()}
                    disabled={busy}
                    data-testid="lesson-next"
                    className="cursor-pointer font-black h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm flex items-center gap-1.5"
                  >
                    {t('player:lessons.markDone')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : reviewMode ? (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setShowLessonReview(false)}
                    className="cursor-pointer font-black h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm flex items-center gap-1.5"
                  >
                    {t('common:app.back')}
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleStartAdventure(false)}
                    data-testid="start-adventure"
                    className="cursor-pointer font-black h-9 sm:h-10 px-5 sm:px-6 text-xs sm:text-sm flex items-center gap-1.5 shadow-sm"
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
                  className="w-full shrink-0 h-10 font-bold"
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
