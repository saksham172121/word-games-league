import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/version.js';
import { timeNotif } from '../js/jokes.js';

test('version: semver, and js/version.js matches sw.js', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], APP_VERSION);
  assert.ok(sw.includes("'js/version.js'"), 'version.js must be precached');
});

test('timeNotif: morning only (5:00-11:59), personal per player', () => {
  assert.match(timeNotif(5, 'saksham').title, /TOP OF THE MORNING TO YOU SAILOR/);
  assert.match(timeNotif(11, 'soukhya').title, /TOP OF THE MORNING MADAM/);
  for (const h of [0, 3, 4, 12, 15, 21, 23]) assert.equal(timeNotif(h, 'saksham'), null, `hour ${h}`);
});
