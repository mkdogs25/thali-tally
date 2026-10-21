import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atRisk, MESSAGE, needsChoice, protection, StorageState, syncAllowed } from '../src/lib/storageMode';

const s = (over: Partial<StorageState>): StorageState => ({ mode: null, configured: true, signedIn: false, ...over });

test('data is only called safe when a cloud account is chosen AND signed in', () => {
  assert.equal(protection(s({ mode: 'cloud', signedIn: true })), 'synced');
  assert.equal(protection(s({ mode: 'cloud', signedIn: false })), 'cloud-pending');
  assert.equal(protection(s({ mode: 'local' })), 'local-only');
  assert.equal(protection(s({ mode: null })), 'local-only', 'undecided counts as local until they choose');
  assert.equal(protection(s({ mode: 'local', signedIn: true })), 'local-only', 'choosing local wins over a lingering session');
});

test('a build without a sync server can only keep data on the device, and says so', () => {
  for (const mode of ['local', 'cloud', null] as const) assert.equal(protection(s({ configured: false, mode })), 'unavailable');
  assert.ok(!needsChoice(s({ configured: false })), 'nothing to choose between');
  assert.ok(!syncAllowed(s({ configured: false, mode: 'cloud', signedIn: true })));
});

test('syncing happens only for a signed-in cloud choice', () => {
  assert.ok(syncAllowed(s({ mode: 'cloud', signedIn: true })));
  assert.ok(!syncAllowed(s({ mode: 'cloud', signedIn: false })));
  assert.ok(!syncAllowed(s({ mode: 'local', signedIn: true })), 'local means nothing is uploaded, even if signed in');
  assert.ok(!syncAllowed(s({ mode: null, signedIn: true })));
});

test('first run asks once; after a choice it does not ask again', () => {
  assert.ok(needsChoice(s({ mode: null })));
  assert.ok(!needsChoice(s({ mode: 'local' })));
  assert.ok(!needsChoice(s({ mode: 'cloud' })));
});

test('every state except "synced" is flagged as at risk', () => {
  assert.ok(!atRisk(s({ mode: 'cloud', signedIn: true })));
  for (const state of [s({ mode: 'local' }), s({ mode: 'cloud' }), s({ mode: null }), s({ configured: false })]) assert.ok(atRisk(state));
});

test('the wording never promises safety for unsynced data, and names the real ways data is lost', () => {
  for (const key of ['local-only', 'cloud-pending', 'unavailable'] as const) {
    const { short, long } = MESSAGE[key];
    assert.match(short, /not guaranteed/i, `${key} short`);
    assert.match(long, /not guaranteed|no guarantee/i, `${key} long`);
    assert.match(long, /clearing your browser/i);
    assert.match(long, /uninstalling the app/i);
    assert.match(long, /losing or resetting your phone/i);
    assert.doesNotMatch(long + short, /\b(is|are) (safe|secure)\b/i, `${key} must not promise safety`);
  }
  assert.match(MESSAGE['local-only'].long, /cloud account/i, 'points to the fix');
  assert.match(MESSAGE['cloud-pending'].long, /sign in/i);
  assert.match(MESSAGE.synced.short, /backed up/i);
  assert.doesNotMatch(MESSAGE.synced.long, /not guaranteed|no guarantee/i);
});
