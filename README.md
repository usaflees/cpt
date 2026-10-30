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
| `content/coin-about.json` | Short description of each coin, shown on its coin page |
| `_headers` | Security headers (incl. Content-Security-Policy) and cache rules for Cloudflare Pages |
| `_redirects` | Old tickers → new coin pages (**generated**) |
| `sitemap.xml` | **Generated** list of all pages for search engines |
| `robots.txt`, `site.webmanifest`, `favicon.*`, `icon-*.png`, `apple-touch-icon.png`, `og-image.png` | Search/social/app metadata |
| `scripts/` | Maintenance scripts (Node 18+, no dependencies) |
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

**Refresh supplies and prices** (every month or two):
`node scripts/refresh-coins.mjs && node scripts/build-coin-pages.mjs`. The refresh script warns if a coin has
lost every live feed (for example, after a delisting).

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
