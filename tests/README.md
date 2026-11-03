# QA suite

`bash tests/run.sh` runs everything against a local Cloudflare Pages emulator; `bash tests/run.sh <url>` runs the
browser and live checks against a deployed preview or production. It prints one line per check (plus the log of any
check that fails; `--verbose` prints everything) and ends with `QA PASSED` or `QA FAILED`.
Needs Node 20+ and Playwright with Chromium (preinstalled in Claude Code cloud sessions).

| File | Checks |
| --- | --- |
| `serve.mjs` | Local emulator: applies `_headers` (including CSP), `_redirects`, directory indexes and `404.html` |
| `links.mjs` | Every internal link and `#anchor` in every HTML file resolves; no duplicate ids |
| `smoke.cjs` | Home (all feeds live, movers, filters, quick view, holdings, alerts, sorting, widget builder, service worker), coin and sector pages, widgets, about, embed, 404, phone layout, no console or CSP errors |
| `converter.cjs` | /convert/ and coin-page converter: live rates, both directions, swap, fiat rates, coins added after load, deep links, renamed tickers, phone layout |
| `heatmap.cjs` | Tile coverage and bounds, sector grouping, stablecoin toggle, links, phone layout |
| `search.cjs` | Header search on every sub-page (keyboard, Enter, old tickers), home Enter-to-open, light/dark first visit, alert notifications |
| `axe.cjs` | axe-core accessibility scan of 13 page types in dark and light themes (skips if axe-core isn't installed) |
| `crawl.cjs` | Loads every sitemap URL plus widget variants and the 404 page; fails on console errors, uncaught errors, CSP violations or failed requests; lists browser warnings (~2 min, 4 pages at a time) |
| `wait-deploy.sh` | Waits until a URL serves the current local build (same hashed assets, same sitemap), so a deploy wait is one command |

Also run by `run.sh`: `scripts/build-coin-pages.mjs`, `scripts/seo-lint.mjs`, `scripts/check-live.mjs`.
Screenshots go to `$TMPDIR/cpt-qa` (or the second argument of each `.cjs` file).
The tests use live exchange data, so they need network access to Binance, Coinbase and Kraken.

Chrome reports a cross-document view transition it skipped (an interrupted or instant automated navigation) as an
error even though the navigation completes. The browser tests ignore exactly those two messages ("Transition was
aborted because of invalid state", "Transition was skipped"); every other console or page error fails the run.
