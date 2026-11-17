import { useMemo } from 'react';
import type { GameTheme } from '@engine';
import { useAppStore } from '@/stores/appStore';
import { usePlayerStore } from '@/stores/playerStore';

export function useGameTheme(): {
  theme: GameTheme;
  isCyber: boolean;
  isEsports: boolean;
  isAcademy: boolean;
  isArcade: boolean;
  isDark: boolean;
} {
  const settings = useAppStore((s) => s.settings);
  const config = usePlayerStore((s) => s.config);

  const theme: GameTheme = useMemo(() => {
    const raw = settings?.score_rules?.game_theme ?? config?.settings?.score_rules?.game_theme;
    if (raw === 'space' || raw === 'lab' || raw === 'planet' || raw === 'light') {
      return raw;
    }
    const local = typeof window !== 'undefined' ? localStorage.getItem('fra_game_theme') : null;
    if (local === 'space' || local === 'lab' || local === 'planet' || local === 'light') {
      return local as GameTheme;
    }
    return 'space';
  }, [settings?.score_rules?.game_theme, config?.settings?.score_rules?.game_theme]);

  return {
    theme,
    isCyber: theme === 'space',
    isEsports: theme === 'lab',
    isAcademy: theme === 'light',
    isArcade: theme === 'planet',
    isDark: theme !== 'light',
  };
}
