import { GAMES, PLAYERS, playerById, otherPlayer, fmtScore, played } from './scoring.js';
import { buildDays, computeStats, computeBadges, periodFilter } from './stats.js';
import { todayISO, prettyDate, monthKey, monthTitle, shiftMonth, fromISO, toISO } from './dates.js';
import * as J from './jokes.js';
import { createStore } from './store.js';
import { confetti } from './confetti.js';
import { DAD_JOKES } from './dadjokes.js';
import { APP_VERSION } from './version.js';

const $app = document.getElementById('app');
const names = Object.fromEntries(PLAYERS.map((p) => [p.id, p.name]));
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const S = {
  store: null,
  entries: [],
  days: {},
  loaded: false,
  error: null,
  me: ls.get('wgl-me'),
  view: 'today',
  period: 'month',
  calMonth: monthKey(todayISO()),
  sheet: null,
  wiz: null,
  ad: null,
  secret: null,
  settings: {},
  loadingMsg: J.randomLoading(),
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vars = () => ({ me: names[S.me], them: names[otherPlayer(S.me)?.id] });
const nickHTML = (id) => (playerById(id)?.nick ? `<div class="nick">${esc(playerById(id).nick)}</div>` : '');
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
// The app only runs when launched from the home screen. Local dev (localhost) is exempt,
// unless you add ?install=1 to preview the install screen.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
const gated = !standalone() && !(isLocal && !new URLSearchParams(location.search).has('install'));
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (gated) render(); });
window.addEventListener('appinstalled', () => { installEvent = null; if (gated) render(); });

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ====================== Rendering ======================
function installHTML() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inApp = /Instagram|FBAN|FBAV|Line\/|Snapchat|WhatsApp|Twitter|TikTok|GSA\//i.test(ua);
  const step = (n, t) => `<div class="step"><span class="num">${n}</span><div>${t}</div></div>`;
  let steps;
  if (inApp) {
    steps = step(1, 'This in-app browser can\'t install apps. Tap <b>⋯</b> or <b>Share</b> and choose <b>Open in Safari / Chrome</b>.') +
      `<button class="btn lav" data-a="copyLink" style="margin-top:12px">📋 Copy link instead</button>`;
  } else if (ios) {
    steps = step(1, 'Tap the <b>Share</b> button <span class="kbd">⬆︎</span> at the bottom (or top) of Safari.') +
      step(2, 'Scroll down and tap <b>Add to Home Screen</b> <span class="kbd">＋</span>.') +
      step(3, 'Tap <b>Add</b>, then open <b>Word League</b> from your home screen. 🎉');
  } else if (installEvent) {
    steps = `<button class="btn pink" data-a="installPrompt">📲 Install the app</button>` +
      `<p class="muted" style="margin-top:12px;font-size:15px">Then open <b>Word League</b> from your home screen.</p>`;
  } else {
    steps = step(1, 'Tap the browser menu <span class="kbd">⋮</span>.') +
      step(2, 'Choose <b>Install app</b> or <b>Add to Home screen</b>.') +
      step(3, 'Open <b>Word League</b> from your home screen. 🎉');
  }
  return `<div class="welcome">
    <span class="logo-big">🍬</span>
    <h1>Almost there!</h1>
    <p class="muted" style="font-size:18px">Word Games League lives on your home screen, not in a browser tab.<br><b style="color:var(--ink)">Add it to your Home Screen to play.</b></p>
    <div class="card install" style="margin-top:22px">${steps}</div>
    <p class="muted" style="font-size:14px">Opened from the home screen it runs full-screen, just like a real app. 🧇</p>
  </div>`;
}

function render() {
  if (gated) { $app.innerHTML = installHTML(); return; }
  if (!S.me) { $app.innerHTML = welcomeHTML(); return; }
  if (!S.loaded) { $app.innerHTML = `<div class="boot">🧇<p style="font-size:17px;margin-top:10px" class="muted">${esc(S.loadingMsg)}</p></div>`; return; }
  const view = { today: todayHTML, board: boardHTML, cal: calHTML, fun: funHTML }[S.view]();
  $app.innerHTML = `
    ${topHTML()}
    ${S.store?.mode === 'local' ? '<div class="banner demo">🧪 Demo mode: scores are saved only on this device. Finish the Firebase setup (SETUP.md) to share with Soukhya.</div>' : ''}
    ${S.error ? `<div class="banner">😵 Can't reach the server right now. Showing what I have. (${esc(S.error)})</div>` : ''}
    ${view}
    ${S.me === 'saksham' ? verHTML() : ''}
    ${tabsHTML()}
    ${S.sheet ? sheetHTML() : ''}
    ${S.wiz ? wizHTML() : ''}
    ${S.secret && S.me === 'saksham' ? secretHTML() : ''}
    ${S.ad ? adHTML() : ''}`;
  if (S.secret === 'login') document.getElementById('secretpw')?.focus();
}

// ====================== Version (shown on Saksham's side) ======================
// S.latest = version currently on the server (fetched from sw.js, bypassing every cache).
function verHTML() {
  const newer = S.latest && S.latest !== APP_VERSION;
  return `<p class="ver">Version ${esc(APP_VERSION)}${newer ? ` · <b>v${esc(S.latest)} is out. Close and reopen the app to update.</b>` : S.latest ? ' · up to date ✓' : ''}</p>`;
}
async function checkLatest() {
  try {
    const res = await fetch(`sw.js?nocache=${Date.now()}`, { cache: 'no-store' });
    const v = (await res.text()).match(/const VERSION = '([^']+)'/)?.[1];
    if (v && v !== S.latest) {
      S.latest = v;
      if (S.loaded && S.me === 'saksham' && !['note', 'secretpw', 'adreview'].includes(document.activeElement?.id)) render();
    }
  } catch { /* offline: just show the running version */ }
}

// ====================== Morning notification ======================
// First open of the day between 5:00 and 11:59 shows a slide-down "notification". It lives outside #app so
// re-renders never touch it.
let morningChecked = false;
function maybeMorning() {
  if (morningChecked || !S.me || !S.loaded || gated) return;
  morningChecked = true;
  const n = J.timeNotif(new Date().getHours());
  if (!n || ls.get('wgl-morning') === todayISO()) return;
  ls.set('wgl-morning', todayISO());
  setTimeout(() => showNotif(n), 700);
}
function showNotif({ emoji, title, sub }) {
  const el = document.createElement('div');
  el.className = 'notif';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="notif-e">${emoji}</span><div><b>${esc(title)}</b><div>${esc(sub)}</div></div>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  el.addEventListener('click', close);
  document.body.appendChild(el);
  setTimeout(close, 7000);
}

// ====================== Soukhya's irritating dad-joke ad ======================
// Off by default. Saksham flips it from the secret panel (stored in Firestore `settings/dadjokes`).
// When on, Soukhya's phone rolls the dice once per app launch: at most once every AD_MIN_GAP_DAYS days,
// with an AD_CHANCE probability, a random 20-90s after opening. Never twice in one session.
const AD_KEY = 'wgl-ad-last';
const AD_MIN_GAP_DAYS = 2;
const AD_CHANCE = 0.35;
let adTimer = null;
let adDecided = false;
let jokeBag = [];
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const adEnabled = () => S.settings?.dadjokes?.enabled === true;
const daysSince = (iso) => Math.round((fromISO(todayISO()) - fromISO(iso)) / 86400000);
function nextJoke() {
  if (!jokeBag.length) jokeBag = DAD_JOKES.map((_, i) => i).sort(() => Math.random() - 0.5);
  const j = DAD_JOKES[jokeBag.pop()];
  return Array.isArray(j) ? { setup: j[0], punch: j[1] } : { setup: j, punch: '' };
}
function considerAd() {
  if (adDecided || S.me !== 'soukhya' || gated || !adEnabled() || !DAD_JOKES.length) return;
  adDecided = true;
  const last = ls.get(AD_KEY);
  if (last && daysSince(last) < AD_MIN_GAP_DAYS) return;
  if (Math.random() > AD_CHANCE) return;
  clearTimeout(adTimer);
  adTimer = setTimeout(tryAd, rnd(20000, 90000));
}
function tryAd() {
  if (S.me !== 'soukhya' || !adEnabled()) return;
  if (S.wiz || S.sheet || S.ad || document.hidden) { adTimer = setTimeout(tryAd, 10000); return; } // never interrupt entering scores
  ls.set(AD_KEY, todayISO());
  S.ad = { stage: 'ask', joke: nextJoke() };
  render();
}
function syncAd() {
  clearTimeout(adTimer);
  if (S.ad && !S.ad.preview) S.ad = null;
  adDecided = false;
  considerAd();
}
/** Files Soukhya's optional review of the joke she just heard (not for Saksham's preview). */
function sendReview() {
  const ad = S.ad;
  if (!ad || ad.stage !== 'punch' || ad.preview) return;
  const text = (document.getElementById('adreview')?.value ?? ad.review ?? '').trim().slice(0, 300);
  if (!text) return;
  S.store.addReview?.({ joke: `${ad.joke.setup} ${ad.joke.punch}`.trim(), text, at: Date.now(), player: S.me });
  toast('Review filed. 📝 It will be taken very seriously.');
}
function adHTML() {
  const { stage } = S.ad;
  const joke = { setup: J.twks(S.ad.joke.setup), punch: J.twks(S.ad.joke.punch) };
  let body;
  if (stage === 'ask') {
    body = `<span class="ad-emo">🤡</span><h2>Do you want to hear a bad joke?</h2>
      <div class="row"><button class="btn pink" data-a="adYes">Yes 😩</button><button class="btn ghost" data-a="adNo">No</button></div>`;
  } else if (stage === 'joke') {
    body = `<span class="ad-emo">🥁</span><h2>${esc(joke.setup)}</h2>
      ${joke.punch ? '<button class="btn lav" data-a="adPunch">Tell me Already!</button>' : '<button class="btn ghost" data-a="adMore">Another one 😭</button>'}`;
  } else {
    body = `<span class="ad-emo">😏</span><h2>${esc(joke.setup)}</h2><div class="ad-punch">${esc(joke.punch)}</div>
      <label class="ad-rl" for="adreview">Any words for this bad joke? <span class="muted">(optional)</span></label>
      <textarea id="adreview" rows="2" maxlength="300" placeholder="Rate it, roast it, beg for mercy…">${esc(S.ad.review || '')}</textarea>
      <div class="gap"></div>
      <div class="row"><button class="btn mint" data-a="adMore">Another one 😭</button><button class="btn ghost" data-a="adClose">I'm done</button></div>`;
  }
  return `<div class="overlay ad-overlay"><div class="ad" data-stop>
    <button class="ad-x" data-a="adNo" aria-label="Close">×</button>${body}
    <div class="ad-fine">Sponsored by Dad. Closing this ad will not make it stop.</div>
  </div></div>`;
}

// ====================== Secret panel (Saksham's side only) ======================
// Tap the 🍬 in the header 5 times, then enter the password. The check is client-side only,
// so it keeps casual snoopers out but isn't real security.
const SECRET_HASH = 'c0c78e9316b708ae7622f520332493ae7a8428c82b93d7e998c63b929cd03c7f';
const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('');
let logoTaps = [];
function secretHTML() {
  if (S.secret === 'login') {
    return `<div class="overlay"><div class="sheet" data-stop>
      <button class="close" data-a="secretClose">✕</button>
      <h2>🤫 Password?</h2>
      <input id="secretpw" class="pw" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="shhh…">
      <div class="gap"></div>
      <button class="btn pink" data-a="secretUnlock">Unlock</button>
    </div></div>`;
  }
  const on = adEnabled();
  return `<div class="overlay"><div class="sheet" data-stop>
    <button class="close" data-a="secretClose">✕</button>
    <h2>🤫 Secret panel</h2>
    <div class="card" style="margin-top:12px">
      <h2>🤡 ${esc(names.soukhya)}'s dad-joke popup</h2>
      <p class="muted" style="margin-bottom:12px;font-size:15px">When on, it pops up on ${esc(names.soukhya)}'s phone at random: only some launches, and never two days in a row. Currently <b>${on ? 'ON' : 'OFF'}</b>.</p>
      <button class="btn ${on ? 'mint' : 'ghost'}" data-a="secretToggle">${on ? '✅ ON (tap to turn off)' : '⛔ OFF (tap to turn on)'}</button>
      <div class="gap"></div>
      <button class="btn ghost small" data-a="secretPreview">👀 Preview it on my phone</button>
    </div>
    <div class="card">
      <h2>💬 ${esc(names.soukhya)}'s reviews <span class="sticker">${(S.reviews || []).length}</span></h2>
      ${(S.reviews || []).length ? S.reviews.map((r) => `<div class="review"><div class="muted" style="font-size:13px">${esc(r.joke)}</div><div class="speech">${esc(r.text)}</div><div class="muted" style="font-size:11px;margin-top:2px">${esc(new Date(r.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</div></div>`).join('') : '<p class="muted" style="font-size:15px">No reviews yet. When she types a review after a joke, it shows up here.</p>'}
    </div>
  </div></div>`;
}
async function unlockSecret() {
  const pw = (document.getElementById('secretpw')?.value || '').trim().toLowerCase();
  let ok = false;
  try { ok = (await sha256(pw)) === SECRET_HASH; } catch { ok = false; }
  if (ok) { S.secret = 'panel'; watchReviews(); render(); } else toast('Nope. 🙅');
}
let reviewsWatched = false;
function watchReviews() {
  if (reviewsWatched || !S.store?.subscribeReviews) return;
  reviewsWatched = true;
  S.store.subscribeReviews((list) => {
    S.reviews = list.sort((a, b) => (b.at || 0) - (a.at || 0));
    if (S.secret === 'panel' && !S.ad) render();
  }, (err) => console.warn('reviews unavailable', err.code || err.message));
}
async function toggleAd() {
  const next = !adEnabled();
  const prev = S.settings.dadjokes;
  S.settings.dadjokes = { enabled: next };
  render();
  try {
    await S.store.setSetting('dadjokes', { enabled: next });
    toast(next ? 'Popup is ON for Soukhya 😈' : 'Popup is OFF 🕊️');
  } catch (err) {
    S.settings.dadjokes = prev;
    render();
    toast('Could not save: ' + (err.code || err.message) + '. Publish the new Firebase rules!');
  }
}

function topHTML() {
  const p = playerById(S.me);
  return `<header class="top">
    <div class="logo"><span class="ico" data-a="logoTap">🍬</span><div>Word Games League<small>${esc(names.saksham)} vs ${esc(names.soukhya)}</small></div></div>
    <button class="me" data-a="switchWho" style="background:${p.color}" aria-label="You are ${esc(p.name)}. Tap to switch.">${p.short}</button>
  </header>`;
}

function tabsHTML() {
  const t = [['today', '🏠', 'Today'], ['board', '🏆', 'Board'], ['cal', '📅', 'Calendar'], ['fun', '🎉', 'Fun']];
  return `<div class="tabs"><nav>${t.map(([id, e, l]) => `<button class="tab ${S.view === id ? 'on' : ''}" data-a="tab" data-v="${id}"><span class="e">${e}</span>${l}</button>`).join('')}</nav></div>`;
}

function welcomeHTML() {
  const hint = '';
  return `<div class="welcome">
    <span class="logo-big">🍬</span>
    <h1>Word Games League</h1>
    <p class="muted">Wordle · Krillion · Noillirk · Waffle · Farflung<br>One of you will be crowned daily. Who are you?</p>
    <div class="who">${PLAYERS.map((p) => `<button class="btn ${p.id === 'saksham' ? 'pink' : 'mint'}" data-a="who" data-v="${p.id}">I'm ${esc(p.name)}</button>`).join('')}</div>
    ${hint}
  </div>`;
}

// ---------- Day detail (shared by Today, calendar sheet, done screen) ----------
const hidePeek = (date) => {
  const d = S.days[date];
  return date === todayISO() && d && !d.entries[S.me] && !!d.entries[otherPlayer(S.me).id];
};

function dayScoresHTML(date) {
  const d = S.days[date];
  if (!d || !Object.keys(d.entries).length) return '<p class="muted" style="text-align:center;padding:8px 0">No scores logged for this day.</p>';
  if (hidePeek(date)) {
    return `<div class="nopeek"><span class="big">🙈</span>${esc(names[otherPlayer(S.me).id])} already posted!<br><span class="muted">No peeking. Log yours to reveal the scores.</span></div>`;
  }
  const [A, B] = PLAYERS;
  const ea = d.entries[A.id], eb = d.entries[B.id];
  const rows = GAMES.filter((g) => played(ea?.games?.[g.id]) || played(eb?.games?.[g.id])).map((g) => {
    const w = d.result.games?.[g.id];
    const cell = (e, p) => {
      const r = e?.games?.[g.id];
      return `<div class="sv ${w === p.id ? 'win' : ''} ${!played(r) ? 'dim' : ''}">${e ? esc(fmtScore(g.id, r)) : '…'}</div>`;
    };
    return `<div class="gr">${cell(ea, A)}<div class="gname"><span>${g.emoji}</span>${g.name}</div>${cell(eb, B)}</div>`;
  }).join('');
  const notes = PLAYERS.map((p) => d.entries[p.id]?.note?.trim() ? `<div class="speech"><b>${esc(p.name)}:</b> ${esc(d.entries[p.id].note)}</div>` : '').join('');
  return `<div class="names"><div>${esc(A.name)}</div><div></div><div>${esc(B.name)}${nickHTML(B.id)}</div></div>
    <div class="score-list">${rows || '<p class="muted" style="text-align:center">Nobody has played a game yet.</p>'}</div>${notes}`;
}

function dayBannerHTML(date) {
  const d = S.days[date];
  if (!d || hidePeek(date)) return '';
  const res = { ...d.result, mine: !!d.entries[S.me] };
  if (res.status === 'none') return '';
  d._banner ||= {};
  // Keep the joke stable across re-renders for the same result.
  const key = JSON.stringify([res.status, res.winner, res.wins, S.me]);
  if (d._banner.key !== key) d._banner = { key, text: J.dayBanner(res, names, S.me) };
  const cls = res.status === 'complete' && res.winner !== 'tie' ? `win-${res.winner}` : '';
  return `<div class="banner ${cls}">${esc(d._banner.text)}</div>`;
}

// ---------- Today ----------
function todayHTML() {
  const date = todayISO();
  const d = S.days[date];
  const mine = d?.entries[S.me];
  S.greet ||= J.greeting(names[S.me]);
  const pcards = PLAYERS.map((p) => {
    const e = d?.entries[p.id];
    const w = d?.result.status === 'complete' && d.result.winner === p.id;
    return `<div class="pcard ${p.id}"><div class="avatar" style="background:${p.color}">${p.short}</div><div class="pname">${esc(p.name)}${w ? ' 👑' : ''}</div><div class="pstat">${e ? '✅ Posted' : '⏳ Not yet'}</div></div>`;
  }).join('');
  return `
    <h2 style="font-size:26px;margin:0 2px 2px">${esc(S.greet)}</h2>
    ${S.me === 'soukhya' ? nickHTML('soukhya').replace('class="nick"', 'class="nick top-nick"') : ''}
    <p class="muted" style="margin:0 2px 14px">${esc(prettyDate(date))}</p>
    <button class="btn ${mine ? 'ghost' : 'pink'}" data-a="startWiz" data-v="${date}" style="margin-bottom:18px">${mine ? '✏️ Edit my scores' : '🎮 Log my scores'}</button>
    <div class="versus">${pcards}</div>
    ${dayBannerHTML(date)}
    <div class="card"><h2>Today's scores</h2>${dayScoresHTML(date)}</div>`;
}

// ---------- Leaderboard ----------
function boardHTML() {
  const stats = computeStats(S.days, periodFilter(S.period));
  const a = stats.by.saksham, b = stats.by.soukhya;
  const chips = [['week', 'This week'], ['month', 'Month'], ['all', 'All-time']]
    .map(([id, l]) => `<button class="chip ${S.period === id ? 'on' : ''}" data-a="period" data-v="${id}">${l}</button>`).join('');
  const total = Math.max(1, a.dayWins + a.dayTies + b.dayWins);
  const seg = (cls, n) => (n ? `<div class="${cls}" style="flex:${n}">${n}</div>` : '');
  const lead = (x, y, hi = true) => (x === y ? '' : (hi ? x > y : x < y) ? 'lead' : '');
  const row = (label, x, y, fmt = (v) => v, hi = true) =>
    `<tr><td class="${lead(x, y, hi)}">${fmt(x)}</td><td>${label}</td><td class="${lead(y, x, hi)}">${fmt(y)}</td></tr>`;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const games = GAMES.map((g) => {
    const x = a.perGame[g.id], y = b.perGame[g.id];
    const crown = x.w === y.w ? '🤝' : x.w > y.w ? '🩷' : '💚';
    return `<div class="game-chip"><span class="ge">${g.emoji}</span><div><b>${g.name}</b><div class="muted" style="font-size:13px">${esc(names.saksham)} ${x.w}–${x.l}${x.t ? `–${x.t}` : ''} · ${esc(names.soukhya)} ${y.w}–${y.l}${y.t ? `–${y.t}` : ''}</div></div><span style="font-size:24px">${crown}</span></div>`;
  }).join('');
  return `
    <div class="chips">${chips}</div>
    <div class="banner">${esc(J.boardHeadline(stats, names))}</div>
    <div class="card">
      <h2>Days won</h2>
      <div class="bigscore">
        <div><div class="n" style="color:#d6347c">${a.dayWins}</div><div class="l">${esc(names.saksham)}</div></div>
        <div class="vs">vs</div>
        <div><div class="n" style="color:#1a9a70">${b.dayWins}</div><div class="l">${esc(names.soukhya)}</div>${nickHTML('soukhya')}</div>
      </div>
      <div class="bar">${seg('a', a.dayWins)}${seg('t', a.dayTies)}${seg('b', b.dayWins)}</div>
      <div class="muted" style="font-size:13px;text-align:center">${stats.decided} decided day${stats.decided === 1 ? '' : 's'} · ${a.dayTies} tie${a.dayTies === 1 ? '' : 's'}</div>
    </div>
    <div class="card"><h2>Head to head</h2>
      <table class="st">
        ${row('win rate', a.winRate, b.winRate, pct)}
        ${row('games won', a.gameWins, b.gameWins)}
        ${row('current streak', a.curStreak, b.curStreak)}
        ${row('best streak', a.bestStreak, b.bestStreak)}
        ${row('days posted', a.posted, b.posted)}
      </table>
      <div style="margin-top:10px;font-size:14px" class="muted">${esc(J.streakLine(names.saksham, a.curStreak))}<br>${esc(J.streakLine(names.soukhya, b.curStreak))}</div>
    </div>
    <div class="card"><h2>Game by game <span class="sticker">🩷 ${esc(names.saksham)} · 💚 ${esc(names.soukhya)}</span></h2>${games}</div>`;
}

// ---------- Calendar ----------
function calHTML() {
  const key = S.calMonth;
  const first = fromISO(key + '-01');
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const today = todayISO();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="day out"></div>');
  const tally = { saksham: 0, soukhya: 0, tie: 0 };
  for (let n = 1; n <= dim; n++) {
    const date = `${key}-${String(n).padStart(2, '0')}`;
    const d = S.days[date];
    let cls = '';
    if (d?.result.status === 'complete') { cls = d.result.winner; tally[d.result.winner]++; }
    else if (d?.result.status === 'waiting' || d?.result.status === 'nocontest') cls = 'wait';
    const fut = date > today;
    cells.push(`<button class="day ${cls} ${date === today ? 'today' : ''} ${fut ? 'future' : ''}" ${fut ? 'disabled' : `data-a="day" data-v="${date}"`}>${n}</button>`);
  }
  return `
    <div class="card">
      <div class="cal-head"><button class="nav" data-a="cal" data-v="-1">‹</button><h2>${esc(monthTitle(key))}</h2><button class="nav" data-a="cal" data-v="1">›</button></div>
      <div class="grid" style="margin-bottom:6px">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('')}</div>
      <div class="grid">${cells.join('')}</div>
      <div class="legend">
        <span><i style="background:var(--pink)"></i>${esc(names.saksham)} ${tally.saksham}</span>
        <span><i style="background:var(--mint)"></i>${esc(names.soukhya)} ${tally.soukhya}</span>
        <span><i style="background:var(--lemon)"></i>Tie ${tally.tie}</span>
        <span><i style="background:repeating-linear-gradient(45deg,#fff,#fff 3px,var(--lav-soft) 3px,var(--lav-soft) 6px)"></i>Waiting</span>
      </div>
    </div>
    <p class="muted" style="text-align:center">${esc(J.EMPTY_CAL)}</p>`;
}

function sheetHTML() {
  const date = S.sheet;
  const mine = S.days[date]?.entries[S.me];
  return `<div class="overlay" data-a="closeSheet"><div class="sheet" data-stop>
    <button class="close" data-a="closeSheet">✕</button>
    <h2>${esc(prettyDate(date))}</h2>
    ${dayBannerHTML(date)}
    ${dayScoresHTML(date)}
    <div class="gap"></div>
    <button class="btn ${mine ? 'ghost' : 'pink'}" data-a="startWiz" data-v="${date}">${mine ? '✏️ Edit my scores' : '➕ Add my scores for this day'}</button>
  </div></div>`;
}

// ---------- Fun ----------
function funHTML() {
  const badges = computeBadges(S.entries, S.days);
  const all = computeStats(S.days);
  const totalGames = S.entries.reduce((n, e) => n + GAMES.filter((g) => played(e.games?.[g.id])).length, 0);
  const notes = S.entries.filter((e) => (e.note || '').trim()).length;
  const bestP = all.by.saksham.bestStreak >= all.by.soukhya.bestStreak ? 'saksham' : 'soukhya';
  const facts = [
    ['📆', `${Object.keys(S.days).length} days of rivalry so far`],
    ['🎮', `${totalGames} games played in total`],
    ['🔥', all.decided ? `Longest streak: ${all.by[bestP].bestStreak} by ${names[bestP]}` : 'Longest streak: nobody has earned one yet'],
    ['🎭', `${notes} victory speeches & excuses delivered`],
  ].map(([e, t]) => `<div class="fact"><span class="e">${e}</span>${esc(t)}</div>`).join('');
  const bcard = (p) => `<div class="card"><h2>${p.id === 'saksham' ? '🩷' : '💚'} ${esc(p.name)}'s badges <span class="sticker">${badges[p.id].filter((b) => b.earned).length}/${badges[p.id].length}</span></h2>
    <div class="badges">${badges[p.id].map((b) => `<div class="badge ${b.earned ? '' : 'locked'}" title="${esc(b.desc)}"><span class="be">${b.earned ? b.emoji : '🔒'}</span>${esc(b.name)}<div class="muted" style="font-weight:400;font-size:11px;margin-top:2px">${esc(b.desc)}</div></div>`).join('')}</div></div>`;
  return `
    <div class="card"><h2>📣 Brag to the group chat</h2><p class="muted" style="margin-bottom:12px">Copies a scoreboard card you can paste anywhere.</p><button class="btn lav" data-a="share">Share the scoreboard</button></div>
    <div class="card"><h2>🧠 Rivalry facts</h2>${facts}</div>
    ${PLAYERS.map(bcard).join('')}`;
}

// ====================== Wizard ======================
const PROMPTS = {
  wordle: 'How many guesses did it take?',
  waffle: 'How many stars did you get?',
  krillion: 'What was your final score?',
  noillirk: 'What was your final score?',
  farflung: 'Bonus game! Final score?',
};

function startWiz(date) {
  const existing = S.days[date]?.entries[S.me];
  S.sheet = null;
  S.wiz = {
    date, step: 0, games: structuredClone(existing?.games || {}), note: existing?.note || '',
    pad: '', react: '', fromRecap: false, saved: false, celebrated: false, editing: !!existing,
  };
  enterStep(0);
  render();
}

function enterStep(i) {
  const w = S.wiz;
  w.step = i;
  const g = GAMES[i];
  const cur = g && w.games[g.id];
  w.pad = cur?.status === 'done' && g.kind === 'high' ? String(cur.score) : '';
  w.react = cur && cur.status !== 'skip' ? reactFor(g, cur) : '';
}

function reactFor(g, r) {
  if (!r || r.status === 'skip') return J.reactSkip(vars());
  if (g.kind === 'wordle') return J.reactWordle(r.status === 'failed' ? 'X' : r.score, vars());
  if (g.kind === 'waffle') return J.reactWaffle(r.score, vars());
  return J.reactNum(g.id, r.score, vars());
}

function wizHTML() {
  const w = S.wiz;
  const n = GAMES.length;
  const dots = Array.from({ length: n + 1 }, (_, i) => `<i class="${w.saved || i < w.step ? 'on' : i === w.step ? 'cur' : ''}"></i>`).join('');
  const dateTag = w.date !== todayISO() ? `<div class="sticker" style="margin:0 auto 10px;display:table">📅 ${esc(prettyDate(w.date))}</div>` : '';
  let body;
  if (w.saved) body = doneHTML();
  else if (w.step < n) body = gameStepHTML(GAMES[w.step]);
  else body = recapHTML();
  return `<div class="wiz"><div class="wiz-in">
    <div class="wiz-top"><button class="close" style="float:none" data-a="wizClose" aria-label="Close">✕</button><div class="dots">${dots}</div></div>
    ${dateTag}${body}
  </div></div>`;
}

function gameStepHTML(g) {
  const w = S.wiz;
  const cur = w.games[g.id];
  const val = cur?.status === 'done' ? String(cur.score) : cur?.status === 'failed' ? 'X' : null;
  let input = '';
  if (g.kind === 'wordle') {
    input = `<div class="opts six">${['1', '2', '3', '4', '5', '6', 'X'].map((v) => `<button class="opt ${v === 'X' ? 'x' : ''} ${val === v ? 'sel' : ''}" data-a="pick" data-v="${v}">${v}</button>`).join('')}</div>`;
  } else if (g.kind === 'waffle') {
    input = `<div class="opts stars">${[0, 1, 2, 3, 4, 5].map((v) => `<button class="opt stars-opt ${val === String(v) ? 'sel' : ''}" data-a="pick" data-v="${v}">${v}<br>${'⭐'.repeat(Math.min(v, 5)) || '💨'}</button>`).join('')}</div>`;
  } else {
    input = `<div class="display ${w.pad ? '' : 'empty'}">${w.pad || '0'}</div>
      <div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => `<button class="opt" data-a="key" data-v="${k}">${k === 'del' ? '⌫' : k === 'ok' ? '✓' : k}</button>`).join('')}</div>`;
  }
  const hasVal = !!cur && cur.status !== 'skip';
  return `
    <div class="q"><span class="emo">${g.emoji}</span><h1>${g.name}${g.optional ? ' <span class="sticker">optional</span>' : ''}</h1><p>${PROMPTS[g.id]}</p></div>
    ${input}
    ${hasVal && w.react ? `<div class="react">${esc(w.react)}</div>` : ''}
    <div class="wiz-nav">
      <button class="btn pink" data-a="next" ${cur ? '' : 'disabled'}>${w.fromRecap ? 'Back to summary' : 'Next →'}</button>
      <div class="row">
        ${w.step > 0 && !w.fromRecap ? '<button class="btn ghost small" data-a="back">← Back</button>' : ''}
        <button class="btn ghost small" data-a="skip">Didn't play 🐔</button>
      </div>
    </div>`;
}

function recapHTML() {
  const w = S.wiz;
  const rows = GAMES.map((g, i) => {
    const r = w.games[g.id];
    const txt = r && r.status !== 'skip' ? fmtScore(g.id, r) : 'skipped';
    return `<div class="recap-row" data-a="edit" data-v="${i}"><span class="e">${g.emoji}</span><span>${g.name}</span><b class="${r && r.status !== 'skip' ? '' : 'muted'}" style="${r && r.status !== 'skip' ? '' : 'font-weight:500;font-size:16px'}">${esc(txt)} ✏️</b></div>`;
  }).join('');
  return `
    <div class="q"><span class="emo">📝</span><h1>All set?</h1><p>Tap a row to fix it.</p></div>
    <div class="card" style="padding:8px 14px">${rows}</div>
    <textarea id="note" rows="3" maxlength="300" placeholder="Daily excuse / victory speech (optional, but the group chat deserves it)">${esc(w.note)}</textarea>
    <div class="wiz-nav">
      <button class="btn mint" data-a="submit">${w.editing ? 'Save changes 🔒' : 'Lock it in 🔒'}</button>
      <button class="btn ghost small" data-a="back">← Back</button>
    </div>`;
}

function doneHTML() {
  const w = S.wiz;
  const res = S.days[w.date]?.result;
  const mine = S.days[w.date]?.entries[S.me];
  const iWon = res?.status === 'complete' && res.winner === S.me;
  if (iWon && !w.celebrated) { w.celebrated = true; setTimeout(() => confetti(), 250); }
  w.doneMsg ||= J.submitDone();
  return `<div class="done">
    <span class="emo">${iWon ? '🏆' : res?.status === 'complete' ? '🫡' : '🔒'}</span>
    <h1 style="font-size:30px;margin:8px 0">${esc(w.doneMsg)}</h1>
    <div style="margin-top:14px;text-align:left">${mine ? dayBannerHTML(w.date) : ''}</div>
    <div class="wiz-nav" style="margin-top:20px">
      <button class="btn pink" data-a="wizDoneBoard">See the scoreboard 🏆</button>
      <button class="btn ghost" data-a="wizClose">Back home</button>
    </div>
  </div>`;
}

async function submitWiz() {
  const w = S.wiz;
  const games = {};
  for (const g of GAMES) games[g.id] = w.games[g.id] || { status: 'skip', score: null };
  if (!GAMES.some((g) => played(games[g.id]))) { toast('You skipped everything. Coward. Play at least one. 🐔'); return; }
  const note = (document.getElementById('note')?.value ?? w.note).trim().slice(0, 300);
  const entry = { id: `${w.date}_${S.me}`, date: w.date, player: S.me, games, note };
  try {
    const res = await S.store.save(entry);
    if (res === 'queued') toast('Saved offline. It will sync when you are back online. 📡');
    w.saved = true;
    render();
  } catch (err) {
    console.error(err);
    toast('Could not save: ' + (err.code || err.message));
  }
}

// ====================== Events ======================
function pick(v) {
  const w = S.wiz, g = GAMES[w.step];
  w.games[g.id] = g.kind === 'wordle' && v === 'X' ? { status: 'failed', score: null } : { status: 'done', score: Number(v) };
  w.react = reactFor(g, w.games[g.id]);
}

function key(k) {
  const w = S.wiz, g = GAMES[w.step];
  if (k === 'ok') { if (w.games[g.id]) next(); return; }
  if (k === 'del') w.pad = w.pad.slice(0, -1);
  else if (w.pad.length < 6) w.pad = (w.pad === '0' ? '' : w.pad) + k;
  if (w.pad === '') { delete w.games[g.id]; w.react = ''; }
  else { w.games[g.id] = { status: 'done', score: Number(w.pad) }; w.react = reactFor(g, w.games[g.id]); }
}

function next() {
  const w = S.wiz;
  if (w.fromRecap) { w.fromRecap = false; enterStep(GAMES.length); return; }
  enterStep(w.step + 1);
}

function share() {
  const stats = computeStats(S.days);
  const a = stats.by.saksham, b = stats.by.soukhya;
  const text = [
    '🍬 WORD GAMES LEAGUE 🍬',
    `${names.saksham} ${a.dayWins} – ${b.dayWins} ${names.soukhya}  (days won, all-time)`,
    `🔥 ${J.streakLine(names.saksham, a.curStreak)}`,
    `🔥 ${J.streakLine(names.soukhya, b.curStreak)}`,
    '',
    J.boardHeadline(stats, names),
  ].join('\n');
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('Copied! Paste it in the group chat 📋'), () => toast('Could not copy'));
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  // Clicks on the sheet body (not the ✕) must not hit the dimmed backdrop's "close" action.
  if (el.classList.contains('overlay') && ev.target.closest('.sheet')) return;
  const a = el.dataset.a, v = el.dataset.v;
  switch (a) {
    case 'who': S.me = v; ls.set('wgl-me', v); S.greet = null; syncAd(); maybeMorning(); break;
    case 'switchWho': {
      const other = otherPlayer(S.me);
      if (!confirm(`Switch to ${other.name}?`)) return;
      S.me = other.id; ls.set('wgl-me', S.me); S.greet = null; syncAd(); break;
    }
    case 'adYes': S.ad.stage = 'joke'; break;
    case 'adPunch': S.ad.stage = 'punch'; break;
    case 'adMore': sendReview(); S.ad = { stage: 'joke', joke: nextJoke(), preview: S.ad.preview }; break;
    case 'adNo': sendReview(); if (!S.ad.preview && S.ad.stage === 'ask') toast('Fine. I\'ll ask again. 😈'); S.ad = null; break;
    case 'adClose': sendReview(); S.ad = null; break;
    case 'logoTap': {
      if (S.me !== 'saksham') return;
      const now = Date.now();
      logoTaps = [...logoTaps.filter((t) => now - t < 2500), now];
      if (logoTaps.length < 5) return;
      logoTaps = [];
      S.secret = 'login';
      break;
    }
    case 'secretUnlock': unlockSecret(); return;
    case 'secretClose': S.secret = null; break;
    case 'secretToggle': toggleAd(); return;
    case 'secretPreview': S.ad = { stage: 'ask', joke: nextJoke(), preview: true }; break;
    case 'tab': S.view = v; scrollTo(0, 0); break;
    case 'period': S.period = v; break;
    case 'cal': S.calMonth = shiftMonth(S.calMonth, Number(v)); break;
    case 'day': S.sheet = v; break;
    case 'closeSheet': S.sheet = null; break;
    case 'startWiz': startWiz(v); break;
    case 'pick': pick(v); break;
    case 'key': key(v); break;
    case 'skip': {
      const g = GAMES[S.wiz.step];
      S.wiz.games[g.id] = { status: 'skip', score: null };
      toast(J.reactSkip(vars()));
      next(); break;
    }
    case 'next': next(); break;
    case 'back': S.wiz.fromRecap = false; enterStep(Math.max(0, S.wiz.step - 1)); break;
    case 'edit': S.wiz.note = document.getElementById('note')?.value ?? S.wiz.note; enterStep(Number(v)); S.wiz.fromRecap = true; break;
    case 'submit': submitWiz(); return;
    case 'wizClose': S.wiz = null; break;
    case 'wizDoneBoard': S.wiz = null; S.view = 'board'; break;
    case 'share': share(); return;
    case 'copyLink': navigator.clipboard?.writeText(location.href.split('?')[0]).then(() => toast('Link copied! Paste it in Safari 📋'), () => toast('Could not copy')); return;
    case 'installPrompt': installEvent?.prompt(); return;
    default: return;
  }
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'secretpw') unlockSecret();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'note' && S.wiz) S.wiz.note = e.target.value;
  if (e.target.id === 'adreview' && S.ad) S.ad.review = e.target.value;
});

// ====================== Boot ======================
function onData(entries) {
  S.entries = entries;
  S.days = buildDays(entries);
  S.loaded = true;
  S.error = null;
  // Don't blow away what the user is typing.
  if (['note', 'secretpw', 'adreview'].includes(document.activeElement?.id)) return;
  render();
  maybeMorning();
}

function onSettings(map) {
  S.settings = map || {};
  if (!adEnabled()) { clearTimeout(adTimer); if (S.ad && !S.ad.preview) S.ad = null; } else considerAd();
  if (S.loaded && !['secretpw', 'adreview'].includes(document.activeElement?.id)) render();
}

function seedDemo(store) {
  // ?demo=1 (demo mode only): 3 weeks of fake rivalry so you can look around.
  const out = [];
  const today = new Date();
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  for (let i = 1; i <= 24; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const date = toISO(d);
    for (const p of PLAYERS) {
      if (Math.random() < 0.08) continue;
      const wf = Math.random() < 0.12;
      out.push({
        id: `${date}_${p.id}`, date, player: p.id,
        games: {
          wordle: wf ? { status: 'failed', score: null } : { status: 'done', score: rnd(2, 6) },
          krillion: { status: 'done', score: rnd(20, 140) },
          noillirk: Math.random() < 0.15 ? { status: 'skip', score: null } : { status: 'done', score: rnd(20, 140) },
          waffle: { status: 'done', score: rnd(0, 5) },
          farflung: Math.random() < 0.6 ? { status: 'skip', score: null } : { status: 'done', score: rnd(100, 900) },
        },
        note: Math.random() < 0.2 ? pickOne(['I was robbed.', 'Skill diff. 💅', 'my cat walked on the keyboard', 'the sun was in my eyes', 'ez']) : '',
      });
    }
  }
  store._replaceAll?.(out);
}
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && (!isLocal || location.search.includes('sw=1'))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

async function main() {
  registerSW(); // also needed in the browser so Android treats the site as installable
  if (gated) { render(); return; } // browser tab: show only the "add to home screen" page
  render();
  checkLatest();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkLatest(); });
  const loadTimer = setInterval(() => { if (S.loaded) return clearInterval(loadTimer); S.loadingMsg = J.randomLoading(); render(); }, 1800);
  try {
    S.store = await createStore();
    if (S.store.mode === 'local' && new URLSearchParams(location.search).has('demo')) seedDemo(S.store);
    await S.store.subscribe(onData, (err) => { S.error = err.code || err.message; S.loaded = true; render(); });
    // Settings are optional: if they can't be read (e.g. rules not updated yet) everything stays "off".
    S.store.subscribeSettings?.(onSettings, (err) => console.warn('settings unavailable', err.code || err.message));
  } catch (err) {
    console.error(err);
    S.error = err.code || err.message;
    S.loaded = true;
    render();
  }
}
main();

// Roll over to a new day if the app has been open overnight.
setInterval(() => {
  if (S.loaded && !S.wiz && S.view === 'today' && S._day !== todayISO()) { S._day = todayISO(); S.greet = null; render(); }
}, 60000);
