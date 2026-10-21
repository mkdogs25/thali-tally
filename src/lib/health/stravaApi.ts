import { kindFromStrava } from './kinds';
import type { Workout } from './types';

/**
 * Strava has no "log in with Strava" that works without a server: its token exchange needs a client secret.
 * For a personal app that is fine. The person creates their own (free) Strava API application, pastes its
 * Client ID and Client Secret in here, and both stay in the phone's secure storage (Keychain / Keystore).
 * A new Strava API app starts in single-athlete mode, which is exactly one person: its owner.
 */

export const REDIRECT_URI = 'thalitally://localhost/strava';
export const CALLBACK_DOMAIN = 'localhost';
const SCOPE = 'activity:read_all';
const AUTHORIZE = 'https://www.strava.com/oauth/authorize';
const TOKEN = 'https://www.strava.com/oauth/token';
const API = 'https://www.strava.com/api/v3';
/** Strava allows 200 requests / 15 min by default; one detail call per new activity adds up, so cap it. */
const MAX_DETAIL_CALLS = 15;

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

export interface StravaCredentials {
  clientId: string;
  clientSecret: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

// --- pure helpers (unit-tested) --------------------------------------------------------

export function buildAuthorizeUrl(clientId: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE}?${q.toString()}`;
}

export type CallbackResult = { ok: true; code: string } | { ok: false; error: string };

/** Reads Strava's redirect. Strava lets people untick permissions, so the granted scope is checked too. */
export function parseCallback(url: string, expectedState: string): CallbackResult {
  const query = new URL(url).searchParams;
  if (query.get('error')) return { ok: false, error: query.get('error') === 'access_denied' ? 'Strava access was declined.' : `Strava said: ${query.get('error')}` };
  if (query.get('state') !== expectedState) return { ok: false, error: 'The Strava sign-in response did not match this request. Try again.' };
  const code = query.get('code');
  if (!code) return { ok: false, error: 'Strava did not return an authorisation code.' };
  const scope = query.get('scope') ?? '';
  if (!scope.split(',').includes('activity:read_all') && !scope.split(',').includes('activity:read')) {
    return { ok: false, error: 'Please tick “View data about your activities” when Strava asks, so workouts can be read.' };
  }
  return { ok: true, code };
}

export const needsRefresh = (t: StravaTokens, nowSec: number = Date.now() / 1000) => t.expiresAt - 120 <= nowSec;

interface RawActivity {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local?: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  kilojoules?: number;
  calories?: number;
}

/** Strava activity → app workout. `kcal` comes from the detail call when we have it. */
export function toWorkout(a: RawActivity, kcal: number | null): Workout {
  const start = Date.parse(a.start_date);
  const seconds = a.elapsed_time ?? a.moving_time ?? 0;
  return {
    id: `strava:${a.id}`,
    source: 'strava',
    app: 'Strava',
    kind: kindFromStrava(a.sport_type ?? a.type ?? ''),
    name: a.name || 'Strava activity',
    startMs: start,
    endMs: start + seconds * 1000,
    kcal,
    distanceM: a.distance && a.distance > 0 ? a.distance : null,
  };
}

/** Energy for an activity: the detailed record's calories, else kilojoules of work (≈ kcal when cycling with power). */
export const energyOf = (detail: Pick<RawActivity, 'calories' | 'kilojoules'> | null, summary: RawActivity): number | null => {
  const v = detail?.calories || summary.kilojoules || null;
  return v && v > 0 ? v : null;
};

// --- network ----------------------------------------------------------------------------

export class StravaError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 429) throw new StravaError('Strava’s rate limit was reached. It resets every 15 minutes — try again then.', 429);
  if (res.status === 401) throw new StravaError('Strava rejected the saved sign-in. Disconnect and connect again.', 401);
  if (!res.ok) throw new StravaError(`Strava returned an error (${res.status}).`, res.status);
  return (await res.json()) as T;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const toTokens = (r: TokenResponse): StravaTokens => ({ accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: r.expires_at });

export async function exchangeCode(creds: StravaCredentials, code: string, fetchImpl: FetchLike = fetch): Promise<StravaTokens> {
  const res = await fetchImpl(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, code, grant_type: 'authorization_code' }).toString(),
  });
  return toTokens(await json<TokenResponse>(res));
}

export async function refreshTokens(creds: StravaCredentials, tokens: StravaTokens, fetchImpl: FetchLike = fetch): Promise<StravaTokens> {
  const res = await fetchImpl(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }).toString(),
  });
  return toTokens(await json<TokenResponse>(res));
}

/**
 * Activities between two instants, grouped by the athlete's local day. `known` holds activities already stored
 * with their energy, which saves one detail request each.
 */
export async function fetchActivities(
  accessToken: string,
  fromSec: number,
  toSec: number,
  known: Map<string, Workout>,
  fetchImpl: FetchLike = fetch,
): Promise<Record<string, Workout[]>> {
  const auth = { headers: { Authorization: `Bearer ${accessToken}` } };
  const out: Record<string, Workout[]> = {};
  let detailCalls = 0;
  for (let page = 1; page <= 5; page++) {
    const res = await fetchImpl(`${API}/athlete/activities?after=${fromSec}&before=${toSec}&per_page=100&page=${page}`, auth);
    const list = await json<RawActivity[]>(res);
    for (const a of list) {
      const cached = known.get(`strava:${a.id}`);
      let kcal: number | null = cached?.kcal ?? null;
      if (cached === undefined) {
        // Not seen before: its calories need one detail request. Over the cap, leave it for the next sync
        // rather than storing it as "no energy" for good.
        if (detailCalls >= MAX_DETAIL_CALLS) continue;
        detailCalls++;
        const detail = await json<RawActivity>(await fetchImpl(`${API}/activities/${a.id}`, auth));
        kcal = energyOf(detail, a);
      }
      const day = (a.start_date_local ?? a.start_date).slice(0, 10);
      (out[day] ??= []).push(toWorkout(a, kcal));
    }
    if (list.length < 100) break;
  }
  return out;
}
