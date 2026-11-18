// Turns raw entries into days, leaderboard stats, streaks and badges.
import { GAMES, PLAYERS, dayResult, played } from './scoring.js';
import { monthKey, weekStart, todayISO } from './dates.js';

/** entries[] -> { 'YYYY-MM-DD': { date, entries: {saksham, soukhya}, result } } */
export function buildDays(entries) {
  const days = {};
  for (const e of entries) {
    (days[e.date] ||= { date: e.date, entries: {} }).entries[e.player] = e;
  }
  for (const d of Object.values(days)) d.result = dayResult(d.entries.saksham, d.entries.soukhya);
  return days;
}

export function periodFilter(period, today = todayISO()) {
  if (period === 'week') {
    const ws = weekStart(today);
    return (date) => date >= ws;
  }
  if (period === 'month') return (date) => monthKey(date) === monthKey(today);
  return () => true;
}

const emptyPlayer = () => ({
  dayWins: 0, dayLosses: 0, dayTies: 0,
  gameWins: 0, gameLosses: 0, gameTies: 0,
  perGame: Object.fromEntries(GAMES.map((g) => [g.id, { w: 0, l: 0, t: 0 }])),
  curStreak: 0, bestStreak: 0, posted: 0,
});

export function computeStats(days, filter = () => true) {
  const by = { saksham: emptyPlayer(), soukhya: emptyPlayer() };
  const dates = Object.keys(days).filter(filter).sort();
  const streak = { saksham: 0, soukhya: 0 };
  for (const date of dates) {
    const d = days[date];
    for (const p of PLAYERS) if (d.entries[p.id]) by[p.id].posted++;
    const r = d.result;
    if (r.status !== 'complete') continue;
    for (const p of PLAYERS) {
      const me = by[p.id];
      for (const g of GAMES) {
        const w = r.games[g.id];
        if (w === null || w === undefined) continue;
        if (w === 'tie') { me.gameTies++; me.perGame[g.id].t++; }
        else if (w === p.id) { me.gameWins++; me.perGame[g.id].w++; }
        else { me.gameLosses++; me.perGame[g.id].l++; }
      }
      if (r.winner === 'tie') { me.dayTies++; streak[p.id] = 0; }
      else if (r.winner === p.id) { me.dayWins++; streak[p.id]++; me.bestStreak = Math.max(me.bestStreak, streak[p.id]); }
      else { me.dayLosses++; streak[p.id] = 0; }
      me.curStreak = streak[p.id];
    }
  }
  const decided = by.saksham.dayWins + by.saksham.dayLosses + by.saksham.dayTies;
  for (const p of PLAYERS) {
    const me = by[p.id];
    me.winRate = decided ? me.dayWins / decided : 0;
  }
  return { by, decided };
}

// ---------- Badges ----------
const worstRun = (outcomes, pid) => {
  // true if a win follows 2+ losses
  let losses = 0;
  for (const w of outcomes) {
    if (w === pid) { if (losses >= 2) return true; losses = 0; }
    else if (w === 'tie') losses = 0;
    else losses++;
  }
  return false;
};

export const BADGES = [
  { id: 'first', emoji: '🩸', name: 'First Blood', desc: 'Win your first day.', test: (c) => c.stats.dayWins >= 1 },
  { id: 'hat', emoji: '🎩', name: 'Hat Trick', desc: '3 day-wins in a row.', test: (c) => c.stats.bestStreak >= 3 },
  { id: 'fire', emoji: '🔥', name: 'Menace', desc: '5 day-wins in a row.', test: (c) => c.stats.bestStreak >= 5 },
  { id: 'wiz', emoji: '🧙', name: 'Wordle Wizard', desc: 'Wordle in 2 or fewer.', test: (c) => c.mine.some((e) => e.games?.wordle?.status === 'done' && e.games.wordle.score <= 2) },
  { id: 'hole', emoji: '🏌️', name: 'Hole In One', desc: 'Wordle in 1. Liar.', test: (c) => c.mine.some((e) => e.games?.wordle?.status === 'done' && e.games.wordle.score === 1) },
  { id: 'waffle', emoji: '🧇', name: 'Waffle Michelin', desc: 'A perfect 5★ Waffle.', test: (c) => c.mine.some((e) => e.games?.waffle?.status === 'done' && e.games.waffle.score === 5) },
  { id: 'sweep', emoji: '🧹', name: 'Clean Sweep', desc: 'Win every game in a day (3+ games).', test: (c) => c.sweep },
  { id: 'comeback', emoji: '🦸', name: 'Comeback Kid', desc: 'Win a day after 2+ losses.', test: (c) => c.comeback },
  { id: 'drama', emoji: '🎭', name: 'Drama Queen', desc: 'Write 5 victory speeches/excuses.', test: (c) => c.mine.filter((e) => (e.note || '').trim()).length >= 5 },
  { id: 'sore', emoji: '💀', name: 'Sore Loser', desc: 'Fail Wordle 3 times.', test: (c) => c.mine.filter((e) => e.games?.wordle?.status === 'failed').length >= 3 },
  { id: 'loyal', emoji: '📅', name: 'Committed', desc: 'Post on 7 different days.', test: (c) => c.mine.length >= 7 },
  { id: 'month', emoji: '🗓️', name: 'Unemployed (affectionate)', desc: 'Post on 30 different days.', test: (c) => c.mine.length >= 30 },
];

export function computeBadges(entries, days) {
  const out = {};
  const sorted = Object.keys(days).sort();
  const all = computeStats(days);
  for (const p of PLAYERS) {
    const mine = entries.filter((e) => e.player === p.id);
    let sweep = false;
    const outcomes = [];
    for (const date of sorted) {
      const r = days[date].result;
      if (r.status !== 'complete') continue;
      outcomes.push(r.winner);
      const decided = GAMES.filter((g) => r.games[g.id] !== null && r.games[g.id] !== undefined).length;
      if (decided >= 3 && r.wins[p.id] === decided) sweep = true;
    }
    const ctx = { mine, stats: all.by[p.id], sweep, comeback: worstRun(outcomes, p.id) };
    out[p.id] = BADGES.map((b) => ({ ...b, earned: !!b.test(ctx) }));
  }
  return out;
}

export { played };
