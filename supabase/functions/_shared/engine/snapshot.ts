import { evaluateSubmission } from './evaluate.ts';
import { validateMission } from './interpreter.ts';
import { DEFAULT_BLOCKS } from './commands.ts';
import { DEFAULT_SCORE_RULES } from './scoring.ts';
import type { DraftData } from './rows.ts';
import type { LessonConfig, LevelConfig, Localized, PublishedConfig, RobotConfig, SceneConfig, WorldConfig } from './types.ts';

export interface SnapshotBuild {
  snapshot: PublishedConfig | null;
  errors: string[];
  warnings: string[];
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Freeze the current draft into a published gameplay configuration.
 *
 * Besides assembling the snapshot, this is the quality gate for publishing: every active level must be
 * structurally valid AND solvable by at least one of its expected solutions (executed with the real
 * interpreter), otherwise the publish is refused so players can never receive a broken level.
 */
export function buildSnapshot(draft: DraftData, version = 0, publishedAt = new Date().toISOString()): SnapshotBuild {
  const errors: string[] = [];
  const warnings: string[] = [];

  const blocks = [...draft.blocks].filter((b) => b.enabled).sort(byPosition);
  const blockDefs = (blocks.length > 0 ? blocks : DEFAULT_BLOCKS).map((b) => ({
    command_type: b.command_type,
    category: b.category,
    label: b.label,
    description: b.description,
    color: b.color,
    icon: b.icon,
    params: b.params,
    enabled: true,
    position: b.position,
  }));
  const enabledCommands = new Set(blockDefs.map((b) => b.command_type));

  const worlds: WorldConfig[] = draft.worlds
    .filter((w) => w.is_active)
    .sort(byPosition)
    .map((w) => ({ id: w.id, position: w.position, name: w.name, description: w.description, theme: w.theme, color: w.color }));
  const worldOrder = new Map(worlds.map((w, i) => [w.id, i]));

  const robots: RobotConfig[] = draft.robots
    .filter((r) => r.is_active)
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      builtin_style: r.builtin_style,
      sprite_url: r.sprite_url,
      frame_width: r.frame_width,
      frame_height: r.frame_height,
      animations: r.animations,
      scale: Number(r.scale),
      move_speed_ms: r.move_speed_ms,
      primary_color: r.primary_color,
      is_default: r.is_default,
    }));
  if (robots.length === 0) errors.push('At least one active robot is required');

  const scenes: SceneConfig[] = draft.scenes
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, name: s.name, kind: s.kind, theme: s.theme, image_url: s.image_url, width: s.width, height: s.height, parallax: s.parallax }));

  const levelsDraft = draft.levels
    .filter((l) => l.is_active && worldOrder.has(l.world_id))
    .sort((a, b) => (worldOrder.get(a.world_id)! - worldOrder.get(b.world_id)!) || a.position - b.position);

  const levels: LevelConfig[] = [];
  for (const [index, l] of levelsDraft.entries()) {
    const label = `Level "${l.code}"`;
    const tr = draft.level_translations.filter((t) => t.level_id === l.id);
    const title: Localized = {};
    const description: Localized = {};
    for (const t of tr) {
      if (t.title.trim()) title[t.lang] = t.title;
      if (t.description.trim()) description[t.lang] = t.description;
    }
    if (!title.th && !title.en) errors.push(`${label} has no title in any language`);
    else if (!title.th || !title.en) warnings.push(`${label} is missing a ${!title.th ? 'Thai' : 'English'} title (fallback will be used)`);

    const m = draft.missions.find((x) => x.level_id === l.id);
    if (!m) {
      errors.push(`${label} has no mission`);
      continue;
    }
    const mission = { map: m.map, robot_start: m.robot_start, objectives: m.objectives, rules: m.rules };
    for (const p of validateMission(mission)) errors.push(`${label}: ${p}`);
    for (const c of m.rules.allowed_commands) {
      if (!enabledCommands.has(c)) errors.push(`${label}: allowed command ${c} is disabled in the Block Manager`);
    }

    if (!m.expected_solutions || m.expected_solutions.length === 0) {
      errors.push(`${label} has no expected solution, so it cannot be verified as solvable`);
    } else {
      for (const [si, sol] of m.expected_solutions.entries()) {
        const out = evaluateSubmission(mission, sol, blockDefs);
        if (out.status === 'INVALID') errors.push(`${label}: expected solution #${si + 1} is invalid (${out.issues.map((i) => i.code).join(', ')})`);
        else if (!out.result.success) errors.push(`${label}: expected solution #${si + 1} does not complete the mission`);
      }
    }

    levels.push({
      id: l.id,
      code: l.code,
      world_id: l.world_id,
      position: index + 1,
      version: l.version,
      difficulty: l.difficulty,
      max_score: l.max_score,
      time_limit_seconds: l.time_limit_seconds,
      scene_id: l.scene_asset_id,
      robot_id: l.robot_asset_id,
      completion_animation: l.completion_animation,
      unlock: l.unlock,
      title,
      description,
      mission,
      hints: draft.hints
        .filter((h) => h.level_id === l.id)
        .sort(byPosition)
        .map((h) => ({ id: h.id, position: h.position, text: h.text })),
    });
  }
  if (levels.length === 0) errors.push('At least one active level is required');

  const lessons: LessonConfig[] = draft.lessons
    .filter((l) => l.is_active)
    .sort(byPosition)
    .map((l, i) => {
      const tr = draft.lesson_translations.filter((t) => t.lesson_id === l.id);
      const title: Localized = {};
      const summary: Localized = {};
      const body: Localized = {};
      for (const t of tr) {
        if (t.title.trim()) title[t.lang] = t.title;
        if (t.summary.trim()) summary[t.lang] = t.summary;
        if (t.body.trim()) body[t.lang] = t.body;
      }
      if (!title.th && !title.en) errors.push(`Lesson #${i + 1} has no title in any language`);
      else if (!title.th || !title.en) warnings.push(`Lesson #${i + 1} is missing a ${!title.th ? 'Thai' : 'English'} title`);
      return { id: l.id, position: i + 1, image_url: l.image_url, video_url: l.video_url, demo_program: l.demo_program, title, summary, body };
    });

  if (errors.length > 0) return { snapshot: null, errors, warnings };

  const s = draft.settings;
  return {
    snapshot: {
      version,
      published_at: publishedAt,
      settings: {
        score_rules: { ...DEFAULT_SCORE_RULES, ...s.score_rules },
        timer_enabled: s.timer_enabled,
        total_duration_seconds: s.total_duration_seconds,
        lesson_timer_seconds: s.lesson_timer_seconds,
        level_timer_seconds: s.level_timer_seconds,
        bonus_seconds_per_level: s.bonus_seconds_per_level,
        lessons_mandatory: s.lessons_mandatory,
        allow_skip_lessons: s.allow_skip_lessons,
        rewards_enabled: s.rewards_enabled,
      },
      worlds,
      levels,
      blocks: blockDefs,
      lessons,
      robots,
      scenes,
    },
    errors,
    warnings,
  };
}
