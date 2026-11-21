// Pure decision logic for the push Worker (no network), so it can be unit-tested in Node.

export const PLAYERS = { saksham: 'Saksham', soukhya: 'Soukhya' };
export const otherOf = (id) => (id === 'saksham' ? 'soukhya' : 'saksham');

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

/** Message for "X just posted". Never includes scores (keeps the no-peeking rule). */
export function postedMessage(player) {
  return { title: `${PLAYERS[player]} posted 👀`, body: 'Your move. No pressure. A lot of pressure.', tag: 'posted' };
}

/**
 * What the hourly cron should send.
 * posted = { saksham: bool, soukhya: bool } for the local day. Returns [{ to: 'saksham'|'soukhya', title, body, tag }].
 */
export function cronMessages({ hour, posted, morningHour, eveningHour, sw }) {
  const out = [];
  const both = ['saksham', 'soukhya'];
  if (sw.morning && hour === morningHour) {
    for (const to of both) {
      out.push({ to, title: 'TOP OF THE MORNING TO YOU SAILOR ☀️', body: 'Wordle won\'t play itself. 🧇', tag: 'morning' });
    }
  }
  if (sw.evening && hour === eveningHour) {
    const n = both.filter((p) => posted[p]).length;
    if (n === 0) {
      for (const to of both) out.push({ to, title: 'Nobody has played yet 🦗', body: 'The waffles are cooling. Someone start.', tag: 'evening' });
    } else if (n === 1) {
      const done = both.find((p) => posted[p]);
      const todo = otherOf(done);
      out.push({ to: todo, title: `${PLAYERS[done]} already posted 😬`, body: 'Your move before the day ends.', tag: 'evening' });
    }
  }
  return out;
}
