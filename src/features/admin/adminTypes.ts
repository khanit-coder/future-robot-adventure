import type { adminApi } from '@/services/api/adminApi';

export type AdminModuleId =
  | 'overview'
  | 'settings'
  | 'branding'
  | 'robots'
  | 'scenes'
  | 'levels'
  | 'blocks'
  | 'lessons'
  | 'hints'
  | 'scores'
  | 'timers'
  | 'rewards'
  | 'players'
  | 'dashboard'
  | 'languages'
  | 'sessions'
  | 'system'
  | 'audit';

export type AdminWorkspaceData = Awaited<ReturnType<typeof adminApi.loadWorkspace>>;
