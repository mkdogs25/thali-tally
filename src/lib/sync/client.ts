import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

// Expo inlines EXPO_PUBLIC_* values when the app is bundled. They are the project's public URL and public (anon)
// key; the data is protected by row-level security on the server, not by keeping these secret.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False when this build was made without a sync server, in which case the app is simply local-only. */
export const syncConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

/** Keeps the sign-in session in the app's own database so it works the same on phones and the web. */
function sqliteStorage(db: SQLiteDatabase): SupportedStorage {
  const k = (key: string) => `auth.${key}`;
  return {
    async getItem(key) {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', k(key));
      return row?.value ?? null;
    },
    async setItem(key, value) {
      await db.runAsync('INSERT OR REPLACE INTO kv (key, value, updated_at, dirty) VALUES (?, ?, ?, 0)', k(key), value, Date.now());
    },
    async removeItem(key) {
      await db.runAsync('DELETE FROM kv WHERE key = ?', k(key));
    },
  };
}

export function createAccountClient(db: SQLiteDatabase): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: sqliteStorage(db), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

/** Turns the server's and network's error text into something a person can act on. */
export function friendlyError(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e ?? '');
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(text)) return 'Could not reach the server. Check your internet connection and try again.';
  if (/invalid login credentials/i.test(text)) return 'That email and password do not match.';
  if (/email not confirmed/i.test(text)) return 'Please confirm your email first. Check your inbox for the link we sent.';
  if (/already registered|already exists/i.test(text)) return 'An account with this email already exists. Try signing in instead.';
  if (/password should be at least|weak password/i.test(text)) return 'That password is too short or too easy to guess. Use at least 8 characters.';
  if (/rate limit|too many/i.test(text)) return 'Too many attempts. Wait a minute and try again.';
  return text || 'Something went wrong.';
}
