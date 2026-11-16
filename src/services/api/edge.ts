import { getSupabase } from '@/services/supabase/client';

export class ApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(code: string, message: string, status = 400, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Ensure the browser holds a Supabase Auth session (signing in anonymously for students). */
export async function ensureAuthSession(): Promise<string> {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error || !anon.session?.access_token) {
    throw new ApiError('UNAUTHENTICATED', error?.message ?? 'Could not sign in anonymously', 401);
  }
  return anon.session.access_token;
}

/** Call a Supabase Edge Function with the current JWT and decode structured errors cleanly. */
export async function invokeEdge<T = Record<string, unknown>>(
  fnName: string,
  body: Record<string, unknown>,
  options: { allowAnonymous?: boolean } = {},
): Promise<T> {
  const sb = getSupabase();
  let token = (await sb.auth.getSession()).data.session?.access_token;
  if (!token && options.allowAnonymous) {
    token = await ensureAuthSession();
  }
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  let payload: Record<string, unknown>;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!res.ok) {
    const code = typeof payload.error === 'string' ? payload.error : `HTTP_${res.status}`;
    const msg = typeof payload.message === 'string' ? payload.message : res.statusText || code;
    throw new ApiError(code, msg, res.status, payload);
  }

  return payload as T;
}
