import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent, PlayerStatus } from '@engine';
import type { RobotVisualState } from '@/components/common/RobotIllustration';
import { publicApi, type DashboardPlayer, type DashboardSnapshot } from '@/services/api/publicApi';
import { subscribeLiveChannel, type ConnectionState } from '@/services/realtime/liveChannel';
import { useAppStore } from '@/stores/appStore';
import { DashboardView } from './DashboardView';

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  server_now: new Date().toISOString(),
  session: null,
  last_seq: 0,
  total_levels: 10,
  players: [],
  recent_events: [],
  total_missions_completed: 0,
};

export function DashboardPage() {
  const settings = useAppStore((s) => s.settings);
  const dashSettings = useAppStore((s) => s.dashboard);
  const loadGlobal = useAppStore((s) => s.loadGlobal);

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [robotOverrides, setRobotOverrides] = useState<Record<string, RobotVisualState>>({});
  const [recentEvents, setRecentEvents] = useState<GameEvent[]>([]);
  const lastSeqRef = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);

  const refreshSnapshot = useCallback(async () => {
    try {
      const fresh = await publicApi.fetchDashboardSnapshot();
      lastSeqRef.current = fresh.last_seq;
      setSnapshot(fresh);
      setRecentEvents(fresh.recent_events ?? []);
    } catch (e) {
      console.error('dashboard snapshot failed', e);
    }
  }, []);

  const scheduleSnapshotRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshSnapshot();
    }, 600);
  }, [refreshSnapshot]);

  useEffect(() => {
    let active = true;
    void publicApi
      .fetchDashboardSnapshot()
      .then((fresh) => {
        if (!active) return;
        lastSeqRef.current = fresh.last_seq;
        setSnapshot(fresh);
        setRecentEvents(fresh.recent_events ?? []);
      })
      .catch((e) => console.error('dashboard snapshot failed', e));
    return () => {
      active = false;
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const flashRobotState = useCallback((playerId: string, state: RobotVisualState) => {
    setRobotOverrides((prev) => ({ ...prev, [playerId]: state }));
    window.setTimeout(() => {
      setRobotOverrides((prev) => {
        if (prev[playerId] !== state) return prev;
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    }, 3200);
  }, []);

  const applyEvent = useCallback(
    (ev: GameEvent) => {
      if (ev.sequence_number > 0) {
        if (ev.sequence_number <= lastSeqRef.current) return;
        if (lastSeqRef.current > 0 && ev.sequence_number > lastSeqRef.current + 1) {
          scheduleSnapshotRefresh();
        }
        lastSeqRef.current = ev.sequence_number;
      }

      if (ev.type === 'GAME_SESSION_UPDATED' || ev.type === 'CONFIG_PUBLISHED') {
        void loadGlobal();
        void refreshSnapshot();
        return;
      }

      const pid = ev.player_id;
      const p = ev.payload as Record<string, unknown>;
      if (!pid) return;

      if (ev.type === 'PLAYER_JOINED') {
        const joined: DashboardPlayer = {
          id: pid,
          name: String(p.name ?? 'Student'),
          school: String(p.school ?? ''),
          status: 'REGISTERED',
          score: 0,
          levels_completed: 0,
          started_at: null,
          finished_at: null,
          registered_at: ev.timestamp,
        };
        setSnapshot((prev) => {
          if (prev.players.some((x) => x.id === pid)) return prev;
          return { ...prev, players: [...prev.players, joined] };
        });
        flashRobotState(pid, 'wave');
        setRecentEvents((prev) => [ev, ...prev].slice(0, 20));
        return;
      }

      if (ev.type === 'PLAYER_COMPILE_SUCCESS') {
        const anim = (p.animation as RobotVisualState | undefined) ?? 'celebrate';
        flashRobotState(pid, anim);
        return;
      }

      if (ev.type === 'PLAYER_COMPILE_FAILED') {
        flashRobotState(pid, 'fail');
        return;
      }

      setSnapshot((prev) => {
        let deltaMissions = 0;
        const players = prev.players.map((pl) => {
          if (pl.id !== pid) return pl;
          let status: PlayerStatus = pl.status;
          let score = pl.score;
          let levels_completed = pl.levels_completed;
          if (ev.type === 'PLAYER_LESSON_PROGRESS') status = 'LEARNING';
          if (ev.type === 'PLAYER_STARTED') status = 'PLAYING';
          if (ev.type === 'PLAYER_LEVEL_COMPLETED') {
            status = 'PLAYING';
            if (typeof p.score === 'number') score = p.score;
            if (typeof p.levels_completed === 'number') {
              deltaMissions = Math.max(0, p.levels_completed - pl.levels_completed);
              levels_completed = p.levels_completed;
            }
          }
          if (ev.type === 'PLAYER_SCORE_UPDATED' && typeof p.score === 'number') {
            score = p.score;
          }
          if (ev.type === 'PLAYER_FINISHED') {
            status = p.reason === 'TIME_EXPIRED' ? 'TIME_EXPIRED' : 'FINISHED';
            if (typeof p.score === 'number') score = p.score;
            if (typeof p.levels_completed === 'number') levels_completed = p.levels_completed;
          }
          return { ...pl, status, score, levels_completed };
        });
        return {
          ...prev,
          players,
          total_missions_completed: prev.total_missions_completed + deltaMissions,
        };
      });

      if (ev.type === 'PLAYER_LEVEL_COMPLETED' || ev.type === 'PLAYER_FINISHED') {
        flashRobotState(pid, 'celebrate');
        setRecentEvents((prev) => [ev, ...prev].slice(0, 20));
      }
    },
    [flashRobotState, loadGlobal, refreshSnapshot, scheduleSnapshotRefresh],
  );

  useEffect(() => {
    const unsub = subscribeLiveChannel({
      presenceMeta: { role: 'dashboard' },
      onStatusChange: setConnectionState,
      onPresenceSync: (ids) => setOnlineIds(ids),
      onGameEvent: applyEvent,
      onConfigTableChanged: () => void loadGlobal(),
      onReconnect: () => {
        void loadGlobal();
        void refreshSnapshot();
      },
    });
    return unsub;
  }, [applyEvent, loadGlobal, refreshSnapshot]);

  return (
    <DashboardView
      snapshot={snapshot}
      settings={settings}
      dashSettings={dashSettings}
      onlineIds={onlineIds}
      connectionState={connectionState}
      robotOverrides={robotOverrides}
      recentEvents={recentEvents}
    />
  );
}
