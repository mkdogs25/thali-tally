import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { subscribeLocalChanges } from '../lib/db';
import { checkOwner, syncAll, takeOverPhone } from '../lib/sync/engine';
import { createAccountClient, friendlyError, syncConfigured } from '../lib/sync/client';
import { supabaseRemote } from '../lib/sync/supabaseRemote';

export type AuthResult = { ok: true; message?: string } | { ok: false; message: string };

interface AccountContext {
  /** False when this build has no sync server. */
  configured: boolean;
  status: 'loading' | 'signed-out' | 'signed-in';
  email: string | null;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
  /** True while the person must choose what to do with another account's data already on this phone. */
  conflict: boolean;
  /** Goes up whenever a sync changed data on this phone, so screens know to reload. */
  version: number;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  /** Resolve the conflict: replace this phone's data with the signed-in account's, or sign back out. */
  resolveConflict: (takeOver: boolean) => Promise<void>;
}

const none: AccountContext = {
  configured: false,
  status: 'signed-out',
  email: null,
  syncing: false,
  lastSync: null,
  error: null,
  conflict: false,
  version: 0,
  signIn: async () => ({ ok: false, message: 'Cloud sync is not set up in this build.' }),
  signUp: async () => ({ ok: false, message: 'Cloud sync is not set up in this build.' }),
  signOut: async () => {},
  syncNow: async () => {},
  resolveConflict: async () => {},
};

const Ctx = createContext<AccountContext>(none);
export const useAccount = () => useContext(Ctx);

const SYNC_EVERY_MS = 5 * 60_000;
const AFTER_EDIT_MS = 3_000;

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Optional account: the app works fully without one; signing in mirrors the phone's data to the person's account. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const client = useMemo<SupabaseClient | null>(() => (syncConfigured ? createAccountClient(db) : null), [db]);

  const [status, setStatus] = useState<AccountContext['status']>(client ? 'loading' : 'signed-out');
  const [email, setEmail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [version, setVersion] = useState(0);

  const session = useRef<Session | null>(null);
  const busy = useRef(false);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = useCallback(async () => {
    const s = session.current;
    if (!client || !s || busy.current || blocked.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const stats = await syncAll(db, supabaseRemote(client, s.user.id));
      setLastSync(Date.now());
      setError(null);
      if (stats.changed > 0) setVersion((v) => v + 1);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [client, db]);

  const begin = useCallback(
    async (s: Session) => {
      session.current = s;
      setEmail(s.user.email ?? null);
      setStatus('signed-in');
      const owner = await checkOwner(db, s.user.id);
      if (owner === 'other-account') {
        blocked.current = true;
        setConflict(true);
        return;
      }
      blocked.current = false;
      setConflict(false);
      await runSync();
    },
    [db, runSync],
  );

  // Restore a saved session and follow sign-in / sign-out.
  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event, s) => {
      // Do the work outside the callback: the auth client holds a lock while it runs.
      setTimeout(() => {
        if (s && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) void begin(s);
        else if (s && event === 'TOKEN_REFRESHED') session.current = s;
        else if (!s && (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT')) {
          session.current = null;
          blocked.current = false;
          setConflict(false);
          setEmail(null);
          setStatus('signed-out');
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [client, begin]);

  // Sync soon after the person edits something, when the app returns to the foreground, and every few minutes.
  useEffect(() => {
    if (!client) return;
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void runSync(), AFTER_EDIT_MS);
    };
    const unsubscribe = subscribeLocalChanges(schedule);
    const interval = setInterval(() => void runSync(), SYNC_EVERY_MS);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void client.auth.startAutoRefresh();
        void runSync();
      } else {
        void client.auth.stopAutoRefresh();
      }
    });
    return () => {
      unsubscribe();
      clearInterval(interval);
      app.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [client, runSync]);

  const signIn = useCallback<AccountContext['signIn']>(
    async (emailAddress, password) => {
      if (!client) return { ok: false, message: 'Cloud sync is not set up in this build.' };
      if (!validEmail(emailAddress)) return { ok: false, message: 'Enter a valid email address.' };
      if (!password) return { ok: false, message: 'Enter your password.' };
      const { error: e } = await client.auth.signInWithPassword({ email: emailAddress.trim(), password });
      return e ? { ok: false, message: friendlyError(e) } : { ok: true };
    },
    [client],
  );

  const signUp = useCallback<AccountContext['signUp']>(
    async (emailAddress, password) => {
      if (!client) return { ok: false, message: 'Cloud sync is not set up in this build.' };
      if (!validEmail(emailAddress)) return { ok: false, message: 'Enter a valid email address.' };
      if (password.length < 8) return { ok: false, message: 'Use a password of at least 8 characters.' };
      const { data, error: e } = await client.auth.signUp({ email: emailAddress.trim(), password });
      if (e) return { ok: false, message: friendlyError(e) };
      // With email confirmation switched on there is no session until the link in the email is opened.
      return data.session ? { ok: true } : { ok: true, message: 'Account created. Check your email for a confirmation link, then sign in.' };
    },
    [client],
  );

  const signOut = useCallback(async () => {
    await client?.auth.signOut();
  }, [client]);

  const resolveConflict = useCallback(
    async (takeOver: boolean) => {
      const s = session.current;
      if (!client || !s) return;
      if (!takeOver) {
        await client.auth.signOut();
        return;
      }
      await takeOverPhone(db, s.user.id);
      blocked.current = false;
      setConflict(false);
      await runSync();
      setVersion((v) => v + 1);
    },
    [client, db, runSync],
  );

  const value = useMemo<AccountContext>(
    () => ({ configured: Boolean(client), status, email, syncing, lastSync, error, conflict, version, signIn, signUp, signOut, syncNow: runSync, resolveConflict }),
    [client, status, email, syncing, lastSync, error, conflict, version, signIn, signUp, signOut, runSync, resolveConflict],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
