# Push notification Worker (Cloudflare, free plan)

Sends web-push notifications: "X just posted 👀", a morning hello, and an evening nudge.
Everything is **off** until Saksham flips the switches in the secret panel, and the app's 🔔 card stays hidden
until `js/push-config.js` has this Worker's URL.

Free-plan limits that matter (checked against Cloudflare's docs): 100,000 requests/day, 5 cron triggers,
KV 100k reads / 1k writes per day, **10 ms CPU per invocation** (one push payload costs ~2 ms of CPU, so two phones is fine).

## Deploy (one time, ~10 min)
Run these from this `worker/` folder.

1. Make a free account at <https://dash.cloudflare.com/sign-up> (no card needed for Workers Free).
2. `npm install` (already done if you're on the machine that built this)
3. `npx wrangler login` — opens the browser; click Allow.
4. `npx wrangler kv namespace create SUBS` — copy the printed `id` into `wrangler.toml` (replace `REPLACE_WITH_KV_NAMESPACE_ID`).
5. `npx wrangler secret put VAPID_PRIVATE_KEY < .vapid-private.txt` — uploads the private key as a secret (the file is git-ignored).
6. Open `wrangler.toml` and set `TZ_NAME` (IANA name, e.g. `Asia/Kolkata`, `America/New_York`) plus `MORNING_HOUR` / `EVENING_HOUR` (24h).
7. `npx wrangler deploy` — prints your URL: `https://word-games-league-push.<you>.workers.dev`.

## Connect the app
1. Put that URL in `js/push-config.js` → `workerUrl`.
2. Publish the updated `firestore.rules` in the Firebase console (adds the `settings/push` switches).
3. Bump the version (`npm run bump -- patch`), commit, push.
4. On each phone: **Fun tab → Turn on notifications → Send me a test**.
5. In Saksham's secret panel, switch on the pings you want.

## Notes
- The private key never goes in git. If it leaks, run `node scripts/gen-vapid.js` after deleting `.vapid-private.txt`, update `wrangler.toml` and `js/push-config.js`, re-run step 5, and have everyone re-enable notifications.
- "X posted" is sent at most once per person per day (editing a score doesn't re-notify), and never includes scores.
- iPhone: works only for the home-screen app on iOS 16.4+, and permission must be requested from the button tap.
- Subscriptions auto-expire after 120 idle days; the app re-registers on every launch.
- Local test: put `VAPID_PRIVATE_KEY=...` in `.dev.vars` (git-ignored) and run `npx wrangler dev --local`.
