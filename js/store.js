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
    // Test helper used by ?demo=1
    _replaceAll(entries) {
      localStorage.setItem(KEY, JSON.stringify(entries));
      emit();
    },
  };
}
