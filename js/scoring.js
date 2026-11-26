// Games, players and the rules for who wins what.

export const PLAYERS = [
  { id: 'saksham', name: 'Saksham', short: 'S', color: 'var(--pink)', soft: 'var(--pink-soft)' },
  { id: 'soukhya', name: 'Soukhya', nick: 'Soukhya, the Custodian of Egypt, Conqueror of the Levant, Benevolent Kurdish Leader of the Caliphate', short: 'K', color: 'var(--mint)', soft: 'var(--mint-soft)' },
];

// kind: 'wordle' = lower wins (X loses) · 'waffle' = stars 0-5, higher wins · 'high' = raw points, higher wins
//       'sudoku' = { score, time (seconds) }: higher score wins, equal score → faster time wins; 'failed' (DNF) loses
export const GAMES = [
  { id: 'wordle', name: 'Wordle', emoji: '🟩', kind: 'wordle', optional: false },
  { id: 'krillion', name: 'Krillion', emoji: '🦐', kind: 'high', optional: false },
  { id: 'noillirk', name: 'Noillirk', emoji: '🔄', kind: 'high', optional: false },
  { id: 'waffle', name: 'Waffle', emoji: '🧇', kind: 'waffle', optional: false },
  { id: 'sudoku', name: 'Sudoku', emoji: '🔢', kind: 'sudoku', optional: false },
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

function compareSudoku(pa, a, pb, b) {
  const af = a.status === 'failed', bf = b.status === 'failed';
  if (af || bf) return af && bf ? 'tie' : af ? pb : pa;
  if (Number(a.score) !== Number(b.score)) return Number(a.score) > Number(b.score) ? pa : pb;
  const ta = Number.isFinite(Number(a.time)) ? Number(a.time) : Infinity;
  const tb = Number.isFinite(Number(b.time)) ? Number(b.time) : Infinity;
  if (ta === tb) return 'tie';
  return ta < tb ? pa : pb;
}

/** Seconds → "m:ss" (or "h:mm:ss" for an hour or more). */
export function fmtTime(sec) {
  const t = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Returns winning player id, 'tie', or null (no contest: someone didn't play). */
export function compareGame(gameId, entryA, entryB) {
  const game = gameById(gameId);
  const a = entryA?.games?.[gameId];
  const b = entryB?.games?.[gameId];
  if (!game || !played(a) || !played(b)) return null;
  if (game.kind === 'sudoku') return compareSudoku(entryA.player, a, entryB.player, b);
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
  if (game.kind === 'sudoku') return r.status === 'failed' ? 'DNF' : `${r.score} · ${fmtTime(r.time)}`;
  return String(r.score);
}
