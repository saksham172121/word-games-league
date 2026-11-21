// Pure decision logic + message copy for the push Worker (no network), so it can be unit-tested in Node.
// Messages are [title, body] pairs; one is picked at random each time. {p} = the other player's name.
// Keep titles short: phones cut off long ones. Never put scores in here (keeps the no-peeking rule).

export const PLAYERS = { saksham: 'Saksham', soukhya: 'Soukhya' };
export const otherOf = (id) => (id === 'saksham' ? 'soukhya' : 'saksham');

const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
const fill = (s, p) => s.replace(/\{p\}/g, p);

// ---------- Message pools, keyed by who RECEIVES the notification ----------
export const MORNING = {
  soukhya: [
    ['TOP OF THE MORNING MADAM ☀️🫡', 'The Custodian of Egypt has puzzles to conquer. 🏺'],
    ['TOP OF THE MORNING MADAM 🌅👑', 'Rise, Conqueror of the Levant. Wordle won\'t play itself. 🧇'],
    ['TOP OF THE MORNING MADAM ☕✨', 'Time to get beaten. I mean, to win. Probably. 🥊'],
    ['TOP OF THE MORNING MADAM 🐓📣', 'Benevolent Leader of the Caliphate, your daily duel awaits. ⚔️'],
  ],
  saksham: [
    ['TOP OF THE MORNING TO YOU SAILOR ⛵☀️', 'Wordle won\'t play itself. 🧇'],
    ['TOP OF THE MORNING TO YOU SAILOR 🌊🫡', 'Calm seas, sharp guesses. Do not get beaten today. 🥊'],
    ['TOP OF THE MORNING TO YOU SAILOR 🏴‍☠️', 'Hoist the sails, hoist the streak. 🔥'],
    ['TOP OF THE MORNING TO YOU SAILOR ⚓🌅', 'Puzzles ahead, captain. 🧩'],
  ],
};

export const POSTED = {
  soukhya: [ // sent to Soukhya when Saksham posts
    ['{p} posted 👀🔥', 'Time to get beaten, madam? Your move. 🥊'],
    ['{p} just posted 🎯', 'The pressure is on. Do not choke. 😈'],
    ['{p} is done 🫡', 'Your turn, Conqueror. Make it count. ⚔️'],
    ['{p} posted 👑', 'Impressive, probably. Show him how it is done. 💅'],
  ],
  saksham: [ // sent to Saksham when Soukhya posts
    ['{p} posted 👀🔥', 'Time to get beaten, sailor? Your move. 🥊'],
    ['{p} just posted 🎯', 'The Custodian has spoken. Match it. 🏺'],
    ['{p} is done 😏', 'Your turn. No pressure. A LOT of pressure. 😬'],
    ['{p} posted 👑', 'Impressive, probably. Show them how it is done. 💅'],
  ],
};

export const EVENING_NONE = [
  ['Nobody has played yet 🦗🧇', 'The waffles are getting cold. Someone start. 🍽️'],
  ['Dead silence 💤🤫', 'Zero games from both of you. Embarrassing. 😤'],
  ['Hello?? 📣🙃', 'The league is empty. Time to get beaten, anyone? 🥊'],
];
export const EVENING_ONE = [ // sent to whoever has NOT posted yet
  ['{p} already posted 😬⏰', 'Your move before the day ends. Do not be a coward. 🐔'],
  ['{p} is waiting 👀🕰️', 'Time to get beaten, or to fight back? Choose. 🥊'],
  ['Tick tock ⏳🫠', '{p} already played. The day is running out. 🏃'],
  ['Hello?? 📣😤', '{p} posted ages ago. Your scores are late. 📝'],
];

/** Local hour (0-23) and 'YYYY-MM-DD' for an instant, in an IANA time zone. */
export function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { hour: Number(get('hour')), ymd: `${get('year')}-${get('month')}-${get('day')}` };
}

/** Which switches are on. Everything defaults to OFF until Saksham flips it in the secret panel. */
export const switches = (settingsPush) => ({
  posted: settingsPush?.posted === true,
  morning: settingsPush?.morning === true,
  evening: settingsPush?.evening === true,
});

/** "X just posted", for the other player. */
export function postedMessage(poster, rnd) {
  const [title, body] = pick(POSTED[otherOf(poster)], rnd);
  return { title: fill(title, PLAYERS[poster]), body: fill(body, PLAYERS[poster]), tag: 'posted' };
}

/**
 * What the hourly cron should send.
 * posted = { saksham: bool, soukhya: bool } for the local day. Returns [{ to, title, body, tag }].
 */
export function cronMessages({ hour, posted, morningHour, eveningHour, sw }, rnd) {
  const out = [];
  const both = ['saksham', 'soukhya'];
  if (sw.morning && hour === morningHour) {
    for (const to of both) {
      const [title, body] = pick(MORNING[to], rnd);
      out.push({ to, title, body, tag: 'morning' });
    }
  }
  if (sw.evening && hour === eveningHour) {
    const n = both.filter((p) => posted[p]).length;
    if (n === 0) {
      for (const to of both) {
        const [title, body] = pick(EVENING_NONE, rnd);
        out.push({ to, title, body, tag: 'evening' });
      }
    } else if (n === 1) {
      const done = both.find((p) => posted[p]);
      const [title, body] = pick(EVENING_ONE, rnd);
      out.push({ to: otherOf(done), title: fill(title, PLAYERS[done]), body: fill(body, PLAYERS[done]), tag: 'evening' });
    }
  }
  return out;
}
