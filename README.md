<p align="center"><img src="brand/lockup-1200x298.jpg" width="600" alt="CryptoPriceTicker"></p>

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
| `assets/app.css` | All styles: the 6 colour themes (Neon, the brand theme, is the default) and the brand layer |
| `assets/theme-init.js` | Tiny script that applies the saved theme before first paint. `build-coin-pages.mjs` inlines it into every page and puts its hash in the CSP in `_headers`, so edit it here and rebuild |
| `assets/consent.js` | Google Tag Manager (`GTM-PD9TXJX`) with Consent Mode v2 and the cookie banner. Loads GTM after page load; never in widgets; analytics cookies only after "Accept" |
| `about/index.html` | About & data methodology page |
| `accessibility/index.html` | Accessibility statement (WCAG 2.1 AA / EN 301 549 status, known limits, how to report a barrier) |
| `widgets/index.html` | Free widget landing page: live examples and how to embed |
| `sector/<slug>/index.html` | Sector hub pages (**generated** from `content/sectors.json`) |
| `heatmap/index.html` | Live market heatmap: treemap sized by market cap, coloured by 24h change (**generated**) |
| `convert/index.html` | Crypto converter: any coin ⇄ any coin or 20 fiat currencies (**generated**; fiat rates from Coinbase's public exchange-rates API) |
| `brand/` | Brand kit page (`/brand/`) and every logo asset: vector mark (`mark.svg`, `mark-glow.svg`), CPT badges, lockup, banners, poster. Masters and the colour rationale are on the page |
| `coin-icons/<sym>.svg` | Self-hosted coin logos (**generated** by `scripts/build-coin-icons.mjs` from MIT/CC0 icon packs; licences in `coin-icons/LICENSES.md`). Coins without one show their ticker |
| `speculation-rules.json` | Prerenders same-site links on hover (Chromium), sent via the `Speculation-Rules` header in `_headers` |
| `og/<sym>.jpg` | Per-coin social share images (`node scripts/build-og-images.cjs`, needs Playwright) |
| `sw.js` | Service worker: installable app + offline fallback (always network-first) |
| `llms.txt`, `.well-known/security.txt`, `<key>.txt` | AI-crawler summary, security contact, IndexNow key |
| `content/coin-about.json` | Short description of each coin, shown on its coin page |
| `content/coin-stats.json` | **Generated** performance figures (7d–1y change, 52-week range, monthly closes) |
| `content/seo-overrides.json` | Optional per-coin `title` / `description` / `h1` overrides (the self-improving loop's only content lever) |
| `content/experiments.json` | Log of every SEO change: hypothesis, pages, start and evaluation dates, result |
| `content/page-dates.json` | **Generated.** Content hash and last-changed date of each hand-written page, so its sitemap `lastmod` moves only when its content does |
| `_headers` | Security headers (incl. Content-Security-Policy) and cache rules for Cloudflare Pages |
| `_redirects` | Old tickers → new coin pages (**generated**) |
| `sitemap.xml` | **Generated** list of all pages for search engines |
| `robots.txt`, `site.webmanifest`, `favicon.*`, `icon-*.png`, `apple-touch-icon.png`, `og-image.jpg` | Search/social/app metadata |
| `scripts/` | Maintenance scripts (Node 18+, no dependencies) — see below |
| `scripts/telemetry/` | Google Apps Script that collects Search Console + Cloudflare data into a private Sheet |
| `.github/workflows/site-checks.yml` | Runs the generator and `seo-lint` on every pull request and push to `main` |
| `docs/SELF-IMPROVING.md` | How the weekly self-improvement loop works and the rules it must follow |
| `docs/LAUNCH-KIT.md` | Launch & growth plan: indexing checklist, where to post (and the rules), post drafts |
| `docs/AUDIT.md` | The October 2026 audit: what was wrong, what changed, and the evidence |
| `docs/STRATEGY.md` | Strategy 2026–2027: measured baseline, research, prioritized backlog, roadmap, what we decided against, KPIs |
| `docs/NEWS-AND-MONETIZATION.md` | News block (original daily briefs + licensed headlines) and the phased, compliance-gated monetization plan |

## Common tasks

**Change text, layout or styles.** Edit `index.html` / `assets/app.css` / `assets/app.js`, run
`node scripts/build-coin-pages.mjs` (it stamps every page's `/assets/…?v=` links with the new content
hash, since those files are cached for a year), and commit. CI fails if you forget.
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
4. Optional: give it a logo. Follow the steps at the top of `scripts/build-coin-icons.mjs`, then run
   `node scripts/build-coin-pages.mjs` again. Check the logo by eye: some tickers are shared by
   unrelated projects.
5. Commit everything.

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

- [ ] **Google Tag Manager:** in GTM, add a *Google tag* (GA4 measurement ID) firing on *Initialization - All Pages*, keep its built-in consent checks on, and **Publish**. Custom HTML tags won't run (the CSP has no 'unsafe-inline').
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
