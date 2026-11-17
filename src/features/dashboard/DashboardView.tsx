import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Crown,
  Globe2,
  Home,
  LayoutGrid,
  Medal,
  Radio,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DashboardMode, DashboardSettingsRow, GameEvent, GameSettingsRow } from '@engine';
import { FullscreenButton } from '@/components/common/FullscreenButton';
import { SettingsMenu } from '@/components/common/SettingsMenu';
import { useFullscreen } from '@/hooks/useFullscreen';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import { currentLang } from '@/i18n/config';
import type { DashboardPlayer, DashboardSnapshot } from '@/services/api/publicApi';
import type { ConnectionState } from '@/services/realtime/liveChannel';
import { cn } from '@/utils/cn';
import { formatDuration, pickLocalized } from '@/utils/localize';
import { RobotCard, type DashboardTheme } from './RobotCard';
import { avatarForPlayer } from './avatar';

type ExtendedDashboardMode = DashboardMode | 'HALL_OF_FAME';

interface DashboardViewProps {
  snapshot: DashboardSnapshot;
  settings: GameSettingsRow | null;
  dashSettings: DashboardSettingsRow | null;
  onlineIds: Set<string>;
  connectionState: ConnectionState;
  robotOverrides: Record<string, RobotVisualState>;
  recentEvents: GameEvent[];
}

const THEME_CLASSES: Record<string, string> = {
  space: 'bg-slate-950 text-white',
  lab: 'bg-slate-900 text-white',
  planet: 'bg-indigo-950 text-white',
  light: 'bg-slate-100 text-slate-900',
};

function sortHallOfFame(list: DashboardPlayer[]): DashboardPlayer[] {
  return [...list].sort(
    (a, b) =>
      b.score - a.score ||
      b.levels_completed - a.levels_completed ||
      (a.best_level_ms ?? Number.MAX_SAFE_INTEGER) - (b.best_level_ms ?? Number.MAX_SAFE_INTEGER),
  );
}

export function DashboardView({
  snapshot,
  settings,
  dashSettings,
  onlineIds,
  connectionState,
  robotOverrides,
  recentEvents,
}: DashboardViewProps) {
  const { t } = useTranslation(['dashboard', 'common']);
  const lang = currentLang();
  const { isFullscreen } = useFullscreen();
  const fallbackLang = settings?.default_language ?? 'en';

  const configuredMode: DashboardMode = dashSettings?.mode ?? 'GRID';
  const [manualOverride, setManualOverride] = useState<{
    forConfigured: DashboardMode;
    mode: ExtendedDashboardMode;
  } | null>(null);
  const mode: ExtendedDashboardMode =
    manualOverride && manualOverride.forConfigured === configuredMode ? manualOverride.mode : configuredMode;

  const dark = dashSettings?.theme !== 'light';
  const columns = dashSettings?.columns ?? 8;
  const robotSize = dashSettings?.robot_size ?? 88;
  const pageSize = Math.max(8, dashSettings?.page_size ?? 48);
  const rotateSeconds = Math.max(3, dashSettings?.rotate_seconds ?? 12);
  const spotlightInterval = Math.max(3, dashSettings?.spotlight_interval_seconds ?? 8);
  const showSchool = dashSettings?.show_school ?? true;
  const showLeaderboard = dashSettings?.show_leaderboard ?? true;
  const showScores = dashSettings?.show_scores ?? true;
  const showOnlineCount = dashSettings?.show_online_count ?? true;
  const animationsEnabled = dashSettings?.animations_enabled ?? true;

  const players = snapshot.players;
  const totalPages = Math.max(1, Math.ceil(players.length / pageSize));
  const [pageState, setPage] = useState(0);
  const page = pageState >= totalPages ? 0 : pageState;
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  useEffect(() => {
    if (mode !== 'GRID' || totalPages <= 1) return;
    const id = window.setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, rotateSeconds * 1000);
    return () => window.clearInterval(id);
  }, [mode, totalPages, rotateSeconds]);

  useEffect(() => {
    if (mode !== 'SPOTLIGHT' || players.length <= 1) return;
    const id = window.setInterval(() => {
      setSpotlightIndex((i) => (i + 1) % players.length);
    }, spotlightInterval * 1000);
    return () => window.clearInterval(id);
  }, [mode, players.length, spotlightInterval]);

  const pagedPlayers = useMemo(() => {
    const start = page * pageSize;
    return players.slice(start, start + pageSize);
  }, [players, page, pageSize]);

  const activeCount = useMemo(
    () => players.filter((p) => p.status === 'PLAYING' || p.status === 'LEARNING').length,
    [players],
  );
  const finishedCount = useMemo(
    () => players.filter((p) => p.status === 'FINISHED' || p.status === 'TIME_EXPIRED').length,
    [players],
  );
  const rankedPlayers = useMemo(() => sortHallOfFame(players), [players]);
  const topLeaders = useMemo(() => rankedPlayers.slice(0, 10), [rankedPlayers]);

  const gameTitle = settings ? pickLocalized(settings.game_title, lang, fallbackLang) : t('common:app.title');
  const eventTitle = settings ? pickLocalized(settings.event_title, lang, fallbackLang) : '';
  const collegeName = settings ? pickLocalized(settings.college_name, lang, fallbackLang) : '';

  const activeTheme = dashSettings?.theme ?? 'space';
  const themeClass = THEME_CLASSES[activeTheme] ?? THEME_CLASSES.space;

  return (
    <div
      className={cn(
        'flex flex-col justify-between bg-cover bg-center',
        isFullscreen ? 'h-screen overflow-hidden p-3 sm:p-4' : 'min-h-screen p-4 lg:p-6',
        themeClass,
      )}
      style={
        dashSettings?.background_url ? { backgroundImage: `url(${dashSettings.background_url})` } : undefined
      }
    >
      {/* Top Header */}
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-4 rounded-2xl border shrink-0',
          isFullscreen ? 'px-4 py-2' : 'px-5 py-3.5',
          dark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white/95 shadow-xs',
        )}
      >
        <div className="flex items-center gap-3.5">
          <a
            href="/play"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition-colors',
              dark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200',
            )}
            data-testid="dashboard-home-link"
          >
            <Home className="h-4 w-4 text-sky-400" />
            <span>{t('common:app.home')}</span>
          </a>

          {settings?.college_logo_url && (
            <img
              src={settings.college_logo_url}
              alt="College Logo"
              className="h-12 w-12 rounded-full object-contain overflow-hidden bg-transparent shrink-0"
            />
          )}
          {settings?.game_logo_url && (
            <img src={settings.game_logo_url} alt="" className="h-12 w-12 rounded-xl object-contain" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-bold uppercase tracking-wider', activeTheme === 'space' ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'text-sky-400')}>{collegeName}</span>
              {eventTitle && <span className="text-xs text-slate-400">• {eventTitle}</span>}
            </div>
            <h1 className={cn('text-xl font-extrabold tracking-tight sm:text-2xl', activeTheme === 'space' && 'text-sky-200 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)] font-black')}>{gameTitle}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {showOnlineCount && (
            <StatPill
              icon={<Users className="h-4 w-4 text-emerald-400" />}
              label={t('dashboard:onlinePlayers')}
              value={onlineIds.size || players.length}
              dark={dark}
              theme={activeTheme}
            />
          )}
          <StatPill
            icon={<Sparkles className="h-4 w-4 text-sky-400" />}
            label={t('dashboard:activePlayers')}
            value={activeCount}
            dark={dark}
            theme={activeTheme}
          />
          <StatPill
            icon={<CheckCircle2 className="h-4 w-4 text-amber-400" />}
            label={t('dashboard:finishedPlayers')}
            value={finishedCount}
            dark={dark}
            theme={activeTheme}
          />

          {/* Mode tabs */}
          <div
            className={cn(
              'inline-flex rounded-xl border p-1',
              dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-100',
            )}
          >
            {(['GRID', 'PLANET', 'SPOTLIGHT', 'HALL_OF_FAME'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setManualOverride({ forConfigured: configuredMode, mode: m })}
                data-testid={`dashboard-mode-${m}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors',
                  mode === m
                    ? m === 'HALL_OF_FAME'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-indigo-600 text-white'
                    : dark
                      ? 'text-slate-300 hover:bg-slate-700'
                      : 'text-slate-600 hover:bg-white',
                )}
              >
                {m === 'GRID' && <LayoutGrid className="h-3.5 w-3.5" />}
                {m === 'PLANET' && <Globe2 className="h-3.5 w-3.5" />}
                {m === 'SPOTLIGHT' && <Award className="h-3.5 w-3.5" />}
                {m === 'HALL_OF_FAME' && <Crown className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{t(`dashboard:modes.${m}`)}</span>
              </button>
            ))}
          </div>

          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold',
              connectionState === 'connected'
                ? 'bg-emerald-500/20 text-emerald-400'
                : connectionState === 'reconnecting'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-rose-500/20 text-rose-400',
            )}
          >
            <Radio className="h-3.5 w-3.5" />
            {connectionState === 'connected'
              ? t('dashboard:live')
              : connectionState === 'reconnecting'
                ? t('dashboard:reconnecting')
                : t('dashboard:offline')}
          </div>

          <FullscreenButton dark={dark} />
          <SettingsMenu dark={dark} />
        </div>
      </header>

      {/* Main Display Area */}
      <main className={cn('my-3 flex-1', isFullscreen && 'min-h-0 overflow-y-auto')}>
        {players.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700/60 p-8 text-center">
            <RobotIllustration state="wave" size={110} />
            <p className="mt-4 text-lg font-bold opacity-80">{t('dashboard:noPlayers')}</p>
          </div>
        ) : mode === 'HALL_OF_FAME' ? (
          <HallOfFameFullView
            players={rankedPlayers}
            totalLevels={snapshot.total_levels}
            showSchool={showSchool}
            showScores={showScores}
            dark={dark}
            theme={activeTheme}
          />
        ) : mode === 'GRID' ? (
          <div className="space-y-3">
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.min(columns, Math.max(2, pagedPlayers.length))}, minmax(0, 1fr))`,
              }}
            >
              {pagedPlayers.map((p) => (
                <RobotCard
                  key={p.id}
                  player={p}
                  totalLevels={snapshot.total_levels}
                  online={onlineIds.has(p.id)}
                  robotSize={robotSize}
                  showSchool={showSchool}
                  showScore={showScores}
                  animationsEnabled={animationsEnabled}
                  overrideState={robotOverrides[p.id]}
                  dark={dark}
                  theme={activeTheme}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPage(idx)}
                    className={cn(
                      'h-2.5 rounded-full transition-all cursor-pointer',
                      idx === page ? 'w-8 bg-sky-400' : 'w-2.5 bg-slate-600 hover:bg-slate-500',
                    )}
                    aria-label={t('dashboard:page', { current: idx + 1, total: totalPages })}
                  />
                ))}
                <span className="ml-2 text-xs font-semibold opacity-70">
                  {t('dashboard:page', { current: page + 1, total: totalPages })}
                </span>
              </div>
            )}
          </div>
        ) : mode === 'PLANET' ? (
          <PlanetMapView
            players={players}
            totalLevels={snapshot.total_levels}
            showSchool={showSchool}
            showScores={showScores}
            dark={dark}
            theme={activeTheme}
          />
        ) : (
          <SpotlightView
            player={players[spotlightIndex % players.length]}
            players={players}
            totalLevels={snapshot.total_levels}
            overrideState={robotOverrides[players[spotlightIndex % players.length]?.id]}
            dark={dark}
            theme={activeTheme}
          />
        )}
      </main>

      {/* Bottom Section: Real-Time Hall of Fame & Recent Achievements */}
      <footer className="grid gap-4 lg:grid-cols-12 shrink-0" data-testid="dashboard-hall-of-fame">
        {showLeaderboard && mode !== 'HALL_OF_FAME' && (
          <section
            className={cn(
              'rounded-2xl border p-4 lg:col-span-7',
              dark
                ? 'border-amber-500/30 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-950/90'
                : 'border-amber-300 bg-white shadow-sm',
            )}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 text-amber-400">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="flex items-center gap-2 text-base font-extrabold">
                    {t('dashboard:hallOfFame')}
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LIVE
                    </span>
                  </h2>
                  <p className="text-[11px] opacity-70">{t('dashboard:hallOfFameSub')}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-sky-400">
                {t('dashboard:totalMissions')}: {snapshot.total_missions_completed}
              </span>
            </div>

            {/* Top 3 Podium Mini-Cards */}
            {topLeaders.length > 0 && (
              <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
                {topLeaders.slice(0, 3).map((p, idx) => {
                  const av = avatarForPlayer(p.id);
                  const medalColors = [
                    'border-amber-400/70 bg-amber-500/15',
                    'border-slate-300/60 bg-slate-400/10',
                    'border-amber-700/60 bg-amber-800/15',
                  ];
                  const badgeColors = [
                    'bg-amber-400 text-slate-950',
                    'bg-slate-300 text-slate-950',
                    'bg-amber-700 text-white',
                  ];
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'relative flex items-center gap-2.5 rounded-2xl border p-2.5',
                        medalColors[idx] ?? 'border-slate-700 bg-slate-800',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm',
                          badgeColors[idx],
                        )}
                      >
                        {idx === 0 ? '👑' : idx + 1}
                      </span>
                      <RobotIllustration
                        styleName={av.style}
                        color={av.color}
                        size={42}
                        state="celebrate"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{p.name}</p>
                        {showSchool && <p className="truncate text-[11px] opacity-75">{p.school}</p>}
                        <div className="mt-0.5 flex items-center gap-2 text-xs font-extrabold">
                          {showScores && (
                            <span className="text-amber-400">
                              {p.score} {t('dashboard:pts')}
                            </span>
                          )}
                          <span className="text-sky-400">
                            {t('dashboard:lvlProgress', {
                              done: p.levels_completed,
                              total: snapshot.total_levels,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ranks 4 - 9 */}
            {topLeaders.length > 3 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {topLeaders.slice(3, 9).map((p, idx) => {
                  const rank = idx + 4;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-3 py-1.5 text-xs',
                        dark ? 'bg-slate-800/70' : 'bg-slate-50',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-extrabold text-slate-200">
                          {rank}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{p.name}</p>
                          {showSchool && <p className="truncate text-[10px] opacity-65">{p.school}</p>}
                        </div>
                      </div>
                      {showScores && (
                        <span className="ml-2 shrink-0 font-extrabold text-amber-400">
                          {p.score} {t('dashboard:pts')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section
          className={cn(
            'rounded-2xl border p-4',
            showLeaderboard && mode !== 'HALL_OF_FAME' ? 'lg:col-span-5' : 'lg:col-span-12',
            dark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white',
          )}
        >
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
            <Sparkles className="h-5 w-5 text-sky-400" />
            {t('dashboard:recentAchievements')}
          </h2>
          {recentEvents.length === 0 ? (
            <p className="text-sm opacity-60">{t('dashboard:noEvents')}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {recentEvents.slice(0, 8).map((ev) => (
                <div
                  key={ev.event_id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
                    dark ? 'bg-slate-800/70 text-slate-200' : 'bg-slate-50 text-slate-800',
                  )}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <EventRow ev={ev} />
                </div>
              ))}
            </div>
          )}
        </section>
      </footer>
    </div>
  );
}

function HallOfFameFullView({
  players,
  totalLevels,
  showSchool,
  showScores,
  dark,
  theme = 'space',
}: {
  players: DashboardPlayer[];
  totalLevels: number;
  showSchool: boolean;
  showScores: boolean;
  dark: boolean;
  theme?: string;
}) {
  const { t } = useTranslation('dashboard');
  const top3 = players.slice(0, 3);
  const rest = players.slice(3, 15);
  const isCyber = theme === 'space';

  return (
    <div className="space-y-6">
      {/* Podium for Top 3 */}
      <div className="grid items-end gap-4 md:grid-cols-3 max-w-5xl mx-auto pt-2">
        {[1, 0, 2].map((podiumIdx) => {
          const p = top3[podiumIdx];
          if (!p) return <div key={`empty-${podiumIdx}`} className="hidden md:block" />;
          const av = avatarForPlayer(p.id);
          const isFirst = podiumIdx === 0;
          const isSecond = podiumIdx === 1;
          return (
            <div
              key={p.id}
              className={cn(
                'flex flex-col items-center rounded-3xl border p-6 text-center transition-all shadow-xl',
                isFirst
                  ? isCyber
                    ? 'border-2 border-amber-400 bg-gradient-to-b from-amber-500/25 via-slate-900/95 to-slate-950 shadow-[0_0_35px_rgba(251,191,36,0.4)] md:-translate-y-3'
                    : 'border-2 border-amber-400 bg-gradient-to-b from-amber-500/20 via-slate-900/95 to-slate-900 md:-translate-y-3'
                  : isSecond
                    ? isCyber
                      ? 'border-2 border-cyan-400/80 bg-slate-900/90 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                      : 'border-slate-300/60 bg-slate-900/90'
                    : isCyber
                      ? 'border-2 border-amber-600/80 bg-slate-900/90 shadow-[0_0_20px_rgba(217,119,6,0.25)]'
                      : 'border-amber-700/60 bg-slate-900/90',
                !dark && !isFirst && 'bg-white text-slate-900',
              )}
            >
              <div
                className={cn(
                  'mb-2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black',
                  isFirst
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                    : isSecond
                      ? 'bg-slate-300 text-slate-950'
                      : 'bg-amber-700 text-white',
                )}
              >
                {isFirst ? <Crown className="h-4 w-4" /> : <Medal className="h-4 w-4" />}
                RANK #{podiumIdx + 1}
              </div>

              <RobotIllustration
                styleName={av.style}
                color={av.color}
                size={isFirst ? 128 : 100}
                state="celebrate"
              />

              <h3
                className={cn(
                  'mt-3 font-black truncate max-w-full',
                  isFirst ? 'text-2xl' : 'text-xl',
                  isCyber && isFirst && 'text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]',
                  isCyber && !isFirst && 'text-sky-200 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]',
                )}
              >
                {p.name}
              </h3>
              {showSchool && (
                <p
                  className={cn(
                    'text-xs truncate max-w-full mt-0.5',
                    isCyber
                      ? 'border border-sky-400/30 bg-sky-500/10 text-sky-200/90 rounded-md px-2 py-0.5 font-medium'
                      : 'opacity-75',
                  )}
                >
                  {p.school}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm font-extrabold">
                {showScores && (
                  <span
                    className={cn(
                      'rounded-xl px-3 py-1 font-mono',
                      isCyber
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-amber-400/20 text-amber-300',
                    )}
                  >
                    <Trophy className="mr-1 inline h-4 w-4" />
                    {p.score} {t('pts')}
                  </span>
                )}
                <span className="rounded-xl bg-sky-500/20 px-3 py-1 text-sky-300">
                  {t('lvlProgress', { done: p.levels_completed, total: totalLevels })}
                </span>
                {p.best_level_ms != null && (
                  <span className="rounded-xl bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-300">
                    ⚡ {formatDuration(Math.round(p.best_level_ms / 1000))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Honor Roll Ranks 4 - 15 */}
      {rest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {rest.map((p, idx) => {
            const rank = idx + 4;
            const av = avatarForPlayer(p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between rounded-2xl border p-3',
                  dark ? 'border-slate-800 bg-slate-900/85' : 'border-slate-200 bg-white',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-black text-sky-300">
                    #{rank}
                  </span>
                  <RobotIllustration styleName={av.style} color={av.color} size={40} state="idle" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{p.name}</p>
                    {showSchool && <p className="truncate text-xs opacity-65">{p.school}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {showScores && (
                    <p className="text-sm font-black text-amber-400">
                      {p.score} {t('pts')}
                    </p>
                  )}
                  <p className="text-[11px] font-bold text-sky-400">
                    {t('lvlProgress', { done: p.levels_completed, total: totalLevels })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventRow({ ev }: { ev: GameEvent }) {
  const { t } = useTranslation('dashboard');
  const p = ev.payload as Record<string, unknown>;
  const name = String(p.name ?? 'Coder');
  let label = t('events.PLAYER_JOINED', { name });
  if (ev.type === 'PLAYER_LEVEL_COMPLETED') {
    label = t('events.PLAYER_LEVEL_COMPLETED', {
      name,
      level: String(p.level_index ?? ''),
      score: Number(p.score_awarded ?? p.score ?? 0),
    });
  } else if (ev.type === 'PLAYER_FINISHED') {
    label = t('events.PLAYER_FINISHED', { name, score: Number(p.score ?? 0) });
  }
  return <span className="truncate">{label}</span>;
}

function StatPill({
  icon,
  label,
  value,
  dark,
  theme = 'space',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  dark: boolean;
  theme?: string;
}) {
  const isCyber = theme === 'space';
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all',
        isCyber
          ? 'border-sky-500/35 bg-slate-900/80 shadow-[0_0_12px_rgba(56,189,248,0.15)] text-white'
          : dark
            ? 'border-slate-700 bg-slate-800/70 text-white'
            : 'border-slate-200 bg-slate-50 text-slate-900',
      )}
    >
      {icon}
      <div>
        <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
        <p className={cn('text-base font-extrabold leading-none', isCyber && 'text-sky-300 font-mono drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]')}>{value}</p>
      </div>
    </div>
  );
}

function PlanetMapView({
  players,
  totalLevels,
  showSchool,
  showScores,
  dark,
  theme = 'space',
}: {
  players: DashboardPlayer[];
  totalLevels: number;
  showSchool: boolean;
  showScores: boolean;
  dark: boolean;
  theme?: string;
}) {
  const isCyber = theme === 'space';
  const zones = [
    { key: 'orbit-0', label: 'Training Orbit', color: '#38bdf8', min: 0, max: 2 },
    { key: 'orbit-1', label: 'Energy Planet', color: '#f59e0b', min: 3, max: 5 },
    { key: 'orbit-2', label: 'Lost Station', color: '#a78bfa', min: 6, max: 8 },
    { key: 'orbit-3', label: 'Final Mission', color: '#4ade80', min: 9, max: Math.max(9, totalLevels) },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {zones.map((z) => {
        const group = players.filter((p) => p.levels_completed >= z.min && p.levels_completed <= z.max);
        return (
          <div
            key={z.key}
            className={cn(
              'rounded-3xl border p-4 space-y-3',
              isCyber
                ? 'border-sky-500/35 bg-slate-900/85 shadow-[0_0_15px_rgba(56,189,248,0.12)]'
                : dark
                  ? 'border-slate-800 bg-slate-900/80'
                  : 'border-slate-200 bg-white',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: z.color }} />
                <h3 className={cn('font-extrabold text-sm', isCyber && 'text-sky-200')}>{z.label}</h3>
              </div>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">
                {group.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 max-h-[46vh] overflow-y-auto pr-1">
              {group.map((p) => {
                const av = avatarForPlayer(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 transition-transform hover:scale-[1.01]',
                      isCyber
                        ? 'border-sky-500/25 bg-slate-800/80'
                        : dark
                          ? 'border-slate-700 bg-slate-800/70'
                          : 'border-slate-200 bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <RobotIllustration styleName={av.style} color={av.color} size={34} state="idle" />
                      <div className="min-w-0">
                        <p className={cn('truncate text-xs font-bold', isCyber && 'text-sky-200')}>{p.name}</p>
                        {showSchool && (
                          <p className="truncate text-[10px] opacity-65">{p.school}</p>
                        )}
                      </div>
                    </div>
                    {showScores && <span className={cn('text-xs font-extrabold text-amber-400 shrink-0', isCyber && 'font-mono')}>{p.score}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpotlightView({
  player,
  players,
  totalLevels,
  overrideState,
  dark,
  theme = 'space',
}: {
  player: DashboardPlayer;
  players: DashboardPlayer[];
  totalLevels: number;
  overrideState?: RobotVisualState;
  dark: boolean;
  theme?: string;
}) {
  if (!player) return null;
  const av = avatarForPlayer(player.id);
  const isCyber = theme === 'space';
  return (
    <div className="grid gap-4 lg:grid-cols-12 items-center">
      <div
        className={cn(
          'flex flex-col items-center rounded-3xl border p-8 text-center lg:col-span-5',
          isCyber
            ? 'border-sky-500/40 bg-slate-900/90 shadow-[0_0_25px_rgba(56,189,248,0.2)]'
            : dark
              ? 'border-slate-800 bg-slate-900/90'
              : 'border-slate-200 bg-white',
        )}
      >
        <RobotIllustration
          styleName={av.style}
          color={av.color}
          size={180}
          state={overrideState ?? (player.status === 'FINISHED' ? 'celebrate' : 'wave')}
        />
        <h2 className={cn('mt-4 text-3xl font-extrabold', isCyber && 'text-sky-200 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)] font-black')}>{player.name}</h2>
        <p className="text-base opacity-75">{player.school}</p>
        <div className="mt-4 flex gap-4 text-lg font-extrabold">
          <span className={cn('text-amber-400', isCyber && 'font-mono')}>{player.score} pts</span>
          <span className="text-sky-400">
            {player.levels_completed} / {totalLevels}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 lg:col-span-7 max-h-[46vh] overflow-y-auto pr-1">
        {players.slice(0, 16).map((p) => (
          <RobotCard
            key={p.id}
            player={p}
            totalLevels={totalLevels}
            online
            robotSize={56}
            showSchool={false}
            showScore
            animationsEnabled
            dark={dark}
            theme={theme as DashboardTheme}
          />
        ))}
      </div>
    </div>
  );
}
