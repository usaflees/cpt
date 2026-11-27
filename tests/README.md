# QA suite

`bash tests/run.sh` runs everything against a local Cloudflare Pages emulator; `bash tests/run.sh <url>` runs the
browser and live checks against a deployed preview or production. It prints one line per check (plus the log of any
check that fails; `--verbose` prints everything) and ends with `QA PASSED`, `QA FAILED`, or `QA INCOMPLETE` when a check could not run (axe-core missing; only `QA PASSED` is a pass).
Needs Node 20+ and Playwright with Chromium (preinstalled in Claude Code cloud sessions).

| File | Checks |
| --- | --- |
| `serve.mjs` | Local emulator: applies `_headers` (including CSP), `_redirects`, directory indexes and `404.html` |
| `links.mjs` | Every internal link and `#anchor` in every HTML file resolves; no duplicate ids |
| `smoke.cjs` | Home (all feeds live, movers, filters, quick view, holdings, alerts, sorting, widget builder, service worker), coin and sector pages, widgets, about, embed, 404, phone layout, no console or CSP errors |
| `converter.cjs` | /convert/ and coin-page converter: live rates, both directions, swap, fiat rates, coins added after load, deep links, renamed tickers, phone layout |
| `heatmap.cjs` | Tile coverage and bounds, sector grouping, stablecoin toggle, links, phone layout |
| `search.cjs` | Header search on every sub-page (keyboard, Enter, old tickers), home Enter-to-open, light/dark first visit, alert notifications |
| `agent.cjs` | AI-agent tools (WebMCP, `assets/agent.js`): never downloaded without `document.modelContext`; with a stand-in, home and coin pages register 7 tools whose answers, watchlist and alert writes are checked |
| `ondevice.cjs` | On-device AI (`assets/ondevice.js`): never downloaded without Chrome's built-in model or translator; with stand-ins, a coin page answers a preset from its own numbers and translates the About section and back |
| `screener.cjs` | Plain-words filter (`assets/screener.js`): the rule reader on sample sentences; in the browser it loads on the search box's first focus, a sentence filters the table to coins whose live numbers match, Enter stays on the page, Clear resets, a stand-in Prompt API reads an unreadable sentence with a JSON Schema, no sideways scroll at 375 px. |
| `depth.cjs` | Big-order cost box (`assets/depth.js`): the order-book walk on made-up levels; on BTC and SOL a $25k buy and sell read the live books, at least two exchanges answer with a cost against the mid price under 5%, Kraken's pair names work; no sideways scroll at 375 px. |
| `flow.cjs` | Buyers vs sellers (`assets/flow.js`) and when it moves (`assets/moves.js`) on coin pages: taker-side rules per exchange, window counting that leaves out an exchange until it covers the window, hour grouping; on BTC nothing loads before the boxes come into view, the table fills from live trades with shares of 0 to 100% and at least two exchanges, the hour chart has 24 bars and names the time zone; no sideways scroll at 375 px. |
| `bell.cjs` | Bell Brief: `functions/bell.js` answers 204 without its KV binding, 405 for POST and the stored JSON otherwise; after a bell the static page lacks, the home page asks `/bell` once on a 204 and keeps its edition, or swaps in a newer one (escaped, countdown restarted) |
| `axe.cjs` | axe-core accessibility scan of 13 page types in dark and light themes (skips if axe-core isn't installed) |
| `crawl.cjs` | Loads every sitemap URL plus widget variants and the 404 page; fails on console errors, uncaught errors, CSP violations or failed requests; lists browser warnings; only 12 sampled pages open a real Kraken socket (Kraken limits connections per IP) (~2 min, 4 pages at a time) |
| `wait-deploy.sh` | Waits until a URL serves the current local build (same hashed assets, same sitemap), so a deploy wait is one command |

Also run by `run.sh`: `scripts/build-coin-pages.mjs`, `scripts/seo-lint.mjs`, `scripts/check-live.mjs`.
Screenshots go to `$TMPDIR/cpt-qa` (or the second argument of each `.cjs` file).
The tests use live exchange data, so they need network access to Binance, Coinbase and Kraken.

Chrome reports a cross-document view transition it skipped (an interrupted or instant automated navigation) as an
error even though the navigation completes. The browser tests ignore exactly those two messages ("Transition was
aborted because of invalid state", "Transition was skipped"); every other console or page error fails the run.
