# Westpac Treasure Map

Westpac Innovation and Coding Competition 2026.

Rewards Westpac already pays for, finally in sight: **Treasure Map**, **Skip & Save**, **Me vs Me**.

## Files
- `index.html`: phone frame, tabs (Map, Discover, Pot, Missions), demo controls on the right
- `styles.css`: layout for all screens (base Night palette)
- `theme.css`: Street Art theme, light (concrete + primer-white base, yellow / pink / cyan spray accents, Anton + Inter). Remove `class="ts"` from `<body>` to go back to plain Night
- Fonts (Anton + Inter) are embedded inside `theme.css`, so no font files are needed and it works offline. Their licenses are at the end of `theme.css`
- `data.js`: mock data, single source of truth (`window.TM`)
  - 25 Gold Coast shops, card tiers, Ana's 60 days of transactions, bills, Japan goal
  - 4 scenarios: Normal day, Skipped coffee, Rent due tomorrow, Very tight (stays silent)
  - `window.DATA`: the same numbers in the older `DATA.*` shape, for code that still uses it
- `engine.js`: deterministic logic, no DOM (`window.Engine`)
  - coins, offers, Pot ledger, feed lists, cash-flow check (shared by Skip & Save and Me vs Me)
  - Me vs Me: target generator, adaptive difficulty, reward, anti-gaming checks
- `app.js`: Map, offer sheet, power-up switcher, Discover feed, Pot (`window.App` hooks)
- `missions.js`: draws the Missions tab (Me vs Me)

Load order matters: `data.js` → `engine.js` → `app.js` → `missions.js`.

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
