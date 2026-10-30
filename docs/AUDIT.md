# Site audit — 30 October 2026

What was found on the live site (cryptopriceticker.com, Cloudflare Pages), what changed, and how it was
verified. Measurements were taken in headless Chromium against the live exchange APIs.

## Data accuracy

| Finding | Fix |
| --- | --- |
| **Wrong prices shown.** The bootstrap read Binance's 24h snapshot, which still lists ~257 delisted pairs with prices frozen since early October. XMR showed **$118.70** while the real price was ≈ **$614**; TON, HNT, BEAM, LRC and MKR were also frozen. | Stale pairs (no trade in 2h) are ignored, and each coin streams only from exchanges verified to list it (`feeds` in `assets/coins.js`). |
| Toncoin was renamed **Gram (GRAM)** in June 2026. Binance moved to `GRAMUSDT`; Coinbase and Kraken still use `TON`. | Coin is now `GRAM` with per-exchange ticker aliases; old `TON` watchlists, bags and links migrate automatically (`/coin/ton/` → `/coin/gram/`). Same for FTM → S (Sonic) and MATIC → POL. MKR (migrated to SKY at 1:24,000) was replaced by SKY. |
| 6 coins never received a live price (DAI, OKB, MNT, BRETT, MEW, RON); BRETT and RON had no market on any of the three exchanges. | DAI/OKB/MNT/MEW now stream from Kraken; BRETT, RON and the near-dead SCRT ($4M cap) were removed; HYPE (#9 by market cap), ASTER, WLFI, MORPHO, CAKE and PAXG were added. Every coin has ≥ 1 verified feed. |
| Seed prices and supplies were far out of date (e.g. ZEC $42.80 vs ≈ $1,224; SOL $148 vs ≈ $95). Fake 24h changes (`(idx % 7 − 2.5) × 1.35`) and sine-wave sparklines were displayed as if real. | Supplies and prices refreshed from CoinLore and CoinMarketCap (`scripts/refresh-coins.mjs`). Until a live tick arrives a coin shows "—" and a dimmed price, never invented numbers. |
| "Liquidity ±2% = combined order-book depth within 200 bps" was actually `volume × 0.065`. | Labelled **Est. liquidity** everywhere, with the method explained. Coin pages and the 🔔 inspector show **real** ±2% depth measured from Binance's order book. |
| Coinbase subscription included 21 product IDs that don't exist (Coinbase answered with an error for each). | Subscriptions are built from verified feeds only. |

## Bugs (each reproduced before and re-tested after)

| Bug | Before | After |
| --- | --- | --- |
| Typing a price alert in the coin modal | Input wiped every 180 ms by live re-render | Value persists; only the numbers update |
| Visiting a widget link `/?w=BTC` | **Replaced the visitor's saved watchlist** with `[BTC]` | Goes to `/coin/btc/`; watchlist untouched |
| Saved currency (e.g. BTC) | Prices in BTC but the **USD** button highlighted | Correct button active (`aria-pressed`) |
| "Pin price to tab" | Title froze when the tab was in the background (requestAnimationFrame doesn't run there) | Keeps updating in background tabs |
| Empty portfolio value | `$0.00000000` | `$0.00` |
| 24h low/high labels | Overlapped for 5-digit prices | Readable |
| Sync link | Not saved, private data left in the address bar | Saved to the browser, URL cleaned |
| Embedded widgets in browsers that block third-party storage | Unguarded `localStorage` reads at startup would throw and stop the widget | Every storage access is guarded |

## Performance

| | Before | After |
| --- | --- | --- |
| Home: data downloaded on load | **285 KB compressed / 1.9 MB parsed** (every Binance pair) | 6.7 KB compressed / 29 KB parsed (only tracked pairs) |
| Home: total HTTP (uncompressed) | 2,011 KB | 113 KB |
| Home: WebSocket traffic per 20 s | 927 KB | 236 KB (−75%) |
| Embedded widget: HTTP | 2,011 KB | 15–75 KB (≈ 1 KB of HTML once CSS/JS are cached) |
| Embedded widget: WebSocket per 20 s | 692 KB (streamed every market) | 36 KB (−95%) |
| Event handlers | 336+ inline `onclick` strings rebuilt on every render | One delegated listener |

Code is now `index.html` + cacheable `assets/*` (home page ≈ 29 KB Brotli in total; coin pages ≈ 2.3 KB of
HTML on top of cached assets; the widget page ≈ 0.3 KB).

## SEO

| Finding | Fix |
| --- | --- |
| No `404.html`, so Pages ran in SPA mode: `/robots.txt`, `/favicon.ico` and **any made-up URL returned 200 with the home page** (soft-404s, endless duplicate URLs). | Real `404.html` (404 status, `noindex`). |
| Only one indexable URL, so nothing could rank for "<coin> price". | 114 generated coin pages (`/coin/btc/` …), each with its own title, description, canonical URL, breadcrumb structured data, a factual description and related-coin links. |
| No robots.txt, sitemap, favicon, social image or Twitter card. Title ~95 characters. | Added `robots.txt`, `sitemap.xml` (115 URLs), favicon set and web manifest, a 1200×630 `og-image.png`, Twitter card, and a 60-character title. |
| **Widget links used keyword-rich anchors**, which Google's spam policy explicitly lists as link spam ("keyword-rich… links embedded in widgets that are distributed across various sites") and can trigger a manual action. | Credit links are brand-only ("Live prices by CryptoPriceTicker.com"). Old embeds keep working. |
| Widget frames relied on JavaScript to set `noindex`. | New widgets use `/embed/` with a static `noindex, indexifembedded` meta tag plus an `X-Robots-Tag` header. |
| Home page had little crawlable text and no internal links. | "How it works" and FAQ sections, plus a crawlable list of all coin pages. |

## Security & hosting

`_headers` adds a Content-Security-Policy that allows only the site itself, the three exchanges and
Cloudflare Web Analytics, and blocks all inline script. It also sets HSTS, Permissions-Policy and
cache rules. `frame-ancestors *` is deliberate so widgets stay embeddable. All text that comes from
the exchange APIs is HTML-escaped before rendering.

## Accessibility

axe-core reports **0 violations** on the home, coin and 404 pages in all 5 themes (it found
contrast failures in 4 of 5 themes before the fix). Changes include: labels on all 336 icon buttons,
keyboard-sortable column headers with `aria-sort`, real links/buttons instead of clickable divs,
modals with dialog semantics, Esc and backdrop close, and focus return. Also: a skip link, visible
focus rings, `prefers-reduced-motion` support, and a decorative ticker tape hidden from screen readers.

## Sources

- Cloudflare Pages — Serving Pages (SPA fallback without 404.html): https://developers.cloudflare.com/pages/configuration/serving-pages/
- Cloudflare Pages — Headers / Redirects / Early Hints / Web Analytics: https://developers.cloudflare.com/pages/configuration/headers/ · …/redirects/ · …/early-hints/ · https://developers.cloudflare.com/pages/how-to/web-analytics/
- Google Search spam policies (link spam, widget links): https://developers.google.com/search/docs/essentials/spam-policies
- Binance announcement, Toncoin (TON) → Gram (GRAM): https://www.binance.com/en/support/announcement/detail/fe307fba935b44698fde4db01e84a7eb
