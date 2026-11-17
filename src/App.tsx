import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfigGuard } from '@/components/common/ConfigGuard';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { RobotIllustration } from '@/components/common/RobotIllustration';
import { Toaster } from '@/components/ui/toast';
import { useAppStore } from '@/stores/appStore';

const PlayerPage = lazy(() =>
  import('@/features/player/PlayerPage').then((m) => ({ default: m.PlayerPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const AdminPage = lazy(() => import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const CardDownloadPage = lazy(() =>
  import('@/features/rewards/CardDownloadPage').then((m) => ({ default: m.CardDownloadPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
      <RobotIllustration state="idle" size={84} />
    </div>
  );
}

export default function App() {
  const loadGlobal = useAppStore((s) => s.loadGlobal);
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    void loadGlobal();
  }, [loadGlobal]);

  useEffect(() => {
    if (!settings || typeof document === 'undefined') return;
    if (settings.primary_color) {
      document.documentElement.style.setProperty('--fra-primary', settings.primary_color);
    }
    if (settings.secondary_color) {
      document.documentElement.style.setProperty('--fra-secondary', settings.secondary_color);
    }
    const logoUrl = settings.game_logo_url || settings.college_logo_url;
    if (logoUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = logoUrl;
    }
  }, [settings]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              path="/play"
              element={
                <ConfigGuard>
                  <PlayerPage />
                </ConfigGuard>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ConfigGuard>
                  <DashboardPage />
                </ConfigGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <ConfigGuard bypassMaintenance>
                  <AdminPage />
                </ConfigGuard>
              }
            />
            <Route path="/card" element={<CardDownloadPage />} />
            <Route path="*" element={<Navigate to="/play" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </ErrorBoundary>
  );
}
