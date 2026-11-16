import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameEvent } from '@engine';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';

export const LIVE_TOPIC = 'fra:live';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface LiveHandlers {
  onGameEvent?: (event: GameEvent) => void;
  onConfigTableChanged?: (
    table: 'game_settings' | 'dashboard_settings' | 'game_sessions' | 'i18n_overrides',
  ) => void;
  onPresenceSync?: (onlinePlayerIds: Set<string>, totalConnections: number) => void;
  onStatusChange?: (status: ConnectionState) => void;
  onReconnect?: () => void;
  presenceMeta?: { player_id?: string; role: 'player' | 'dashboard' | 'admin' };
}

/**
 * Single coordinated Realtime subscription per browser tab:
 *  - Broadcast events on `fra:live` (with event_id deduplication)
 *  - Presence tracking on `fra:live`
 *  - Postgres changes on live global configuration tables
 *  - Automatic reconnect recovery callback so dashboards/players refresh their snapshot
 */
export function subscribeLiveChannel(handlers: LiveHandlers): () => void {
  if (!isSupabaseConfigured) {
    handlers.onStatusChange?.('offline');
    return () => {};
  }

  const sb = getSupabase();
  const seenEventIds = new Set<string>();
  let hasConnectedOnce = false;

  const channel: RealtimeChannel = sb.channel(LIVE_TOPIC, {
    config: {
      presence: { key: handlers.presenceMeta?.player_id ?? `viewer-${crypto.randomUUID().slice(0, 8)}` },
      broadcast: { self: false },
    },
  });

  channel.on('broadcast', { event: 'game_event' }, ({ payload }) => {
    const ev = payload as GameEvent | undefined;
    if (!ev || !ev.event_id) return;
    if (seenEventIds.has(ev.event_id)) return;
    seenEventIds.add(ev.event_id);
    if (seenEventIds.size > 1000) {
      const first = seenEventIds.values().next().value;
      if (first) seenEventIds.delete(first);
    }
    handlers.onGameEvent?.(ev);
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<{ player_id?: string; role?: string }>();
    const onlineIds = new Set<string>();
    let total = 0;
    for (const entries of Object.values(state)) {
      for (const entry of entries) {
        total += 1;
        if (entry.player_id) onlineIds.add(entry.player_id);
      }
    }
    handlers.onPresenceSync?.(onlineIds, total);
  });

  for (const table of ['game_settings', 'dashboard_settings', 'game_sessions', 'i18n_overrides'] as const) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      handlers.onConfigTableChanged?.(table);
    });
  }

  handlers.onStatusChange?.('connecting');
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      handlers.onStatusChange?.('connected');
      if (handlers.presenceMeta) {
        try {
          await channel.track({ ...handlers.presenceMeta, joined_at: new Date().toISOString() });
        } catch {
          // Presence track errors are non-fatal
        }
      }
      if (hasConnectedOnce) {
        handlers.onReconnect?.();
      }
      hasConnectedOnce = true;
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      handlers.onStatusChange?.(hasConnectedOnce ? 'reconnecting' : 'offline');
    } else if (status === 'CLOSED') {
      handlers.onStatusChange?.('offline');
    }
  });

  return () => {
    void sb.removeChannel(channel);
  };
}
