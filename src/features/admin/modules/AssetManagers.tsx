import { useState } from 'react';
import { Plus, Save, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RobotAssetRow, SceneAssetRow, ThemeKey } from '@engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/stores/toastStore';
import { RobotIllustration, type RobotVisualState } from '@/components/common/RobotIllustration';
import type { AdminWorkspaceData } from '@/features/admin/adminTypes';
import { ImageUploader } from '@/features/admin/components/ImageUploader';
import { LocalizedFields } from '@/features/admin/components/LocalizedFields';
import { SpritesheetTemplateGuide } from './SpritesheetTemplateGuide';
import { BUILTIN_ANIMATIONS } from '@/game-engine/animations/animationConstants';
import { getSupabase } from '@/services/supabase/client';
import { pickLocalized } from '@/utils/localize';
import { currentLang } from '@/i18n/config';

const ANIM_STATES: RobotVisualState[] = ['idle', 'walk', 'run', 'jump', 'turn', 'wave', 'celebrate', 'fail'];

export function RobotManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const lang = currentLang();
  const [selectedId, setSelectedId] = useState<string>(data.robots[0]?.id ?? '');
  const [previewState, setPreviewState] = useState<RobotVisualState>('idle');

  const current = data.robots.find((r) => r.id === selectedId) ?? data.robots[0] ?? null;
  const [draft, setDraft] = useState<RobotAssetRow | null>(current);

  const pick = (r: RobotAssetRow) => {
    setSelectedId(r.id);
    setDraft(structuredClone(r));
  };

  const handleApplyTemplate = async (
    url: string,
    frameWidth: number,
    frameHeight: number,
    anims: typeof BUILTIN_ANIMATIONS,
  ) => {
    if (!draft) return;
    const updated = {
      ...draft,
      sprite_url: url,
      frame_width: frameWidth,
      frame_height: frameHeight,
      animations: anims,
    };
    setDraft(updated);
    const sb = getSupabase();
    const { error } = await sb
      .from('robot_assets')
      .update({
        sprite_url: url,
        frame_width: frameWidth,
        frame_height: frameHeight,
        animations: anims,
      })
      .eq('id', draft.id);
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }
    await onReload();
    toast('success', 'นำตัวอย่างต้นแบบ Spritesheet ไปใช้เรียบร้อยแล้ว');
  };

  const createRobot = async () => {
    const sb = getSupabase();
    const { data: created, error } = await sb
      .from('robot_assets')
      .insert({
        name: { th: 'หุ่นยนต์ใหม่', en: 'New Robot' },
        kind: 'builtin',
        builtin_style: 'bolt',
        primary_color: '#38bdf8',
      })
      .select('*')
      .single();
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }
    await onReload();
    pick(created as RobotAssetRow);
    toast('success', t('admin:common.saved'));
  };

  const save = async () => {
    if (!draft) return;
    const sb = getSupabase();
    if (draft.is_default) {
      await sb.from('robot_assets').update({ is_default: false }).neq('id', draft.id);
    }
    const { error } = await sb
      .from('robot_assets')
      .update({
        name: draft.name,
        kind: draft.kind,
        builtin_style: draft.builtin_style,
        sprite_url: draft.sprite_url,
        frame_width: draft.frame_width,
        frame_height: draft.frame_height,
        animations: draft.animations,
        scale: draft.scale,
        move_speed_ms: draft.move_speed_ms,
        primary_color: draft.primary_color,
        is_default: draft.is_default,
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

  const remove = async (id: string) => {
    if (!window.confirm(t('admin:common.confirmDelete'))) return;
    const { error } = await getSupabase().from('robot_assets').delete().eq('id', id);
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }
    await onReload();
    setDraft(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t('admin:modules.robots')}</CardTitle>
          <Button size="sm" onClick={() => void createRobot()}>
            <Plus className="h-4 w-4" />
            {t('common:app.add')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.robots.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => pick(r)}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left cursor-pointer ${
                draft?.id === r.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <RobotIllustration robot={r} size={42} state="idle" />
                <div>
                  <p className="font-bold text-sm text-slate-900">{pickLocalized(r.name, lang, 'en')}</p>
                  <p className="text-xs text-slate-500">{r.kind}</p>
                </div>
              </div>
              {r.is_default && (
                <Badge variant="warning">
                  <Star className="h-3 w-3" /> Default
                </Badge>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-8">
        <CardContent className="p-6 space-y-5">
          {draft ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-extrabold text-slate-900">
                  {pickLocalized(draft.name, lang, 'en')}
                </h3>
                {!draft.is_default && (
                  <Button variant="destructive" size="sm" onClick={() => void remove(draft.id)}>
                    <Trash2 className="h-4 w-4" />
                    {t('common:app.delete')}
                  </Button>
                )}
              </div>

              {/* Animation preview */}
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-950 p-5 text-white">
                <RobotIllustration robot={draft} size={112} state={previewState} />
                <div className="flex flex-wrap justify-center gap-1.5">
                  {ANIM_STATES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPreviewState(st)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase cursor-pointer ${
                        previewState === st ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <LocalizedFields
                label="Robot Name"
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Asset Type</Label>
                  <Select
                    value={draft.kind}
                    onChange={(e) =>
                      setDraft({ ...draft, kind: e.target.value as 'builtin' | 'spritesheet' })
                    }
                  >
                    <option value="builtin">Builtin Vector Robot</option>
                    <option value="spritesheet">Uploaded Spritesheet</option>
                  </Select>
                </div>

                {draft.kind === 'builtin' ? (
                  <div className="space-y-1.5">
                    <Label>Builtin Style</Label>
                    <Select
                      value={draft.builtin_style ?? 'bolt'}
                      onChange={(e) => setDraft({ ...draft, builtin_style: e.target.value })}
                    >
                      <option value="bolt">Bolt (Classic)</option>
                      <option value="nova">Nova (Dual Antenna)</option>
                      <option value="gizmo">Gizmo (Hover Thruster)</option>
                    </Select>
                  </div>
                ) : (
                  <ImageUploader
                    folder="robots"
                    label="Spritesheet PNG (อัปโหลดแล้วบันทึกอัตโนมัติ)"
                    value={draft.sprite_url}
                    onChange={(url) => setDraft((d) => (d ? { ...d, sprite_url: url } : d))}
                    onPersist={async (url) => {
                      await getSupabase().from('robot_assets').update({ sprite_url: url }).eq('id', draft.id);
                      await onReload();
                    }}
                  />
                )}
              </div>

              {draft.kind === 'spritesheet' && (
                <div className="space-y-4">
                  <SpritesheetTemplateGuide
                    currentRobot={draft}
                    onApplyTemplate={handleApplyTemplate}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Frame Width (px)</Label>
                      <Input
                        type="number"
                        min={16}
                        value={draft.frame_width ?? 96}
                        onChange={(e) => setDraft({ ...draft, frame_width: Number(e.target.value) || 96 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Frame Height (px)</Label>
                      <Input
                        type="number"
                        min={16}
                        value={draft.frame_height ?? 96}
                        onChange={(e) => setDraft({ ...draft, frame_height: Number(e.target.value) || 96 })}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label>Animation Frame Ranges (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        value={JSON.stringify(draft.animations, null, 2)}
                        onChange={(e) => {
                          try {
                            setDraft({ ...draft, animations: JSON.parse(e.target.value) });
                          } catch {
                            // wait until valid JSON
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Primary Color</Label>
                  <Input
                    type="color"
                    value={draft.primary_color}
                    onChange={(e) => setDraft({ ...draft, primary_color: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Scale (0.2–4.0)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0.2}
                    max={4}
                    value={draft.scale}
                    onChange={(e) => setDraft({ ...draft, scale: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Move Speed (ms/step)</Label>
                  <Input
                    type="number"
                    min={100}
                    max={2000}
                    value={draft.move_speed_ms}
                    onChange={(e) => setDraft({ ...draft, move_speed_ms: Number(e.target.value) || 450 })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Switch
                    checked={draft.is_default}
                    onCheckedChange={(v) => setDraft({ ...draft, is_default: v })}
                  />
                  Default Robot
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Switch
                    checked={draft.is_active}
                    onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                  />
                  {t('admin:common.activeStatus')}
                </label>
              </div>

              <Button onClick={() => void save()}>
                <Save className="h-4 w-4" />
                {t('common:app.save')}
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a robot to edit.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SceneManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const lang = currentLang();
  const [draft, setDraft] = useState<SceneAssetRow | null>(data.scenes[0] ?? null);

  const createScene = async () => {
    const { data: created, error } = await getSupabase()
      .from('scene_assets')
      .insert({ name: { th: 'ฉากใหม่', en: 'New Scene' }, kind: 'builtin', theme: 'training' })
      .select('*')
      .single();
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }
    await onReload();
    setDraft(created as SceneAssetRow);
  };

  const save = async () => {
    if (!draft) return;
    const { error } = await getSupabase()
      .from('scene_assets')
      .update({
        name: draft.name,
        kind: draft.kind,
        theme: draft.theme,
        image_url: draft.image_url,
        width: draft.width,
        height: draft.height,
        parallax: draft.parallax,
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

  const remove = async (id: string) => {
    if (!window.confirm(t('admin:common.confirmDelete'))) return;
    await getSupabase().from('scene_assets').delete().eq('id', id);
    await onReload();
    setDraft(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{t('admin:modules.scenes')}</CardTitle>
          <Button size="sm" onClick={() => void createScene()}>
            <Plus className="h-4 w-4" />
            {t('common:app.add')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.scenes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setDraft(structuredClone(s))}
              className={`w-full rounded-xl border p-3 text-left cursor-pointer ${
                draft?.id === s.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <p className="font-bold text-sm text-slate-900">{pickLocalized(s.name, lang, 'en')}</p>
              <p className="text-xs text-slate-500">
                {s.kind} • {s.theme}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-8">
        <CardContent className="space-y-5 p-6">
          {draft ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-900">
                  {pickLocalized(draft.name, lang, 'en')}
                </h3>
                <Button variant="destructive" size="sm" onClick={() => void remove(draft.id)}>
                  <Trash2 className="h-4 w-4" />
                  {t('common:app.delete')}
                </Button>
              </div>

              {/* Scene Preview */}
              <div
                className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white"
                style={
                  draft.kind === 'image' && draft.image_url
                    ? {
                        backgroundImage: `url(${draft.image_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              >
                <div className="rounded-xl bg-slate-950/70 px-4 py-2 text-xs font-bold">
                  {draft.width}×{draft.height} • {draft.theme.toUpperCase()}
                </div>
              </div>

              <LocalizedFields
                label="Scene Name"
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Kind</Label>
                  <Select
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as 'builtin' | 'image' })}
                  >
                    <option value="builtin">Builtin Space Theme</option>
                    <option value="image">Custom Background Image</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Theme</Label>
                  <Select
                    value={draft.theme}
                    onChange={(e) => setDraft({ ...draft, theme: e.target.value as ThemeKey })}
                  >
                    <option value="training">Training Station</option>
                    <option value="energy">Energy Planet</option>
                    <option value="station">Lost Station</option>
                    <option value="final">Final Mission</option>
                  </Select>
                </div>
              </div>

              {draft.kind === 'image' && (
                <ImageUploader
                  folder="scenes"
                  label="Background Image (อัปโหลดแล้วบันทึกอัตโนมัติ)"
                  value={draft.image_url}
                  onChange={(url) => setDraft((d) => (d ? { ...d, image_url: url } : d))}
                  onPersist={async (url) => {
                    await getSupabase().from('scene_assets').update({ image_url: url }).eq('id', draft.id);
                    await onReload();
                  }}
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Width (px)</Label>
                  <Input
                    type="number"
                    min={320}
                    max={4096}
                    value={draft.width}
                    onChange={(e) => setDraft({ ...draft, width: Number(e.target.value) || 960 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Height (px)</Label>
                  <Input
                    type="number"
                    min={240}
                    max={2304}
                    value={draft.height}
                    onChange={(e) => setDraft({ ...draft, height: Number(e.target.value) || 540 })}
                  />
                </div>
              </div>

              <Button onClick={() => void save()}>
                <Save className="h-4 w-4" />
                {t('common:app.save')}
              </Button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a scene to edit.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
