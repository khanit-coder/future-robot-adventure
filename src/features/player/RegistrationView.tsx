import { useState } from 'react';
import { Rocket, School, Sparkles, User, GraduationCap, AlertCircle, Lock, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '@engine';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { FullscreenButton } from '@/components/common/FullscreenButton';
import { SettingsMenu } from '@/components/common/SettingsMenu';
import { RobotIllustration } from '@/components/common/RobotIllustration';
import { useFullscreen } from '@/hooks/useFullscreen';
import { cn } from '@/utils/cn';
import { ApiError } from '@/services/api/edge';
import { useAppStore } from '@/stores/appStore';
import { usePlayerStore } from '@/stores/playerStore';
import { pickLocalized } from '@/utils/localize';
import { currentLang } from '@/i18n/config';

export function RegistrationView() {
  const { t, i18n } = useTranslation(['player', 'common']);
  const { isFullscreen } = useFullscreen();
  const settings = useAppStore((s) => s.settings);
  const activeSession = useAppStore((s) => s.activeSession);
  const register = usePlayerStore((s) => s.register);

  const lang = currentLang();
  const [displayName, setDisplayName] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [preferredLang, setPreferredLang] = useState<Lang>(lang);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fallback = settings?.default_language ?? 'en';
  const gameTitle = settings ? pickLocalized(settings.game_title, lang, fallback) : t('common:app.title');
  const tagline = settings ? pickLocalized(settings.tagline, lang, fallback) : t('common:app.tagline');
  const eventTitle =
    settings && settings.event_title
      ? pickLocalized(settings.event_title, lang, fallback)
      : lang === 'th'
        ? 'คณะเทคโนโลยีสารสนเทศ'
        : 'Faculty of Information Technology';
  const collegeName =
    settings && settings.college_name
      ? pickLocalized(settings.college_name, lang, fallback)
      : lang === 'th'
        ? 'วิทยาลัยเทคโนโลยีขอนแก่น P-TECH'
        : 'Khon Kaen Technological College P-TECH';

  const handleLanguagePick = (next: Lang) => {
    setPreferredLang(next);
    void i18n.changeLanguage(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const cleanName = displayName.trim();
    const cleanSchool = school.trim();
    if (!cleanName) {
      setErrorMsg(t('player:welcome.validation.nameRequired'));
      return;
    }
    if (!cleanSchool) {
      setErrorMsg(t('player:welcome.validation.schoolRequired'));
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await register({
        display_name: cleanName,
        school: cleanSchool,
        grade: grade.trim() || undefined,
        lang: preferredLang,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const key = `common:errors.${err.code}`;
        const translated = t(key);
        setErrorMsg(translated !== key ? translated : err.message);
      } else {
        setErrorMsg(t('common:errors.NETWORK'));
      }
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col fra-scrollable',
        isFullscreen ? 'h-screen overflow-y-auto' : 'min-h-screen',
      )}
    >
      <header
        className={cn(
          'flex w-full items-center justify-between shrink-0 mx-auto',
          isFullscreen ? 'max-w-[94vw] px-8 py-5' : 'max-w-7xl px-6 py-4',
        )}
      >
        <div className="flex items-center gap-3 sm:gap-3.5">
          {settings?.college_logo_url && (
            <img
              src={settings.college_logo_url}
              alt="College Logo"
              className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-full object-contain overflow-hidden bg-transparent shrink-0 drop-shadow-[0_2px_10px_rgba(56,189,248,0.25)] transition-transform hover:scale-105"
            />
          )}
          {settings?.game_logo_url && (
            <img
              src={settings.game_logo_url}
              alt=""
              className="h-11 w-11 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-xl object-contain shrink-0 drop-shadow-md"
            />
          )}
          <div className="flex flex-col justify-center">
            <p className="text-xs sm:text-sm md:text-base font-extrabold uppercase tracking-wide text-sky-300 drop-shadow-sm leading-tight">
              {collegeName}
            </p>
            <p className="text-sm sm:text-base md:text-lg font-bold text-white drop-shadow-sm leading-snug mt-0.5">
              {eventTitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FullscreenButton dark />
          <SettingsMenu dark />
        </div>
      </header>

      <main
        className={cn(
          'flex-1 content-center items-center w-full mx-auto grid lg:grid-cols-12',
          isFullscreen
            ? 'max-w-[90vw] gap-12 px-8 py-6'
            : 'max-w-7xl gap-10 px-6 pb-12 pt-4',
        )}
      >
        {/* Hero side */}
        <div className="space-y-6 lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/15 px-3.5 py-1.5 text-xs font-bold text-sky-200">
            <Sparkles className="h-4 w-4 text-amber-300" />
            {t('player:welcome.badge')}
          </div>
          <h1
            className={cn(
              'font-extrabold tracking-tight text-white',
              isFullscreen ? 'text-5xl xl:text-6xl leading-tight' : 'text-4xl sm:text-5xl',
            )}
          >
            {gameTitle}
          </h1>
          <p className={cn('font-medium text-sky-200', isFullscreen ? 'text-xl xl:text-2xl' : 'text-lg')}>
            {tagline}
          </p>
          <p className={cn('max-w-2xl leading-relaxed text-slate-300', isFullscreen ? 'text-lg' : 'text-base')}>
            {t('player:welcome.subtitle')}
          </p>

          <div className="flex items-end gap-4 pt-2">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 text-center">
              <RobotIllustration styleName="bolt" color="#38bdf8" state="wave" size={isFullscreen ? 116 : 88} />
              <p className="mt-1.5 text-xs font-semibold text-sky-300">Bolt</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 text-center">
              <RobotIllustration styleName="nova" color="#f472b6" state="idle" size={isFullscreen ? 116 : 88} />
              <p className="mt-1.5 text-xs font-semibold text-pink-300">Nova</p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 text-center">
              <RobotIllustration
                styleName="gizmo"
                color="#4ade80"
                state="celebrate"
                size={isFullscreen ? 116 : 88}
              />
              <p className="mt-1.5 text-xs font-semibold text-emerald-300">Gizmo</p>
            </div>
          </div>
        </div>

        {/* Registration card */}
        <div className="lg:col-span-6">
          <Card className="border-slate-200/90 bg-white text-slate-900 shadow-2xl">
            <CardContent className={cn(isFullscreen ? 'p-8 xl:p-10' : 'p-6 sm:p-8')}>
              {!activeSession ? (
                <div className="py-8 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                    <Lock className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{t('player:welcome.noSessionTitle')}</h2>
                  <p className="text-sm text-slate-600">{t('player:welcome.noSessionDesc')}</p>
                </div>
              ) : !activeSession.registration_open ? (
                <div className="py-8 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                    <Lock className="h-7 w-7" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{t('player:welcome.closedTitle')}</h2>
                  <p className="text-sm text-slate-600">{t('player:welcome.closedDesc')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900">{t('player:welcome.heading')}</h2>
                    <p className="mt-1 text-sm text-slate-500">{activeSession.name}</p>
                  </div>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name" className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-indigo-600" />
                      {t('player:welcome.displayName')} *
                    </Label>
                    <Input
                      id="reg-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('player:welcome.displayNamePlaceholder')}
                      maxLength={40}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-school" className="flex items-center gap-1.5">
                      <School className="h-4 w-4 text-indigo-600" />
                      {t('player:welcome.school')} *
                    </Label>
                    <Input
                      id="reg-school"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder={t('player:welcome.schoolPlaceholder')}
                      maxLength={80}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-grade" className="flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-indigo-600" />
                      {t('player:welcome.grade')}
                    </Label>
                    <Input
                      id="reg-grade"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder={t('player:welcome.gradePlaceholder')}
                      maxLength={20}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t('player:welcome.preferredLang')}</Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {(['th', 'en'] as const).map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => handleLanguagePick(code)}
                          className={`rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all cursor-pointer ${
                            preferredLang === code
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {code === 'th' ? '🇹🇭 ภาษาไทย' : '🇬🇧 English'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="w-full text-base"
                    data-testid="register-submit"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Rocket className="h-5 w-5" />
                    )}
                    {submitting ? t('player:welcome.submitting') : t('player:welcome.submit')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
