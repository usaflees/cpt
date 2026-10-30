# CryptoPriceTicker.com

Live crypto prices streamed straight from Coinbase, Binance and Kraken into the browser.
Plain static files hosted on **Cloudflare Pages**. There is no framework and no build step:
whatever is in this repository is what gets deployed.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Home page: price table, movers, private bag, widget builder |
| `coin/<sym>/index.html` | One page per coin (**generated**, don't edit by hand) |
| `embed/index.html` | The iframe widget other sites embed (`/embed/?layout=…&coins=…`) |
| `404.html` | Real "not found" page. Without it, Pages answers every unknown URL with the home page and a 200 status |
| `assets/coins.js` | **Coin list.** The single source of truth for the table, widgets and coin pages |
| `assets/app.js` | All site logic: feeds, table, coin pages, widgets, alerts, portfolio |
| `assets/app.css` | All styles, including the 5 colour themes |
| `assets/theme-init.js` | Tiny script that applies the saved theme before first paint |
| `about/index.html` | About & data methodology page |
| `widgets/index.html` | Free widget landing page: live examples and how to embed |
| `sector/<slug>/index.html` | Sector hub pages (**generated** from `content/sectors.json`) |
| `convert/index.html` | Crypto converter: any coin ⇄ any coin or 20 fiat currencies (**generated**; fiat rates from Coinbase's public exchange-rates API) |
| `og/<sym>.jpg` | Per-coin social share images (`node scripts/build-og-images.cjs`, needs Playwright) |
| `sw.js` | Service worker: installable app + offline fallback (always network-first) |
| `llms.txt`, `.well-known/security.txt`, `<key>.txt` | AI-crawler summary, security contact, IndexNow key |
| `content/coin-about.json` | Short description of each coin, shown on its coin page |
| `content/coin-stats.json` | **Generated** performance figures (7d–1y change, 52-week range, monthly closes) |
| `content/seo-overrides.json` | Optional per-coin `title` / `description` / `h1` overrides (the self-improving loop's only content lever) |
| `content/experiments.json` | Log of every SEO change: hypothesis, pages, start and evaluation dates, result |
| `_headers` | Security headers (incl. Content-Security-Policy) and cache rules for Cloudflare Pages |
| `_redirects` | Old tickers → new coin pages (**generated**) |
| `sitemap.xml` | **Generated** list of all pages for search engines |
| `robots.txt`, `site.webmanifest`, `favicon.*`, `icon-*.png`, `apple-touch-icon.png`, `og-image.png` | Search/social/app metadata |
| `scripts/` | Maintenance scripts (Node 18+, no dependencies) — see below |
| `scripts/telemetry/` | Google Apps Script that collects Search Console + Cloudflare data into a private Sheet |
| `.github/workflows/site-checks.yml` | Runs the generator and `seo-lint` on every pull request and push to `main` |
| `docs/SELF-IMPROVING.md` | How the weekly self-improvement loop works and the rules it must follow |
| `docs/LAUNCH-KIT.md` | Launch & growth plan: indexing checklist, where to post (and the rules), post drafts |
| `docs/AUDIT.md` | The October 2026 audit: what was wrong, what changed, and the evidence |

## Common tasks

**Change text, layout or styles.** Edit `index.html` / `assets/app.css` / `assets/app.js` and commit.
Cloudflare redeploys automatically.

**Add, remove or rename a coin.**
1. Edit `assets/coins.js`. To add a coin, append a line with `sym`, `name` and `sectors`, and set
   `supply: 0, price: 0, feeds: []`.
2. Add a one- or two-sentence description to `content/coin-about.json`.
3. Run:
   ```sh
   node scripts/refresh-coins.mjs      # fills circulating supply, seed price, and which exchanges list it
   node scripts/build-coin-pages.mjs   # regenerates coin pages, sitemap.xml, _redirects, home-page links
   ```
4. Commit everything.

If a coin is renamed (like Toncoin → Gram), change its `sym`/`name` and set `formerly: "OLD"`. Old
watchlists, portfolios and `/coin/old/` links then move over automatically. If an exchange still
uses the old ticker, add `tickers: { CB: "OLD" }` (or `BN`/`KR`).

**Refresh data** (the weekly scheduled task does this automatically):
```sh
node scripts/refresh-coins.mjs      # supplies, seed prices, verified exchange feeds (warns on delistings)
node scripts/fetch-coin-stats.mjs   # performance figures from daily candles
node scripts/build-coin-pages.mjs   # regenerate pages, sitemap, redirects
node scripts/seo-lint.mjs           # must pass before anything ships
```

**Check the live site:** `node scripts/check-live.mjs` (or pass a preview URL).

**Change an SEO title or description:** edit `content/seo-overrides.json`, add an entry to
`content/experiments.json`, rebuild, and run `node scripts/seo-lint.mjs --base main`. Rules are in
`docs/SELF-IMPROVING.md`.

**Add a new data source or third-party script.** Add its host to the `Content-Security-Policy` line
in `_headers`, or browsers will block it.

## Cloudflare dashboard checklist

These settings live in the Cloudflare dashboard, not in this repository:

- [ ] **Web Analytics:** Workers & Pages → your project → Metrics → *Enable* (free, cookie-less). The CSP already allows it.
- [ ] **www → apex redirect:** Rules → Redirect Rules → "Redirect from WWW to root" template (301), so `www.cryptopriceticker.com` doesn't serve a duplicate site.
- [ ] **Always Use HTTPS:** SSL/TLS → Edge Certificates → on.
- [ ] **Early Hints:** Speed → Settings → on (`preload`/`preconnect` tags are already in the HTML).
- [ ] **Rocket Loader:** leave **off**. It rewrites scripts, which conflicts with the CSP.
- [ ] **Google Search Console & Bing Webmaster Tools:** verify the domain (DNS TXT record) and submit `https://cryptopriceticker.com/sitemap.xml`.

## Local preview

Any static server works, e.g. `npx serve .` or `python3 -m http.server`, then open http://localhost:8000.
`_headers`/`_redirects` only apply on Cloudflare (or `npx wrangler pages dev .`). Every pushed branch
also gets its own preview URL on Cloudflare Pages.
