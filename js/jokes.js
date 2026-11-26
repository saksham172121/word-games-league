// All the sass. {me} = the person entering, {them} = the rival, {w}/{l} = winner/loser.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fill = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
/** Any laugh ("hehehe", "hahaha", "hihihi"...) becomes "hehehehe ~twks" (that's what she said). */
export const twks = (s) => String(s).replace(/\b(?:h[aeiou]){3,}h?\b(?!\s*~twks)/gi, 'hehehehe ~twks');
const say = (arr, v) => twks(fill(pick(arr), v));

const WORDLE = {
  1: [
    '1/6?! Either you are a wizard or you have a time machine. Frame this. 🖼️',
    'ONE GUESS. The Wordle gods bowed to you, {me}. Everyone else: sit down. 👑',
    'Hole in one 🏌️ Please spend this luck on a lottery ticket immediately.',
  ],
  2: [
    '2/6. Unhinged talent. You are making {them} feel things. 😤',
    'Two guesses?! Who raised you, a dictionary? 📖',
    'Two! Show-off behaviour, and honestly, I respect it.',
  ],
  3: [
    '3/6. Clean. Confident. Slightly smug. Chef\'s kiss. 😌💋',
    'A three! Big brain, small tips, huge ego. I love to see it.',
    'Three guesses. Your brain is doing yoga today. 🧘',
  ],
  4: [
    '4/6. The human average. Beautifully, boringly normal. 🧍',
    'A solid 4. Not a legend, not a disaster, just vibes. ✌️',
    'Four. Respectable. Nobody will write songs about it, but still.',
  ],
  5: [
    '5/6… sweating a little, are you? 😅',
    'Five guesses. You made it dramatic for no reason. Entertainment though.',
    '5/6. The letters fought back and you barely won. 🥊',
  ],
  6: [
    '6/6. Last life, final boss, cinematic. Heart rate: 140. Dignity: gone. 🎬',
    'SIX. You clutched it by one inch. Be proud. Be very quiet about it.',
    'You won on the last guess. Technically a win. Spiritually a hostage situation. 😮‍💨',
  ],
  X: [
    'X. 💀 I hold a moment of silence 🕯️ and then I laugh.',
    'Failed. The word was probably "EASY" and that is the joke.',
    'X/6. The dictionary has filed a restraining order. 📜',
    'Wordle Defeated You. Even the cursor felt bad. 😭',
  ],
};

const WAFFLE = {
  5: ['5 stars ⭐⭐⭐⭐⭐ A perfect waffle. Michelin is calling.', 'FIVE STARS. Absolute breakfast royalty. 🧇👑'],
  4: ['4 stars. Crispy, golden, only slightly smug.', 'Four! One swap shy of perfection. Just frame it as "modesty".'],
  3: ['3 stars. A respectable, fluffy, mid waffle. 🧇', 'Three stars. The waffle is fine. YOU are fine. Everyone is fine.'],
  2: ['2 stars. This waffle needs a little love. And maybe syrup.', 'Two stars. Slightly soggy. Moral support deployed. 🫶'],
  1: ['1 star. I do not speak of this waffle.', 'One star. The waffle iron has filed a complaint.'],
  0: ['0 stars. Burnt. 🔥 Straight to the bin, eat cereal instead.', 'Zero. The waffle did not survive. Neither did your pride. 🪦'],
};

const NUM = {
  krillion: [
    'Krillion logged. 🦐 Numbers are numbers, but yours have swagger.',
    'Shrimply the best. (Sorry. Not sorry.) 🦐',
    'Krillion: noted. The shrimp council will review it.',
  ],
  noillirk: [
    'Noillirk, locked in. 🔄 Reads the same backwards? Nobody knows.',
    'Noillirk logged. {them} is nervously refreshing the app right now.',
    'Noillirk. Looks like "Krillion" reversed and yet somehow harder.',
  ],
  farflung: [
    'Farflung… 🌍 you went far and flung hard. Respect.',
    'Farflung logged. Bonus game, bonus bragging rights. ✨',
    'Wow, you actually played Farflung. Over-achiever energy.',
  ],
};
const ZERO = ['Zero. A bold artistic choice. 🎨', 'Zero! The purest form of score. Also the saddest. 🥲'];

const SKIP = [
  'Skipped. Coward. 🐔 (I love you though)',
  'No play, no pain. Smart or scared?',
  'Skipped it. The game is crying but you will never know.',
  'Okay, quitter. The league remembers. 👀',
];

export function reactWordle(v, vars) {
  return say(WORDLE[v] || WORDLE[6], vars);
}
export function reactWaffle(n, vars) {
  return say(WAFFLE[n] || WAFFLE[3], vars);
}
export function reactNum(gameId, n, vars) {
  if (n === 0) return say(ZERO, vars);
  return say(NUM[gameId] || NUM.krillion, vars);
}
export const reactSkip = (vars) => say(SKIP, vars);

const SUDOKU = {
  dnf: [
    'Did not finish. The grid won. The grid always wins. 💀🔢',
    'DNF. Somewhere a 7 is laughing at you. 😭',
    'You and that sudoku are no longer on speaking terms. 🪦',
  ],
  blitz: [ // under 5 minutes
    'Under 5 minutes?! Are you a calculator in a trench coat? 🧮🏎️',
    'Speedrun energy. {them} has been notified and is now worried. 😤',
    'That was so fast the numbers got whiplash. ⚡',
  ],
  quick: [ // 5-10 minutes
    'Clean and quick. Your brain is in its gym era. 💪🧠',
    'Solid time. The grid never stood a chance. 🔢✨',
  ],
  steady: [ // 10-20 minutes
    'A respectable, steady solve. Slow and smug wins the race. 🐢',
    'Not fast, not slow. Perfectly average. Like a beige sofa. 🛋️',
  ],
  slow: [ // 20+ minutes
    'Over 20 minutes… did you solve it or adopt it? 🍼',
    'That sudoku took a whole lunch break. Respect the commitment. 🥪',
    'Your pencil is now legally a senior citizen. ✏️👴',
  ],
};
export function reactSudoku(r, vars) {
  if (!r || r.status === 'failed') return say(SUDOKU.dnf, vars);
  const t = Number(r.time) || 0;
  return say(t < 300 ? SUDOKU.blitz : t < 600 ? SUDOKU.quick : t < 1200 ? SUDOKU.steady : SUDOKU.slow, vars);
}

// ---------- Day results ----------
const DAY_WIN = [
  '{w} takes the day {a}–{b}! 👑 Absolute legend. {l}, was that… a tear? 😭',
  '{w} wins {a}–{b}. History books are being updated. {l} is being gently escorted off the podium. 🏆',
  '{a}–{b} to {w}! Flawless, humble, extremely talented. (I am not biased.) {l}: tomorrow, maybe. 🫡',
  '{w} 1, {l} 0. Today the universe sided with {w}. Blame the universe, {l}. 🌌',
  'Standing ovation for {w}! 👏 {l} has been advised to hydrate and reflect.',
  '{w} ate that. {l} was the plate. 🍽️ ({a}–{b})',
];
const DAY_TIE = [
  'Dead tie {a}–{b}. You are equally great and equally mid. 🤝',
  'A draw! Nobody wins, nobody sleeps. 😤 {a}–{b}',
  '{a}–{b}. Perfectly balanced, as all things should be. Rematch tomorrow. ⚖️',
];
const DAY_NOCONTEST = [
  'You both posted, but never played the same game. Chaotic. Hilarious. No winner. 🌀',
];
const WAITING_FOR_THEM = [
  '{them} has not posted yet. Apply pressure. Send a menacing emoji. 😈',
  'Waiting on {them}… maybe they are crying in a corner. Maybe they are busy. Probably crying. 🫠',
  'The scoreboard holds its breath. {them}, hurry up. 🫁',
];
const WAITING_FOR_ME = [
  '{them} already posted! Your move, {me}. No pressure. A LOT of pressure. 😬',
  '{them} is done. You are not. The tension is unreal. ⏳',
];
const NOBODY = ['Nobody has played yet today. The waffles are cooling. 🧇', 'It is quiet. Too quiet. Someone play a game. 🦗'];

export function dayBanner(res, names, viewer) {
  const [A, B] = [names.saksham, names.soukhya];
  const me = viewer ? names[viewer] : A;
  const them = viewer ? (viewer === 'saksham' ? B : A) : B;
  if (res.status === 'none') return say(NOBODY);
  if (res.status === 'waiting') return say(res.mine ? WAITING_FOR_THEM : WAITING_FOR_ME, { me, them });
  if (res.status === 'nocontest') return say(DAY_NOCONTEST);
  if (res.winner === 'tie') return say(DAY_TIE, { a: res.wins.saksham, b: res.wins.soukhya });
  const w = res.winner, l = w === 'saksham' ? 'soukhya' : 'saksham';
  return say(DAY_WIN, { w: names[w], l: names[l], a: res.wins[w], b: res.wins[l] });
}

// ---------- Leaderboard headline ----------
export function boardHeadline(stats, names) {
  const a = stats.by.saksham, b = stats.by.soukhya;
  if (!stats.decided) return 'No results yet. The rivalry is a blank page. ✨ Go make history.';
  if (a.dayWins === b.dayWins) return say(['Level on days won. Tension you can taste. 🍬', 'Perfectly tied. One of you is about to ruin that. 😈']);
  const lead = a.dayWins > b.dayWins ? 'saksham' : 'soukhya';
  const trail = lead === 'saksham' ? 'soukhya' : 'saksham';
  const gap = Math.abs(a.dayWins - b.dayWins);
  const v = { w: names[lead], l: names[trail], g: gap };
  if (gap === 1) return say(['{w} leads by just 1. {l} is breathing down their neck. 😮‍💨', 'One day separates them. {l}, smell blood? 🩸'], v);
  if (gap <= 3) return say(['{w} is up by {g}. Comfortable? Never. {l} is plotting. 🕵️', '{w} leads by {g}. {l} calls it "strategic warming up". 🔥'], v);
  return say(['{w} is {g} days ahead. {l}, this is not a gap, it is a canyon. 🏔️', '{w} is cooking. {l} is the ingredient. 🍳 ({g} days clear)'], v);
}

export function streakLine(name, n) {
  if (n >= 5) return `${name} is on a ${n}-day tear 🔥🔥🔥 somebody stop them`;
  if (n >= 3) return `${name} has ${n} wins in a row 🔥`;
  if (n === 2) return `${name} has won 2 straight. Warming up. ♨️`;
  if (n === 1) return `${name} won the last day.`;
  return `${name}: streak is zero. Reset. Breathe. 🧘`;
}

/** Time-of-day banner shown when the app is opened. Returns null outside the morning (5:00-11:59). */
export function timeNotif(hour, player) {
  if (hour >= 5 && hour < 12) {
    return player === 'soukhya'
      ? { emoji: '☀️', title: 'TOP OF THE MORNING MADAM 🫡', sub: 'The Custodian of Egypt has puzzles to conquer. 🏺' }
      : { emoji: '☀️', title: 'TOP OF THE MORNING TO YOU SAILOR ⛵', sub: 'Wordle won\'t play itself. 🧇' };
  }
  return null;
}

export const LOADING = [
  'Warming up the waffle iron…', 'Asking the dictionary nicely…', 'Untangling the letters…',
  'Judging you silently…', 'Polishing the trophies…', 'Bribing the leaderboard…', 'Counting the tears…',
];
export const randomLoading = () => pick(LOADING);

export const EMPTY_CAL = 'Tap any day to see what went down. 🔍';
export const SUBMIT_DONE = ['Locked in. 🔒 No take-backs (okay, there are edits).', 'Saved! Your results are now legally binding. 📜', 'Done. The league has been notified. 📣'];
export const submitDone = () => pick(SUBMIT_DONE);
export const greeting = (name) =>
  pick([`Hey ${name} 👋`, `Welcome back, ${name} ✨`, `${name}!! 🎉`, `Oh look, it's ${name} 😏`, `Ready to flex, ${name}? 💪`]);
