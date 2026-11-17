import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HARD_LIMITS, PARAM_OF } from '@engine';
import type { BlockDefinitionRow, Command, LessonRow } from '@engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/stores/toastStore';
import type { AdminWorkspaceData } from '@/features/admin/adminTypes';
import { ImageUploader } from '@/features/admin/components/ImageUploader';
import { LocalizedFields } from '@/features/admin/components/LocalizedFields';
import { currentLang } from '@/i18n/config';
import { adminApi } from '@/services/api/adminApi';
import { getSupabase } from '@/services/supabase/client';

export function LessonManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const lang = currentLang();
  const [selectedId, setSelectedId] = useState(data.lessons[0]?.id ?? '');
  const current = data.lessons.find((l) => l.id === selectedId) ?? data.lessons[0] ?? null;

  const addLesson = async () => {
    const sb = getSupabase();
    const pos = data.lessons.length + 1;
    const { data: created, error } = await sb.from('lessons').insert({ position: pos }).select('*').single();
    if (error || !created) return;
    const l = created as LessonRow;
    await sb.from('lesson_translations').insert([
      { lesson_id: l.id, lang: 'th', title: `บทเรียนใหม่ ${pos}`, summary: 'สรุปย่อ', body: 'เนื้อหาบทเรียน' },
      { lesson_id: l.id, lang: 'en', title: `New Lesson ${pos}`, summary: 'Summary', body: 'Lesson body' },
    ]);
    await onReload();
    setSelectedId(l.id);
  };

  const moveLesson = async (l: LessonRow, dir: -1 | 1) => {
    const idx = data.lessons.findIndex((x) => x.id === l.id);
    const swap = data.lessons[idx + dir];
    if (!swap) return;
    const sb = getSupabase();
    await Promise.all([
      sb.from('lessons').update({ position: swap.position }).eq('id', l.id),
      sb.from('lessons').update({ position: l.position }).eq('id', swap.id),
    ]);
    await onReload();
  };

  const toggleRule = async (field: 'lessons_mandatory' | 'allow_skip_lessons', val: boolean) => {
    await adminApi.updateSettings(data.settings.id, { [field]: val });
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap gap-6 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Switch
              checked={data.settings.lessons_mandatory}
              onCheckedChange={(v) => void toggleRule('lessons_mandatory', v)}
            />
            Lessons Mandatory Before Playing
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Switch
              checked={data.settings.allow_skip_lessons}
              onCheckedChange={(v) => void toggleRule('allow_skip_lessons', v)}
            />
            Allow Students to Skip Lessons
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t('admin:modules.lessons')}</CardTitle>
            <Button size="sm" onClick={() => void addLesson()}>
              <Plus className="h-4 w-4" />
              {t('common:app.add')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.lessons.map((l, idx) => {
              const tr = data.lessonTranslations.find((x) => x.lesson_id === l.id && x.lang === lang);
              return (
                <div
                  key={l.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
                    l.id === current?.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className="flex-1 text-left cursor-pointer min-w-0"
                  >
                    <p className="text-xs font-bold text-slate-400">Lesson {idx + 1}</p>
                    <p className="truncate text-sm font-bold text-slate-900">{tr?.title || 'Untitled'}</p>
                  </button>
                  <div className="flex gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void moveLesson(l, -1)}
                      disabled={idx === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void moveLesson(l, 1)}
                      disabled={idx === data.lessons.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardContent className="space-y-4 p-6">
            {current ? (
              <LessonEditorPanel
                key={`${current.id}:${current.updated_at}`}
                lesson={current}
                data={data}
                onReload={onReload}
              />
            ) : (
              <p className="text-sm text-slate-500">Select a lesson.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LessonEditorPanel({
  lesson,
  data,
  onReload,
}: {
  lesson: LessonRow;
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const th = data.lessonTranslations.find((x) => x.lesson_id === lesson.id && x.lang === 'th');
  const en = data.lessonTranslations.find((x) => x.lesson_id === lesson.id && x.lang === 'en');

  const [draft, setDraft] = useState<LessonRow>(() => structuredClone(lesson));
  const [titleTh, setTitleTh] = useState(th?.title ?? '');
  const [titleEn, setTitleEn] = useState(en?.title ?? '');
  const [summaryTh, setSummaryTh] = useState(th?.summary ?? '');
  const [summaryEn, setSummaryEn] = useState(en?.summary ?? '');
  const [bodyTh, setBodyTh] = useState(th?.body ?? '');
  const [bodyEn, setBodyEn] = useState(en?.body ?? '');
  const [demoJson, setDemoJson] = useState(
    lesson.demo_program ? JSON.stringify(lesson.demo_program, null, 2) : '',
  );

  const save = async () => {
    let demo: Command[] | null = null;
    if (demoJson.trim()) {
      try {
        demo = JSON.parse(demoJson) as Command[];
      } catch {
        toast('error', 'Demo Program must be valid JSON');
        return;
      }
    }
    const sb = getSupabase();
    await sb
      .from('lessons')
      .update({
        image_url: draft.image_url,
        video_url: draft.video_url || null,
        demo_program: demo,
        is_active: draft.is_active,
      })
      .eq('id', draft.id);
    await sb.from('lesson_translations').upsert(
      [
        { lesson_id: draft.id, lang: 'th', title: titleTh, summary: summaryTh, body: bodyTh },
        { lesson_id: draft.id, lang: 'en', title: titleEn, summary: summaryEn, body: bodyEn },
      ],
      { onConflict: 'lesson_id,lang' },
    );
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  const remove = async (id: string) => {
    if (!window.confirm(t('admin:common.confirmDelete'))) return;
    await getSupabase().from('lessons').delete().eq('id', id);
    await onReload();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Badge>{draft.is_active ? t('common:app.active') : t('common:app.inactive')}</Badge>
        <Button variant="destructive" size="sm" onClick={() => void remove(draft.id)}>
          <Trash2 className="h-4 w-4" />
          {t('common:app.delete')}
        </Button>
      </div>

      <LocalizedFields
        label="Title"
        value={{ th: titleTh, en: titleEn }}
        onChange={(v) => {
          setTitleTh(v.th ?? '');
          setTitleEn(v.en ?? '');
        }}
      />
      <LocalizedFields
        label="Summary"
        value={{ th: summaryTh, en: summaryEn }}
        onChange={(v) => {
          setSummaryTh(v.th ?? '');
          setSummaryEn(v.en ?? '');
        }}
      />
      <LocalizedFields
        label="Body (supports ## headings, - bullets, **bold**)"
        multiline
        value={{ th: bodyTh, en: bodyEn }}
        onChange={(v) => {
          setBodyTh(v.th ?? '');
          setBodyEn(v.en ?? '');
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploader
          folder="lessons"
          label="Lesson Image (อัปโหลดแล้วบันทึกอัตโนมัติ)"
          value={draft.image_url}
          onChange={(url) => setDraft((d) => ({ ...d, image_url: url }))}
          onPersist={async (url) => {
            await getSupabase().from('lessons').update({ image_url: url }).eq('id', draft.id);
            await onReload();
          }}
        />
        <div className="space-y-1.5">
          <Label>Video URL (optional)</Label>
          <Input
            value={draft.video_url ?? ''}
            onChange={(e) => setDraft({ ...draft, video_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Interactive Demo Program (Command[] JSON, optional)</Label>
        <Textarea
          className="font-mono text-xs"
          value={demoJson}
          onChange={(e) => setDemoJson(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
          {t('admin:common.activeStatus')}
        </label>
        <Button onClick={() => void save()}>
          <Save className="h-4 w-4" />
          {t('common:app.save')}
        </Button>
      </div>
    </>
  );
}

export function BlockManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);

  const saveBlock = async (b: BlockDefinitionRow) => {
    const { error } = await getSupabase()
      .from('block_definitions')
      .update({
        label: b.label,
        description: b.description,
        color: b.color,
        params: b.params,
        enabled: b.enabled,
      })
      .eq('id', b.id);
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin:modules.blocks')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500">
          Only predefined safe robot commands can be enabled or customized. No arbitrary code is permitted.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {data.blocks.map((b) => (
            <BlockEditorCard key={`${b.id}:${b.updated_at}`} block={b} onSave={saveBlock} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BlockEditorCard({
  block,
  onSave,
}: {
  block: BlockDefinitionRow;
  onSave: (b: BlockDefinitionRow) => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [draft, setDraft] = useState(block);

  const paramName = PARAM_OF[draft.command_type];
  const hardMax =
    paramName === 'steps'
      ? HARD_LIMITS.MAX_STEPS
      : paramName === 'times'
        ? HARD_LIMITS.MAX_REPEAT
        : HARD_LIMITS.MAX_WAIT_SECONDS;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            className="h-7 w-7 rounded border border-slate-200 cursor-pointer"
          />
          <span className="font-mono text-xs font-extrabold text-slate-800">{draft.command_type}</span>
          <Badge variant="secondary">{draft.category}</Badge>
        </div>
        <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
      </div>

      <LocalizedFields label="Label" value={draft.label} onChange={(v) => setDraft({ ...draft, label: v })} />
      <LocalizedFields
        label="Description"
        value={draft.description}
        onChange={(v) => setDraft({ ...draft, description: v })}
      />

      {paramName && draft.params[0] && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Min</Label>
            <Input
              type="number"
              min={1}
              max={hardMax}
              value={draft.params[0].min}
              onChange={(e) => {
                const p = { ...draft.params[0], min: Math.max(1, Number(e.target.value) || 1) };
                setDraft({ ...draft, params: [p] });
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Max (≤{hardMax})</Label>
            <Input
              type="number"
              min={1}
              max={hardMax}
              value={draft.params[0].max}
              onChange={(e) => {
                const p = { ...draft.params[0], max: Math.min(hardMax, Number(e.target.value) || hardMax) };
                setDraft({ ...draft, params: [p] });
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Default</Label>
            <Input
              type="number"
              min={draft.params[0].min}
              max={draft.params[0].max}
              value={draft.params[0].default}
              onChange={(e) => {
                const p = { ...draft.params[0], default: Number(e.target.value) || draft.params[0].min };
                setDraft({ ...draft, params: [p] });
              }}
            />
          </div>
        </div>
      )}

      <Button size="sm" onClick={() => void onSave(draft)}>
        <Save className="h-3.5 w-3.5" />
        {t('common:app.save')}
      </Button>
    </div>
  );
}
