import { describe, expect, it } from 'vitest';
import { DEFAULT_BLOCKS, DEFAULT_SCORE_RULES, SAMPLE_LEVELS, buildSnapshot } from '@engine';
import type { DraftData } from '@engine';
import { SEED_LESSONS, SEED_ROBOTS, SEED_SCENES, SEED_WORLDS } from '../../supabase/seed/content';

function makeValidDraft(): DraftData {
  const ts = '2026-01-01T00:00:00Z';
  const worlds = SEED_WORLDS.map((w, i) => ({
    id: `w-${i}`,
    position: i + 1,
    ...w,
    is_active: true,
    created_at: ts,
    updated_at: ts,
  }));
  const scenes = SEED_SCENES.map((s, i) => ({
    id: `s-${i}`,
    name: s.name,
    kind: 'builtin' as const,
    theme: s.theme,
    image_url: null,
    width: 960,
    height: 540,
    parallax: [],
    is_active: true,
    created_at: ts,
    updated_at: ts,
  }));
  const robots = SEED_ROBOTS.map((r, i) => ({
    id: `r-${i}`,
    name: r.name,
    kind: 'builtin' as const,
    builtin_style: r.style,
    sprite_url: null,
    frame_width: null,
    frame_height: null,
    animations: {},
    scale: 1,
    move_speed_ms: 450,
    primary_color: r.color,
    is_default: r.isDefault,
    is_active: true,
    created_at: ts,
    updated_at: ts,
  }));
  const levels = SAMPLE_LEVELS.map((l, i) => ({
    id: `lv-${i}`,
    code: l.code,
    world_id: worlds[l.worldIndex].id,
    position: i + 1,
    difficulty: l.difficulty,
    max_score: l.max_score,
    time_limit_seconds: null,
    scene_asset_id: scenes[l.worldIndex].id,
    robot_asset_id: null,
    completion_animation: 'celebrate' as const,
    unlock: { type: 'PREVIOUS_LEVEL' as const },
    is_active: true,
    version: 1,
    created_at: ts,
    updated_at: ts,
  }));
  const level_translations = SAMPLE_LEVELS.flatMap((l, i) =>
    (['th', 'en'] as const).map((lang) => ({
      id: `lt-${i}-${lang}`,
      level_id: levels[i].id,
      lang,
      title: l.title[lang] ?? '',
      description: l.description[lang] ?? '',
      created_at: ts,
      updated_at: ts,
    })),
  );
  const missions = SAMPLE_LEVELS.map((l, i) => ({
    id: `m-${i}`,
    level_id: levels[i].id,
    map: l.mission.map,
    robot_start: l.mission.robot_start,
    objectives: l.mission.objectives,
    rules: l.mission.rules,
    expected_solutions: l.solutions,
    created_at: ts,
    updated_at: ts,
  }));
  const hints = SAMPLE_LEVELS.flatMap((l, i) =>
    l.hints.map((h, k) => ({
      id: `h-${i}-${k}`,
      level_id: levels[i].id,
      position: k + 1,
      text: h,
      created_at: ts,
      updated_at: ts,
    })),
  );
  const lessons = SEED_LESSONS.map((l, i) => ({
    id: `ls-${i}`,
    position: i + 1,
    image_url: null,
    video_url: null,
    demo_program: l.demo,
    is_active: true,
    created_at: ts,
    updated_at: ts,
  }));
  const lesson_translations = SEED_LESSONS.flatMap((l, i) =>
    (['th', 'en'] as const).map((lang) => ({
      id: `lst-${i}-${lang}`,
      lesson_id: lessons[i].id,
      lang,
      title: l.title[lang] ?? '',
      summary: l.summary[lang] ?? '',
      body: l.body[lang] ?? '',
      created_at: ts,
      updated_at: ts,
    })),
  );
  const blocks = DEFAULT_BLOCKS.map((b, i) => ({
    id: `b-${i}`,
    ...b,
    created_at: ts,
    updated_at: ts,
  }));

  return {
    settings: {
      score_rules: DEFAULT_SCORE_RULES,
      timer_enabled: true,
      total_duration_seconds: 1200,
      lesson_timer_seconds: null,
      level_timer_seconds: null,
      bonus_seconds_per_level: 0,
      lessons_mandatory: true,
      allow_skip_lessons: false,
      rewards_enabled: true,
    },
    worlds,
    levels,
    level_translations,
    missions,
    hints,
    lessons,
    lesson_translations,
    blocks,
    robots,
    scenes,
  };
}

describe('buildSnapshot publish gate', () => {
  it('builds a clean snapshot from seed data with zero errors or warnings', () => {
    const built = buildSnapshot(makeValidDraft(), 1);
    expect(built.errors).toEqual([]);
    expect(built.warnings).toEqual([]);
    expect(built.snapshot?.levels).toHaveLength(10);
    expect(built.snapshot?.lessons).toHaveLength(7);
    expect(built.snapshot?.worlds).toHaveLength(4);
  });

  it('rejects a draft whose expected solution fails the mission', () => {
    const draft = makeValidDraft();
    draft.missions[0].expected_solutions = [[{ type: 'MOVE_FORWARD', steps: 1 }]];
    const built = buildSnapshot(draft, 2);
    expect(built.snapshot).toBeNull();
    expect(built.errors.some((e) => e.includes('does not complete'))).toBe(true);
  });

  it('rejects a draft when a level uses a disabled block command', () => {
    const draft = makeValidDraft();
    const jump = draft.blocks.find((b) => b.command_type === 'JUMP')!;
    jump.enabled = false;
    const built = buildSnapshot(draft, 2);
    expect(built.snapshot).toBeNull();
    expect(built.errors.some((e) => e.includes('JUMP is disabled'))).toBe(true);
  });

  it('warns when a translation is missing in one language', () => {
    const draft = makeValidDraft();
    const th = draft.level_translations.find((t) => t.level_id === draft.levels[0].id && t.lang === 'th')!;
    th.title = '';
    const built = buildSnapshot(draft, 2);
    expect(built.snapshot).not.toBeNull();
    expect(built.warnings.some((w) => w.includes('missing a Thai title'))).toBe(true);
  });
});
