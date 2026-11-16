import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Bot,
  Boxes,
  CheckCircle2,
  Clock,
  FileClock,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  LogOut,
  Map,
  Monitor,
  Palette,
  Rocket,
  Settings,
  Users,
  CalendarClock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { toast } from '@/stores/toastStore';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { RobotIllustration } from '@/components/common/RobotIllustration';
import { ApiError } from '@/services/api/edge';
import { adminApi } from '@/services/api/adminApi';
import { subscribeLiveChannel } from '@/services/realtime/liveChannel';
import { useAppStore } from '@/stores/appStore';
import { AdminAuthGate } from './AdminAuthGate';
import type { AdminModuleId, AdminWorkspaceData } from './adminTypes';
import {
  BrandingModule,
  GameSettingsModule,
  OverviewModule,
  ScoreManagerModule,
  TimerSettingsModule,
} from './modules/OverviewAndSettings';
import { RobotManagerModule, SceneManagerModule } from './modules/AssetManagers';
import { HintManagerModule, LevelManagerModule } from './modules/LevelManager';
import { BlockManagerModule, LessonManagerModule } from './modules/CurriculumManager';
import { DashboardEditorModule, PlayerManagerModule, RewardManagerModule } from './modules/OperationsManager';
import {
  AuditLogsModule,
  LanguageManagerModule,
  SessionManagerModule,
  SystemSettingsModule,
} from './modules/SystemModules';

const NAV_ITEMS: { id: AdminModuleId; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'settings', icon: Settings },
  { id: 'branding', icon: Palette },
  { id: 'robots', icon: Bot },
  { id: 'scenes', icon: ImageIcon },
  { id: 'levels', icon: Map },
  { id: 'blocks', icon: Boxes },
  { id: 'lessons', icon: BookOpen },
  { id: 'hints', icon: HelpCircle },
  { id: 'scores', icon: Award },
  { id: 'timers', icon: Clock },
  { id: 'rewards', icon: Globe },
  { id: 'players', icon: Users },
  { id: 'dashboard', icon: Monitor },
  { id: 'languages', icon: Languages },
  { id: 'sessions', icon: CalendarClock },
  { id: 'system', icon: Activity },
  { id: 'audit', icon: FileClock },
];

export function AdminPage() {
  return (
    <AdminAuthGate>
      {(admin, onSignOut) => <AdminShell adminEmail={admin.email ?? ''} onSignOut={onSignOut} />}
    </AdminAuthGate>
  );
}

function AdminShell({ adminEmail, onSignOut }: { adminEmail: string; onSignOut: () => Promise<void> }) {
  const { t } = useTranslation(['admin', 'common']);
  const loadGlobal = useAppStore((s) => s.loadGlobal);
  const setRealtimeStatus = useAppStore((s) => s.setRealtimeStatus);

  const [moduleId, setModuleId] = useState<AdminModuleId>('overview');
  const [data, setData] = useState<AdminWorkspaceData | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const ws = await adminApi.loadWorkspace();
    setData(ws);
    await loadGlobal();
  }, [loadGlobal]);

  useEffect(() => {
    let active = true;
    void adminApi.loadWorkspace().then((ws) => {
      if (active) {
        setData(ws);
        void loadGlobal();
      }
    });
    const unsub = subscribeLiveChannel({
      presenceMeta: { role: 'admin' },
      onStatusChange: setRealtimeStatus,
    });
    return () => {
      active = false;
      unsub();
    };
  }, [loadGlobal, setRealtimeStatus]);

  const handleValidate = async () => {
    try {
      const res = await adminApi.publish(true);
      toast(
        'success',
        t('admin:topbar.validateOk', { levels: res.summary.levels, lessons: res.summary.lessons }),
      );
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details.errors)) {
        setPublishErrors(e.details.errors as string[]);
        setPublishOpen(true);
      } else {
        toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
      }
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishErrors([]);
    try {
      const res = await adminApi.publish(false, publishNote.trim() || undefined);
      setPublishOpen(false);
      setPublishNote('');
      await reload();
      toast('success', t('admin:topbar.publishSuccess', { version: res.version }));
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details.errors)) {
        setPublishErrors(e.details.errors as string[]);
      } else {
        toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
      }
    } finally {
      setPublishing(false);
    }
  };

  const latestVersion = data?.publishedConfigs[0]?.version;

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-950 text-slate-200 lg:flex">
        <div className="border-b border-slate-800 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-400">Future Robot Adventure</p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-white">{adminEmail}</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setModuleId(id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                moduleId === id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(`admin:modules.${id}`)}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:bg-slate-900 hover:text-white"
            onClick={() => void onSignOut()}
          >
            <LogOut className="h-4 w-4" />
            {t('admin:auth.signOut')}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            {/* Compact module selector on small screens */}
            <select
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-bold lg:hidden"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value as AdminModuleId)}
            >
              {NAV_ITEMS.map(({ id }) => (
                <option key={id} value={id}>
                  {t(`admin:modules.${id}`)}
                </option>
              ))}
            </select>
            <h1 className="hidden text-lg font-extrabold text-slate-900 lg:block">
              {t(`admin:modules.${moduleId}`)}
            </h1>
            <Badge variant={latestVersion ? 'success' : 'warning'}>
              {latestVersion
                ? t('admin:topbar.publishedVersion', { version: latestVersion })
                : t('admin:topbar.nonePublished')}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleValidate()}>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {t('admin:topbar.validateDraft')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPublishErrors([]);
                setPublishOpen(true);
              }}
            >
              <Rocket className="h-4 w-4" />
              {t('admin:topbar.publish')}
            </Button>
            <LanguageSwitcher />
          </div>
        </header>

        <main className="flex-1 p-5 overflow-y-auto">
          {!data ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <RobotIllustration state="idle" size={84} />
              <p className="text-sm font-semibold text-slate-500">{t('common:app.loading')}</p>
            </div>
          ) : (
            <ModuleBody id={moduleId} data={data} reload={reload} />
          )}
        </main>
      </div>

      {/* Publish Dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:topbar.publishTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">{t('admin:topbar.publishDesc')}</p>

          {publishErrors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 space-y-1">
              {publishErrors.map((err, i) => (
                <p key={i}>• {err}</p>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t('admin:topbar.publishNote')}</Label>
            <Input value={publishNote} onChange={(e) => setPublishNote(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              {t('common:app.cancel')}
            </Button>
            <Button onClick={() => void handlePublish()} disabled={publishing}>
              <Rocket className="h-4 w-4" />
              {publishing ? t('admin:topbar.publishing') : t('admin:topbar.publish')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModuleBody({
  id,
  data,
  reload,
}: {
  id: AdminModuleId;
  data: AdminWorkspaceData;
  reload: () => Promise<void>;
}) {
  switch (id) {
    case 'overview':
      return <OverviewModule data={data} />;
    case 'settings':
      return <GameSettingsModule key={data.settings.updated_at} data={data} onReload={reload} />;
    case 'branding':
      return <BrandingModule key={data.settings.updated_at} data={data} onReload={reload} />;
    case 'robots':
      return <RobotManagerModule data={data} onReload={reload} />;
    case 'scenes':
      return <SceneManagerModule data={data} onReload={reload} />;
    case 'levels':
      return <LevelManagerModule data={data} onReload={reload} />;
    case 'blocks':
      return <BlockManagerModule data={data} onReload={reload} />;
    case 'lessons':
      return <LessonManagerModule data={data} onReload={reload} />;
    case 'hints':
      return <HintManagerModule data={data} onReload={reload} />;
    case 'scores':
      return <ScoreManagerModule key={data.settings.updated_at} data={data} onReload={reload} />;
    case 'timers':
      return <TimerSettingsModule key={data.settings.updated_at} data={data} onReload={reload} />;
    case 'rewards':
      return <RewardManagerModule data={data} onReload={reload} />;
    case 'players':
      return <PlayerManagerModule data={data} />;
    case 'dashboard':
      return <DashboardEditorModule key={data.dashboard.updated_at} data={data} onReload={reload} />;
    case 'languages':
      return <LanguageManagerModule data={data} onReload={reload} />;
    case 'sessions':
      return <SessionManagerModule data={data} onReload={reload} />;
    case 'system':
      return <SystemSettingsModule key={data.settings.updated_at} data={data} onReload={reload} />;
    case 'audit':
      return <AuditLogsModule data={data} />;
  }
}
