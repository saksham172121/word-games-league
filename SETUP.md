# Setup (about 10 minutes, all free)

You need: a Google account, a GitHub account. No credit card anywhere.

## 1. Try it first (optional)
```bash
cd ~/word-games-league
npm run serve        # then open http://localhost:8080/?demo=1
```
Without Firebase it runs in **demo mode** (data stays on that device). `?demo=1` fills in fake history so you can look around.

## 2. Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project** → name it `word-games-league`. Turn Google Analytics **off**. Create.
2. **Build → Firestore Database → Create database**. Pick a location near you, choose **Production mode**, Enable.
3. In Firestore, open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules), and click **Publish**.
4. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
   (Nobody logs in; this just gives each phone a quiet identity so the rules can say "only the app may write".)
5. **Project settings (gear icon) → General → Your apps → `</>` (Web)**. Nickname it anything, skip Hosting, **Register app**.
   Copy the `firebaseConfig` values it shows you.

## 3. Paste the config
Open [`js/firebase-config.js`](js/firebase-config.js) and replace the `PASTE_…` values with yours. These aren't secrets (Firebase web configs are public by design); the rules in step 2.3 are what protect your data.

## 4. Put it on GitHub Pages
The repo must be **public** for free Pages.
```bash
git add -A && git commit -m "Word Games League"
gh repo create word-games-league --public --source=. --push
```
Then on GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.**
After a minute your app is at `https://<your-username>.github.io/word-games-league/`.

## 5. Install on phones
Send each other the link, then:
- **iPhone** (must be Safari): Share ⬆️ → **Add to Home Screen**.
- **Android** (Chrome): ⋮ → **Install app**.

Open it, tap who you are, and go.

## Updating later
Change files → commit → push; Pages redeploys. Phones cache the app for speed, so **bump `VERSION` in `sw.js`** (`v1` → `v2`) whenever you change files, otherwise phones may keep showing the old one for a while.

## Troubleshooting
- **"Can't reach the server" banner / `permission-denied`**: rules not published (2.3) or Anonymous sign-in not enabled (2.4).
- **`auth/unauthorized-domain`**: Firebase console → Authentication → Settings → Authorized domains → add `<your-username>.github.io`.
- **Still seeing the demo banner**: `js/firebase-config.js` still has `PASTE_…` values, or the phone has an old cached copy (bump `VERSION`).
- **Wrong score entered**: tap the day in the Calendar → *Edit my scores*. Everything is editable.

## Free-tier reality check
Spark plan limits: 1 GiB stored, 50k reads and 20k writes **per day**. This app uses roughly 10 writes a day. You'd need to play a few million years to hit the limit.
