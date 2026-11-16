import { useMemo, useState } from 'react';
import { Activity, Pause, Play, Plus, RotateCcw, Save, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/stores/toastStore';
import type { AdminWorkspaceData } from '@/features/admin/adminTypes';
import { LocalizedFields } from '@/features/admin/components/LocalizedFields';
import { I18N_NAMESPACES, STATIC_RESOURCES, applyI18nOverrides } from '@/i18n/config';
import { adminApi, type SystemHealthReport } from '@/services/api/adminApi';
import { getSupabase } from '@/services/supabase/client';
import { useAppStore } from '@/stores/appStore';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[next] = v;
    else if (v && typeof v === 'object') Object.assign(out, flattenKeys(v as Record<string, unknown>, next));
  }
  return out;
}

export function LanguageManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [ns, setNs] = useState<(typeof I18N_NAMESPACES)[number]>('common');
  const [search, setSearch] = useState('');

  const enFlat = useMemo(() => flattenKeys(STATIC_RESOURCES.en[ns]), [ns]);
  const thFlat = useMemo(() => flattenKeys(STATIC_RESOURCES.th[ns]), [ns]);

  const overrideMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of data.overrides) {
      if (o.namespace === ns) m.set(`${o.lang}:${o.key}`, o.value);
    }
    return m;
  }, [data.overrides, ns]);

  const keys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.keys(enFlat).filter(
      (k) =>
        !q ||
        k.toLowerCase().includes(q) ||
        enFlat[k].toLowerCase().includes(q) ||
        (thFlat[k] ?? '').toLowerCase().includes(q),
    );
  }, [enFlat, thFlat, search]);

  const saveOverride = async (key: string, thVal: string, enVal: string) => {
    const sb = getSupabase();
    await sb.from('i18n_overrides').upsert(
      [
        { lang: 'th', namespace: ns, key, value: thVal },
        { lang: 'en', namespace: ns, key, value: enVal },
      ],
      { onConflict: 'lang,namespace,key' },
    );
    await onReload();
    const { data: all } = await sb.from('i18n_overrides').select('*');
    if (all) applyI18nOverrides(all);
    toast('success', t('admin:common.saved'));
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>{t('admin:modules.languages')}</CardTitle>
        <div className="flex gap-2">
          <Select
            className="w-40"
            value={ns}
            onChange={(e) => setNs(e.target.value as (typeof I18N_NAMESPACES)[number])}
          >
            {I18N_NAMESPACES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Input
            className="w-56"
            placeholder={t('common:app.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
        {keys.map((k) => (
          <I18nRowEditor
            key={`${ns}:${k}`}
            keyName={k}
            initialTh={overrideMap.get(`th:${k}`) ?? thFlat[k] ?? ''}
            initialEn={overrideMap.get(`en:${k}`) ?? enFlat[k] ?? ''}
            onSave={(thVal, enVal) => saveOverride(k, thVal, enVal)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function I18nRowEditor({
  keyName,
  initialTh,
  initialEn,
  onSave,
}: {
  keyName: string;
  initialTh: string;
  initialEn: string;
  onSave: (th: string, en: string) => Promise<void>;
}) {
  const { t } = useTranslation('common');
  const [th, setTh] = useState(initialTh);
  const [en, setEn] = useState(initialEn);
  const dirty = th !== initialTh || en !== initialEn;

  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-12 items-center">
      <span className="font-mono text-xs text-slate-500 sm:col-span-3 break-all">{keyName}</span>
      <Input className="sm:col-span-4 h-9 text-sm" value={th} onChange={(e) => setTh(e.target.value)} />
      <Input className="sm:col-span-4 h-9 text-sm" value={en} onChange={(e) => setEn(e.target.value)} />
      <div className="sm:col-span-1 flex justify-end">
        <Button
          size="sm"
          variant={dirty ? 'default' : 'outline'}
          disabled={!dirty}
          onClick={() => void onSave(th, en)}
        >
          <Save className="h-3.5 w-3.5" />
          <span className="sr-only">{t('app.save')}</span>
        </Button>
      </div>
    </div>
  );
}

export function SessionManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [newName, setNewName] = useState('Open House Session');
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const startNew = async () => {
    try {
      await adminApi.startSession(newName.trim() || 'Open House', true);
      await onReload();
      toast('success', t('admin:common.saved'));
    } catch (e) {
      toast('error', t('admin:common.saveFailed'), e instanceof Error ? e.message : undefined);
    }
  };

  const toggleReg = async (id: string, open: boolean) => {
    await adminApi.toggleRegistration(id, open);
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  const close = async (id: string) => {
    if (!window.confirm('Close this active session?')) return;
    await adminApi.closeSession(id);
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  const confirmReset = async () => {
    if (!resetTargetId || resetConfirmText !== 'RESET') return;
    await adminApi.resetSession(resetTargetId);
    setResetTargetId(null);
    setResetConfirmText('');
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin:sessions.startNew')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            className="max-w-sm"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('admin:sessions.newSessionName')}
          />
          <Button onClick={() => void startNew()}>
            <Plus className="h-4 w-4" />
            {t('admin:sessions.startNew')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin:modules.sessions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.sessions.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900">{s.name}</span>
                  <Badge variant={s.status === 'ACTIVE' ? 'success' : 'secondary'}>{s.status}</Badge>
                  {s.status === 'ACTIVE' && (
                    <Badge variant={s.registration_open ? 'info' : 'warning'}>
                      {s.registration_open ? 'Registration Open' : 'Registration Paused'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500">Started: {new Date(s.started_at).toLocaleString()}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {s.status === 'ACTIVE' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void toggleReg(s.id, !s.registration_open)}
                    >
                      {s.registration_open ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {s.registration_open ? t('admin:sessions.pauseReg') : t('admin:sessions.resumeReg')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void close(s.id)}>
                      <Square className="h-3.5 w-3.5" />
                      {t('admin:sessions.closeSession')}
                    </Button>
                  </>
                )}
                <Button size="sm" variant="destructive" onClick={() => setResetTargetId(s.id)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('admin:sessions.resetSession')}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(resetTargetId)} onOpenChange={(o) => !o && setResetTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:sessions.resetSession')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-rose-700 font-medium">{t('admin:sessions.resetWarning')}</p>
          <Input
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="RESET"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetTargetId(null)}>
              {t('common:app.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={resetConfirmText !== 'RESET'}
              onClick={() => void confirmReset()}
            >
              {t('common:app.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SystemSettingsModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const realtimeStatus = useAppStore((s) => s.realtimeStatus);
  const [maintenanceMode, setMaintenanceMode] = useState(data.settings.maintenance_mode);
  const [maintenanceMsg, setMaintenanceMsg] = useState(data.settings.maintenance_message);
  const [announcement, setAnnouncement] = useState(data.settings.announcement ?? { th: '', en: '' });
  const [health, setHealth] = useState<SystemHealthReport | null>(null);

  const save = async () => {
    const cleanAnn = announcement.th?.trim() || announcement.en?.trim() ? announcement : null;
    await adminApi.updateSettings(data.settings.id, {
      maintenance_mode: maintenanceMode,
      maintenance_message: maintenanceMsg,
      announcement: cleanAnn,
    });
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  const checkHealth = async () => {
    try {
      setHealth(await adminApi.systemHealth());
    } catch (e) {
      toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin:modules.system')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <span className="font-bold text-slate-900">{t('admin:system.maintenanceMode')}</span>
            <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
          </label>

          <LocalizedFields
            label={t('admin:system.maintenanceMessage')}
            value={maintenanceMsg}
            onChange={setMaintenanceMsg}
          />
          <LocalizedFields
            label={t('admin:system.announcement')}
            value={announcement}
            onChange={setAnnouncement}
          />

          <Button onClick={() => void save()}>
            <Save className="h-4 w-4" />
            {t('common:app.save')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>System Health</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void checkHealth()}>
            <Activity className="h-4 w-4" />
            {t('admin:system.runHealthCheck')}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
            <p className="text-xs text-slate-500">{t('admin:system.realtimeStatus')}</p>
            <p className="font-extrabold uppercase">{realtimeStatus}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
            <p className="text-xs text-slate-500">{t('admin:system.dbLatency')}</p>
            <p className="font-extrabold">{health ? `${health.db_latency_ms} ms` : '—'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
            <p className="text-xs text-slate-500">{t('admin:system.storageBucket')}</p>
            <p className="font-extrabold">{health ? (health.storage_ready ? 'Ready' : 'Missing') : '—'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AuditLogsModule({ data }: { data: AdminWorkspaceData }) {
  const { t } = useTranslation('admin');
  const [filter, setFilter] = useState('');
  const logs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return data.auditLogs;
    return data.auditLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        (l.admin_email ?? '').toLowerCase().includes(q),
    );
  }, [data.auditLogs, filter]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t('modules.audit')}</CardTitle>
        <Input
          className="w-60"
          placeholder="Filter action/entity..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left uppercase text-slate-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Admin</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Entity</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 font-medium">{l.admin_email ?? l.admin_id ?? 'system'}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="info">{l.action}</Badge>
                  </td>
                  <td className="py-2 pr-3 font-mono">{l.entity}</td>
                  <td className="py-2 font-mono text-[11px] text-slate-600 max-w-md truncate">
                    {JSON.stringify(l.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
