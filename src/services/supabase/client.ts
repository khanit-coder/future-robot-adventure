import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  url &&
  anonKey &&
  url.startsWith('http') &&
  !url.includes('your-project-ref') &&
  !anonKey.includes('your-public-anon-key'),
);

// Migrate any existing non-anonymous admin session from default Supabase storage key
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem('fra-admin-auth-v1')) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const raw = localStorage.getItem(k);
          if (raw && raw.includes('"is_anonymous":false')) {
            localStorage.setItem('fra-admin-auth-v1', raw);
            break;
          }
        }
      }
    }
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Separate Supabase clients for Player (/play) and Admin (/admin) so that anonymous
 * player sign-ins or sign-outs in another tab never overwrite the Admin session!
 */
export const playerSupabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storageKey: 'fra-player-auth-v1',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 20,
          },
        },
      })
    : null;

export const adminSupabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storageKey: 'fra-admin-auth-v1',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const supabase: SupabaseClient | null = playerSupabase;

export function getSupabase(): SupabaseClient {
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const client = isAdminRoute ? adminSupabase : playerSupabase;
  if (!client) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return client;
}
