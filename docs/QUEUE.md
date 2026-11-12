# Work queue for the daily build task

The "CPT daily build" scheduled task takes the **first item under Ready** each day, builds only that, and ships it
if every check passes (prompt: `docs/DAILY-TASKS.md`). To ask for something, add a line under Ready (or tell any
chat "queue: …") instead of opening a new long chat: that is the cheapest way to get work done.

Item format: `- [ ] Title. What: … Done when: … Needs: …` (keep each item small enough for one run).

## Ready
- [ ] **QA crawl: stay under Kraken's connection limit.** What: `tests/crawl.cjs` loads every page, and each page
  opens a Kraken WebSocket. Two crawls within about 10 minutes (local QA, then preview QA) can exceed Kraken's
  per-IP connection limit; Kraken then answers HTTP 429 and QA fails for a reason unrelated to the site (seen
  12 Nov, twice). In `tests/crawl.cjs` (this item names that file) abort `wss://ws.kraken.com` requests on all but
  about 12 sampled pages (home, 6 coin pages, a sector hub, heatmap, converter, two widget layouts), so exchange
  errors on the sampled pages still fail the crawl. Done when: local QA immediately followed by preview QA ends
  with QA PASSED twice in a row, and a deliberately broken Kraken URL still fails the crawl on a sampled page.
- [ ] **Finish PR #15 (logos invisible on some themes).** What: bring branch `ccr-f189e90d-csug64` up to date with
  `main` (keep main's `assets/app.css`, which already dropped the unused rules; re-apply the single-tone logo fix
  from `scripts/build-coin-icons.mjs --tones` and its theme tokens), plus its three small fixes (CSV export drops
  the estimated-liquidity column, pinned tab title waits for a live price, service worker prunes old `?v=`
  copies). Done when: the 18 single-tone logos are visible on all six themes, QA passes, PR #15 is merged or
  replaced by a new PR and closed with a note.
- [ ] **PR #14 (wait-deploy false timeouts).** What: `tests/wait-deploy.sh` compares plain `/assets/…` URLs that
  are cached for a year; skip `assets/` in that byte comparison as PR #14 does (this item names `tests/wait-deploy.sh`,
  so the edit is allowed). Done when: the script returns "serves the current build" against production right after a
  release that changes an asset; PR #14 merged or closed as superseded.
- [ ] **One icon sprite on the home page.** What: measure first (count image requests on a cold load of `/` in
  Chromium). If more than 30 are coin logos, serve the home table, movers and tape logos from one generated SVG
  sprite (`scripts/build-coin-icons.mjs`) instead of one file per coin; keep per-coin files for coin pages and
  widgets. Done when: image requests on `/` fall by at least half, logos look the same on every theme, LCP and CLS
  don't get worse, QA passes. Skip with a note if the measurement shows fewer than 30.
- [ ] **Backup and restore.** What: "Export my data" and "Import" in the home menu: one JSON file with watchlist,
  holdings, price alerts, move/portfolio alert settings and theme (all from `localStorage`; nothing uploaded).
  Import validates the file and asks before replacing. Done when: export → clear site data → import restores
  everything; a `tests/` browser check covers it (this item allows adding one test file); QA passes.
- [ ] **Stream overlay preset for widgets.** What: `/embed/?overlay=1` gives a transparent background, larger type
  and no credit-link hover effects, for OBS and similar browser sources; add a short "Use in a stream" paragraph and
  the URL to `/widgets/`. Done when: the overlay renders on a transparent page at 1920×200, widget tests pass.

## Waiting on the owner
- **Redirect the 2022 site's old addresses.** The domain's earlier site was the owner's own price site (a
  CodeCanyon PHP script), and Googlebot still requests its addresses and gets 404. Needs from the owner: the
  Search Console exports in `docs/INDEXING-PLAN.md` §A.5 (404 examples and externally linked pages), or the old
  address shape (e.g. `/currency/bitcoin`). Then: add rules to the `_redirects` generator in
  `scripts/build-coin-pages.mjs` (this item names that file) mapping each old coin address to `/coin/<sym>/` and
  old list or home variants to `/`; never redirect an address with no matching page (Google treats that as a soft
  404). Don't commit the exports, only the rules. Done when: a sample of old addresses returns 301 to the right
  page on the preview and `check-live` has one such check.
- **AdSense ads (after Google approves the site).** Verification is live (`ads.txt` and the home-page meta tag).
  When AdSense shows "Ready": build ad slots per `docs/NEWS-AND-MONETIZATION.md` §6 (never in the price table,
  heatmap, converter result or widgets; reserved space; loaded after the page), switch consent to Google's
  certified message for EEA/UK/CH, add the ad origins to the CSP and `seo-lint`, and rewrite every "no ads"
  statement (home, footers, FAQ, About, Trust, widgets page, `llms.txt`, brand kit, launch kit).
- **PR #16 (quant SEO engine, `dist/` build, comparison and category pages).** Needs four owner decisions listed in
  the PR, and `docs/INDEXING-PLAN.md` §E recommends holding new URL families until Google has indexed the current
  pages.
- **News headlines and AI "why it moved" lines.** Need a licensed headline source, a Cloudflare Worker and an owner
  decision (research/2026-11-08).
- **Exchange market-data terms.** Decide before the first ad is shown (research/2026-11-08; ads weaken the
  "ad-free" argument under Binance's terms).

## Done
- 2026-11-12: AdSense site verification (`ads.txt`, meta tag), indexing plan, this queue and the two daily tasks.
