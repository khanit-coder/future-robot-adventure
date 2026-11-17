import type {
  AdminRow,
  AuditLogRow,
  BlockDefinitionRow,
  ClaimStatus,
  DashboardSettingsRow,
  GameSessionRow,
  GameSettingsRow,
  HintRow,
  I18nOverrideRow,
  LessonRow,
  LessonTranslationRow,
  LevelRow,
  LevelTranslationRow,
  MissionRow,
  PlayerRow,
  PlayerSessionRow,
  PublishedConfigRow,
  RewardClaimRow,
  RewardRow,
  RobotAssetRow,
  SceneAssetRow,
  WorldRow,
} from '@engine';
import { getSupabase } from '@/services/supabase/client';
import { invokeEdge } from '@/services/api/edge';
import { validateImageFile } from '@/utils/localize';

export interface AdminPlayerJoined {
  player: PlayerRow;
  session: PlayerSessionRow | null;
}

export interface AdminClaimJoined extends RewardClaimRow {
  players?: { display_name: string; school: string } | null;
  rewards?: { name: { th?: string; en?: string } } | null;
}

export interface SystemHealthReport {
  ok: boolean;
  db_latency_ms: number;
  total_players_all_time: number;
  published_version: number | null;
  published_at: string | null;
  active_session: GameSessionRow | null;
  storage_ready: boolean;
  server_now: string;
}

export const adminApi = {
  async checkIsAdmin(): Promise<AdminRow | null> {
    const sb = getSupabase();
    const { data: userData } = await sb.auth.getUser();
    if (!userData.user) return null;
    const { data } = await sb.from('admins').select('*').eq('user_id', userData.user.id).maybeSingle();
    return (data as AdminRow | null) ?? null;
  },

  async signIn(email: string, password: string) {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const admin = await this.checkIsAdmin();
    if (!admin) {
      await sb.auth.signOut();
      throw new Error('NOT_ADMIN');
    }
    return admin;
  },

  async signOut() {
    const sb = getSupabase();
    await sb.auth.signOut();
  },

  async uploadAsset(
    folder: 'logos' | 'robots' | 'scenes' | 'lessons' | 'rewards' | 'dashboard',
    file: File,
  ): Promise<string> {
    const check = validateImageFile(file);
    if (!check.ok) throw new Error(check.reason);
    const ext =
      file.name
        .split('.')
        .pop()
        ?.replace(/[^a-z0-9]/gi, '')
        .toLowerCase() || 'png';

    // Primary path: upload via service-role Edge Function (ensures bucket, RLS, and audit log)
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const res = await invokeEdge<{ ok: boolean; url: string }>('admin-action', {
        action: 'upload_asset',
        folder,
        ext,
        content_type: file.type,
        base64,
      });
      if (res.url) return res.url;
    } catch {
      // Fallback to direct client storage upload below
    }

    const sb = getSupabase();
    const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await sb.storage.from('game-assets').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = sb.storage.from('game-assets').getPublicUrl(path);
    return data.publicUrl;
  },

  async publish(dry_run: boolean, note?: string) {
    return invokeEdge<{
      ok: boolean;
      dry_run?: boolean;
      version?: number;
      published_at?: string;
      warnings: string[];
      summary: { levels: number; lessons: number; worlds: number; blocks: number };
    }>('publish-config', { dry_run, note });
  },

  async loadWorkspace() {
    const sb = getSupabase();
    const [
      settings,
      dashboard,
      sessions,
      worlds,
      levels,
      levelTr,
      missions,
      hints,
      lessons,
      lessonTr,
      blocks,
      robots,
      scenes,
      rewards,
      claims,
      overrides,
      latestPub,
      audit,
    ] = await Promise.all([
      sb.from('game_settings').select('*').limit(1).maybeSingle(),
      sb.from('dashboard_settings').select('*').limit(1).maybeSingle(),
      sb.from('game_sessions').select('*').order('started_at', { ascending: false }),
      sb.from('worlds').select('*').order('position'),
      sb.from('levels').select('*').order('position'),
      sb.from('level_translations').select('*'),
      sb.from('missions').select('*'),
      sb.from('hints').select('*').order('position'),
      sb.from('lessons').select('*').order('position'),
      sb.from('lesson_translations').select('*'),
      sb.from('block_definitions').select('*').order('position'),
      sb.from('robot_assets').select('*').order('created_at'),
      sb.from('scene_assets').select('*').order('created_at'),
      sb.from('rewards').select('*').order('position'),
      sb
        .from('reward_claims')
        .select('*, players(display_name, school), rewards(name)')
        .order('created_at', { ascending: false }),
      sb.from('i18n_overrides').select('*').order('namespace').order('key'),
      sb
        .from('published_configs')
        .select('id, version, note, published_by, published_at')
        .order('version', { ascending: false })
        .limit(5),
      sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(150),
    ]);

    return {
      settings: settings.data as GameSettingsRow,
      dashboard: dashboard.data as DashboardSettingsRow,
      sessions: (sessions.data ?? []) as GameSessionRow[],
      worlds: (worlds.data ?? []) as WorldRow[],
      levels: (levels.data ?? []) as LevelRow[],
      levelTranslations: (levelTr.data ?? []) as LevelTranslationRow[],
      missions: (missions.data ?? []) as MissionRow[],
      hints: (hints.data ?? []) as HintRow[],
      lessons: (lessons.data ?? []) as LessonRow[],
      lessonTranslations: (lessonTr.data ?? []) as LessonTranslationRow[],
      blocks: (blocks.data ?? []) as BlockDefinitionRow[],
      robots: (robots.data ?? []) as RobotAssetRow[],
      scenes: (scenes.data ?? []) as SceneAssetRow[],
      rewards: (rewards.data ?? []) as RewardRow[],
      claims: (claims.data ?? []) as AdminClaimJoined[],
      overrides: (overrides.data ?? []) as I18nOverrideRow[],
      publishedConfigs: (latestPub.data ?? []) as Omit<PublishedConfigRow, 'snapshot'>[],
      auditLogs: (audit.data ?? []) as AuditLogRow[],
    };
  },

  async fetchSessionPlayers(sessionId: string): Promise<AdminPlayerJoined[]> {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('players')
      .select('*, player_sessions(*)')
      .eq('game_session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (
      (data ?? []) as Array<PlayerRow & { player_sessions: PlayerSessionRow | PlayerSessionRow[] }>
    ).map((row) => {
      const ps = Array.isArray(row.player_sessions)
        ? (row.player_sessions[0] ?? null)
        : (row.player_sessions ?? null);
      const { player_sessions: _omit, ...player } = row;
      return { player, session: ps };
    });
  },

  async updateSettings(id: string, patch: Partial<GameSettingsRow>) {
    const { data, error } = await getSupabase()
      .from('game_settings')
      .update(patch)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      await invokeEdge('admin-action', { action: 'save_settings', id, patch });
    }
    void this.publish(false, 'Auto-publish settings').catch(() => {});
  },

  async updateDashboardSettings(id: string, patch: Partial<DashboardSettingsRow>) {
    const { data, error } = await getSupabase()
      .from('dashboard_settings')
      .update(patch)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      await invokeEdge('admin-action', { action: 'save_dashboard_settings', id, patch });
    }
  },

  async setClaimStatus(claimId: string, status: ClaimStatus) {
    const { data, error } = await getSupabase().rpc('set_claim_status', {
      p_claim_id: claimId,
      p_status: status,
    });
    if (error) throw error;
    return data;
  },

  async startSession(name: string, registration_open = true) {
    return invokeEdge<{ ok: boolean; session: GameSessionRow }>('admin-action', {
      action: 'start_session',
      name,
      registration_open,
    });
  },

  async closeSession(session_id: string) {
    return invokeEdge<{ ok: boolean; session: GameSessionRow }>('admin-action', {
      action: 'close_session',
      session_id,
    });
  },

  async toggleRegistration(session_id: string, registration_open: boolean) {
    return invokeEdge<{ ok: boolean; session: GameSessionRow }>('admin-action', {
      action: 'toggle_registration',
      session_id,
      registration_open,
    });
  },

  async resetSession(session_id: string) {
    return invokeEdge<{ ok: boolean; session: GameSessionRow }>('admin-action', {
      action: 'reset_session',
      session_id,
    });
  },

  async adjustScore(player_session_id: string, points: number, note: string) {
    return invokeEdge<{ ok: boolean; total_score: number }>('admin-action', {
      action: 'adjust_score',
      player_session_id,
      points,
      note,
    });
  },

  async deletePlayer(playerId: string) {
    const { error } = await getSupabase().from('players').delete().eq('id', playerId);
    if (error) throw error;
  },

  async systemHealth() {
    return invokeEdge<SystemHealthReport>('admin-action', { action: 'system_health' });
  },
};
