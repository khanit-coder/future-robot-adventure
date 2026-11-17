import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Flame, Play, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameSettingsRow, GameTheme, ScoreRules } from '@engine';
import { computeMissionScore } from '@engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/stores/toastStore';
import { adminApi } from '@/services/api/adminApi';
import { publicApi, type DashboardSnapshot } from '@/services/api/publicApi';
import type { AdminWorkspaceData } from '@/features/admin/adminTypes';
import { LocalizedFields } from '@/features/admin/components/LocalizedFields';
import { ImageUploader } from '@/features/admin/components/ImageUploader';
import { cn } from '@/utils/cn';
import { THEME_OPTIONS } from '../themeOptions';
import { StudentSimulatorModal } from './StudentSimulatorModal';

export function OverviewModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload?: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const [simModalOpen, setSimModalOpen] = useState(false);
  const activeSession = data.sessions.find((s) => s.status === 'ACTIVE');

  const refreshSnapshot = useCallback(() => {
    void publicApi
      .fetchDashboardSnapshot(activeSession?.id)
      .then(setSnap)
      .catch(() => {});
  }, [activeSession?.id]);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  const players = snap?.players ?? [];
  const playing = players.filter((p) => p.status === 'PLAYING' || p.status === 'LEARNING').length;
  const finished = players.filter((p) => p.status === 'FINISHED' || p.status === 'TIME_EXPIRED').length;
  const latestPub = data.publishedConfigs[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title={t('admin:overview.players')} value={players.length} />
        <Kpi title={t('admin:overview.playing')} value={playing} />
        <Kpi title={t('admin:overview.finished')} value={finished} />
        <Kpi title={t('admin:overview.missions')} value={snap?.total_missions_completed ?? 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 shadow-sm md:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-200">
                <Flame className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  จำลองนักเรียนใช้งานพร้อมกัน (Concurrent Student Stress Test)
                  <Badge variant="info" className="text-xs">
                    Admin Tool
                  </Badge>
                </CardTitle>
                <p className="text-xs text-slate-600 mt-0.5">
                  ทดสอบสมรรถนะเซิร์ฟเวอร์และการแสดงผลหน้าจอแดชบอร์ด 100 จอ กำหนดจำนวนนักเรียนพร้อมกัน ดู Metrics และล้างข้อมูลได้ในคลิกเดียว
                </p>
              </div>
            </div>
            <Button
              onClick={() => setSimModalOpen(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-xs shadow-md flex items-center gap-1.5 shrink-0"
            >
              <Play className="h-4 w-4" />
              เปิดระบบทดสอบ (Run Simulator)
            </Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin:modules.sessions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {activeSession ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{activeSession.name}</span>
                  <Badge variant="success">{activeSession.status}</Badge>
                </div>
                <p className="text-slate-500">
                  Registration: {activeSession.registration_open ? 'OPEN' : 'PAUSED'}
                </p>
              </>
            ) : (
              <p className="text-amber-700 font-medium">No active session.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Published Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {latestPub ? (
              <p className="font-semibold text-slate-700">
                Version <span className="text-indigo-600">v{latestPub.version}</span> •{' '}
                {new Date(latestPub.published_at).toLocaleString()}
              </p>
            ) : (
              <p className="text-amber-700">{t('admin:topbar.nonePublished')}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {t('admin:overview.openDashboard')}
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/play" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {t('admin:overview.openPlayer')}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <StudentSimulatorModal
        open={simModalOpen}
        onOpenChange={setSimModalOpen}
        data={data}
        onReload={async () => {
          refreshSnapshot();
          if (onReload) await onReload();
        }}
      />
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
        <p className="mt-1 text-3xl font-extrabold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

export function GameSettingsModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [form, setForm] = useState<GameSettingsRow>(data.settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(form.id, {
        game_title: form.game_title,
        tagline: form.tagline,
        event_title: form.event_title,
        college_name: form.college_name,
        default_language: form.default_language,
        lessons_mandatory: form.lessons_mandatory,
        allow_skip_lessons: form.allow_skip_lessons,
        rewards_enabled: form.rewards_enabled,
        timer_enabled: form.timer_enabled,
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
        <CardTitle>{t('admin:modules.settings')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LocalizedFields
          label="Game Title"
          value={form.game_title}
          onChange={(v) => setForm({ ...form, game_title: v })}
        />
        <LocalizedFields
          label="Tagline"
          value={form.tagline}
          onChange={(v) => setForm({ ...form, tagline: v })}
        />
        <LocalizedFields
          label="Event Title"
          value={form.event_title}
          onChange={(v) => setForm({ ...form, event_title: v })}
        />
        <LocalizedFields
          label="College Name"
          value={form.college_name}
          onChange={(v) => setForm({ ...form, college_name: v })}
        />

        <div className="max-w-xs space-y-1.5">
          <Label>Default Language</Label>
          <Select
            value={form.default_language}
            onChange={(e) => setForm({ ...form, default_language: e.target.value as 'th' | 'en' })}
          >
            <option value="th">ไทย (th)</option>
            <option value="en">English (en)</option>
          </Select>
        </div>

        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold">
            <span>บังคับเรียนบทเรียนก่อนเล่น (Mandatory Lessons)</span>
            <Switch
              checked={form.lessons_mandatory}
              onCheckedChange={(v) => setForm({ ...form, lessons_mandatory: v })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold">
            <span>อนุญาตให้กดข้ามบทเรียน (Allow Skip Lessons)</span>
            <Switch
              checked={form.allow_skip_lessons}
              onCheckedChange={(v) => setForm({ ...form, allow_skip_lessons: v })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold">
            <span>เปิดระบบแลกของรางวัล (Enable Rewards)</span>
            <Switch
              checked={form.rewards_enabled}
              onCheckedChange={(v) => setForm({ ...form, rewards_enabled: v })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold">
            <span>เปิดระบบจับเวลา (Enable Timer)</span>
            <Switch
              checked={form.timer_enabled}
              onCheckedChange={(v) => setForm({ ...form, timer_enabled: v })}
            />
          </label>
        </div>

        <Button onClick={() => void save()} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? t('common:app.saving') : t('common:app.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function BrandingModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [form, setForm] = useState<GameSettingsRow>(data.settings);
  const [gameTheme, setGameTheme] = useState<GameTheme>(data.settings.score_rules?.game_theme ?? 'space');
  const [saving, setSaving] = useState(false);

  const persistField = async (patch: Partial<GameSettingsRow>) => {
    await adminApi.updateSettings(form.id, patch);
    await onReload();
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(form.id, {
        college_logo_url: form.college_logo_url,
        game_logo_url: form.game_logo_url,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        score_rules: {
          ...form.score_rules,
          game_theme: gameTheme,
        },
      });
      localStorage.setItem('fra_game_theme', gameTheme);
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
        <CardTitle>{t('admin:modules.branding')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Student Game Page Theme / Style 1–4 */}
        <div className="space-y-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/30 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-base font-extrabold flex items-center gap-2">
                <span>สไตล์หน้าเล่นเกมของนักเรียน (Student Game Page Theme)</span>
                <Badge variant="secondary" className="text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                  หน้าจอ /play ของนักเรียน
                </Badge>
              </Label>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                เลือกสไตล์ 1, 2, 3 หรือ 4 สำหรับหน้านักเรียนเข้าเล่นเกม (ตั้งค่าแยกอิสระจากหน้าจอแดชบอร์ด)
              </p>
            </div>
            <span className="text-xs text-indigo-700 dark:text-indigo-300 font-bold">
              ปัจจุบัน: แบบที่ {THEME_OPTIONS.find((t) => t.id === gameTheme)?.number ?? 1}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {THEME_OPTIONS.map((item) => {
              const isSelected = gameTheme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGameTheme(item.id)}
                  className={cn(
                    'group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer',
                    isSelected
                      ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/40 shadow-md dark:border-indigo-400 dark:bg-slate-900 dark:ring-indigo-400/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900',
                  )}
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-black',
                          isSelected
                            ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                        )}
                      >
                        {item.number}
                      </span>
                      {isSelected ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <Check className="h-3 w-3" /> หน้านักเรียน
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">
                          {item.nameEn}
                        </span>
                      )}
                    </div>

                    <h4 className="mt-2.5 text-sm font-extrabold text-slate-900 dark:text-white">
                      {item.name}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  {/* Card mini preview */}
                  <div
                    className={cn(
                      'mt-3.5 flex w-full items-center justify-between rounded-xl border p-2 text-xs font-bold transition-all',
                      item.cardPreviewClass,
                    )}
                  >
                    <span className={cn('text-[11px] font-black', item.textColor)}>
                      {item.badgeText}
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-xs"
                      style={{ backgroundColor: item.accentBg }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <ImageUploader
            folder="logos"
            label="College Logo (วงกลม ไม่มีขอบ - อัปโหลดแล้วบันทึกอัตโนมัติ)"
            circular
            value={form.college_logo_url}
            onChange={(url) => setForm((f) => ({ ...f, college_logo_url: url }))}
            onPersist={(url) => persistField({ college_logo_url: url })}
          />
          <ImageUploader
            folder="logos"
            label="Game Logo (อัปโหลดแล้วบันทึกอัตโนมัติ)"
            value={form.game_logo_url}
            onChange={(url) => setForm((f) => ({ ...f, game_logo_url: url }))}
            onPersist={(url) => persistField({ game_logo_url: url })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 max-w-md">
          <div className="space-y-1.5">
            <Label>Primary Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer"
              />
              <Input
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Secondary Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.secondary_color}
                onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer"
              />
              <Input
                value={form.secondary_color}
                onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
              />
            </div>
          </div>
        </div>

        <Button onClick={() => void save()} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? t('common:app.saving') : t('common:app.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ScoreManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [rules, setRules] = useState<ScoreRules>(data.settings.score_rules);
  const [saving, setSaving] = useState(false);

  const samplePerfect = computeMissionScore({
    rules,
    level: { max_score: 200 },
    hintsUsed: 0,
    failedAttempts: 0,
    elapsedMs: 15_000,
  });

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(data.settings.id, { score_rules: rules });
      await onReload();
      toast('success', t('admin:common.saved'));
    } catch (e) {
      toast('error', t('admin:common.saveFailed'), e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof ScoreRules; label: string }[] = [
    { key: 'mission_base', label: 'Mission Complete (+)' },
    { key: 'no_hint_bonus', label: 'No Hints Bonus (+)' },
    { key: 'no_error_bonus', label: 'No Errors Bonus (+)' },
    { key: 'time_bonus_max', label: 'Max Time Bonus (+)' },
    { key: 'time_bonus_full_seconds', label: 'Full Bonus Within (sec)' },
    { key: 'time_bonus_zero_seconds', label: 'Zero Time Bonus After (sec)' },
    { key: 'hint_penalty', label: 'Hint Penalty (-)' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin:modules.scores')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Input
                type="number"
                min={0}
                value={rules[f.key]}
                onChange={(e) => setRules({ ...rules, [f.key]: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
          Preview (15s solve, 0 hints, 0 errors, max 200): <strong>{samplePerfect.total} pts</strong> (Base{' '}
          {samplePerfect.base} + NoHint {samplePerfect.no_hint_bonus} + NoErr {samplePerfect.no_error_bonus} +
          Time {samplePerfect.time_bonus})
        </div>

        <Button onClick={() => void save()} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? t('common:app.saving') : t('common:app.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function TimerSettingsModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [form, setForm] = useState(data.settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(form.id, {
        timer_enabled: form.timer_enabled,
        total_duration_seconds: form.total_duration_seconds,
        lesson_timer_seconds: form.lesson_timer_seconds,
        level_timer_seconds: form.level_timer_seconds,
        bonus_seconds_per_level: form.bonus_seconds_per_level,
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
        <CardTitle>{t('admin:modules.timers')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
          <div>
            <p className="font-bold text-slate-900">Enable Main Game Timer</p>
            <p className="text-xs text-slate-500">
              Server-authoritative countdown started when entering gameplay.
            </p>
          </div>
          <Switch
            checked={form.timer_enabled}
            onCheckedChange={(v) => setForm({ ...form, timer_enabled: v })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Total Play Duration (seconds — default 1200 = 20 min)</Label>
            <Input
              type="number"
              min={60}
              max={14400}
              value={form.total_duration_seconds}
              onChange={(e) =>
                setForm({ ...form, total_duration_seconds: Math.max(60, Number(e.target.value) || 60) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bonus Seconds Per Cleared Level</Label>
            <Input
              type="number"
              min={0}
              max={600}
              value={form.bonus_seconds_per_level}
              onChange={(e) =>
                setForm({ ...form, bonus_seconds_per_level: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Optional Lesson Timer (seconds, blank = off)</Label>
            <Input
              type="number"
              min={10}
              value={form.lesson_timer_seconds ?? ''}
              onChange={(e) =>
                setForm({ ...form, lesson_timer_seconds: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default Per-Level Time Cap for Time Bonus (seconds, blank = global)</Label>
            <Input
              type="number"
              min={10}
              value={form.level_timer_seconds ?? ''}
              onChange={(e) =>
                setForm({ ...form, level_timer_seconds: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
        </div>

        <Button onClick={() => void save()} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? t('common:app.saving') : t('common:app.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
