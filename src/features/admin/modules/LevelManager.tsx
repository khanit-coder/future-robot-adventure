import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, FlaskConical, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { COMMAND_TYPES, OBJECTIVE_TYPES, evaluateSubmission, validateMission } from '@engine';
import type {
  Command,
  CommandType,
  Direction,
  HintRow,
  LevelRow,
  MissionSpec,
  ObjectiveType,
  Pos,
  TileChar,
  UnlockRequirement,
  WorldRow,
} from '@engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/stores/toastStore';
import type { AdminWorkspaceData } from '@/features/admin/adminTypes';
import { LocalizedFields } from '@/features/admin/components/LocalizedFields';
import { currentLang } from '@/i18n/config';
import { getSupabase } from '@/services/supabase/client';
import { pickLocalized } from '@/utils/localize';

type Brush = TileChar | 'CRYSTAL' | 'GENERATOR' | 'FRIEND' | 'ROBOT';

const BRUSHES: Brush[] = ['.', '#', 'H', 'O', 'D', 'G', '_', 'CRYSTAL', 'GENERATOR', 'FRIEND', 'ROBOT'];

export function LevelManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const lang = currentLang();
  const [selectedId, setSelectedId] = useState<string>(data.levels[0]?.id ?? '');

  const selectedLevel = data.levels.find((l) => l.id === selectedId) ?? data.levels[0] ?? null;

  const createLevel = async () => {
    const world = data.worlds[0];
    if (!world) return;
    const sb = getSupabase();
    const num = data.levels.length + 1;
    const code = `level_${String(num).padStart(2, '0')}_${Date.now().toString(36).slice(-4)}`;
    const { data: created, error } = await sb
      .from('levels')
      .insert({
        code,
        world_id: world.id,
        position: num,
        difficulty: 1,
        max_score: 200,
      })
      .select('*')
      .single();
    if (error || !created) {
      toast('error', t('admin:common.saveFailed'), error?.message);
      return;
    }
    const lvl = created as LevelRow;
    await sb.from('level_translations').insert([
      { level_id: lvl.id, lang: 'th', title: `ด่านใหม่ ${num}`, description: 'เดินไปยังเป้าหมาย' },
      { level_id: lvl.id, lang: 'en', title: `New Level ${num}`, description: 'Reach the goal.' },
    ]);
    await sb.from('missions').insert({
      level_id: lvl.id,
      map: {
        width: 5,
        height: 3,
        rows: ['_____', '....G', '_____'],
        crystals: [],
        generators: [],
        friends: [],
      },
      robot_start: { x: 0, y: 1, dir: 'E' },
      objectives: [{ type: 'REACH_GOAL' }],
      rules: { allowed_commands: ['MOVE_FORWARD'], max_blocks: 5 },
      expected_solutions: [[{ type: 'MOVE_FORWARD', steps: 4 }]],
    });
    await onReload();
    setSelectedId(lvl.id);
    toast('success', t('admin:common.saved'));
  };

  const moveOrder = async (lvl: LevelRow, dir: -1 | 1) => {
    const idx = data.levels.findIndex((l) => l.id === lvl.id);
    const swap = data.levels[idx + dir];
    if (!swap) return;
    const sb = getSupabase();
    await Promise.all([
      sb.from('levels').update({ position: swap.position }).eq('id', lvl.id),
      sb.from('levels').update({ position: lvl.position }).eq('id', swap.id),
    ]);
    await onReload();
  };

  const addWorld = async () => {
    const sb = getSupabase();
    const n = data.worlds.length + 1;
    const { error } = await sb.from('worlds').insert({
      position: n,
      name: { th: `โลกใหม่ ${n}`, en: `World ${n}` },
      description: { th: 'การผจญภัยครั้งใหม่', en: 'A brand new adventure' },
      theme: 'station',
      color: '#38bdf8',
    });
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Level list */}
      <Card className="lg:col-span-4">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle>{t('admin:modules.levels')}</CardTitle>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => void addWorld()}>
                + World
              </Button>
              <Button size="sm" onClick={() => void createLevel()}>
                <Plus className="h-4 w-4" />
                {t('common:app.add')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[75vh] overflow-y-auto">
          {data.levels.map((lvl, idx) => {
            const tr = data.levelTranslations.find((x) => x.level_id === lvl.id && x.lang === lang);
            return (
              <div
                key={lvl.id}
                className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
                  lvl.id === selectedLevel?.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(lvl.id)}
                  className="flex-1 text-left cursor-pointer min-w-0"
                >
                  <p className="text-xs font-bold text-slate-400">
                    #{idx + 1} • {lvl.code}
                  </p>
                  <p className="truncate font-bold text-sm text-slate-900">{tr?.title || lvl.code}</p>
                </button>
                <div className="flex items-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void moveOrder(lvl, -1)}
                    disabled={idx === 0}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void moveOrder(lvl, 1)}
                    disabled={idx === data.levels.length - 1}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Level Editor */}
      <Card className="lg:col-span-8">
        <CardContent className="p-6 space-y-5">
          {selectedLevel ? (
            <LevelEditorPanel
              key={`${selectedLevel.id}:${selectedLevel.updated_at}`}
              level={selectedLevel}
              data={data}
              onReload={onReload}
              onSelectLevel={setSelectedId}
            />
          ) : (
            <p className="text-sm text-slate-500">Select or create a level.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LevelEditorPanel({
  level,
  data,
  onReload,
  onSelectLevel,
}: {
  level: LevelRow;
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
  onSelectLevel: (id: string) => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const lang = currentLang();
  const th = data.levelTranslations.find((x) => x.level_id === level.id && x.lang === 'th');
  const en = data.levelTranslations.find((x) => x.level_id === level.id && x.lang === 'en');
  const missionRow = data.missions.find((x) => x.level_id === level.id);

  const [brush, setBrush] = useState<Brush>('.');
  const [testOutput, setTestOutput] = useState<{ ok: boolean; text: string } | null>(null);
  const [levelDraft, setLevelDraft] = useState<LevelRow>(() => structuredClone(level));
  const [titleTh, setTitleTh] = useState(th?.title ?? '');
  const [titleEn, setTitleEn] = useState(en?.title ?? '');
  const [descTh, setDescTh] = useState(th?.description ?? '');
  const [descEn, setDescEn] = useState(en?.description ?? '');
  const [missionDraft, setMissionDraft] = useState<MissionSpec | null>(() =>
    missionRow
      ? structuredClone({
          map: missionRow.map,
          robot_start: missionRow.robot_start,
          objectives: missionRow.objectives,
          rules: missionRow.rules,
        })
      : null,
  );
  const [solutionsJson, setSolutionsJson] = useState(
    JSON.stringify(missionRow?.expected_solutions ?? [], null, 2),
  );

  const duplicateLevel = async () => {
    if (!missionDraft) return;
    const sb = getSupabase();
    const code = `${levelDraft.code.slice(0, 26)}_copy_${Date.now().toString(36).slice(-4)}`;
    let expected: Command[][];
    try {
      expected = JSON.parse(solutionsJson) as Command[][];
    } catch {
      expected = [];
    }
    const { data: created, error } = await sb
      .from('levels')
      .insert({
        code,
        world_id: levelDraft.world_id,
        position: data.levels.length + 1,
        difficulty: levelDraft.difficulty,
        max_score: levelDraft.max_score,
        scene_asset_id: levelDraft.scene_asset_id,
        robot_asset_id: levelDraft.robot_asset_id,
        completion_animation: levelDraft.completion_animation,
        unlock: levelDraft.unlock,
      })
      .select('*')
      .single();
    if (error || !created) {
      toast('error', t('admin:common.saveFailed'), error?.message);
      return;
    }
    const lvl = created as LevelRow;
    await sb.from('level_translations').insert([
      { level_id: lvl.id, lang: 'th', title: `${titleTh} (สำเนา)`, description: descTh },
      { level_id: lvl.id, lang: 'en', title: `${titleEn} (Copy)`, description: descEn },
    ]);
    await sb.from('missions').insert({
      level_id: lvl.id,
      map: missionDraft.map,
      robot_start: missionDraft.robot_start,
      objectives: missionDraft.objectives,
      rules: missionDraft.rules,
      expected_solutions: expected,
    });
    await onReload();
    onSelectLevel(lvl.id);
  };

  const deleteLevel = async (id: string) => {
    if (!window.confirm(t('admin:common.confirmDelete'))) return;
    await getSupabase().from('levels').delete().eq('id', id);
    await onReload();
    onSelectLevel(data.levels.find((l) => l.id !== id)?.id ?? '');
  };

  const paintCell = (x: number, y: number) => {
    if (!missionDraft) return;
    const next = structuredClone(missionDraft);
    const same = (p: Pos) => p.x === x && p.y === y;
    if (brush === 'ROBOT') {
      next.robot_start = { ...next.robot_start, x, y };
    } else if (brush === 'CRYSTAL') {
      const idx = next.map.crystals.findIndex(same);
      if (idx >= 0) next.map.crystals.splice(idx, 1);
      else next.map.crystals.push({ x, y });
    } else if (brush === 'GENERATOR') {
      const idx = next.map.generators.findIndex(same);
      if (idx >= 0) next.map.generators.splice(idx, 1);
      else next.map.generators.push({ x, y });
    } else if (brush === 'FRIEND') {
      const idx = next.map.friends.findIndex(same);
      if (idx >= 0) next.map.friends.splice(idx, 1);
      else next.map.friends.push({ x, y });
    } else {
      const chars = next.map.rows[y].split('');
      chars[x] = brush;
      next.map.rows[y] = chars.join('');
    }
    setMissionDraft(next);
  };

  const resizeMap = (w: number, h: number) => {
    if (!missionDraft) return;
    const width = Math.max(3, Math.min(20, w));
    const height = Math.max(1, Math.min(14, h));
    const rows: string[] = [];
    for (let y = 0; y < height; y++) {
      const old = missionDraft.map.rows[y] ?? '';
      let row = '';
      for (let x = 0; x < width; x++) row += old[x] ?? '.';
      rows.push(row);
    }
    const inside = (p: Pos) => p.x < width && p.y < height;
    setMissionDraft({
      ...missionDraft,
      map: {
        width,
        height,
        rows,
        crystals: missionDraft.map.crystals.filter(inside),
        generators: missionDraft.map.generators.filter(inside),
        friends: missionDraft.map.friends.filter(inside),
      },
      robot_start: {
        ...missionDraft.robot_start,
        x: Math.min(missionDraft.robot_start.x, width - 1),
        y: Math.min(missionDraft.robot_start.y, height - 1),
      },
    });
  };

  const runTest = () => {
    if (!missionDraft) return;
    const problems = validateMission(missionDraft);
    if (problems.length > 0) {
      setTestOutput({ ok: false, text: problems.join(' • ') });
      return;
    }
    try {
      const sols = JSON.parse(solutionsJson) as Command[][];
      if (!Array.isArray(sols) || sols.length === 0) {
        setTestOutput({ ok: false, text: 'Provide at least one expected solution.' });
        return;
      }
      for (const sol of sols) {
        const out = evaluateSubmission(missionDraft, sol);
        if (out.status === 'INVALID') {
          setTestOutput({ ok: false, text: out.issues.map((i) => i.code).join(', ') });
          return;
        }
        if (!out.result.success) {
          setTestOutput({
            ok: false,
            text: t('admin:levels.testFailed', { reason: out.result.failure?.code ?? 'INCOMPLETE' }),
          });
          return;
        }
      }
      const first = evaluateSubmission(missionDraft, sols[0]);
      setTestOutput({
        ok: true,
        text: t('admin:levels.testPassed', {
          steps: first.status === 'EXECUTED' ? first.result.steps_executed : 0,
        }),
      });
    } catch {
      setTestOutput({ ok: false, text: 'Invalid JSON in expected solutions' });
    }
  };

  const save = async () => {
    if (!missionDraft) return;
    let parsedSolutions: Command[][];
    try {
      parsedSolutions = JSON.parse(solutionsJson) as Command[][];
    } catch {
      toast('error', 'Expected Solutions must be valid JSON');
      return;
    }

    const sb = getSupabase();
    const { error } = await sb
      .from('levels')
      .update({
        code: levelDraft.code,
        world_id: levelDraft.world_id,
        difficulty: levelDraft.difficulty,
        max_score: levelDraft.max_score,
        time_limit_seconds: levelDraft.time_limit_seconds,
        scene_asset_id: levelDraft.scene_asset_id,
        robot_asset_id: levelDraft.robot_asset_id,
        completion_animation: levelDraft.completion_animation,
        unlock: levelDraft.unlock,
        is_active: levelDraft.is_active,
      })
      .eq('id', levelDraft.id);
    if (error) {
      toast('error', t('admin:common.saveFailed'), error.message);
      return;
    }

    await sb.from('level_translations').upsert(
      [
        { level_id: levelDraft.id, lang: 'th', title: titleTh, description: descTh },
        { level_id: levelDraft.id, lang: 'en', title: titleEn, description: descEn },
      ],
      { onConflict: 'level_id,lang' },
    );

    const { error: mErr } = await sb
      .from('missions')
      .update({
        map: missionDraft.map,
        robot_start: missionDraft.robot_start,
        objectives: missionDraft.objectives,
        rules: missionDraft.rules,
        expected_solutions: parsedSolutions,
      })
      .eq('level_id', levelDraft.id);
    if (mErr) {
      toast('error', t('admin:common.saveFailed'), mErr.message);
      return;
    }

    await onReload();
    toast('success', t('admin:common.saved'));
  };

  if (!missionDraft) return <p className="text-sm text-slate-500">Missing mission row.</p>;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold text-slate-900">{levelDraft.code}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void duplicateLevel()}>
            <Copy className="h-4 w-4" />
            {t('common:app.duplicate')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => void deleteLevel(levelDraft.id)}>
            <Trash2 className="h-4 w-4" />
            {t('common:app.delete')}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>{t('admin:levels.code')}</Label>
          <Input
            value={levelDraft.code}
            onChange={(e) => setLevelDraft({ ...levelDraft, code: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>{t('admin:levels.world')}</Label>
          <Select
            value={levelDraft.world_id}
            onChange={(e) => setLevelDraft({ ...levelDraft, world_id: e.target.value })}
          >
            {data.worlds.map((w: WorldRow) => (
              <option key={w.id} value={w.id}>
                {pickLocalized(w.name, lang, 'en')}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t('admin:levels.maxScore')}</Label>
          <Input
            type="number"
            min={0}
            value={levelDraft.max_score}
            onChange={(e) => setLevelDraft({ ...levelDraft, max_score: Number(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>{t('admin:levels.difficulty')} (1–5)</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={levelDraft.difficulty}
            onChange={(e) =>
              setLevelDraft({
                ...levelDraft,
                difficulty: Math.min(5, Math.max(1, Number(e.target.value) || 1)) as LevelRow['difficulty'],
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Scene</Label>
          <Select
            value={levelDraft.scene_asset_id ?? ''}
            onChange={(e) => setLevelDraft({ ...levelDraft, scene_asset_id: e.target.value || null })}
          >
            <option value="">Default</option>
            {data.scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {pickLocalized(s.name, lang, 'en')}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t('admin:levels.unlockRule')}</Label>
          <Select
            value={levelDraft.unlock.type}
            onChange={(e) =>
              setLevelDraft({
                ...levelDraft,
                unlock: { type: e.target.value as UnlockRequirement['type'] } as UnlockRequirement,
              })
            }
          >
            <option value="PREVIOUS_LEVEL">Previous Level</option>
            <option value="NONE">Always Unlocked</option>
            <option value="MIN_SCORE">Min Score (100)</option>
          </Select>
        </div>
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
        label="Description"
        multiline
        value={{ th: descTh, en: descEn }}
        onChange={(v) => {
          setDescTh(v.th ?? '');
          setDescEn(v.en ?? '');
        }}
      />

      {/* Visual Grid Map Editor */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-extrabold text-sm text-slate-900">{t('admin:levels.mapEditor')}</h4>
          <div className="flex items-center gap-2 text-xs">
            <span>W:</span>
            <Input
              type="number"
              className="h-8 w-16"
              value={missionDraft.map.width}
              onChange={(e) => resizeMap(Number(e.target.value) || 5, missionDraft.map.height)}
            />
            <span>H:</span>
            <Input
              type="number"
              className="h-8 w-16"
              value={missionDraft.map.height}
              onChange={(e) => resizeMap(missionDraft.map.width, Number(e.target.value) || 3)}
            />
            <span>Dir:</span>
            <Select
              className="h-8 w-20"
              value={missionDraft.robot_start.dir}
              onChange={(e) =>
                setMissionDraft({
                  ...missionDraft,
                  robot_start: { ...missionDraft.robot_start, dir: e.target.value as Direction },
                })
              }
            >
              {(['N', 'E', 'S', 'W'] as const).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Brush palette */}
        <div className="flex flex-wrap gap-1.5">
          {BRUSHES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrush(b)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-bold cursor-pointer ${
                brush === b
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {t(`admin:levels.tools.${b}`)}
            </button>
          ))}
        </div>

        {/* Clickable grid */}
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex flex-col gap-1">
            {missionDraft.map.rows.map((row, y) => (
              <div key={y} className="flex gap-1">
                {row.split('').map((ch, x) => {
                  const hasRobot = missionDraft.robot_start.x === x && missionDraft.robot_start.y === y;
                  const hasCrystal = missionDraft.map.crystals.some((p) => p.x === x && p.y === y);
                  const hasGen = missionDraft.map.generators.some((p) => p.x === x && p.y === y);
                  const hasFriend = missionDraft.map.friends.some((p) => p.x === x && p.y === y);
                  return (
                    <button
                      key={x}
                      type="button"
                      onClick={() => paintCell(x, y)}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-lg border text-xs font-extrabold cursor-pointer ${
                        ch === '_'
                          ? 'border-dashed border-slate-300 bg-slate-100 text-slate-400'
                          : ch === '#'
                            ? 'border-slate-700 bg-slate-700 text-white'
                            : ch === 'H'
                              ? 'border-orange-500 bg-orange-400 text-white'
                              : ch === 'O'
                                ? 'border-rose-500 bg-slate-950 text-rose-400'
                                : ch === 'D'
                                  ? 'border-rose-600 bg-rose-600 text-white'
                                  : ch === 'G'
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-slate-300 bg-white text-slate-500'
                      }`}
                    >
                      {hasRobot ? '🤖' : hasCrystal ? '💎' : hasGen ? '⚡' : hasFriend ? '🫂' : ch}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rules & Objectives */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('admin:levels.allowedBlocks')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {COMMAND_TYPES.map((cmd) => {
              const on = missionDraft.rules.allowed_commands.includes(cmd);
              return (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => {
                    const list = on
                      ? missionDraft.rules.allowed_commands.filter((c) => c !== cmd)
                      : [...missionDraft.rules.allowed_commands, cmd];
                    setMissionDraft({
                      ...missionDraft,
                      rules: { ...missionDraft.rules, allowed_commands: list as CommandType[] },
                    });
                  }}
                  className={`rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                    on ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cmd}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('admin:levels.objectives')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {OBJECTIVE_TYPES.map((obj) => {
              const on = missionDraft.objectives.some((o) => o.type === obj);
              return (
                <button
                  key={obj}
                  type="button"
                  onClick={() => {
                    const list = on
                      ? missionDraft.objectives.filter((o) => o.type !== obj)
                      : [...missionDraft.objectives, { type: obj as ObjectiveType }];
                    setMissionDraft({ ...missionDraft, objectives: list });
                  }}
                  className={`rounded-lg px-2 py-1 text-xs font-bold cursor-pointer ${
                    on ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {obj}
                </button>
              );
            })}
          </div>
          <div className="pt-2">
            <Label>{t('admin:levels.maxBlocks')}</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={missionDraft.rules.max_blocks}
              onChange={(e) =>
                setMissionDraft({
                  ...missionDraft,
                  rules: { ...missionDraft.rules, max_blocks: Number(e.target.value) || 5 },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('admin:levels.expectedSolutions')}</Label>
        <Textarea
          className="font-mono text-xs min-h-[110px]"
          value={solutionsJson}
          onChange={(e) => setSolutionsJson(e.target.value)}
        />
      </div>

      {testOutput && (
        <div
          className={`rounded-xl border p-3 text-sm font-semibold ${
            testOutput.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {testOutput.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Switch
            checked={levelDraft.is_active}
            onCheckedChange={(v) => setLevelDraft({ ...levelDraft, is_active: v })}
          />
          {t('admin:common.activeStatus')}
        </label>

        <div className="flex gap-2">
          <Button variant="outline" onClick={runTest}>
            <FlaskConical className="h-4 w-4" />
            {t('admin:levels.testLevel')}
          </Button>
          <Button onClick={() => void save()}>
            <Save className="h-4 w-4" />
            {t('common:app.save')}
          </Button>
        </div>
      </div>
    </>
  );
}

export function HintManagerModule({
  data,
  onReload,
}: {
  data: AdminWorkspaceData;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const lang = currentLang();
  const [levelId, setLevelId] = useState(data.levels[0]?.id ?? '');
  const hints = data.hints.filter((h) => h.level_id === levelId).sort((a, b) => a.position - b.position);

  const addHint = async () => {
    if (!levelId) return;
    await getSupabase()
      .from('hints')
      .insert({
        level_id: levelId,
        position: hints.length + 1,
        text: { th: 'คำใบ้ใหม่', en: 'New hint' },
      });
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  const updateHint = async (hint: HintRow) => {
    await getSupabase().from('hints').update({ text: hint.text, position: hint.position }).eq('id', hint.id);
    await onReload();
    toast('success', t('admin:common.saved'));
  };

  const removeHint = async (id: string) => {
    await getSupabase().from('hints').delete().eq('id', id);
    await onReload();
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>{t('admin:modules.hints')}</CardTitle>
        <div className="flex items-center gap-2">
          <Select className="w-64" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
            {data.levels.map((l) => {
              const tr = data.levelTranslations.find((x) => x.level_id === l.id && x.lang === lang);
              return (
                <option key={l.id} value={l.id}>
                  {tr?.title || l.code}
                </option>
              );
            })}
          </Select>
          <Button size="sm" onClick={() => void addHint()}>
            <Plus className="h-4 w-4" />
            {t('common:app.add')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hints.length === 0 ? (
          <p className="text-sm text-slate-500">No hints for this level yet.</p>
        ) : (
          hints.map((h, idx) => (
            <HintEditorRow
              key={`${h.id}:${h.updated_at}`}
              hint={h}
              index={idx}
              onSave={updateHint}
              onDelete={removeHint}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function HintEditorRow({
  hint,
  index,
  onSave,
  onDelete,
}: {
  hint: HintRow;
  index: number;
  onSave: (h: HintRow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [draft, setDraft] = useState(hint);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <Badge>Hint #{index + 1}</Badge>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={() => void onDelete(hint.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => void onSave(draft)}>
            <Save className="h-3.5 w-3.5" />
            {t('common:app.save')}
          </Button>
        </div>
      </div>
      <LocalizedFields
        label="Hint Text"
        value={draft.text}
        onChange={(v) => setDraft({ ...draft, text: v })}
      />
    </div>
  );
}
