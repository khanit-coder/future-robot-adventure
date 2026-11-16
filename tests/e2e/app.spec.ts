import { expect, test } from '@playwright/test';
import { DEFAULT_BLOCKS, DEFAULT_SCORE_RULES, SAMPLE_LEVELS } from '@engine';
import { SEED_LESSONS, SEED_ROBOTS, SEED_SCENES, SEED_WORLDS } from '../../supabase/seed/content';

/**
 * End-to-end tests running the real Vite production bundle in Chromium.
 * Supabase HTTP & Edge endpoints are intercepted at the browser network boundary so we can
 * verify real routing, UI interactions, Blockly mounting, Phaser mounting, bilingual switching,
 * 100-player Dashboard rendering, and Admin auth gating without needing external live credentials.
 */
function buildMockConfig() {
  return {
    version: 1,
    published_at: '2026-01-01T00:00:00Z',
    settings: {
      score_rules: DEFAULT_SCORE_RULES,
      timer_enabled: true,
      total_duration_seconds: 1200,
      lesson_timer_seconds: null,
      level_timer_seconds: null,
      bonus_seconds_per_level: 0,
      lessons_mandatory: false,
      allow_skip_lessons: true,
      rewards_enabled: true,
    },
    worlds: SEED_WORLDS.map((w, i) => ({ id: `w-${i}`, position: i + 1, ...w })),
    levels: SAMPLE_LEVELS.slice(0, 3).map((l, i) => ({
      id: `00000002-0000-4000-8000-00000000000${i + 1}`,
      code: l.code,
      world_id: `w-${l.worldIndex}`,
      position: i + 1,
      difficulty: l.difficulty,
      max_score: l.max_score,
      time_limit_seconds: null,
      scene_id: 's-0',
      robot_id: null,
      completion_animation: 'celebrate' as const,
      unlock: { type: 'PREVIOUS_LEVEL' as const },
      title: l.title,
      description: l.description,
      mission: l.mission,
      hints: l.hints.map((h, k) => ({ id: `h-${i}-${k}`, position: k + 1, text: h })),
    })),
    blocks: DEFAULT_BLOCKS,
    lessons: SEED_LESSONS.slice(0, 2).map((l, i) => ({
      id: `00000005-0000-4000-8000-00000000000${i + 1}`,
      position: i + 1,
      image_url: null,
      video_url: null,
      demo_program: l.demo,
      title: l.title,
      summary: l.summary,
      body: l.body,
    })),
    robots: SEED_ROBOTS.map((r, i) => ({
      id: `r-${i}`,
      name: r.name,
      kind: 'builtin' as const,
      builtin_style: r.style,
      sprite_url: null,
      frame_width: null,
      frame_height: null,
      animations: {},
      scale: 1,
      move_speed_ms: 250,
      primary_color: r.color,
      is_default: r.isDefault,
    })),
    scenes: SEED_SCENES.map((s, i) => ({
      id: `s-${i}`,
      name: s.name,
      kind: 'builtin' as const,
      theme: s.theme,
      image_url: null,
      width: 960,
      height: 540,
      parallax: [],
    })),
  };
}

async function mockSupabaseNetwork(page: import('@playwright/test').Page) {
  let registered = false;
  let playerStatus: 'REGISTERED' | 'LEARNING' | 'PLAYING' | 'FINISHED' = 'REGISTERED';
  const totalScore = 0;
  const levelsCompleted = 0;
  const mockConfig = buildMockConfig();

  // Stub WebSocket connections cleanly so Supabase Realtime does not spam console errors
  await page.routeWebSocket('**/realtime/v1/**', (ws) => {
    ws.onMessage(() => {});
  });

  await page.route('https://e2e-test.supabase.co/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const body = req.postDataJSON?.() as Record<string, unknown> | null;

    if (url.includes('/auth/v1/signup')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: { id: '11111111-1111-4111-8111-111111111111', is_anonymous: true },
        }),
      });
    }
    if (url.includes('/auth/v1/user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', is_anonymous: true }),
      });
    }
    if (url.includes('/rest/v1/game_settings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'gs-1',
          singleton: true,
          game_title: { en: 'Future Robot Adventure', th: 'ผจญภัยหุ่นยนต์แห่งอนาคต' },
          tagline: { en: 'Learn to Code. Explore the Future.', th: 'เรียนรู้การเขียนโค้ด ผจญภัยสู่โลกอนาคต' },
          event_title: { en: 'Open House', th: 'เปิดบ้านวิทยาลัย' },
          college_name: { en: 'Engineering College', th: 'วิทยาลัยวิศวกรรม' },
          primary_color: '#4f46e5',
          secondary_color: '#f59e0b',
          default_language: 'en',
          maintenance_mode: false,
          maintenance_message: {},
          rewards_enabled: true,
        }),
      });
    }
    if (url.includes('/rest/v1/dashboard_settings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ds-1',
          singleton: true,
          mode: 'GRID',
          columns: 8,
          robot_size: 72,
          page_size: 48,
          rotate_seconds: 12,
          show_school: true,
          show_leaderboard: true,
          show_scores: true,
          show_online_count: true,
          animations_enabled: true,
          theme: 'space',
          spotlight_interval_seconds: 8,
        }),
      });
    }
    if (url.includes('/rest/v1/game_sessions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sess-1',
          name: 'Open House 2026',
          status: 'ACTIVE',
          registration_open: true,
          started_at: '2026-01-01T00:00:00Z',
        }),
      });
    }
    if (url.includes('/rest/v1/i18n_overrides')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.includes('/rest/v1/admins')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    }
    if (url.includes('/rest/v1/rpc/dashboard_snapshot')) {
      const players = Array.from({ length: 60 }).map((_, i) => ({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        name: `Player ${i + 1}`,
        school: `School ${(i % 5) + 1}`,
        status: i % 2 === 0 ? 'PLAYING' : 'FINISHED',
        score: (60 - i) * 20,
        levels_completed: (i % 10) + 1,
        started_at: '2026-01-01T00:00:00Z',
        finished_at: null,
        registered_at: '2026-01-01T00:00:00Z',
      }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          server_now: new Date().toISOString(),
          session: { id: 'sess-1', name: 'Open House 2026', status: 'ACTIVE', registration_open: true },
          last_seq: 1,
          total_levels: 10,
          players,
          recent_events: [],
          total_missions_completed: 330,
        }),
      });
    }
    if (url.includes('/functions/v1/register-player')) {
      registered = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          player: { id: 'p-1', display_name: body?.display_name ?? 'Tonkla', school: body?.school ?? 'Demo' },
          player_session: { id: 'ps-1', status: 'REGISTERED', total_score: 0 },
          existing: false,
        }),
      });
    }
    if (url.includes('/functions/v1/player-action')) {
      const action = body?.action;
      if (action === 'get_state' && !registered) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'NOT_REGISTERED' }),
        });
      }
      if (action === 'get_config') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ config: mockConfig, latest_version: 1 }),
        });
      }
      if (action === 'start_game') {
        playerStatus = 'PLAYING';
      }
      if (action === 'start_level') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            server_now: new Date().toISOString(),
            progress: {
              id: 'prog-1',
              player_session_id: 'ps-1',
              level_id: body?.level_id,
              status: 'IN_PROGRESS',
              attempts: 0,
              failed_attempts: 0,
              hints_used: 0,
              started_at: new Date().toISOString(),
              score: 0,
            },
          }),
        });
      }
      if (action === 'get_hints') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ hints: [], hints_used: 0, hints_total: 2, penalty: 10 }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          server_now: new Date().toISOString(),
          player: {
            id: 'p-1',
            game_session_id: 'sess-1',
            auth_user_id: '11111111-1111-4111-8111-111111111111',
            display_name: 'Tonkla',
            school: 'Demo School',
            lang: 'en',
          },
          player_session: {
            id: 'ps-1',
            player_id: 'p-1',
            game_session_id: 'sess-1',
            status: playerStatus,
            config_version: 1,
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 1200_000).toISOString(),
            total_score: totalScore,
            levels_completed: levelsCompleted,
            total_attempts: 0,
            hints_used: 0,
            lessons_completed: 0,
            current_level_id: mockConfig.levels[0].id,
          },
          session: { id: 'sess-1', name: 'Open House 2026', status: 'ACTIVE', registration_open: true },
          progress: [],
          lessons_done: [],
          claim: null,
          latest_version: 1,
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

test('Player registers, previews lessons, enters Blockly+Phaser workspace, and switches languages', async ({
  page,
}) => {
  await mockSupabaseNetwork(page);
  await page.goto('/play');

  await expect(page.getByText('Future Robot Adventure')).toBeVisible();
  await page.getByLabel(/Display Name/i).fill('Tonkla');
  await page.getByLabel(/School Name/i).fill('Demo High');
  await page.getByTestId('register-submit').click();

  // Lessons appear first
  await expect(page.getByText('What is Programming?')).toBeVisible();
  await page.getByRole('button', { name: /Skip Tutorial/i }).click();

  // Game workspace mounts both Blockly editor and Phaser viewport
  await expect(page.getByTestId('blockly-editor')).toBeVisible();
  await expect(page.getByTestId('phaser-viewport')).toBeVisible();
  await expect(page.getByTestId('compile-btn')).toBeVisible();

  // Empty compile gives friendly validation without crashing
  await page.getByTestId('compile-btn').click();
  await expect(page.getByRole('alert')).toBeVisible();

  // Language switch works live without resetting the game
  await page.getByTestId('lang-th').click();
  await expect(page.getByText('ปลุกหุ่นยนต์!')).toBeVisible();
  await expect(page.getByTestId('player-timer')).toBeVisible();
});

test('Dashboard renders 60 concurrent players cleanly', async ({ page }) => {
  await mockSupabaseNetwork(page);
  await page.goto('/dashboard');

  await expect(page.getByText('Future Robot Adventure')).toBeVisible();
  await expect(page.getByTestId('dashboard-robot-card')).toHaveCount(48);
  await expect(page.getByText('Player 1').first()).toBeVisible();
});

test('Admin route displays login gate', async ({ page }) => {
  await mockSupabaseNetwork(page);
  await page.goto('/admin');

  await expect(page.getByTestId('admin-login-btn')).toBeVisible();
});
