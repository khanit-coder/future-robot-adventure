import { Suspense, lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FullPageLoading } from '@/components/common/LoadingSpinner';
import { subscribeLiveChannel } from '@/services/realtime/liveChannel';
import { useAppStore } from '@/stores/appStore';
import { usePlayerStore } from '@/stores/playerStore';
import { RegistrationView } from './RegistrationView';

const LessonsView = lazy(() =>
  import('@/features/lessons/LessonsView').then((m) => ({ default: m.LessonsView })),
);
const PlayWorkspace = lazy(() =>
  import('./PlayWorkspace').then((m) => ({ default: m.PlayWorkspace })),
);
const ResultView = lazy(() =>
  import('@/features/rewards/ResultView').then((m) => ({ default: m.ResultView })),
);

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
    // Preload heavy game chunks (Phaser + Blockly) in the background after initial paint
    const timer = window.setTimeout(() => {
      void import('@/features/lessons/LessonsView');
      void import('./PlayWorkspace');
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [bootstrap]);

  useEffect(() => {
    const unsub = subscribeLiveChannel({
      presenceMeta: player ? { role: 'player', player_id: player.id } : { role: 'player' },
      onConfigTableChanged: () => {
        void loadGlobal();
        void refreshState();
      },
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

  return (
    <Suspense fallback={<FullPageLoading message={t('app.loading')} />}>
      {playerSession.status === 'FINISHED' || playerSession.status === 'TIME_EXPIRED' ? (
        <ResultView />
      ) : showLessonReview ? (
        <LessonsView reviewMode />
      ) : playerSession.status === 'REGISTERED' || playerSession.status === 'LEARNING' ? (
        <LessonsView />
      ) : (
        <PlayWorkspace />
      )}
    </Suspense>
  );
}
