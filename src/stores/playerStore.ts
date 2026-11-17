import { create } from 'zustand';
import type {
  GameSessionRow,
  Lang,
  PlayerLevelProgressRow,
  PlayerRow,
  PlayerSessionRow,
  PublishedConfig,
} from '@engine';
import { playerApi, type PlayerStateResponse } from '@/services/api/playerApi';
import { ApiError } from '@/services/api/edge';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';
import i18n from '@/i18n/config';

const WORKSPACE_STORAGE_PREFIX = 'fra_ws_v1';

export function loadSavedWorkspace(playerSessionId: string, levelId: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(`${WORKSPACE_STORAGE_PREFIX}:${playerSessionId}:${levelId}`);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function saveWorkspaceState(
  playerSessionId: string,
  levelId: string,
  state: Record<string, unknown> | null,
) {
  try {
    const key = `${WORKSPACE_STORAGE_PREFIX}:${playerSessionId}:${levelId}`;
    if (!state) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

interface PlayerStore {
  bootstrapped: boolean;
  loading: boolean;
  error: string | null;
  player: PlayerRow | null;
  playerSession: PlayerSessionRow | null;
  session: GameSessionRow | null;
  config: PublishedConfig | null;
  latestVersion: number | null;
  progress: PlayerLevelProgressRow[];
  lessonsDone: string[];
  claim: PlayerStateResponse['claim'];
  serverOffsetMs: number;
  selectedLevelId: string | null;
  showLessonReview: boolean;

  bootstrap: () => Promise<void>;
  register: (input: { display_name: string; school: string; grade?: string; lang: Lang }) => Promise<void>;
  refreshState: () => Promise<void>;
  completeLesson: (lessonId: string) => Promise<void>;
  markLessonsStarted: () => Promise<void>;
  startGame: (skip?: boolean) => Promise<void>;
  selectLevel: (levelId: string) => Promise<void>;
  finishGame: () => Promise<void>;
  resetToHome: () => Promise<void>;
  setShowLessonReview: (open: boolean) => void;
  setClaim: (claim: PlayerStateResponse['claim']) => void;
  applyServerTime: (serverNowIso?: string) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  bootstrapped: false,
  loading: false,
  error: null,
  player: null,
  playerSession: null,
  session: null,
  config: null,
  latestVersion: null,
  progress: [],
  lessonsDone: [],
  claim: null,
  serverOffsetMs: 0,
  selectedLevelId: null,
  showLessonReview: false,

  applyServerTime: (serverNowIso) => {
    if (!serverNowIso) return;
    const ms = new Date(serverNowIso).getTime();
    if (Number.isFinite(ms)) {
      set({ serverOffsetMs: ms - Date.now() });
    }
  },

  bootstrap: async () => {
    if (!isSupabaseConfigured) {
      set({ bootstrapped: true });
      return;
    }
    // Fast-path for new visitors: if there is no existing Supabase session in localStorage,
    // skip anonymous sign-in and Edge Function calls until they submit the registration form!
    try {
      const { data: sessionData } = await getSupabase().auth.getSession();
      if (!sessionData.session?.access_token) {
        set({ bootstrapped: true, loading: false, player: null, playerSession: null });
        return;
      }
    } catch {
      set({ bootstrapped: true, loading: false, player: null, playerSession: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const state = await playerApi.getState(true);
      let config = state.config ?? null;
      let latestVersion = state.latest_version;
      if (!config) {
        const res = await playerApi.getConfig();
        config = res.config;
        latestVersion = res.latest_version;
      }
      get().applyServerTime(state.server_now);
      if (state.player.lang && !localStorage.getItem('fra_lang')) {
        void i18n.changeLanguage(state.player.lang);
      }
      const nextLevel = pickActiveLevelId(config, state.progress, state.player_session.current_level_id);
      set({
        bootstrapped: true,
        loading: false,
        player: state.player,
        playerSession: state.player_session,
        session: state.session,
        config,
        latestVersion,
        progress: state.progress,
        lessonsDone: state.lessons_done,
        claim: state.claim,
        selectedLevelId: nextLevel,
      });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_REGISTERED') {
        set({ bootstrapped: true, loading: false, player: null, playerSession: null });
      } else {
        set({
          bootstrapped: true,
          loading: false,
          error: e instanceof ApiError ? e.code : e instanceof Error ? e.message : 'ERROR',
        });
      }
    }
  },

  register: async (input) => {
    set({ loading: true, error: null });
    try {
      const res = await playerApi.register(input);
      if (res.config && res.session && !res.existing) {
        get().applyServerTime(res.server_now);
        const nextLevel = pickActiveLevelId(res.config, [], res.player_session.current_level_id);
        set({
          bootstrapped: true,
          loading: false,
          player: res.player,
          playerSession: res.player_session,
          session: res.session,
          config: res.config,
          latestVersion: res.latest_version ?? res.player_session.config_version,
          progress: [],
          lessonsDone: [],
          claim: null,
          selectedLevelId: nextLevel,
        });
        return;
      }
      await get().bootstrap();
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  refreshState: async () => {
    if (!get().player) return;
    try {
      const state = await playerApi.getState(true);
      get().applyServerTime(state.server_now);
      const config = state.config ?? get().config;
      const currentSelected = get().selectedLevelId;
      const nextLevel =
        currentSelected && config?.levels.some((l) => l.id === currentSelected)
          ? currentSelected
          : config
            ? pickActiveLevelId(config, state.progress, state.player_session.current_level_id)
            : null;
      set({
        player: state.player,
        playerSession: state.player_session,
        session: state.session,
        config,
        progress: state.progress,
        lessonsDone: state.lessons_done,
        claim: state.claim,
        latestVersion: state.latest_version,
        selectedLevelId: nextLevel,
      });
    } catch (e) {
      console.error('refreshState failed', e);
    }
  },

  markLessonsStarted: async () => {
    await playerApi.lessonsStarted();
    await get().refreshState();
  },

  completeLesson: async (lessonId) => {
    await playerApi.completeLesson(lessonId);
    set((s) => ({
      lessonsDone: s.lessonsDone.includes(lessonId) ? s.lessonsDone : [...s.lessonsDone, lessonId],
    }));
  },

  startGame: async (skip = false) => {
    set({ loading: true });
    try {
      const state = await playerApi.startGame(skip);
      get().applyServerTime(state.server_now);
      const cfg = state.config ?? get().config;
      const levelId = cfg
        ? pickActiveLevelId(cfg, state.progress, state.player_session.current_level_id)
        : null;
      set({
        loading: false,
        playerSession: state.player_session,
        config: cfg,
        progress: state.progress,
        selectedLevelId: levelId,
        showLessonReview: false,
      });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  selectLevel: async (levelId) => {
    const res = await playerApi.startLevel(levelId);
    get().applyServerTime(res.server_now);
    set((s) => {
      const exists = s.progress.some((p) => p.level_id === levelId);
      const progress = exists
        ? s.progress.map((p) => (p.level_id === levelId ? res.progress : p))
        : [...s.progress, res.progress];
      return { selectedLevelId: levelId, progress };
    });
  },

  finishGame: async () => {
    const state = await playerApi.finishGame();
    get().applyServerTime(state.server_now);
    set({
      playerSession: state.player_session,
      progress: state.progress,
      claim: state.claim,
    });
  },

  resetToHome: async () => {
    if (isSupabaseConfigured) {
      try {
        await getSupabase().auth.signOut();
      } catch {
        // Ignore signOut errors
      }
    }
    set({
      bootstrapped: true,
      loading: false,
      error: null,
      player: null,
      playerSession: null,
      session: null,
      config: null,
      latestVersion: null,
      progress: [],
      lessonsDone: [],
      claim: null,
      selectedLevelId: null,
      showLessonReview: false,
    });
  },

  setShowLessonReview: (showLessonReview) => set({ showLessonReview }),
  setClaim: (claim) => set({ claim }),
}));

function pickActiveLevelId(
  cfg: PublishedConfig,
  progress: PlayerLevelProgressRow[],
  currentLevelId: string | null,
): string | null {
  if (cfg.levels.length === 0) return null;
  if (currentLevelId && cfg.levels.some((l) => l.id === currentLevelId)) return currentLevelId;
  const completed = new Set(progress.filter((p) => p.status === 'COMPLETED').map((p) => p.level_id));
  const nextIncomplete = cfg.levels.find((l) => !completed.has(l.id));
  return nextIncomplete?.id ?? cfg.levels[0].id;
}
