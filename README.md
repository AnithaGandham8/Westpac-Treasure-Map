# Westpac Treasure Map

Westpac Innovation and Coding Competition 2026.

Rewards Westpac already pays for, finally in sight: **Treasure Map**, **Skip & Save**, **Me vs Me**.

## Files
- `index.html`: phone frame, tabs (Map, Discover, Pot, Missions), demo controls on the right
- `styles.css`: structural layout for all screens (legacy base palette)
- `theme.css`: preserved Street Art theme and its bundled font assets for reference/rollback
- `westpac.css`: active Westpac visual layer and design tokens. To restore Street Art, remove the `westpac.css` link, change `<body class="wp-theme">` to `<body class="ts">`, and remove the Bootstrap links if you also want to restore the original dependency setup
- `vendor/`: pinned local Bootstrap and Bootstrap Icons assets; local files keep the demo usable offline
- Fonts (Anton + Inter) for the preserved Street Art theme are embedded inside `theme.css`; their licenses are at the end of that file. The active Westpac layer uses the system font stack with Inter first when available.
- Bootstrap **5.3.8** is included locally under `vendor/bootstrap-5.3.8/` (MIT License).
- Bootstrap Icons **1.13.2** are included locally under `vendor/bootstrap-icons-1.13.2/` (MIT License). See `vendor/README.md` for package sources and license details.
- `data.js`: mock data, single source of truth (`window.TM`)
  - 25 Gold Coast shops, card tiers, Ana's 60 days of transactions, bills, main goal (Holiday trip)
  - `GOAL_IDEAS`: the example goals shown under the goal search (Travel, Food & coffee, Everyday shopping, Health & activities)
  - 4 scenarios: Normal day, Skipped coffee, Rent due tomorrow, Very tight (stays silent)
  - `window.DATA`: the same numbers in the older `DATA.*` shape, for code that still uses it
- `engine.js`: deterministic logic, no DOM (`window.Engine`)
  - coins, offers, Pot ledger, feed lists, cash-flow check (shared by Skip & Save and Me vs Me)
  - goals: several goals with their own price; the active one receives new rewards; add / set price / remove (only empty goals you added)
  - Me vs Me: target generator, adaptive difficulty, reward, anti-gaming checks
- `app.js`: Map, offer sheet, power-up switcher, Discover feed, Pot (`window.App` hooks)
- `missions.js`: draws the Missions tab (Me vs Me)
- `ai.js`: client for the 3 AI endpoints (goal search, "why this?", weekly insight). Numbers are always computed in JS; the model only writes intents and words. Falls back to local logic if the AI is slow, rate-limited or offline (`?ai=off` forces local mode)
- `wrangler.toml`: Cloudflare Pages config with the Workers AI binding (no API key needed)
- `functions/api/`: the 3 AI endpoints (`goal-search.js`, `why.js`, `challenge-insight.js`), shared helpers (`_ai.js`) and CORS for the GitHub Pages copy (`_middleware.js`). The model never sees transactions: it gets the goal + shop list, or numbers already computed in the browser

Load order matters: `data.js` → `engine.js` → `ai.js` → `app.js` → `missions.js`.

CSS order matters too: Bootstrap → Bootstrap Icons → `styles.css` → `theme.css` → `westpac.css`. The last file is the active brand layer; keep legacy layout and behavior selectors in place when adjusting presentation.

## Me vs Me rules
- **Target:** top non-essential category (delivery, coffee, rideshare, meals); median of the last 4 weeks × 0.9
- **Level up:** beat the target by more than 20% → target 10% harder (max level 5)
- **Ease:** two misses in a row → target about 10% easier
- **Reward:** min(level tier, 3% of cash-flow buffer), then the cash-flow check (full / half / nothing)
- **Fair play:** healthy floor at 60% of usual, no reward for shifted spend, tiny-purchase flag (4+ under $3 at one shop in a day)
- **Ask first** by default; a toggle switches to automatic

## Run locally
    python3 -m http.server 8080
Then open http://localhost:8080 (opening `index.html` directly also works).

Add `?scenario=rentDueTomorrow` (or `skippedCoffee`, `veryTight`) to the URL to start in a scenario.

The Python server above only serves static files; it does not run the Cloudflare Pages Functions in `functions/api/`. AI-backed actions therefore use their local fallback in this setup. Add `?ai=off` to force local mode and avoid requests to those unavailable endpoints. Cloudflare Pages runs the configured AI endpoints.
