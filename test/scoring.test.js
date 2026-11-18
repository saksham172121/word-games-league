import test from 'node:test';
import assert from 'node:assert/strict';
import { compareGame, dayResult, fmtScore } from '../js/scoring.js';
import { buildDays, computeStats, computeBadges } from '../js/stats.js';
import { weekStart, addDays } from '../js/dates.js';

const e = (player, date, games, note = '') => ({ id: `${date}_${player}`, player, date, games, note });
const done = (score) => ({ status: 'done', score });
const fail = { status: 'failed', score: null };
const skip = { status: 'skip', score: null };

test('wordle: lower wins, fail loses, both fail ties', () => {
  const a = e('saksham', '2026-01-01', { wordle: done(3) });
  const b = e('soukhya', '2026-01-01', { wordle: done(4) });
  assert.equal(compareGame('wordle', a, b), 'saksham');
  assert.equal(compareGame('wordle', a, e('soukhya', '2026-01-01', { wordle: fail })), 'saksham');
  assert.equal(compareGame('wordle', e('saksham', 'd', { wordle: fail }), e('soukhya', 'd', { wordle: fail })), 'tie');
  assert.equal(compareGame('wordle', a, e('soukhya', 'd', { wordle: done(3) })), 'tie');
});

test('higher-wins games and waffle', () => {
  const a = e('saksham', 'd', { krillion: done(120), waffle: done(5), farflung: done(0) });
  const b = e('soukhya', 'd', { krillion: done(90), waffle: done(2), farflung: done(0) });
  assert.equal(compareGame('krillion', a, b), 'saksham');
  assert.equal(compareGame('waffle', a, b), 'saksham');
  assert.equal(compareGame('farflung', a, b), 'tie');
});

test('skip means no contest', () => {
  const a = e('saksham', 'd', { wordle: done(3) });
  const b = e('soukhya', 'd', { wordle: skip });
  assert.equal(compareGame('wordle', a, b), null);
  assert.equal(compareGame('noillirk', a, b), null);
});

test('dayResult statuses and winner', () => {
  assert.equal(dayResult(undefined, undefined).status, 'none');
  assert.equal(dayResult(e('saksham', 'd', {}), undefined).status, 'waiting');
  assert.equal(dayResult(e('saksham', 'd', { wordle: skip }), e('soukhya', 'd', { wordle: skip })).status, 'nocontest');
  const r = dayResult(
    e('saksham', 'd', { wordle: done(3), krillion: done(10), waffle: done(1) }),
    e('soukhya', 'd', { wordle: done(5), krillion: done(20), waffle: done(0) }),
  );
  assert.equal(r.status, 'complete');
  assert.deepEqual(r.wins, { saksham: 2, soukhya: 1 });
  assert.equal(r.winner, 'saksham');
  const t = dayResult(e('saksham', 'd', { wordle: done(3), krillion: done(5) }), e('soukhya', 'd', { wordle: done(4), krillion: done(9) }));
  assert.equal(t.winner, 'tie');
});

test('fmtScore', () => {
  assert.equal(fmtScore('wordle', done(3)), '3/6');
  assert.equal(fmtScore('wordle', fail), 'X');
  assert.equal(fmtScore('waffle', done(4)), '4★');
  assert.equal(fmtScore('krillion', done(77)), '77');
  assert.equal(fmtScore('krillion', skip), '—');
});

test('stats: day record, streaks, period filter', () => {
  const win = (d) => [e('saksham', d, { wordle: done(2) }), e('soukhya', d, { wordle: done(5) })];
  const lose = (d) => [e('saksham', d, { wordle: done(5) }), e('soukhya', d, { wordle: done(2) })];
  const entries = [...win('2026-03-01'), ...win('2026-03-02'), ...lose('2026-03-03'), ...win('2026-03-04'), ...win('2026-03-05')];
  const days = buildDays(entries);
  const { by, decided } = computeStats(days);
  assert.equal(decided, 5);
  assert.equal(by.saksham.dayWins, 4);
  assert.equal(by.soukhya.dayWins, 1);
  assert.equal(by.saksham.bestStreak, 2);
  assert.equal(by.saksham.curStreak, 2);
  assert.equal(by.soukhya.curStreak, 0);
  assert.equal(by.saksham.perGame.wordle.w, 4);
  const mar4 = computeStats(days, (d) => d >= '2026-03-04');
  assert.equal(mar4.decided, 2);
});

test('badges: comeback and perfect waffle', () => {
  const mk = (d, sw, kw) => [
    e('saksham', d, { wordle: done(sw), waffle: done(5) }),
    e('soukhya', d, { wordle: done(kw), waffle: done(1) }),
  ];
  // saksham wins waffle always; days where wordle is lost -> tie (1-1). Use krillion for clear losses.
  const lose = (d) => [e('saksham', d, { wordle: done(6), krillion: done(1) }), e('soukhya', d, { wordle: done(1), krillion: done(9) })];
  const entries = [...lose('2026-04-01'), ...lose('2026-04-02'), ...mk('2026-04-03', 2, 5)];
  const days = buildDays(entries);
  const badges = computeBadges(entries, days);
  const earned = (p) => badges[p].filter((b) => b.earned).map((b) => b.id);
  assert.ok(earned('saksham').includes('waffle'));
  assert.ok(earned('saksham').includes('wiz'));
  assert.ok(earned('saksham').includes('comeback'));
  assert.ok(!earned('soukhya').includes('comeback'));
});

test('dates: weekStart is Monday', () => {
  assert.equal(weekStart('2026-11-18'), '2026-11-16'); // Wed -> Mon
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
  assert.equal(weekStart('2026-11-22'), '2026-11-16'); // Sun
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

import { twks } from '../js/jokes.js';
test('twks: laughs become "hehehehe ~twks", idempotent, other words untouched', () => {
  assert.equal(twks('well hahaha ok'), 'well hehehehe ~twks ok');
  assert.equal(twks('hihihi!'), 'hehehehe ~twks!');
  assert.equal(twks('HEHEHEHE'), 'hehehehe ~twks');
  assert.equal(twks('hehehehe ~twks'), 'hehehehe ~twks');
  assert.equal(twks('the heater is here, hehe'), 'the heater is here, hehe');
});
