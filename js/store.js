// Storage layer. The rest of the app only uses: createStore() -> { mode, subscribe, save }.
// Firebase (Firestore) when configured, otherwise a localStorage demo mode.
import { firebaseConfig } from './firebase-config.js';

const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('PASTE');

export const entryId = (date, player) => `${date}_${player}`;

export async function createStore() {
  return configured ? firebaseStore() : localStore();
}

// ---------------- Firebase ----------------
async function firebaseStore() {
  const V = '10.12.2';
  const B = `https://www.gstatic.com/firebasejs/${V}/`;
  const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all([
    import(B + 'firebase-app.js'),
    import(B + 'firebase-auth.js'),
    import(B + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });

  // Sign in quietly. If we're offline and have signed in before, the saved session is reused.
  const ready = (async () => {
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
  })();

  return {
    mode: 'firebase',
    async subscribe(onData, onError) {
      try { await ready; } catch (e) { onError?.(e); return () => {}; }
      return fs.onSnapshot(
        fs.collection(db, 'entries'),
        (snap) => onData(snap.docs.map((d) => cleanEntry(d.data()))),
        (err) => onError?.(err),
      );
    },
    async subscribeSettings(onData, onError) {
      try { await ready; } catch (e) { onError?.(e); return () => {}; }
      return fs.onSnapshot(
        fs.collection(db, 'settings'),
        (snap) => onData(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
        (err) => onError?.(err),
      );
    },
    // Small keyed collections ('nicknames', 'devices'): subscribeMap -> { docId: data }, setMap merges fields.
    async subscribeMap(name, onData, onError) {
      try { await ready; } catch (e) { onError?.(e); return () => {}; }
      return fs.onSnapshot(
        fs.collection(db, name),
        (snap) => onData(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
        (err) => onError?.(err),
      );
    },
    async setMap(name, id, data) {
      await ready;
      await Promise.race([
        fs.setDoc(fs.doc(db, name, id), data, { merge: true }),
        new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), 8000)),
      ]);
    },
    async addReview(review) {
      await ready;
      fs.addDoc(fs.collection(db, 'jokeReviews'), review).catch((e) => console.error('review failed', e)); // queued offline by Firestore
    },
    async subscribeReviews(onData, onError) {
      try { await ready; } catch (e) { onError?.(e); return () => {}; }
      return fs.onSnapshot(
        fs.collection(db, 'jokeReviews'),
        (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => onError?.(err),
      );
    },
    async setSetting(key, value) {
      await ready;
      await Promise.race([
        fs.setDoc(fs.doc(db, 'settings', key), value),
        new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), 8000)),
      ]);
    },
    async save(entry) {
      await ready;
      const ref = fs.doc(db, 'entries', entryId(entry.date, entry.player));
      const write = fs.setDoc(ref, { ...entry, updatedAt: fs.serverTimestamp() });
      // Offline writes are queued by Firestore and only resolve once online; don't block the UI on that.
      const result = await Promise.race([
        write.then(() => 'saved'),
        new Promise((r) => setTimeout(() => r('queued'), 4000)),
      ]);
      write.catch((e) => console.error('save failed', e));
      return result;
    },
  };
}

function cleanEntry(d) {
  return { id: d.id || entryId(d.date, d.player), date: d.date, player: d.player, games: d.games || {}, note: d.note || '' };
}

// ---------------- Local demo mode ----------------
function localStore() {
  const KEY = 'wgl-entries-v1';
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(load().map(cleanEntry)));
  window.addEventListener('storage', (e) => e.key === KEY && emit());
  return {
    mode: 'local',
    async subscribe(onData) {
      listeners.add(onData);
      onData(load().map(cleanEntry));
      return () => listeners.delete(onData);
    },
    async save(entry) {
      const all = load().filter((e) => !(e.date === entry.date && e.player === entry.player));
      all.push({ ...entry, id: entryId(entry.date, entry.player) });
      localStorage.setItem(KEY, JSON.stringify(all));
      emit();
      return 'saved';
    },
    async subscribeSettings(onData) {
      const read = () => { try { return JSON.parse(localStorage.getItem('wgl-settings-v1') || '{}'); } catch { return {}; } };
      listeners.add(() => onData(read()));
      onData(read());
      return () => {};
    },
    async subscribeMap(name, onData) {
      const read = () => { try { return JSON.parse(localStorage.getItem(`wgl-map-${name}`) || '{}'); } catch { return {}; } };
      listeners.add(() => onData(read()));
      onData(read());
      return () => {};
    },
    async setMap(name, id, data) {
      let cur = {};
      try { cur = JSON.parse(localStorage.getItem(`wgl-map-${name}`) || '{}'); } catch {}
      cur[id] = { ...(cur[id] || {}), ...data };
      localStorage.setItem(`wgl-map-${name}`, JSON.stringify(cur));
      emit();
    },
    async addReview(review) {
      let all = [];
      try { all = JSON.parse(localStorage.getItem('wgl-reviews-v1') || '[]'); } catch {}
      all.push({ id: String(Date.now()), ...review });
      localStorage.setItem('wgl-reviews-v1', JSON.stringify(all));
      emit();
    },
    async subscribeReviews(onData) {
      const read = () => { try { return JSON.parse(localStorage.getItem('wgl-reviews-v1') || '[]'); } catch { return []; } };
      listeners.add(() => onData(read()));
      onData(read());
      return () => {};
    },
    async setSetting(key, value) {
      let cur = {};
      try { cur = JSON.parse(localStorage.getItem('wgl-settings-v1') || '{}'); } catch {}
      cur[key] = value;
      localStorage.setItem('wgl-settings-v1', JSON.stringify(cur));
      emit();
    },
    // Test helper used by ?demo=1
    _replaceAll(entries) {
      localStorage.setItem(KEY, JSON.stringify(entries));
      emit();
    },
  };
}
