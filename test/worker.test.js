import test from 'node:test';
import assert from 'node:assert/strict';
import { localParts, switches, postedMessage, cronMessages, otherOf, MORNING, POSTED, EVENING_NONE, EVENING_ONE } from '../worker/src/logic.js';

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

test('every message variant: short, no scores/results, posted ones name the poster', () => {
  const all = [...MORNING.saksham, ...MORNING.soukhya, ...POSTED.saksham, ...POSTED.soukhya, ...EVENING_NONE, ...EVENING_ONE];
  for (const [title, body] of all) {
    assert.ok(title.length <= 45, `title too long: ${title}`);
    assert.ok(body.length <= 90, `body too long: ${body}`);
    assert.doesNotMatch(title + ' ' + body, /\d\s*[\/★]|(?<![A-Za-z])(won|lost|scored?)(?![A-Za-z'’])/i, `leaks result: ${title} ${body}`);
    assert.doesNotMatch(title + ' ' + body, /\bwe\b/i);
  }
  for (const [title] of [...POSTED.saksham, ...POSTED.soukhya]) assert.match(title, /\{p\}/);
  assert.equal(otherOf('saksham'), 'soukhya');
});

test('posted message goes by poster name and is addressed to the other player', () => {
  for (let i = 0; i < 4; i++) {
    const rnd = () => i / 4;
    assert.match(postedMessage('soukhya', rnd).title, /^Soukhya /);
    assert.match(postedMessage('saksham', rnd).title, /^Saksham /);
  }
  assert.match(postedMessage('saksham', () => 0).body, /madam/i); // Soukhya receives it
  assert.match(postedMessage('soukhya', () => 0).body, /sailor/i); // Saksham receives it
});

const on = { posted: true, morning: true, evening: true };
const base = { morningHour: 8, eveningHour: 15, sw: on };

test('cron: morning is personal (Madam for Soukhya, Sailor for Saksham) and only at the morning hour', () => {
  const m = cronMessages({ ...base, hour: 8, posted: {} }, () => 0);
  assert.deepEqual(m.map((x) => x.to).sort(), ['saksham', 'soukhya']);
  assert.match(m.find((x) => x.to === 'soukhya').title, /TOP OF THE MORNING MADAM/);
  assert.match(m.find((x) => x.to === 'saksham').title, /TOP OF THE MORNING TO YOU SAILOR/);
  assert.equal(cronMessages({ ...base, hour: 9, posted: {} }).length, 0);
  assert.equal(cronMessages({ ...base, hour: 8, posted: {}, sw: { ...on, morning: false } }).length, 0);
});

test('cron: afternoon nudge depends on who has posted', () => {
  const none = cronMessages({ ...base, hour: 15, posted: { saksham: false, soukhya: false } });
  assert.equal(none.length, 2);
  const one = cronMessages({ ...base, hour: 15, posted: { saksham: true, soukhya: false } }, () => 0);
  assert.equal(one.length, 1);
  assert.equal(one[0].to, 'soukhya');
  assert.match(one[0].title, /Saksham already posted/);
  assert.equal(cronMessages({ ...base, hour: 15, posted: { saksham: true, soukhya: true } }).length, 0);
  assert.equal(cronMessages({ ...base, hour: 15, posted: {}, sw: { ...on, evening: false } }).length, 0);
});
