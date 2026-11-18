// Games, players and the rules for who wins what.

export const PLAYERS = [
  { id: 'saksham', name: 'Saksham', short: 'S', color: 'var(--pink)', soft: 'var(--pink-soft)' },
  { id: 'soukhya', name: 'Soukhya', nick: 'Soukhya, the Custodian of Egypt, Conqueror of the Levant, Benevolent Kurdish Leader of the Caliphate', short: 'K', color: 'var(--mint)', soft: 'var(--mint-soft)' },
];

// kind: 'wordle' = lower wins (X loses) · 'waffle' = stars 0-5, higher wins · 'high' = raw points, higher wins
export const GAMES = [
  { id: 'wordle', name: 'Wordle', emoji: '🟩', kind: 'wordle', optional: false },
  { id: 'krillion', name: 'Krillion', emoji: '🦐', kind: 'high', optional: false },
  { id: 'noillirk', name: 'Noillirk', emoji: '🔄', kind: 'high', optional: false },
  { id: 'waffle', name: 'Waffle', emoji: '🧇', kind: 'waffle', optional: false },
  { id: 'farflung', name: 'Farflung', emoji: '🌍', kind: 'high', optional: true },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
export const playerById = (id) => PLAYERS.find((p) => p.id === id);
export const otherPlayer = (id) => PLAYERS.find((p) => p.id !== id);

/** A game result is { status: 'done' | 'failed' | 'skip', score: number | null } */
export const played = (g) => !!g && (g.status === 'done' || g.status === 'failed');

// Lower rank is better. Wordle: score 1-6, fail = 7. Others: negated score so higher is better.
function rank(game, r) {
  if (game.kind === 'wordle') return r.status === 'failed' ? 7 : Number(r.score);
  return -Number(r.score);
}

/** Returns winning player id, 'tie', or null (no contest: someone didn't play). */
export function compareGame(gameId, entryA, entryB) {
  const game = gameById(gameId);
  const a = entryA?.games?.[gameId];
  const b = entryB?.games?.[gameId];
  if (!game || !played(a) || !played(b)) return null;
  const ra = rank(game, a);
  const rb = rank(game, b);
  if (ra === rb) return 'tie';
  return ra < rb ? entryA.player : entryB.player;
}

/**
 * Result of a whole day. Needs both players' entries.
 * status: 'none' (nobody posted) | 'waiting' (one posted) | 'nocontest' (both posted, no shared game) | 'complete'
 */
export function dayResult(entryA, entryB) {
  const res = { status: 'none', games: {}, wins: { saksham: 0, soukhya: 0 }, ties: 0, winner: null };
  if (!entryA && !entryB) return res;
  if (!entryA || !entryB) return { ...res, status: 'waiting' };
  let decided = 0;
  for (const g of GAMES) {
    const w = compareGame(g.id, entryA, entryB);
    res.games[g.id] = w;
    if (w === null) continue;
    decided++;
    if (w === 'tie') res.ties++;
    else res.wins[w]++;
  }
  if (!decided) return { ...res, status: 'nocontest' };
  res.status = 'complete';
  if (res.wins.saksham > res.wins.soukhya) res.winner = 'saksham';
  else if (res.wins.soukhya > res.wins.saksham) res.winner = 'soukhya';
  else res.winner = 'tie';
  return res;
}

/** Human-friendly score text for a game result. */
export function fmtScore(gameId, r) {
  if (!r || r.status === 'skip') return '—';
  const game = gameById(gameId);
  if (game.kind === 'wordle') return r.status === 'failed' ? 'X' : `${r.score}/6`;
  if (game.kind === 'waffle') return `${r.score}★`;
  return String(r.score);
}
