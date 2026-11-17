import { create } from 'zustand';
import type { DashboardSettingsRow, GameSessionRow, GameSettingsRow, I18nOverrideRow } from '@engine';
import { applyI18nOverrides } from '@/i18n/config';
import i18n from '@/i18n/config';
import { publicApi } from '@/services/api/publicApi';
import { isSupabaseConfigured } from '@/services/supabase/client';
import type { ConnectionState } from '@/services/realtime/liveChannel';

interface AppState {
  loaded: boolean;
  error: string | null;
  settings: GameSettingsRow | null;
  dashboard: DashboardSettingsRow | null;
  activeSession: GameSessionRow | null;
  overrides: I18nOverrideRow[];
  realtimeStatus: ConnectionState;
  loadGlobal: () => Promise<void>;
  setRealtimeStatus: (status: ConnectionState) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  loaded: false,
  error: null,
  settings: null,
  dashboard: null,
  activeSession: null,
  overrides: [],
  realtimeStatus: isSupabaseConfigured ? 'connecting' : 'offline',

  setRealtimeStatus: (realtimeStatus) => set({ realtimeStatus }),

  loadGlobal: async () => {
    if (!isSupabaseConfigured) {
      set({ loaded: true });
      return;
    }
    try {
      const { settings, dashboard, activeSession, overrides } = await publicApi.fetchGlobalState();
      if (settings) {
        document.documentElement.style.setProperty('--fra-primary', settings.primary_color);
        document.documentElement.style.setProperty('--fra-secondary', settings.secondary_color);
        if (settings.score_rules?.game_theme) {
          document.documentElement.setAttribute('data-fra-theme', settings.score_rules.game_theme);
          localStorage.setItem('fra_game_theme', settings.score_rules.game_theme);
        }
        // Apply admin's default language only if user hasn't picked one yet in localStorage.
        if (!localStorage.getItem('fra_lang') && settings.default_language) {
          void i18n.changeLanguage(settings.default_language);
        }
      }
      if (overrides.length > 0 || get().overrides.length > 0) {
        applyI18nOverrides(overrides);
      }
      set({ loaded: true, error: null, settings, dashboard, activeSession, overrides });
    } catch (e) {
      set({ loaded: true, error: e instanceof Error ? e.message : 'Failed to load settings' });
    }
  },
}));
