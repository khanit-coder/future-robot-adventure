import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Download, Plus, Save, Sliders, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DashboardMode, DashboardSettingsRow, RewardRow } from '@engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/stores/toastStore';
import type { AdminWorkspaceData } from '@/features/admin/adminTypes';
import { ImageUploader } from '@/features/admin/components/ImageUploader';
import { LocalizedFields } from '@/features/admin/components/LocalizedFields';
import { currentLang } from '@/i18n/config';
import { adminApi, type AdminPlayerJoined } from '@/services/api/adminApi';
import { getSupabase } from '@/services/supabase/client';
import { pickLocalized, toCsv } from '@/utils/localize';

export function RewardManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const lang = currentLang();
  const [claimFilter, setClaimFilter] = useState('');

  const toggleRewards = async (enabled: boolean) => {
    await adminApi.updateSettings(data.settings.id, { rewards_enabled: enabled });
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  const addReward = async () => {
    await getSupabase()
      .from('rewards')
      .insert({
        position: data.rewards.length + 1,
        name: { th: 'ของรางวัลใหม่', en: 'New Reward' },
        description: { th: 'คำอธิบาย', en: 'Description' },
        min_score: 500,
        stock_total: 20,
      });
    await onReload();
  };

  const filteredClaims = useMemo(() => {
    const q = claimFilter.trim().toLowerCase();
    if (!q) return data.claims;
    return data.claims.filter(
      (c) =>
        c.claim_code.toLowerCase().includes(q) ||
        c.players?.display_name.toLowerCase().includes(q) ||
        c.players?.school.toLowerCase().includes(q),
    );
  }, [data.claims, claimFilter]);

  const handleClaimAction = async (id: string, status: 'CLAIMED' | 'CANCELLED') => {
    try {
      await adminApi.setClaimStatus(id, status);
      await onReload();
      toast('success', t('admin:common.saved'));
    } catch (e) {
      toast('error', t('admin:common.saveFailed'), e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-extrabold text-slate-900">{t('admin:rewards.enableRewards')}</p>
            <p className="text-xs text-slate-500">
              When disabled, students still finish and see their score without claiming prizes.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Switch checked={data.settings.rewards_enabled} onCheckedChange={(v) => void toggleRewards(v)} />
            <Button size="sm" onClick={() => void addReward()}>
              <Plus className="h-4 w-4" />
              {t('admin:rewards.addReward')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {data.rewards.map((rw) => (
          <RewardEditorCard key={`${rw.id}:${rw.updated_at}`} reward={rw} onReload={onReload} />
        ))}
      </div>

      {/* Claims desk */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>{t('admin:rewards.claimsTitle')}</CardTitle>
          <Input
            className="w-64"
            placeholder={t('common:app.search')}
            value={claimFilter}
            onChange={(e) => setClaimFilter(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">{t('admin:rewards.claimCode')}</th>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Reward</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">{t('admin:common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 font-mono font-extrabold text-indigo-700">{c.claim_code}</td>
                    <td className="py-2.5 pr-3">
                      <p className="font-bold">{c.players?.display_name ?? c.player_id}</p>
                      <p className="text-xs text-slate-500">{c.players?.school}</p>
                    </td>
                    <td className="py-2.5 pr-3">{pickLocalized(c.rewards?.name, lang, 'en')}</td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant={
                          c.status === 'CLAIMED'
                            ? 'success'
                            : c.status === 'RESERVED'
                              ? 'warning'
                              : 'secondary'
                        }
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right space-x-1.5">
                      {c.status === 'RESERVED' && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => void handleClaimAction(c.id, 'CLAIMED')}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {t('admin:rewards.markClaimed')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleClaimAction(c.id, 'CANCELLED')}
                          >
                            <X className="h-3.5 w-3.5" />
                            {t('admin:rewards.cancelClaim')}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RewardEditorCard({ reward, onReload }: { reward: RewardRow; onReload: () => Promise<void> }) {
  const { t } = useTranslation(['admin', 'common']);
  const [draft, setDraft] = useState(reward);

  const left = Math.max(0, draft.stock_total - draft.reserved_count - draft.claimed_count);

  const save = async () => {
    const { error } = await getSupabase()
      .from('rewards')
      .update({
        name: draft.name,
        description: draft.description,
        image_url: draft.image_url,
        min_score: draft.min_score,
        stock_total: Math.max(draft.reserved_count + draft.claimed_count, draft.stock_total),
        is_active: draft.is_active,
      })
      .eq('id', draft.id);
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  const remove = async () => {
    if (!window.confirm(t('admin:common.confirmDelete'))) return;
    const { error } = await getSupabase().from('rewards').delete().eq('id', draft.id);
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }
    await onReload();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Badge variant="info">
              {t('admin:rewards.available')}: {left}
            </Badge>
            <Badge variant="warning">
              {t('admin:rewards.reserved')}: {draft.reserved_count}
            </Badge>
            <Badge variant="success">
              {t('admin:rewards.claimed')}: {draft.claimed_count}
            </Badge>
          </div>
          <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
        </div>

        <LocalizedFields
          label="Reward Name"
          value={draft.name}
          onChange={(v) => setDraft({ ...draft, name: v })}
        />
        <LocalizedFields
          label="Description"
          value={draft.description}
          onChange={(v) => setDraft({ ...draft, description: v })}
        />

        <ImageUploader
          folder="rewards"
          label="Reward Image"
          value={draft.image_url}
          onChange={(url) => setDraft({ ...draft, image_url: url })}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>{t('admin:rewards.minScore')}</Label>
            <Input
              type="number"
              min={0}
              value={draft.min_score}
              onChange={(e) => setDraft({ ...draft, min_score: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('admin:rewards.stockTotal')}</Label>
            <Input
              type="number"
              min={draft.reserved_count + draft.claimed_count}
              value={draft.stock_total}
              onChange={(e) => setDraft({ ...draft, stock_total: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="destructive" size="sm" onClick={() => void remove()}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => void save()}>
            <Save className="h-4 w-4" />
            {t('common:app.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlayerManagerModule({ data }: { data: AdminWorkspaceData }) {
  const { t } = useTranslation(['admin', 'common']);
  const [sessionId, setSessionId] = useState(
    data.sessions.find((s) => s.status === 'ACTIVE')?.id ?? data.sessions[0]?.id ?? '',
  );
  const [rows, setRows] = useState<AdminPlayerJoined[]>([]);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<AdminPlayerJoined | null>(null);
  const [pointsDelta, setPointsDelta] = useState('50');
  const [reason, setReason] = useState('Bonus points');

  const loadPlayers = useCallback(async () => {
    if (!sessionId) return;
    try {
      setRows(await adminApi.fetchSessionPlayers(sessionId));
    } catch (e) {
      toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
    }
  }, [sessionId, t]);

  useEffect(() => {
    let active = true;
    if (!sessionId) return;
    void adminApi
      .fetchSessionPlayers(sessionId)
      .then((res) => {
        if (active) setRows(res);
      })
      .catch((e) => {
        if (active) toast('error', t('common:app.error'), e instanceof Error ? e.message : undefined);
      });
    return () => {
      active = false;
    };
  }, [sessionId, t]);

  const schools = useMemo(() => Array.from(new Set(rows.map((r) => r.player.school))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (schoolFilter && r.player.school !== schoolFilter) return false;
      if (!q) return true;
      return r.player.display_name.toLowerCase().includes(q) || r.player.school.toLowerCase().includes(q);
    });
  }, [rows, search, schoolFilter]);

  const exportCsv = () => {
    const csv = toCsv(
      [
        'Name',
        'School',
        'Grade',
        'Language',
        'Status',
        'Score',
        'Levels Completed',
        'Attempts',
        'Hints Used',
        'Best Level (ms)',
        'Registered At',
      ],
      filtered.map((r) => [
        r.player.display_name,
        r.player.school,
        r.player.grade ?? '',
        r.player.lang,
        r.session?.status ?? '',
        r.session?.total_score ?? 0,
        r.session?.levels_completed ?? 0,
        r.session?.total_attempts ?? 0,
        r.session?.hints_used ?? 0,
        r.session?.best_level_ms ?? '',
        r.player.created_at,
      ]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `players-${sessionId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdjust = async () => {
    if (!adjustTarget?.session) return;
    const pts = Number(pointsDelta);
    try {
      await adminApi.adjustScore(adjustTarget.session.id, pts, reason);
      setAdjustTarget(null);
      await loadPlayers();
      toast('success', t('admin:common.saved'));
    } catch (e) {
      toast('error', t('admin:common.saveFailed'), e instanceof Error ? e.message : undefined);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin:common.confirmDelete'))) return;
    await adminApi.deletePlayer(id);
    await loadPlayers();
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>
          {t('admin:modules.players')} ({filtered.length})
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-48" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {data.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </Select>
          <Select className="w-44" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
            <option value="">{t('admin:players.allSchools')}</option>
            {schools.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </Select>
          <Input
            className="w-48"
            placeholder={t('common:app.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            {t('admin:common.exportCsv')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">School</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Levels</th>
                <th className="py-2 pr-3">Attempts</th>
                <th className="py-2 text-right">{t('admin:common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.player.id} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3 font-bold">{r.player.display_name}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{r.player.school}</td>
                  <td className="py-2.5 pr-3">
                    <Badge variant="secondary">{r.session?.status ?? '—'}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 font-extrabold text-indigo-700">
                    {r.session?.total_score ?? 0}
                  </td>
                  <td className="py-2.5 pr-3">{r.session?.levels_completed ?? 0}</td>
                  <td className="py-2.5 pr-3">{r.session?.total_attempts ?? 0}</td>
                  <td className="py-2.5 text-right space-x-1">
                    {r.session && (
                      <Button size="sm" variant="outline" onClick={() => setAdjustTarget(r)}>
                        <Sliders className="h-3.5 w-3.5" />
                        {t('admin:players.adjustScore')}
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => void handleDelete(r.player.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={Boolean(adjustTarget)} onOpenChange={(o) => !o && setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('admin:players.adjustScore')} — {adjustTarget?.player.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t('admin:players.pointsDelta')}</Label>
              <Input type="number" value={pointsDelta} onChange={(e) => setPointsDelta(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('admin:players.reason')}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdjustTarget(null)}>
                {t('common:app.cancel')}
              </Button>
              <Button onClick={() => void handleAdjust()}>{t('common:app.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function DashboardEditorModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [form, setForm] = useState<DashboardSettingsRow>(data.dashboard);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateDashboardSettings(form.id, {
        mode: form.mode,
        columns: form.columns,
        robot_size: form.robot_size,
        page_size: form.page_size,
        rotate_seconds: form.rotate_seconds,
        spotlight_interval_seconds: form.spotlight_interval_seconds,
        show_school: form.show_school,
        show_leaderboard: form.show_leaderboard,
        show_scores: form.show_scores,
        show_online_count: form.show_online_count,
        animations_enabled: form.animations_enabled,
        theme: form.theme,
        background_url: form.background_url,
      });
      await onReload();
      toast('success', t('admin:common.saved'));
    } catch (e) {
      toast('error', t('admin:common.saveFailed'), e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin:modules.dashboard')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Default Mode</Label>
            <Select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value as DashboardMode })}
            >
              <option value="GRID">Robot Grid</option>
              <option value="PLANET">Planet Map</option>
              <option value="SPOTLIGHT">Spotlight</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <Select
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value as DashboardSettingsRow['theme'] })}
            >
              <option value="space">Deep Space</option>
              <option value="lab">Sci-Fi Lab</option>
              <option value="planet">Nebula Planet</option>
              <option value="light">Bright Classroom</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Columns (3–14)</Label>
            <Input
              type="number"
              min={3}
              max={14}
              value={form.columns}
              onChange={(e) => setForm({ ...form, columns: Number(e.target.value) || 8 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Robot Size (px)</Label>
            <Input
              type="number"
              min={48}
              max={200}
              value={form.robot_size}
              onChange={(e) => setForm({ ...form, robot_size: Number(e.target.value) || 96 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Players Per Page (8–200)</Label>
            <Input
              type="number"
              min={8}
              max={200}
              value={form.page_size}
              onChange={(e) => setForm({ ...form, page_size: Number(e.target.value) || 48 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Page Rotation (sec)</Label>
            <Input
              type="number"
              min={3}
              max={120}
              value={form.rotate_seconds}
              onChange={(e) => setForm({ ...form, rotate_seconds: Number(e.target.value) || 12 })}
            />
          </div>
        </div>

        <ImageUploader
          folder="dashboard"
          label="Custom Background Image (optional)"
          value={form.background_url}
          onChange={(url) => setForm({ ...form, background_url: url })}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['show_school', 'Show School Names'],
              ['show_leaderboard', 'Show Leaderboard'],
              ['show_scores', 'Show Player Scores'],
              ['show_online_count', 'Show Online Count'],
              ['animations_enabled', 'Enable Animations'],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold"
            >
              <span>{label}</span>
              <Switch checked={form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
            </label>
          ))}
        </div>

        <Button onClick={() => void save()} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? t('common:app.saving') : t('common:app.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
