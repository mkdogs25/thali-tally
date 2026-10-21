import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { supabaseRemote } from '../src/lib/sync/supabaseRemote';

interface Seen {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
}

/** A Supabase client wired to a fake `fetch`, so we can see the exact requests it makes. */
function harness(reply: (seen: Seen) => { status?: number; body: unknown }) {
  const requests: Seen[] = [];
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const text = await req.text();
    const seen: Seen = { url: new URL(req.url), method: req.method, headers: req.headers, body: text ? JSON.parse(text) : null };
    requests.push(seen);
    const r = reply(seen);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient('https://demo.supabase.co', 'anon-key', {
    global: { fetch: fakeFetch as typeof fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { requests, remote: supabaseRemote(client, 'user-123') };
}

test('pull asks for rows changed at or after the cursor, oldest first, one page at a time', async () => {
  const { requests, remote } = harness(() => ({ body: [{ uid: 'a', server_ts: '2026-01-05T10:00:00.123456+00:00' }] }));
  const rows = await remote.pull('food_log', '2026-01-05T09:00:00.000001+00:00', 500);
  assert.equal(rows.length, 1);
  const r = requests[0];
  assert.equal(r.method, 'GET');
  assert.equal(r.url.pathname, '/rest/v1/food_log');
  assert.equal(r.url.searchParams.get('select'), '*');
  assert.equal(r.url.searchParams.get('server_ts'), 'gte.2026-01-05T09:00:00.000001+00:00');
  assert.equal(r.url.searchParams.get('order'), 'server_ts.asc');
  assert.equal(r.url.searchParams.get('limit'), '500');
  assert.equal(r.headers.get('apikey'), 'anon-key');
});

test('the very first pull has no cursor filter', async () => {
  const { requests, remote } = harness(() => ({ body: [] }));
  await remote.pull('settings', null, 100);
  assert.equal(requests[0].url.pathname, '/rest/v1/settings');
  assert.equal(requests[0].url.searchParams.get('server_ts'), null);
});

test('push upserts with the user id attached and the right conflict columns for every table', async () => {
  const expected = { food_log: 'user_id,uid', recipes: 'user_id,uid', weight_log: 'user_id,date', settings: 'user_id,key' } as const;
  for (const [table, conflict] of Object.entries(expected)) {
    const { requests, remote } = harness(() => ({ status: 201, body: null }));
    await remote.push(table as keyof typeof expected, [{ uid: 'u1', name: 'Dal', updated_at: 5 }, { uid: 'u2', name: 'Roti', updated_at: 6 }]);
    const r = requests[0];
    assert.equal(r.method, 'POST', table);
    assert.equal(r.url.pathname, `/rest/v1/${table}`);
    assert.equal(r.url.searchParams.get('on_conflict'), conflict, table);
    assert.match(r.headers.get('prefer') ?? '', /resolution=merge-duplicates/, 'overwrite on conflict');
    assert.deepEqual(r.body, [{ uid: 'u1', name: 'Dal', updated_at: 5, user_id: 'user-123' }, { uid: 'u2', name: 'Roti', updated_at: 6, user_id: 'user-123' }]);
  }
});

test('pushing nothing makes no request', async () => {
  const { requests, remote } = harness(() => ({ body: null }));
  await remote.push('food_log', []);
  assert.equal(requests.length, 0);
});

test('server errors surface their message so sync can show why it failed', async () => {
  const { remote } = harness(() => ({ status: 401, body: { message: 'JWT expired', code: 'PGRST301' } }));
  await assert.rejects(() => remote.pull('food_log', null, 10), /JWT expired/);
  await assert.rejects(() => remote.push('food_log', [{ uid: 'x' }]), /JWT expired/);
});
