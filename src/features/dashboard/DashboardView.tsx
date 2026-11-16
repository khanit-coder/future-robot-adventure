import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Globe2, LayoutGrid, Radio, Sparkles, Trophy, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DashboardMode, DashboardSettingsRow, GameEvent, GameSettingsRow } from '@engine';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import { currentLang } from '@/i18n/config';
import type { DashboardPlayer, DashboardSnapshot } from '@/services/api/publicApi';
import type { ConnectionState } from '@/services/realtime/liveChannel';
import { cn } from '@/utils/cn';
import { pickLocalized } from '@/utils/localize';
import { RobotCard } from './RobotCard';
import { avatarForPlayer } from './avatar';

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
  const fallbackLang = settings?.default_language ?? 'en';

  const configuredMode: DashboardMode = dashSettings?.mode ?? 'GRID';
  const [manualOverride, setManualOverride] = useState<{
    forConfigured: DashboardMode;
    mode: DashboardMode;
  } | null>(null);
  const mode =
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
  const topLeaders = useMemo(
    () =>
      [...players].sort((a, b) => b.score - a.score || b.levels_completed - a.levels_completed).slice(0, 8),
    [players],
  );

  const gameTitle = settings ? pickLocalized(settings.game_title, lang, fallbackLang) : t('common:app.title');
  const eventTitle = settings ? pickLocalized(settings.event_title, lang, fallbackLang) : '';
  const collegeName = settings ? pickLocalized(settings.college_name, lang, fallbackLang) : '';

  const themeClass = THEME_CLASSES[dashSettings?.theme ?? 'space'] ?? THEME_CLASSES.space;

  return (
    <div
      className={cn('flex min-h-screen flex-col justify-between bg-cover bg-center p-4 lg:p-6', themeClass)}
      style={
        dashSettings?.background_url ? { backgroundImage: `url(${dashSettings.background_url})` } : undefined
      }
    >
      {/* Top Header */}
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-3.5',
          dark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white/95 shadow-xs',
        )}
      >
        <div className="flex items-center gap-3.5">
          {settings?.college_logo_url && (
            <img
              src={settings.college_logo_url}
              alt=""
              className="h-12 w-12 rounded-xl bg-white object-contain p-1"
            />
          )}
          {settings?.game_logo_url && (
            <img src={settings.game_logo_url} alt="" className="h-12 w-12 rounded-xl object-contain" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">{collegeName}</span>
              {eventTitle && <span className="text-xs text-slate-400">• {eventTitle}</span>}
            </div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{gameTitle}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {showOnlineCount && (
            <StatPill
              icon={<Users className="h-4 w-4 text-emerald-400" />}
              label={t('dashboard:onlinePlayers')}
              value={onlineIds.size || players.length}
              dark={dark}
            />
          )}
          <StatPill
            icon={<Sparkles className="h-4 w-4 text-sky-400" />}
            label={t('dashboard:activePlayers')}
            value={activeCount}
            dark={dark}
          />
          <StatPill
            icon={<CheckCircle2 className="h-4 w-4 text-amber-400" />}
            label={t('dashboard:finishedPlayers')}
            value={finishedCount}
            dark={dark}
          />

          {/* Mode tabs */}
          <div
            className={cn(
              'inline-flex rounded-xl border p-1',
              dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-100',
            )}
          >
            {(['GRID', 'PLANET', 'SPOTLIGHT'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setManualOverride({ forConfigured: configuredMode, mode: m })}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors',
                  mode === m
                    ? 'bg-indigo-600 text-white'
                    : dark
                      ? 'text-slate-300 hover:bg-slate-700'
                      : 'text-slate-600 hover:bg-white',
                )}
              >
                {m === 'GRID' && <LayoutGrid className="h-3.5 w-3.5" />}
                {m === 'PLANET' && <Globe2 className="h-3.5 w-3.5" />}
                {m === 'SPOTLIGHT' && <Award className="h-3.5 w-3.5" />}
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

          <LanguageSwitcher dark={dark} />
        </div>
      </header>

      {/* Main Display Area */}
      <main className="my-4 flex-1">
        {players.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700/60 p-8 text-center">
            <RobotIllustration state="wave" size={110} />
            <p className="mt-4 text-lg font-bold opacity-80">{t('dashboard:noPlayers')}</p>
          </div>
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
          />
        ) : (
          <SpotlightView
            player={players[spotlightIndex % players.length]}
            players={players}
            totalLevels={snapshot.total_levels}
            overrideState={robotOverrides[players[spotlightIndex % players.length]?.id]}
            dark={dark}
          />
        )}
      </main>

      {/* Bottom Section: Leaderboard & Recent Achievements */}
      <footer className="grid gap-4 lg:grid-cols-12">
        {showLeaderboard && (
          <section
            className={cn(
              'rounded-2xl border p-4 lg:col-span-6',
              dark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white',
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold">
                <Trophy className="h-5 w-5 text-amber-400" />
                {t('dashboard:leaderboard')}
              </h2>
              <span className="text-xs font-bold text-sky-400">
                {t('dashboard:totalMissions')}: {snapshot.total_missions_completed}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {topLeaders.map((p, idx) => (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                    dark ? 'bg-slate-800/70' : 'bg-slate-50',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                        idx === 0
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-700 text-slate-200',
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{p.name}</p>
                      {showSchool && <p className="truncate text-[11px] opacity-65">{p.school}</p>}
                    </div>
                  </div>
                  {showScores && (
                    <span className="ml-2 shrink-0 font-extrabold text-amber-400">
                      {p.score} {t('dashboard:pts')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section
          className={cn(
            'rounded-2xl border p-4',
            showLeaderboard ? 'lg:col-span-6' : 'lg:col-span-12',
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  dark: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-1.5',
        dark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50',
      )}
    >
      {icon}
      <div>
        <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
        <p className="text-base font-extrabold leading-none">{value}</p>
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
}: {
  players: DashboardPlayer[];
  totalLevels: number;
  showSchool: boolean;
  showScores: boolean;
  dark: boolean;
}) {
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
              dark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: z.color }} />
                <h3 className="font-extrabold text-sm">{z.label}</h3>
              </div>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">
                {group.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.slice(0, 24).map((p) => {
                const av = avatarForPlayer(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-2.5 py-1.5',
                      dark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50',
                    )}
                  >
                    <RobotIllustration styleName={av.style} color={av.color} size={36} state="idle" />
                    <div className="min-w-0">
                      <p className="truncate max-w-[110px] text-xs font-bold">{p.name}</p>
                      {showSchool && (
                        <p className="truncate max-w-[110px] text-[10px] opacity-65">{p.school}</p>
                      )}
                    </div>
                    {showScores && <span className="text-xs font-extrabold text-amber-400">{p.score}</span>}
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
}: {
  player: DashboardPlayer;
  players: DashboardPlayer[];
  totalLevels: number;
  overrideState?: RobotVisualState;
  dark: boolean;
}) {
  if (!player) return null;
  const av = avatarForPlayer(player.id);
  return (
    <div className="grid gap-4 lg:grid-cols-12 items-center">
      <div
        className={cn(
          'flex flex-col items-center rounded-3xl border p-8 text-center lg:col-span-5',
          dark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white',
        )}
      >
        <RobotIllustration
          styleName={av.style}
          color={av.color}
          size={180}
          state={overrideState ?? (player.status === 'FINISHED' ? 'celebrate' : 'wave')}
        />
        <h2 className="mt-4 text-3xl font-extrabold">{player.name}</h2>
        <p className="text-base opacity-75">{player.school}</p>
        <div className="mt-4 flex gap-4 text-lg font-extrabold">
          <span className="text-amber-400">{player.score} pts</span>
          <span className="text-sky-400">
            {player.levels_completed} / {totalLevels}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 lg:col-span-7">
        {players.slice(0, 16).map((p) => (
          <RobotCard
            key={p.id}
            player={p}
            totalLevels={totalLevels}
            online
            robotSize={64}
            showSchool={false}
            showScore
            animationsEnabled
            dark={dark}
          />
        ))}
      </div>
    </div>
  );
}
