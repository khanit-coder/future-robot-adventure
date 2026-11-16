import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FullPageLoading } from '@/components/common/LoadingSpinner';
import { subscribeLiveChannel } from '@/services/realtime/liveChannel';
import { useAppStore } from '@/stores/appStore';
import { usePlayerStore } from '@/stores/playerStore';
import { LessonsView } from '@/features/lessons/LessonsView';
import { PlayWorkspace } from './PlayWorkspace';
import { RegistrationView } from './RegistrationView';
import { ResultView } from '@/features/rewards/ResultView';

export function PlayerPage() {
  const { t } = useTranslation('common');
  const loadGlobal = useAppStore((s) => s.loadGlobal);
  const bootstrap = usePlayerStore((s) => s.bootstrap);
  const refreshState = usePlayerStore((s) => s.refreshState);
  const bootstrapped = usePlayerStore((s) => s.bootstrapped);
  const player = usePlayerStore((s) => s.player);
  const playerSession = usePlayerStore((s) => s.playerSession);
  const config = usePlayerStore((s) => s.config);
  const showLessonReview = usePlayerStore((s) => s.showLessonReview);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const unsub = subscribeLiveChannel({
      presenceMeta: player ? { role: 'player', player_id: player.id } : { role: 'player' },
      onConfigTableChanged: () => void loadGlobal(),
      onGameEvent: (ev) => {
        if (ev.type === 'GAME_SESSION_UPDATED' || ev.type === 'CONFIG_PUBLISHED') {
          void loadGlobal();
          void refreshState();
        }
      },
      onReconnect: () => {
        void loadGlobal();
        void refreshState();
      },
    });
    return unsub;
  }, [player, loadGlobal, refreshState]);

  if (!bootstrapped) {
    return <FullPageLoading message={t('app.loading')} />;
  }

  if (!player || !playerSession || !config) {
    return <RegistrationView />;
  }

  if (playerSession.status === 'FINISHED' || playerSession.status === 'TIME_EXPIRED') {
    return <ResultView />;
  }

  if (showLessonReview) {
    return <LessonsView reviewMode />;
  }

  if (playerSession.status === 'REGISTERED' || playerSession.status === 'LEARNING') {
    return <LessonsView />;
  }

  return <PlayWorkspace />;
}
