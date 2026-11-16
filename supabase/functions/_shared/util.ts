// Shared helpers for all Edge Functions.
// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import type { EventType, GameEvent, PublishedConfig } from './engine/types.ts';

export type Json = Record<string, unknown>;

const env = (k: string) => Deno.env.get(k) ?? '';

export function corsHeaders(req: Request): HeadersInit {
  const allowed = env('ALLOWED_ORIGINS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  const allow = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public extra?: Json,
  ) {
    super(message ?? code);
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

/** Wrap a handler with CORS, JSON parsing and uniform error responses. */
export function serve(handler: (req: Request, body: any) => Promise<unknown>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
    if (req.method !== 'POST') return json(req, { error: 'METHOD_NOT_ALLOWED' }, 405);
    try {
      let body: any = {};
      const text = await req.text();
      if (text.length > 64 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE');
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new HttpError(400, 'BAD_JSON');
        }
      }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'BAD_JSON');
      const result = await handler(req, body);
      return json(req, result);
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.code, message: e.message, ...e.extra }, e.status);
      console.error('Unhandled error', e);
      return json(req, { error: 'INTERNAL', message: 'Unexpected server error' }, 500);
    }
  };
}

let _admin: SupabaseClient | null = null;
/** Service-role client. Lives only inside Edge Functions; the key is never sent to a browser. */
export function adminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/** Resolve the caller from their JWT (anonymous players included). */
export async function requireUser(req: Request): Promise<User> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED');
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'UNAUTHENTICATED');
  return data.user;
}

export async function requireAdmin(req: Request): Promise<{ user: User; email: string | null; role: string }> {
  const user = await requireUser(req);
  const { data } = await adminClient().from('admins').select('email, role').eq('user_id', user.id).maybeSingle();
  if (!data) throw new HttpError(403, 'FORBIDDEN');
  return { user, email: (data.email as string | null) ?? user.email ?? null, role: data.role as string };
}

export function clientIp(req: Request): string {
  return (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
}

export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
  const { data, error } = await adminClient().rpc('check_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) {
    console.error('rate limit check failed', error);
    return; // fail open on infrastructure errors; DB constraints still protect integrity
  }
  if (data === false) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests, please slow down');
}

/** Strip control characters and angle brackets; collapse whitespace. */
export function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  // deno-lint-ignore no-control-regex
  return input.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/* ---------------- realtime events ---------------- */

export const LIVE_TOPIC = 'fra:live';

export interface NewEvent {
  type: EventType;
  player_id?: string | null;
  session_id?: string | null;
  payload?: Json;
}

/**
 * Persist events (the DB identity column provides the global sequence number) and then broadcast them.
 * Persisting first means dashboards can always recover missed events from the database.
 */
export async function emitEvents(events: NewEvent[]): Promise<GameEvent[]> {
  if (events.length === 0) return [];
  const db = adminClient();
  const { data, error } = await db
    .from('game_events')
    .insert(
      events.map((e) => ({
        game_session_id: e.session_id ?? null,
        player_id: e.player_id ?? null,
        type: e.type,
        payload: e.payload ?? {},
      })),
    )
    .select('id, seq, game_session_id, player_id, type, payload, created_at');
  if (error || !data) {
    console.error('event insert failed', error);
    return [];
  }
  const full: GameEvent[] = (data as any[])
    .sort((a, b) => a.seq - b.seq)
    .map((r) => ({
      event_id: r.id,
      type: r.type,
      player_id: r.player_id,
      session_id: r.game_session_id,
      sequence_number: Number(r.seq),
      timestamp: r.created_at,
      payload: r.payload,
    }));
  await broadcast(full);
  return full;
}

export async function broadcast(events: GameEvent[]): Promise<void> {
  try {
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    const res = await fetch(`${env('SUPABASE_URL')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: events.map((e) => ({ topic: LIVE_TOPIC, event: 'game_event', payload: e, private: false })),
      }),
    });
    if (!res.ok) console.error('broadcast failed', res.status, await res.text());
  } catch (e) {
    // Clients also recover from the database snapshot, so a lost broadcast is never fatal.
    console.error('broadcast error', e);
  }
}

export async function audit(
  admin: { user: User; email: string | null },
  action: string,
  entity: string,
  entityId: string | null,
  details: Json = {},
): Promise<void> {
  const { error } = await adminClient().from('audit_logs').insert({
    admin_id: admin.user.id,
    admin_email: admin.email,
    action,
    entity,
    entity_id: entityId,
    details,
  });
  if (error) console.error('audit insert failed', error);
}

/* ---------------- config snapshots ---------------- */

const configCache = new Map<number, PublishedConfig>();

/** Published snapshots are immutable, so caching per version in the isolate is always safe. */
export async function loadConfig(version: number): Promise<PublishedConfig> {
  const hit = configCache.get(version);
  if (hit) return hit;
  const { data, error } = await adminClient().from('published_configs').select('snapshot').eq('version', version).maybeSingle();
  if (error || !data) throw new HttpError(500, 'CONFIG_NOT_FOUND');
  const snap = data.snapshot as PublishedConfig;
  if (configCache.size > 20) configCache.clear();
  configCache.set(version, snap);
  return snap;
}

export async function latestConfigVersion(): Promise<number> {
  const { data } = await adminClient().from('published_configs').select('version').order('version', { ascending: false }).limit(1).maybeSingle();
  if (!data) throw new HttpError(503, 'NO_PUBLISHED_CONFIG', 'No configuration has been published yet');
  return data.version as number;
}

/** Remove server-only data (hint text) before sending a snapshot to a player. */
export function publicConfig(cfg: PublishedConfig): PublishedConfig {
  return {
    ...cfg,
    levels: cfg.levels.map((l) => ({ ...l, hints: l.hints.map((h) => ({ ...h, text: {} })) })),
  };
}
