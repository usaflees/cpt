# Work queue for the daily build task

The "CPT daily build" scheduled task takes the **first item under Ready** each day, builds only that, and ships it
if every check passes (prompt: `docs/DAILY-TASKS.md`). To ask for something, add a line under Ready (or tell any
chat "queue: …") instead of opening a new long chat: that is the cheapest way to get work done.

Item format: `- [ ] Title. What: … Done when: … Needs: …` (keep each item small enough for one run).

## Ready
- [ ] **Widget-only bundle for /embed/.** What: widgets load the whole site bundle (app.js ~33 KB gzip, app.css ~17 KB,
  coins.js ~4 KB) inside other people's pages, and caches are per site, so every embedding site's visitors pay ~54 KB.
  Build `assets/embed.js` + `assets/embed.css` with only the widget markup, the feeds for the shown coins and the
  formatting (move shared code into a small module both files load, or duplicate the ~3 KB of helpers). Done when:
  /embed/ transfers ≤ 15 KB of JS+CSS gzip, the three layouts and six themes look the same (screenshots before/after),
  widget tests and full QA pass, and the site's own pages are unchanged.

## Waiting on the owner
- **Access lock-down settings (code live Nov 23, PR #17).** Needs from the owner: the settings in
  `docs/knowledge/ACCESS.md` §3 (ruleset on `main`, Actions limits, account 2FA and token review, fewer connectors
  on Claude sessions).
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
- [x] 2026-11-24 **Eight features in one owner-chat release** (In progress Nov 23). Fiat display currencies (EUR, GBP, CAD, AUD, JPY, INR, BRL, KRW; picker beside $ ₿ Ξ ◎, also in the widget builder); holdings profit and loss (average buy price in My bag and quick view; CSV, sync link, backup); table column choice and the visitor's own watchlist order (▲▼); movers 24 h / 7 d (Binance rolling 7-day open, shared with the 7d column); exchange price gaps on the home page (quotes < 60 s, Binance USDT converted at Coinbase's USDT price); Market TV (`/?tv=1`, wake lock, Esc); Time Machine on coin pages (Binance, then Coinbase, then Kraken's last 720 days; BTC 2018-01-01 close $13,380.00 matches); stream overlay `/embed/?overlay=1`. New: `assets/home-plus.js`, `assets/timemachine.js`, `https://api.kraken.com` in connect-src. A review subagent's 8 findings were fixed before release.
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
