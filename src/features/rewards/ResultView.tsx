import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  Gift,
  Heart,
  Home,
  Palette,
  QrCode,
  Smartphone,
  Sparkles,
  Trophy,
  Type,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import type { RewardRow } from '@engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FullscreenButton } from '@/components/common/FullscreenButton';
import { SettingsMenu } from '@/components/common/SettingsMenu';
import { RobotIllustration } from '@/components/common/RobotIllustration';
import { useFullscreen } from '@/hooks/useFullscreen';
import { sfx } from '@/services/audio/soundEffects';
import { cn } from '@/utils/cn';
import { toast } from '@/stores/toastStore';
import { currentLang } from '@/i18n/config';
import { playerApi } from '@/services/api/playerApi';
import { publicApi } from '@/services/api/publicApi';
import { useAppStore } from '@/stores/appStore';
import { usePlayerStore } from '@/stores/playerStore';
import { formatDuration, pickLocalized } from '@/utils/localize';
import {
  CARD_FONTS,
  CARD_THEMES,
  COLLEGE_NAME_TH,
  FACULTY_NAME_TH,
  buildCardDownloadUrl,
  renderShareCardToDataUrl,
  type CardFontId,
  type CardThemeId,
  type ShareCardData,
} from './cardCanvas';

const MAX_HEARTS = 5;
const AUTO_RETURN_SECONDS = 120;

export function ResultView() {
  const { t } = useTranslation(['player', 'common']);
  const lang = currentLang();
  const { isFullscreen } = useFullscreen();
  const settings = useAppStore((s) => s.settings);
  const player = usePlayerStore((s) => s.player)!;
  const playerSession = usePlayerStore((s) => s.playerSession)!;
  const config = usePlayerStore((s) => s.config)!;
  const progress = usePlayerStore((s) => s.progress);
  const claim = usePlayerStore((s) => s.claim);
  const setClaim = usePlayerStore((s) => s.setClaim);
  const resetToHome = usePlayerStore((s) => s.resetToHome);

  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [autoReturnLeft, setAutoReturnLeft] = useState<number>(AUTO_RETURN_SECONDS);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);

  useEffect(() => {
    if (isTimerPaused) return;
    const timer = window.setInterval(() => {
      setAutoReturnLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void resetToHome();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetToHome, isTimerPaused]);

  const fallbackLang = settings?.default_language ?? 'en';
  const rewardsEnabled = settings?.rewards_enabled ?? config.settings.rewards_enabled;

  const totalFailed = useMemo(
    () => progress.reduce((sum, p) => sum + (p.failed_attempts ?? 0), 0),
    [progress],
  );
  const heartsRemaining = Math.max(0, MAX_HEARTS - totalFailed);
  const isOutOfHearts =
    heartsRemaining === 0 && playerSession.levels_completed < config.levels.length;

  useEffect(() => {
    if (isOutOfHearts) {
      sfx.playHeartLost();
    } else {
      sfx.playSuccess();
    }
  }, [isOutOfHearts]);

  const [cardTheme, setCardTheme] = useState<CardThemeId>('cyber');
  const [cardFont, setCardFont] = useState<CardFontId>('modern');
  const [customBadge, setCustomBadge] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');

  const shareCardData: ShareCardData = useMemo(
    () => ({
      name: player.display_name,
      school: player.school,
      score: playerSession.total_score,
      levelsCompleted: playerSession.levels_completed,
      totalLevels: config.levels.length,
      heartsRemaining,
      lang,
      dateStr: new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US'),
      collegeName: settings ? pickLocalized(settings.college_name, lang, fallbackLang) : undefined,
      facultyName: settings ? pickLocalized(settings.event_title, lang, fallbackLang) : undefined,
      collegeNameTh: settings?.college_name ? pickLocalized(settings.college_name, 'th', 'th') : undefined,
      collegeNameEn: settings?.college_name ? pickLocalized(settings.college_name, 'en', 'en') : undefined,
      facultyNameTh: settings?.event_title ? pickLocalized(settings.event_title, 'th', 'th') : undefined,
      facultyNameEn: settings?.event_title ? pickLocalized(settings.event_title, 'en', 'en') : undefined,
      theme: cardTheme,
      fontStyle: cardFont,
      customBadge: customBadge.trim() || undefined,
      customMessage: customMessage.trim() || undefined,
    }),
    [
      player.display_name,
      player.school,
      playerSession.total_score,
      playerSession.levels_completed,
      config.levels.length,
      heartsRemaining,
      lang,
      settings,
      fallbackLang,
      cardTheme,
      cardFont,
      customBadge,
      customMessage,
    ],
  );

  const cardDownloadUrl = useMemo(() => buildCardDownloadUrl(shareCardData), [shareCardData]);

  useEffect(() => {
    let active = true;
    const renderAll = () => {
      if (!active) return;
      setCardImageUrl(renderShareCardToDataUrl(shareCardData));
    };
    renderAll();
    if (typeof document !== 'undefined' && 'fonts' in document) {
      void document.fonts.ready.then(() => {
        if (active) renderAll();
      });
    }
    void QRCode.toDataURL(cardDownloadUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shareCardData, cardDownloadUrl]);

  useEffect(() => {
    if (!rewardsEnabled) return;
    void publicApi
      .fetchActiveRewards()
      .then(setRewards)
      .catch(() => {});
  }, [rewardsEnabled]);

  const handleReserve = async (rewardId: string) => {
    if (reservingId) return;
    setReservingId(rewardId);
    try {
      const res = await playerApi.claimReward(rewardId);
      if (res.ok && res.claim_id && res.claim_code && res.reward_id && res.status) {
        setClaim({
          id: res.claim_id,
          reward_id: res.reward_id,
          claim_code: res.claim_code,
          status: res.status,
        });
        const freshRewards = await publicApi.fetchActiveRewards();
        setRewards(freshRewards);
        toast('success', t('player:results.reservedTitle'));
      } else {
        toast('error', t('common:app.error'), res.reason);
      }
    } catch (e) {
      toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
    } finally {
      setReservingId(null);
    }
  };

  const handleDownloadCard = () => {
    if (!cardImageUrl) return;
    const a = document.createElement('a');
    a.href = cardImageUrl;
    a.download = `future-robot-${player.display_name.replace(/\s+/g, '-') || 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const title = isOutOfHearts
    ? t('player:results.titleOutOfHearts')
    : playerSession.status === 'TIME_EXPIRED'
      ? t('player:results.titleExpired')
      : playerSession.levels_completed >= config.levels.length
        ? t('player:results.titleCompleted')
        : t('player:results.titleFinished');

  const defaultRobot = config.robots.find((r) => r.is_default) ?? config.robots[0] ?? null;

  return (
    <div
      className={cn(
        'min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white fra-result-view fra-scrollable',
        isFullscreen ? 'h-screen overflow-y-auto' : 'overflow-y-auto',
      )}
    >
      <header
        className={cn(
          'mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-4',
          isFullscreen ? 'w-full max-w-[92vw]' : 'max-w-6xl',
        )}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void resetToHome()}
            data-testid="back-home-btn"
            className="border-slate-700 bg-slate-900/90 text-white hover:bg-slate-800"
          >
            <Home className="h-4 w-4 text-sky-400" />
            {t('common:app.home')}
          </Button>
          <span className="font-extrabold text-sky-300">
            {settings ? pickLocalized(settings.game_title, lang, fallbackLang) : t('common:app.title')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsTimerPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-extrabold text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer select-none"
              data-testid="auto-return-countdown"
              title={isTimerPaused ? 'คลิกเพื่อให้นับถอยหลังต่อ' : 'คลิกเพื่อหยุดเวลานับถอยหลังชั่วคราว'}
            >
              <Clock className={cn('h-3.5 w-3.5', !isTimerPaused && 'animate-pulse')} />
              <span>
                {isTimerPaused
                  ? (lang === 'th' ? `⏸️ หยุดเวลา (${formatDuration(autoReturnLeft)})` : `⏸️ Paused (${formatDuration(autoReturnLeft)})`)
                  : t('player:results.autoReturnCountdown', { time: formatDuration(autoReturnLeft) })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoReturnLeft((prev) => prev + 120);
                toast('info', lang === 'th' ? 'เพิ่มเวลาอีก 2 นาทีเรียบร้อย' : 'Added +2 minutes');
              }}
              className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer select-none"
              title={lang === 'th' ? 'ขอเวลาเพิ่มอีก 2 นาที' : 'Add 2 minutes'}
            >
              +2m
            </button>
          </div>
          <FullscreenButton dark />
          <SettingsMenu dark />
        </div>
      </header>

      <main
        className={cn(
          'mx-auto space-y-6 px-6 pb-16 pt-2',
          isFullscreen ? 'w-full max-w-[92vw]' : 'max-w-6xl',
        )}
      >
        <Card className="border-slate-800 bg-slate-900/90 text-white shadow-2xl">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <RobotIllustration
              robot={defaultRobot}
              state={
                isOutOfHearts
                  ? 'fail'
                  : playerSession.status === 'TIME_EXPIRED'
                    ? 'wave'
                    : 'celebrate'
              }
              size={112}
            />
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              {player.school}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{title}</h1>
            <p className="mt-1 text-base text-sky-200">
              {t('player:results.subtitle', { name: player.display_name })}
            </p>

            {/* Hearts summary row */}
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-4 py-1.5">
              {Array.from({ length: MAX_HEARTS }).map((_, idx) => (
                <Heart
                  key={idx}
                  className={`h-5 w-5 ${
                    idx < heartsRemaining
                      ? 'fill-rose-500 text-rose-500'
                      : 'fill-slate-700 text-slate-700'
                  }`}
                />
              ))}
              <span className="ml-1.5 text-xs font-extrabold text-rose-300">
                {heartsRemaining} / {MAX_HEARTS}
              </span>
            </div>

            <div className="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox
                icon={<Trophy className="h-5 w-5 text-amber-400" />}
                label={t('player:results.totalScore')}
                value={String(playerSession.total_score)}
              />
              <StatBox
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                label={t('player:results.levelsDone')}
                value={`${playerSession.levels_completed} / ${config.levels.length}`}
              />
              <StatBox
                icon={<Award className="h-5 w-5 text-sky-400" />}
                label={t('player:results.attempts')}
                value={String(playerSession.total_attempts)}
              />
              <StatBox
                icon={<Clock className="h-5 w-5 text-pink-400" />}
                label={t('player:results.bestTime')}
                value={
                  playerSession.best_level_ms != null
                    ? formatDuration(Math.round(playerSession.best_level_ms / 1000))
                    : '—'
                }
              />
            </div>

            <p className="mt-5 text-sm text-slate-300">{t('player:results.playAgainNote')}</p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => void resetToHome()}
                className="border-sky-400/50 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
              >
                <Home className="h-4 w-4" />
                {t('common:app.backToHome')} ({formatDuration(autoReturnLeft)})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Code & Social Media Share Card Section */}
        <Card
          className="border-sky-500/40 bg-slate-900/95 text-white shadow-2xl"
          data-testid="qr-share-card-section"
        >
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="grid items-start gap-8 lg:grid-cols-12">
              {/* Left: Card Preview + Customizer */}
              <div className="flex flex-col items-center lg:col-span-6 space-y-4">
                <div className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-sky-400/60 shadow-2xl">
                  {cardImageUrl && (
                    <img
                      src={cardImageUrl}
                      alt={player.display_name}
                      className="block h-auto w-full"
                      data-testid="result-card-preview"
                    />
                  )}
                </div>
                <Button
                  variant="success"
                  className="w-full max-w-sm font-extrabold"
                  onClick={handleDownloadCard}
                >
                  <Download className="h-4 w-4" />
                  {t('player:results.shareCard.downloadBtn')}
                </Button>

                {/* Card Theme, Font & Text Customizer Studio */}
                <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-4 text-left">
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-300">
                      <Palette className="h-3.5 w-3.5" />
                      {lang === 'th' ? 'เลือกดีไซน์การ์ด (Card Theme)' : 'Choose Card Theme'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {CARD_THEMES.map((thm) => (
                        <button
                          key={thm.id}
                          type="button"
                          onClick={() => setCardTheme(thm.id)}
                          className={cn(
                            'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition-all cursor-pointer',
                            cardTheme === thm.id
                              ? 'border-sky-400 bg-sky-500/20 text-white ring-2 ring-sky-400/50'
                              : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800',
                          )}
                        >
                          <span className={cn('h-3.5 w-3.5 rounded-full bg-gradient-to-br shrink-0', thm.swatch)} />
                          <span className="truncate">{lang === 'th' ? thm.labelTh : thm.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      <Type className="h-3.5 w-3.5" />
                      {lang === 'th' ? 'เลือกฟอนต์ตัวอักษร (Typography)' : 'Choose Font Style'}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CARD_FONTS.map((fnt) => (
                        <button
                          key={fnt.id}
                          type="button"
                          onClick={() => setCardFont(fnt.id)}
                          className={cn(
                            'rounded-xl border px-2.5 py-2 text-[11px] font-extrabold transition-all cursor-pointer text-center',
                            cardFont === fnt.id
                              ? 'border-amber-400 bg-amber-500/20 text-amber-200 ring-2 ring-amber-400/40'
                              : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800',
                          )}
                        >
                          {lang === 'th' ? fnt.labelTh : fnt.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-slate-800">
                    <p className="text-xs font-extrabold text-indigo-300">
                      {lang === 'th'
                        ? '✏️ ปรับแต่งข้อความบนการ์ด (เว้นว่างเพื่อใช้ค่าเริ่มต้น)'
                        : '✏️ Customize Card Text (Optional)'}
                    </p>
                    <Input
                      value={customBadge}
                      onChange={(e) => setCustomBadge(e.target.value)}
                      maxLength={50}
                      placeholder={
                        lang === 'th'
                          ? 'เช่น 🏅 เกียรติบัตรสุดยอดนักโค้ดดิ้งหุ่นยนต์ 🏅'
                          : 'Custom badge title...'
                      }
                      className="h-8 bg-slate-900 border-slate-700 text-xs text-white placeholder:text-slate-500"
                    />
                    <Input
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      maxLength={70}
                      placeholder={
                        lang === 'th'
                          ? 'เช่น ✨ ขอแสดงความยินดีกับยอดนักเขียนโค้ดแห่งอนาคต! ✨'
                          : 'Custom footer message...'
                      }
                      className="h-8 bg-slate-900 border-slate-700 text-xs text-white placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right: QR Code for Mobile Scan */}
              <div className="flex flex-col items-center text-center lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-4 py-1.5 text-xs font-extrabold text-sky-300">
                  <Smartphone className="h-4 w-4" />
                  {t('player:results.shareCard.badge')}
                </div>
                <h2 className="text-2xl font-extrabold text-white">
                  {t('player:results.shareCard.title')}
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-slate-300">
                  {t('player:results.shareCard.desc')}
                </p>

                <div className="rounded-3xl border-4 border-sky-400 bg-white p-4 shadow-xl">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code Download Card"
                      className="h-56 w-56 object-contain"
                      data-testid="result-qr-code"
                    />
                  ) : (
                    <div className="flex h-56 w-56 items-center justify-center text-slate-400">
                      <QrCode className="h-16 w-16 animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-300 space-y-1">
                  <p className="font-extrabold text-amber-300">{COLLEGE_NAME_TH}</p>
                  <p className="font-bold text-sky-300">{FACULTY_NAME_TH}</p>
                  <p className="text-slate-400">{t('player:results.shareCard.socialHint')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reward section */}
        {!rewardsEnabled ? (
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6 text-center text-sm font-medium text-slate-600">
              {t('player:results.rewardsDisabled')}
            </CardContent>
          </Card>
        ) : claim ? (
          <Card className="border-emerald-300 bg-emerald-50">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <Gift className="h-10 w-10 text-emerald-600" />
              <h2 className="text-xl font-extrabold text-emerald-950">
                {claim.status === 'CLAIMED'
                  ? t('player:results.claimedTitle')
                  : t('player:results.reservedTitle')}
              </h2>
              <p className="text-sm text-emerald-800">{t('player:results.claimCodeLabel')}</p>
              <div
                className="rounded-2xl border-2 border-dashed border-emerald-400 bg-white px-8 py-3 font-mono text-3xl font-extrabold tracking-widest text-emerald-700"
                data-testid="claim-code"
              >
                {claim.claim_code}
              </div>
              <Badge variant="success">{t(`player:results.rewardStatus.${claim.status}`)}</Badge>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 bg-white text-slate-900">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
                  <Gift className="h-5 w-5 text-indigo-600" />
                  {t('player:results.rewardsTitle')}
                </h2>
                <p className="text-sm text-slate-500">{t('player:results.rewardsSubtitle')}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {rewards.map((rw) => {
                  const left = Math.max(0, rw.stock_total - rw.reserved_count - rw.claimed_count);
                  const eligible = playerSession.total_score >= rw.min_score;
                  const outOfStock = left <= 0;

                  return (
                    <div
                      key={rw.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="space-y-2">
                        {rw.image_url && (
                          <img
                            src={rw.image_url}
                            alt={pickLocalized(rw.name, lang, fallbackLang)}
                            className="h-28 w-full rounded-xl object-cover"
                          />
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-slate-900">
                            {pickLocalized(rw.name, lang, fallbackLang)}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600">
                          {pickLocalized(rw.description, lang, fallbackLang)}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Badge variant={eligible ? 'success' : 'secondary'}>
                            {t('player:results.minScore', { score: rw.min_score })}
                          </Badge>
                          <Badge variant={outOfStock ? 'danger' : 'info'}>
                            {outOfStock
                              ? t('player:results.outOfStock')
                              : t('player:results.stockLeft', { left })}
                          </Badge>
                        </div>
                      </div>

                      <Button
                        className="mt-4 w-full"
                        disabled={!eligible || outOfStock || Boolean(reservingId)}
                        onClick={() => void handleReserve(rw.id)}
                      >
                        {reservingId === rw.id
                          ? t('player:results.reserving')
                          : outOfStock
                            ? t('player:results.outOfStock')
                            : !eligible
                              ? t('player:results.notEnoughScore', {
                                  need: rw.min_score - playerSession.total_score,
                                })
                              : t('player:results.reserveBtn')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 text-center">
      <div className="mx-auto flex justify-center">{icon}</div>
      <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
