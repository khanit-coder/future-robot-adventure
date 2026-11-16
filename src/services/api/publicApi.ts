import type {
  DashboardSettingsRow,
  GameEvent,
  GameSessionRow,
  GameSettingsRow,
  I18nOverrideRow,
  PlayerStatus,
  RewardRow,
} from '@engine';
import { getSupabase } from '@/services/supabase/client';

export interface DashboardPlayer {
  id: string;
  name: string;
  school: string;
  status: PlayerStatus;
  score: number;
  levels_completed: number;
  best_level_ms?: number | null;
  started_at: string | null;
  finished_at: string | null;
  registered_at: string;
}

export interface DashboardSnapshot {
  server_now: string;
  session: {
    id: string | null;
    name: string | null;
    status: string | null;
    registration_open: boolean | null;
  } | null;
  last_seq: number;
  total_levels: number;
  players: DashboardPlayer[];
  recent_events: GameEvent[];
  total_missions_completed: number;
}

export const publicApi = {
  async fetchGlobalState(): Promise<{
    settings: GameSettingsRow | null;
    dashboard: DashboardSettingsRow | null;
    activeSession: GameSessionRow | null;
    overrides: I18nOverrideRow[];
  }> {
    const sb = getSupabase();
    const [settingsRes, dashRes, sessionRes, i18nRes] = await Promise.all([
      sb.from('game_settings').select('*').limit(1).maybeSingle(),
      sb.from('dashboard_settings').select('*').limit(1).maybeSingle(),
      sb.from('game_sessions').select('*').eq('status', 'ACTIVE').maybeSingle(),
      sb.from('i18n_overrides').select('*'),
    ]);
    return {
      settings: (settingsRes.data as GameSettingsRow | null) ?? null,
      dashboard: (dashRes.data as DashboardSettingsRow | null) ?? null,
      activeSession: (sessionRes.data as GameSessionRow | null) ?? null,
      overrides: (i18nRes.data as I18nOverrideRow[] | null) ?? [],
    };
  },

  async fetchDashboardSnapshot(sessionId?: string | null): Promise<DashboardSnapshot> {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('dashboard_snapshot', {
      p_session_id: sessionId ?? null,
    });
    if (error) throw error;
    return data as DashboardSnapshot;
  },

  async fetchActiveRewards(): Promise<RewardRow[]> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data as RewardRow[]) ?? [];
  },
};
