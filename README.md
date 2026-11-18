# 🍬 Word Games League

A candy-coloured PWA for Saksham vs Soukhya's daily **Wordle · Krillion · Noillirk · Waffle · Farflung** rivalry.
One question at a time, roasts and praise on every score, a leaderboard, a calendar of past days, badges and confetti.

- **Frontend:** plain HTML/CSS/ES modules (no build step), hosted on GitHub Pages
- **Data:** Firebase Firestore (free tier), real-time, works offline. Falls back to a local demo mode until configured.
- **Setup:** see [SETUP.md](SETUP.md)

## How scoring works
| Game | Input | Winner |
|---|---|---|
| Wordle | 1–6 or X | fewer guesses; X loses to any solve; both X = tie |
| Krillion, Noillirk, Farflung | points | higher |
| Waffle | 0–5 ★ | higher |

A game only counts when **both** players played it (Skip = no contest). Whoever wins more games takes the **day**; equal = tie. Streaks count consecutive days won; a loss or tie resets.

Each person logs their own scores on their own phone. Until you post, you can't peek at the other person's scores for today 🙈.

## Layout
```
index.html · manifest.webmanifest · sw.js   PWA shell
css/style.css                               candy theme
js/scoring.js   rules & day results         js/stats.js   leaderboard, streaks, badges
js/jokes.js     all the sass                js/store.js   Firebase / local storage
js/app.js       UI & wizard                 js/confetti.js
firestore.rules                             paste into Firebase console
test/                                       npm test
```

## Dev
```bash
npm test          # scoring & stats unit tests
npm run serve     # http://localhost:8080/?demo=1
```
Names live in `PLAYERS` in `js/scoring.js`; add or remove games in `GAMES` there too (and add reactions in `js/jokes.js`).
