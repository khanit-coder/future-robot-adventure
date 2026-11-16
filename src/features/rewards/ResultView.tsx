import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  Gift,
  Heart,
  Home,
  QrCode,
  Smartphone,
  Sparkles,
  Trophy,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import type { RewardRow } from '@engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { RobotIllustration } from '@/components/common/RobotIllustration';
import { toast } from '@/stores/toastStore';
import { currentLang } from '@/i18n/config';
import { playerApi } from '@/services/api/playerApi';
import { publicApi } from '@/services/api/publicApi';
import { useAppStore } from '@/stores/appStore';
import { usePlayerStore } from '@/stores/playerStore';
import { formatDuration, pickLocalized } from '@/utils/localize';
import {
  COLLEGE_NAME_TH,
  FACULTY_NAME_TH,
  buildCardDownloadUrl,
  renderShareCardToDataUrl,
  type ShareCardData,
} from './cardCanvas';

const MAX_HEARTS = 5;

export function ResultView() {
  const { t } = useTranslation(['player', 'common']);
  const lang = currentLang();
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

  const fallbackLang = settings?.default_language ?? 'en';
  const rewardsEnabled = settings?.rewards_enabled ?? config.settings.rewards_enabled;

  const totalFailed = useMemo(
    () => progress.reduce((sum, p) => sum + (p.failed_attempts ?? 0), 0),
    [progress],
  );
  const heartsRemaining = Math.max(0, MAX_HEARTS - totalFailed);
  const isOutOfHearts =
    heartsRemaining === 0 && playerSession.levels_completed < config.levels.length;

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
    }),
    [
      player.display_name,
      player.school,
      playerSession.total_score,
      playerSession.levels_completed,
      config.levels.length,
      heartsRemaining,
      lang,
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
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
        <LanguageSwitcher dark />
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-2">
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

            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => void resetToHome()}
                className="border-sky-400/50 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
              >
                <Home className="h-4 w-4" />
                {t('common:app.backToHome')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Code & Social Media Share Card Section */}
        <Card
          className="border-sky-500/40 bg-slate-900/95 text-white shadow-2xl"
          data-testid="qr-share-card-section"
        >
          <CardContent className="p-6 sm:p-8">
            <div className="grid items-center gap-8 lg:grid-cols-12">
              {/* Left: Card Preview */}
              <div className="flex flex-col items-center lg:col-span-6">
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
                  className="mt-4 w-full max-w-sm font-extrabold"
                  onClick={handleDownloadCard}
                >
                  <Download className="h-4 w-4" />
                  {t('player:results.shareCard.downloadBtn')}
                </Button>
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
