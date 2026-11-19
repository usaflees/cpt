# Work queue for the daily build task

The "CPT daily build" scheduled task takes the **first item under Ready** each day, builds only that, and ships it
if every check passes (prompt: `docs/DAILY-TASKS.md`). To ask for something, add a line under Ready (or tell any
chat "queue: …") instead of opening a new long chat: that is the cheapest way to get work done.

Item format: `- [ ] Title. What: … Done when: … Needs: …` (keep each item small enough for one run).

## Ready
- [ ] **Stream overlay preset for widgets.** What: `/embed/?overlay=1` gives a transparent background, larger type
  and no credit-link hover effects, for OBS and similar browser sources; add a short "Use in a stream" paragraph and
  the URL to `/widgets/`. Done when: the overlay renders on a transparent page at 1920×200, widget tests pass.

- [ ] **Exchange gap board (Feature Lab #2, no new URL).** What: a home-page section under the movers listing the
  live price gap between Coinbase, Binance and Kraken for each coin quoted on 2+ exchanges, widest first (top 8),
  in basis points, with cheapest/dearest exchange; "—" until two exchanges report. Says gaps ignore fees and
  transfer times. Uses `c.exPrices` the quick view already fills. Done when: the section updates live, costs under
  5 ms/s main thread (measure), QA passes at 375 px in both themes.
- [ ] **Time Machine on coin pages (Feature Lab #3, no new URL).** What: a "What would it be worth?" box on each coin
  page: amount + date → value today, the lowest and highest point along the way, from Binance/Kraken/Coinbase daily
  candles fetched in the browser on submit (none on load). Done when: BTC from 2018-01-01 matches the exchange's
  daily closes, "—" when the coin has no data for that date, no layout shift, QA passes.
- [ ] **Market TV mode (Feature Lab #4, no new URL).** What: `/?tv=1` (button in the home menu) turns the home page
  into a full-screen board: watchlist as large live tiles, ticker tape, market-mood glow; Screen Wake Lock while
  visible; Esc exits. `noindex` isn't needed (same URL, query only). Done when: works on a 1920×1080 and a 375 px
  screen, wake lock released on exit, QA passes.

## Waiting on the owner
- **Weekly market report page with a feed (makes the site a "regularly updated source").** Google's Preferred
  Sources tool and feed readers only list sources that publish on a schedule. Build `/market/` (one page, replaced
  each week by the data refresh: the week's biggest movers, sector medians, new highs/lows, all computed from
  `content/coin-stats.json`, dated) plus `/market/feed.xml` (Atom, one entry per week). Needs the owner's OK that a
  computed data report is fine under `docs/NEWS-AND-MONETIZATION.md` §9 (it carries no headlines and no AI text).
  Then re-add the Preferred Sources link once Google's tool finds the domain (fact `google-preferred-sources-ineligible`).
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
- [x] 2026-11-19 **Backup and restore.** Home menu "Back up my data" / "Restore from a backup file" (`assets/flash.js`): one JSON file with watchlist, holdings, alerts, alert settings and history, theme, currency, density and pin; caches and the cookie choice excluded; foreign files refused; asks before replacing. `tests/backup.cjs` (in `tests/run.sh`) covers export → clear → import.
- [x] 2026-11-19 **PR #14 (wait-deploy false timeouts).** Already on main (4f72fc3 skips `assets/`); PR #14 closed as superseded.
- [x] 2026-11-19 **One icon sprite on the home page.** Logos come from `coin-icons/sprite.svg`: home image requests 33 → 3 (coin logos 31 → 1), LCP 840 → 216 ms in one Chromium run, CLS unchanged (0.0044); logos identical on Neon, Light and OLED; local and preview QA passed.
- [x] 2026-11-17 **More real text on the thinnest pages.** Sector hubs list every coin with its dated close, 30-day and
  1-year change, 1-year rank in that hub, range and largest fall (full sentence on the coin's main hub, a short line on
  others); /heatmap/ and /race/ show a dated "Biggest moves of the week" table. seo-audit: 0 findings (no page under 250
  words; sector hubs avg 984 words, 64% own phrases).
- [x] 2026-11-16 **QA crawl: stay under Kraken's connection limit.** `tests/crawl.cjs` opens the real Kraken socket only on 12 sampled pages; elsewhere a silent stand-in socket answers (Playwright `routeWebSocket`). A broken Kraken URL still fails 11 of the 12 sampled pages.
- [x] **Finish PR #15 (logos invisible on some themes)** (Nov 16). Merged with `main` (data refresh included); the
  `mono` marks were re-applied with `--tones`. `app.css` keeps main's removals plus 64 overridden declarations.
- 2026-11-12: AdSense site verification (`ads.txt`, meta tag), indexing plan, this queue and the two daily tasks.
