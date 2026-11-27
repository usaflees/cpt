# New-tech feature ideas, round 4 (2026-11-27)

Fourth pass, asked for on 27 Nov ("deep research on the latest technology, discussion boards and Cloudflare's
features and apps, then 100 percent original ideas"). Everything in rounds 1 to 3 is excluded
([round 3](2026-11-27-new-tech-ideas-round3.md) lists it), as are the live price alerts the site already has.

Sources read on 2026-11-27, with search excerpts unless marked "page":
- Cloudflare: the developer changelog to 19 Nov (Browser Run /snapshot formats, inbound TCP for Workers, 30-day
  version retention, spend limits 13 Nov, AI Search summaries 17 Nov, EmbeddingGemma 2 on Workers AI 12 Nov), the blog
  to 25 Nov (Search for Agents, Kitesurf open source 13 Nov, open-weight Clairic 18 Nov), the Workers runtime
  changelog (Temporal with compatibility date 2026-12-01), the shared-dictionaries page in Speed docs (beta on every
  plan, passthrough only), the Durable Objects WebSocket hibernation docs.
- Browsers: chromestatus release notes 156, 157, 158 (page excerpts), web.dev "New to the web platform in October",
  MDN Firefox 161 notes, Firefox 160 release notes (on-device SpeechRecognition), a HTML-in-Canvas write-up.
- Discussion boards: r/CloudFlare front page and threads (remote MCP servers on Workers, Workers cost debates),
  r/CryptoCurrency (CoinMarketCap API credit complaints, "what exchanges still get wrong"), r/sideprojects (a crypto
  ETF dashboard that separates the price's own time from the refresh time), r/algotrading (free OHLCV downloads; a
  reply asks for a fetch timestamp on every file), Hacker News (Cloudflare Wallets thread, a Show HN bar-chart race
  in HTML-in-Canvas, WebMCP posts).
Not confirmed: Cloudflare's shared-dictionary savings for this site (no measurement yet); Coinbase's public
`matches` channel and Kraken's `count` parameter were taken from their docs and are checked by `tests/flow.cjs` in CI.

## What came out of the boards

- People trust a number more when they can see where and when it came from (the ETF dashboard thread, the OHLCV
  timestamp reply). The site already says which exchange each price is from; the new boxes say how much of the window
  they actually cover.
- Order flow and positioning (who is buying, funding, liquidations) live on paid or login sites (Coinalyze, Velo,
  CoinGlass in the "50 research sites" list). A spot-only, no-login view from public trades is missing.
- Cloudflare developers mostly talk about cost control (spend limits were the most requested feature, per the blog)
  and agent plumbing (remote MCP, OAuth, rate limits by client rather than IP).

## Ranked ideas

| # | Idea | Value | Effort / cost | Status |
|---|------|-------|---------------|--------|
| 1 | **Who's buying and who's selling right now** (coin pages): every trade on Coinbase, Kraken and Binance counted by the side that crossed the spread, over 1, 5 and 15 minutes, with buyers' share per exchange and the biggest trade. Seeded with each exchange's last 1,000 public trades, then live from their trade streams; a window counts an exchange only once its trades cover the whole window. | High: order flow is a paid or login feature elsewhere | Low, browser only | **Built** (`assets/flow.js`) |
| 2 | **When does it usually move, on your clock** (coin pages): 30 days of hourly candles grouped by the hour of the day in the visitor's own time zone (24 bars, the current hour highlighted, weekdays against weekends, a table of the numbers). | Medium-high: answers "when should I watch" with the visitor's own hours | Low, browser only | **Built** (`assets/moves.js`) |
| 3 | **Return visits download only what changed** (Cloudflare shared dictionaries, beta on every plan): the build keeps the previous `app.js`/`app.css` and writes a delta against it; a small Pages Function answers requests that carry `Available-Dictionary` with `Content-Encoding: dcb`. Returning Chrome visitors would fetch a few KB instead of ~50 KB after each deploy. | Medium: speed for regulars | Medium; routes asset requests through a Function, which counts against the free Workers requests | Owner decision |
| 4 | **Order-book walls**: from the books `depth.js` already reads, name the biggest resting bid and ask within 2% of the price on each exchange ("largest bid: 38 BTC at $94,200 on Coinbase"). | Medium | Very low | Next build |
| 5 | **Alerts that open the coin page**: pass the coin page as the `navigate` option of the alert notification (Safari, Firefox 158), so a tap lands on the coin instead of the home page. | Small | Very low | Next build |
| 6 | **Spend limit as a safety net**: the site now runs Pages Functions (`/mcp`, `/bell`); a Workers spend limit with email alerts (dashboard, Billing > Spend limits, 13 Nov) caps any surprise from bots. | Safety | One dashboard setting | Owner setting |
| 7 | **Agents that sign their requests get more of /mcp**: verify Web Bot Auth signatures (Cloudflare's IETF draft) in `functions/mcp.js` and give verified agents a higher rate limit than anonymous callers. | Low-medium: agent traffic is small today | Medium | Later |
| 8 | **3D heatmap with real HTML tiles** (HTML-in-Canvas, stable in Chrome 157): a tilt view of `/heatmap/` whose tiles stay selectable and readable by screen readers. | Low: looks good, adds little | Medium | Later |
| 9 | **Find a coin from a logo or a chart screenshot** (EmbeddingGemma 2 on Workers AI, multimodal): drop an image in search. | Low | Needs a Workers AI binding and billing above the free allowance | Not now |

## Owner decisions this raises

- Idea 3 (shared dictionaries): whether asset requests may go through a Pages Function.
- Idea 6: set a Workers spend limit and alert in the Cloudflare dashboard.
