import test from 'node:test';
import assert from 'node:assert/strict';
import { localParts, switches, postedMessage, cronMessages, otherOf } from '../worker/src/logic.js';

test('localParts: hour and date in a time zone', () => {
  const d = new Date('2026-11-22T20:00:00Z'); // 01:30 next day in Kolkata (UTC+5:30)
  assert.deepEqual(localParts(d, 'Asia/Kolkata'), { hour: 1, ymd: '2026-11-23' });
  assert.deepEqual(localParts(d, 'UTC'), { hour: 20, ymd: '2026-11-22' });
  assert.equal(localParts(new Date('2026-11-22T00:05:00Z'), 'UTC').hour, 0); // midnight is 0, not 24
});

test('switches default to OFF', () => {
  assert.deepEqual(switches(undefined), { posted: false, morning: false, evening: false });
  assert.deepEqual(switches({ posted: true }), { posted: true, morning: false, evening: false });
});

test('posted message names the poster and never leaks scores', () => {
  const m = postedMessage('soukhya');
  assert.match(m.title, /Soukhya posted/);
  assert.doesNotMatch(m.title + m.body, /\d\s*[\/★]|won|lost|win|loss/i);
  assert.equal(otherOf('saksham'), 'soukhya');
});

const on = { posted: true, morning: true, evening: true };
const base = { morningHour: 8, eveningHour: 20, sw: on };

test('cron: morning hello to both, only at the morning hour and only if the switch is on', () => {
  const m = cronMessages({ ...base, hour: 8, posted: {} });
  assert.deepEqual(m.map((x) => x.to).sort(), ['saksham', 'soukhya']);
  assert.match(m[0].title, /TOP OF THE MORNING/);
  assert.equal(cronMessages({ ...base, hour: 9, posted: {} }).length, 0);
  assert.equal(cronMessages({ ...base, hour: 8, posted: {}, sw: { ...on, morning: false } }).length, 0);
});

test('cron: evening nudge depends on who has posted', () => {
  const none = cronMessages({ ...base, hour: 20, posted: { saksham: false, soukhya: false } });
  assert.equal(none.length, 2);
  const one = cronMessages({ ...base, hour: 20, posted: { saksham: true, soukhya: false } });
  assert.equal(one.length, 1);
  assert.equal(one[0].to, 'soukhya');
  assert.match(one[0].title, /Saksham already posted/);
  assert.equal(cronMessages({ ...base, hour: 20, posted: { saksham: true, soukhya: true } }).length, 0);
  assert.equal(cronMessages({ ...base, hour: 20, posted: {}, sw: { ...on, evening: false } }).length, 0);
});
