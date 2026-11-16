import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Clock, Gift, Sparkles, Trophy } from 'lucide-react';
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

export function ResultView() {
  const { t } = useTranslation(['player', 'common']);
  const lang = currentLang();
  const settings = useAppStore((s) => s.settings);
  const player = usePlayerStore((s) => s.player)!;
  const playerSession = usePlayerStore((s) => s.playerSession)!;
  const config = usePlayerStore((s) => s.config)!;
  const claim = usePlayerStore((s) => s.claim);
  const setClaim = usePlayerStore((s) => s.setClaim);

  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [reservingId, setReservingId] = useState<string | null>(null);

  const fallbackLang = settings?.default_language ?? 'en';
  const rewardsEnabled = settings?.rewards_enabled ?? config.settings.rewards_enabled;

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

  const title =
    playerSession.status === 'TIME_EXPIRED'
      ? t('player:results.titleExpired')
      : playerSession.levels_completed >= config.levels.length
        ? t('player:results.titleCompleted')
        : t('player:results.titleFinished');

  const defaultRobot = config.robots.find((r) => r.is_default) ?? config.robots[0] ?? null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <span className="font-extrabold text-sky-300">
          {settings ? pickLocalized(settings.game_title, lang, fallbackLang) : t('common:app.title')}
        </span>
        <LanguageSwitcher dark />
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-2">
        <Card className="border-slate-800 bg-slate-900/90 text-white shadow-2xl">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <RobotIllustration
              robot={defaultRobot}
              state={playerSession.status === 'TIME_EXPIRED' ? 'wave' : 'celebrate'}
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
