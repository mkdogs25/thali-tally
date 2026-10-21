import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { parseKey } from '../dates';
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchActivities,
  needsRefresh,
  parseCallback,
  refreshTokens,
  REDIRECT_URI,
  StravaCredentials,
  StravaError,
  StravaTokens,
} from './stravaApi';
import type { Availability, HealthSource, SourceDay, WeightSample, Workout } from './types';

export { CALLBACK_DOMAIN, REDIRECT_URI } from './stravaApi';

// --- secure storage -------------------------------------------------------------------------

const K_CREDS = 'strava.credentials';
const K_TOKENS = 'strava.tokens';

async function readKey<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const getCredentials = () => readKey<StravaCredentials>(K_CREDS);
export const saveCredentials = (c: StravaCredentials) => SecureStore.setItemAsync(K_CREDS, JSON.stringify(c));

async function validTokens(creds: StravaCredentials): Promise<StravaTokens> {
  const tokens = await readKey<StravaTokens>(K_TOKENS);
  if (!tokens) throw new StravaError('Strava is not connected.');
  if (!needsRefresh(tokens)) return tokens;
  const fresh = await refreshTokens(creds, tokens);
  await SecureStore.setItemAsync(K_TOKENS, JSON.stringify(fresh));
  return fresh;
}

const randomState = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// --- source ---------------------------------------------------------------------------------------

export const strava: HealthSource & { setKnown(known: Map<string, Workout>): void } = {
  id: 'strava',
  label: 'Strava',
  hub: false,
  setKnown(known) {
    knownActivities = known;
  },

  async available(): Promise<Availability> {
    if (Platform.OS === 'web') return { ok: false, reason: 'Strava sign-in works in the phone apps, not in the browser.' };
    if (!(await SecureStore.isAvailableAsync())) return { ok: false, reason: 'Secure storage is not available on this device.' };
    return { ok: true };
  },

  async connect() {
    const creds = await getCredentials();
    if (!creds?.clientId || !creds.clientSecret) return 'Enter your Strava Client ID and Client Secret first.';
    const state = randomState();
    const result = await WebBrowser.openAuthSessionAsync(buildAuthorizeUrl(creds.clientId, state), REDIRECT_URI);
    if (result.type !== 'success') return 'Strava sign-in was cancelled.';
    const parsed = parseCallback(result.url, state);
    if (!parsed.ok) return parsed.error;
    try {
      const tokens = await exchangeCode(creds, parsed.code);
      await SecureStore.setItemAsync(K_TOKENS, JSON.stringify(tokens));
      return null;
    } catch (e) {
      return e instanceof StravaError ? e.message : 'Could not complete the Strava sign-in. Check the Client ID and Secret.';
    }
  },

  async disconnect() {
    await SecureStore.deleteItemAsync(K_TOKENS);
  },

  async readDays(days): Promise<Record<string, SourceDay>> {
    const creds = await getCredentials();
    if (!creds) throw new StravaError('Strava is not set up.');
    const tokens = await validTokens(creds);
    const sorted = [...days].sort();
    const from = Math.floor(parseKey(sorted[0]).getTime() / 1000) - 86_400; // pad a day for time zones
    const to = Math.floor((parseKey(sorted[sorted.length - 1]).getTime() + 2 * 86_400_000) / 1000);
    const byDay = await fetchActivities(tokens.accessToken, from, to, knownActivities);
    const out: Record<string, SourceDay> = {};
    for (const day of days) out[day] = { steps: null, activeKcal: null, workouts: byDay[day] ?? [] };
    return out;
  },

  // Strava's weight is a profile field the person typed once, not a measurement; importing it would corrupt the log.
  async readWeights(): Promise<WeightSample[]> {
    return [];
  },
};

let knownActivities = new Map<string, Workout>();
