// deno-lint-ignore-file no-explicit-any
import { buildSnapshot } from '../_shared/engine/snapshot.ts';
import type { DraftData } from '../_shared/engine/rows.ts';
import { HttpError, adminClient, audit, broadcast, requireAdmin, serve } from '../_shared/util.ts';
import { emitEvents } from '../_shared/util.ts';

async function loadDraft(): Promise<DraftData> {
  const db = adminClient();
  const get = async (table: string) => {
    const { data, error } = await db.from(table).select('*');
    if (error) throw new HttpError(500, 'DB_ERROR', `${table}: ${error.message}`);
    return (data ?? []) as any[];
  };
  const [settings, worlds, levels, level_translations, missions, hints, lessons, lesson_translations, blocks, robots, scenes] = await Promise.all([
    get('game_settings'),
    get('worlds'),
    get('levels'),
    get('level_translations'),
    get('missions'),
    get('hints'),
    get('lessons'),
    get('lesson_translations'),
    get('block_definitions'),
    get('robot_assets'),
    get('scene_assets'),
  ]);
  if (!settings[0]) throw new HttpError(500, 'NO_SETTINGS');
  return { settings: settings[0], worlds, levels, level_translations, missions, hints, lessons, lesson_translations, blocks, robots, scenes };
}

/**
 * publish-config — admin only.
 *   { dry_run: true }  → validate the draft (structure + every expected solution is executed) and report.
 *   { note }           → freeze the draft into a new immutable published_configs version and broadcast it.
 * Players already in a game keep the version they started with; new players receive the latest.
 */
Deno.serve(
  serve(async (req, body) => {
    const admin = await requireAdmin(req);
    const draft = await loadDraft();
    const built = buildSnapshot(draft);

    if (!built.snapshot) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'The draft has problems and cannot be published', {
        errors: built.errors,
        warnings: built.warnings,
      });
    }
    const summary = {
      levels: built.snapshot.levels.length,
      lessons: built.snapshot.lessons.length,
      worlds: built.snapshot.worlds.length,
      blocks: built.snapshot.blocks.length,
    };
    if (body.dry_run === true) return { ok: true, dry_run: true, warnings: built.warnings, summary };

    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
    const db = adminClient();
    const { data, error } = await db
      .from('published_configs')
      .insert({ snapshot: built.snapshot, note, published_by: admin.user.id })
      .select('id, version, published_at')
      .single();
    if (error || !data) {
      console.error(error);
      throw new HttpError(500, 'PUBLISH_FAILED');
    }

    await audit(admin, 'PUBLISH', 'published_configs', data.id as string, { version: data.version, note, summary });

    const { data: session } = await db.from('game_sessions').select('id').eq('status', 'ACTIVE').maybeSingle();
    const events = await emitEvents([
      { type: 'CONFIG_PUBLISHED', session_id: (session as any)?.id ?? null, payload: { version: data.version, published_at: data.published_at, note } },
    ]);
    if (events.length === 0) {
      // the event log was unavailable; still try to notify connected clients
      await broadcast([
        {
          event_id: crypto.randomUUID(),
          type: 'CONFIG_PUBLISHED',
          player_id: null,
          session_id: null,
          sequence_number: 0,
          timestamp: new Date().toISOString(),
          payload: { version: data.version },
        },
      ]);
    }

    return { ok: true, version: data.version, published_at: data.published_at, warnings: built.warnings, summary };
  }),
);
