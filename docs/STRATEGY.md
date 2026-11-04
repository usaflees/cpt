# Strategy 2026–2027: speed, search in the AI era, and a product AI answers can't replace

Written November 2026 after the brand, speed and caching work (PRs #1–#4). It is a living plan:
every item has a reason, an effort, a success measure and a trigger for revisiting it. The weekly
improvement loop (`docs/SELF-IMPROVING.md`) keeps its own rules; nothing here relaxes them.

**Contents:** 1 Where we stand · 2 What changed outside · 3 The strategy in one page ·
4 Pillars and backlog · 5 Roadmap · 6 Decided against · 7 Measurement · 8 Risks · Sources

---

## 1. Where we stand (measured, not guessed)

**Lighthouse, mobile, production** (2 Nov 2026, after #3/#4):

| Page | Perf | SEO | LCP | Notes |
| --- | --- | --- | --- | --- |
| Home | 95–98 | 100 | 1.0–1.4 s | TBT 150–270 ms: live table start-up + first tick wave |
| Coin (BTC) | 100 | 100 | 1.4 s | |
| Heatmap / Converter / Widgets / About | 100 | 100 | 1.1–1.4 s | |
| Sector (AI) | 99 | 100 | 1.8 s | |
| Brand kit | 95 | 100 | 2.3 s | image-heavy by design |

**What's already in place:**
- **Delivery:** static files on Cloudflare Pages, with Brotli compression and 103 Early Hints. Assets carry content hashes and are cached for a year.
- **Navigation:** Speculation Rules prerender links on hover, and cross-document view transitions animate page changes.
- **Live feeds:** they're safe for the back/forward cache and for prerendered pages.
- **Quality gates:** CSP-hashed inline theme script; 0 axe-core violations; 0 JS errors across 14 page types × 2 themes × 2 widths.

**Steady-state main-thread cost on the home page:** about 120 ms per second, measured with CDP. That's down from about 240 ms before #4. What's left is the live data itself: parsing exchange JSON, applying ticks and flashing prices.

**Content inventory:**
- 129 URLs: 114 coin pages, 9 sector pages, plus the home, heatmap, converter, about, widgets and brand pages.
- Coin pages are **very uniform: 701–770 words each.**
- Structured data: WebSite/Organization/WebApplication on the home page, WebPage + BreadcrumbList with `dateModified` on coin pages.
- No AI crawler is blocked. `llms.txt` exists.

**Constraints we keep on purpose:**
- No framework and no build step beyond our own Node scripts.
- No server, and the portfolio never leaves the browser. Since 2 Nov 2026 Google Tag Manager / GA4 runs behind a consent banner (Consent Mode v2): analytics cookies only after "Accept", ads signals always denied, never inside widgets (`assets/consent.js`).
- Prices come straight from the exchanges.

These constraints are also the product's positioning. Anything that breaks one needs an explicit decision (see §6).

---

## 2. What changed outside (research summary)

1. **Search clicks are shrinking for informational queries.**
   - AI Overviews now show on a large share of searches.
   - CTR studies range from about −18% to −58% for top results when an AI Overview is present. Pew measured clicks at 8% with an AI summary versus 15% without one.
   - Finance was among the sectors hit hardest.
   - Search Console now reports "AI Mode" and "AI Overviews" separately under Search Appearance.

   **Implication:** "what is X" pages lose value. *Live, interactive, always-current* tools keep it, because an AI answer is a snapshot and our core value is "now".

2. **AI answers cite pages that already rank, and that are easy to parse.**
   - A 2026 study sorts citation failures into three stages:
     - parsing (noise, malformed HTML);
     - fetching/context (truncation, key facts buried);
     - generation (entity gaps, intent mismatch).
   - Front-loading a complete, factual answer helps. So does not blocking the search crawlers: `OAI-SearchBot` decides whether ChatGPT search can cite a page, separately from `GPTBot`, which is for training.
   - Evidence that `llms.txt` or schema markup boosts citations is weak.

3. **Core Web Vitals:**
   - Thresholds are unchanged: LCP < 2.5 s, INP < 200 ms, CLS < 0.1, at the 75th percentile.
   - CrUX added *experimental* soft-navigation metrics in October 2026. These matter for single-page apps only; we are a multi-page site, so there's no work for us.
   - Crypto sites commonly fail INP because of live tickers. That is exactly our risk area.

4. **Rich results are shrinking.**
   - FAQ rich results stopped appearing on 7 May 2026, and HowTo went in 2023.
   - Breadcrumbs, Article, Product and similar types remain.
   - Unused markup does no harm, but it no longer earns visual real estate.

5. **New platform tools** that fit us:
   - `scheduler.yield()`: Chrome/Edge 129+ and Firefox 142+. Not in Safari, which needs a `setTimeout` fallback.
   - Customizable `<select>` with `appearance: base-select`: Chrome 134+. Other browsers fall back to the native select automatically.
   - Document Picture-in-Picture: Chrome/Edge 116+ on desktop. Not in Safari or on mobile.
   - Speculation Rules and view transitions: already shipped.
   - Compression Dictionary Transport: RFC 9842. Chrome/Edge only; Cloudflare supports it in "passthrough" open beta (Apr 2026), which needs origin logic.

6. **Cloudflare is steering new projects toward Workers with static assets.**
   - Existing Pages sites keep working, and there's no forced migration.
   - Workers adds Durable Objects (WebSocket fan-out with hibernation), cron jobs and observability.
   - Durable Objects bill every WebSocket message sent: $0.15 per million on the paid plan.

7. **Regulation:**
   - The European Accessibility Act applies to consumer digital services sold in the EU since June 2025, benchmarked against EN 301 549 (WCAG-based). The microenterprise exemption is narrow.
   - MiCA targets crypto-asset service providers and issuers' marketing. A free price site with no offers or affiliate links is likely outside it, but that's for counsel to confirm before any monetization.

---

## 3. The strategy in one page

> **Win on "live and trustworthy" — the part AI answers can't copy — and make every static page
> a clean, citable fact sheet.**

| Pillar | Goal | Why now |
| --- | --- | --- |
| A. Real-time product moat | Features that only a live page can do | AI summaries take the "what is" clicks; "what's happening right now" stays ours |
| B. Citable fact sheets | Each coin page gives crawlers unique, dated facts in the first screen | Pages are near-uniform; AI and Google reward unique data and direct answers |
| C. Interaction speed | Keep INP well under 200 ms on low-end phones while ticks stream | Live tickers are the #1 INP killer in this niche; 120 ms/s steady state is our headroom |
| D. Measurement | Field data (RUM/CrUX), AI-appearance data, citation checks | Lighthouse is a lab; ranking uses field data |
| E. Trust & compliance | Methodology, freshness, accessibility statement | YMYL bar; EAA |
| F. Platform options | Know exactly when we'd add an edge relay or move to Workers | Avoid premature servers; be ready when a trigger fires |

---

## 4. Pillars and backlog

Effort: **S** < 1 day · **M** 1–3 days · **L** > 3 days. "Owner" means you; everything else is agent work through pull requests.

### A. Real-time product moat

**A1. Floating live ticker (Document Picture-in-Picture), M.**
- A "Pop out" button on the home and coin pages opens an always-on-top mini ticker of the watchlist, which keeps streaming while the visitor works in other apps. No other price site we know of does this well.
- The button appears only where `documentPictureInPicture` exists (desktop Chrome/Edge); elsewhere it's hidden. Opening a second floating window closes the first, and the button needs a user gesture.
- **Success:** pop-out opens per 1,000 desktop sessions, and longer time on site.

**A2. One exchange connection for all tabs (SharedWorker), M.**
- Today every open tab opens its own Binance, Coinbase and Kraken sockets. A SharedWorker would hold one set and fan ticks out to every tab, which cuts bandwidth and CPU and keeps rate limits friendly.
- Fall back to a dedicated Worker (see C1), or to the current in-page sockets, where SharedWorker is missing.
- **Success:** with 3 tabs open, 3 sockets instead of 9, and the same tick latency.

**A3. In-page price alerts upgrade, S–M.**
- The Badging API (`navigator.setAppBadge`) puts an alert count on the installed app's icon.
- An optional sound cue, plus a clear "alerts work while this tab is open" note.
- Real push notifications need a server (see F3), so they stay out.

**A4. Converter and search pickers with coin logos, S.**
- The converter's `<select>` gets `appearance: base-select` with logos, inside `@supports`. Other browsers keep the native select, with no JavaScript dropdown library.
- **Success:** no change in INP, and the converter is easier to use.

**A5. Widget growth, M.**
- **Effect:** widgets are our backlink and brand engine, since every embed credits us with a brand-only link (link-spam rules respected).
- **Additions:**
  - a "Copy for WordPress / Notion / Ghost" snippet set;
  - a dark/light auto theme;
  - a 1-click "single coin card" snippet for every coin page ("Embed BTC widget" exists; make it prominent).
- **Measure:** referrers to `/embed/` in Cloudflare Analytics.
- **Success:** distinct embedding domains per month.

### B. Citable fact sheets (search and AI answers)

**B1. Answer-first summary on every coin page, M. Highest-value SEO item.** *Built Nov 3, 2026 (`performanceSummary` in the coin hero); awaiting owner go-live.*
- A server-rendered paragraph in the first screen, built from `content/coin-stats.json`. Example: "Bitcoin (BTC) is up 34% over the past year and trades within a 52-week range of $X–$Y; its 30-day volatility is Z%. Data as of 2 Nov 2026 from Coinbase daily closes."
- Crawlers that don't run JavaScript, which includes most AI fetchers, then see real, dated facts instead of an empty live widget.
- **No price predictions and no advice language.**
- **Success:** more impressions on coin pages, plus citations in the prompt checks (D3).

**B2. Unique data modules, to fix uniformity, M–L.** *First slice built Nov 3, 2026: "key facts" (largest fall, best/worst month, 90-day BTC correlation, 1-year sector rank); sector hubs show the median largest fall and BTC correlation (Nov 4). Exchange coverage/spread still open.*
- Computed from the daily candles we already fetch:
  - drawdown from the 52-week high;
  - best and worst month;
  - 30/90-day correlation with BTC;
  - exchange coverage and typical cross-exchange spread;
  - rank changes within its sector.
- Each module appears only when its data is meaningful, so no filler.
- **Success:** coin-page word counts stop clustering at 701–770, and each page carries at least 5 facts no other page on the site shares.

**B3. Freshness signals, S.**
- The visible "Data as of" date matches `dateModified` in the structured data and `lastmod` in the sitemap. All three change only when the data actually changes, since fake freshness is a known spam signal.

**B4. Structured data tidy-up, S.** *Organization logo is an `ImageObject` since Nov 3, 2026.*
- Keep WebPage + BreadcrumbList.
- Add `Dataset`-style markup only if it's accurate and useful. No FAQPage for rich results (deprecated); keeping FAQ text for readers is fine.
- Add `ImageObject` logos to the Organization.

**B5. Crawler policy, S.** Shipped 2 Nov 2026: the owner chose to welcome training crawlers too, for reach. Explicitly allow the search and citation bots:
- `OAI-SearchBot`, `PerplexityBot` and `Claude-SearchBot` (citation crawlers);
- `Googlebot` (search).

Whether to allow training crawlers (`GPTBot`, `Google-Extended`, `CCBot`) is a separate owner decision: allowing them costs little for a factual site, and blocking them doesn't remove us from AI answers. Keep `llms.txt`, but treat it as cheap insurance, not a lever.

**B6. Curated comparisons, M. Needs owner approval (new URL family).**
- At most 20 high-demand pairs (BTC vs ETH, SOL vs ETH…), each with computed side-by-side stats and no prose filler.
- **Only if** Search Console shows comparison queries landing on coin pages.

**B7. Languages, L. Later, data-gated.**
- Crypto search demand is heavily non-English. Start with 1–2 languages (Spanish, Portuguese) for the home page and the top 20 coins, with `hreflang`.
- Professional review only, because YMYL plus machine translation is risky.
- **Trigger:** Search Console shows meaningful impressions from those markets.

### C. Interaction speed

**C1. Move exchange parsing off the main thread (dedicated Worker), M. Largest remaining speed win.**
- The socket JSON parsing and tick merging move to a Worker, which posts one compact batch per 200 ms flush.
- The main thread then only patches the DOM. Expect the steady state to fall well below 120 ms/s, with lower INP on mid-range Android.
- Combines with A2 (a SharedWorker uses the same code).

**C2. `scheduler.yield()` in heavy renders, S.**
- The full table render, heatmap layout and sector filter yield between chunks, with a `setTimeout(0)` fallback for Safari.
- **Success:** no long task over 50 ms on interaction in a Lighthouse "timespan" run.

**C3. Performance budgets in CI, S.**
- `seo-lint` fails if any of these is broken:
  - `app.js` > 80 KB raw;
  - `app.css` > 75 KB raw;
  - a page's HTML > 60 KB;
  - a new third-party origin appears in the CSP.
- This keeps today's scores from eroding one PR at a time.

**C4. Lighthouse in CI on 3 representative pages, S–M.**
- A GitHub Action against the Pages preview URL.
- It warns rather than fails, because lab results are noisy.

**C5. Image hygiene, S.**
- The OG cards (8 MB across 114 files) are fine because they're only fetched by crawlers.
- The brand page already uses `srcset`.
- Re-check if an image ever becomes an LCP element.

### D. Measurement

**D1. Owner, S. Field data from real visitors:**
- Enable Cloudflare Web Analytics with Core Web Vitals; it's cookie-less and the CSP already allows it.
- Finish Search Console setup.
- Add the "AI Mode" and "AI Overviews" Search Appearance filters to the weekly digest.

**D2. Field data from Google (CrUX) in the telemetry collector, S.**
- `scripts/telemetry/Code.gs` pulls origin- and URL-level p75 LCP/INP/CLS from the CrUX API weekly into the digest. The site may be below CrUX's traffic threshold at first, in which case the digest records "insufficient data".

**D3. Citation checks, S, monthly.**
- A fixed set of about 15 prompts ("bitcoin price live", "kaspa 52 week high", "best free crypto ticker widget"…), run against Google AI Mode, ChatGPT search and Perplexity.
- Log whether `cryptopriceticker.com` is cited. Run it by hand or as an agent task with web search, and keep the results in the private telemetry repo.

**D4. Product metrics** from Cloudflare Analytics paths and referrers:
- embed domains;
- pop-out opens (A1), via a cookie-less beacon path or simply `/embed/` referrers;
- returning visitors.

### E. Trust and compliance

**E1. Accessibility statement page (`/accessibility/`), S.**
- Records conformance status (WCAG 2.1 AA, EN 301 549), the axe-clean audit and a contact route. The EAA expects responsiveness to complaints.

**E2. Methodology depth, S.**
- The About page explains each new fact module (B2) and gives its formula.

**E3. Monetization gate, owner decision.**
- Before any ads, affiliate links or exchange referrals:
  - get legal review covering MiCA marketing rules, local financial-promotion rules and disclosure;
  - re-check that the CSP and privacy promises still hold.
- Today's "no ads" claim is part of the brand.

### F. Platform options (decide only on a trigger)

**F1. Edge relay with Workers + Durable Objects (hibernation), L.**
- **What it would bring:**
  - one upstream connection per exchange for everyone;
  - visitor IPs hidden from the exchanges (a privacy gain);
  - resilience if an exchange rate-limits browsers or blocks a region.
- **Costs:**
  - per-message billing grows with visitors × ticks;
  - a server to run;
  - a change to "straight from the exchange".
- **Triggers:** an exchange blocks or rate-limits browser connections, *or* daily active visitors grow enough that a cost model shows it pays.

**F2. Move from Pages to Workers static assets, M.**
- **Only** together with F1, or when cron or observability is needed. The `_headers`, `_redirects` and Speculation-Rules setup must be re-verified on Workers.

**F3. Web Push price alerts, L.**
- Needs F1/F2, VAPID keys, a subscription store and consent UX. It breaks "no server, nothing leaves your browser", so it needs an explicit owner decision.

**F4. Compression dictionaries, M.**
- Delta-compress `app.js` and `app.css` between versions. Today that needs origin logic (passthrough beta) and works only in Chrome/Edge.
- **Trigger:** Cloudflare manages dictionaries at the edge, or JS/CSS changes become frequent enough that repeat downloads matter.

---

## 5. Roadmap

| When | Items | Exit criteria |
| --- | --- | --- |
| **Now (next 2 weeks)** | C3 budgets ✅, C2 yield ✅, B3 freshness ✅, B5 robots ✅, E1 accessibility page ✅ (all shipped 2 Nov 2026), D1 (owner, open) | CI enforces budgets; RUM collecting; robots explicit |
| **Next (weeks 3–8)** | **B1 answer-first summaries**, **C1 worker feeds**, A4 logo pickers, D2 CrUX, D3 citations baseline | Every coin page has dated facts above the fold; steady-state main thread < 60 ms/s |
| **Then (months 2–4)** | B2 unique data modules, A1 pop-out ticker, A2 SharedWorker, A5 widget growth, C4 Lighthouse CI | No coin page shares > 60% of its text with another; embed domains growing month over month |
| **Gated** | B6 comparisons, B7 languages, E3 monetization, F1–F4 | Only when the stated trigger or data condition is met, and with owner approval |

Order rationale:
- B1 and C1 are the two highest-leverage items: findability and the live-data risk.
- Budgets come first so later work can't quietly undo current speed.

---

## 6. Decided against (and why)

| Idea | Why not |
| --- | --- |
| Price-prediction pages | Highest YMYL risk; contradicts "no advice"; spam-adjacent at scale |
| Mass programmatic pages (every pair, every fiat) | Thin-content risk; the self-improving rules forbid new URL families without review |
| FAQ schema for rich results | Rich result retired May 2026; keep FAQ text for readers only |
| Minify/bundle build step | 2–3 KB after Brotli; costs the "what's in the repo is what's deployed" property |
| JS framework / SPA | MPA + prerender + view transitions already give instant navigations; SPA adds INP risk and soft-nav measurement gaps |
| Third-party chart/analytics libraries | Each adds JS, CSP origins and privacy surface; current charts are tiny SVG |
| Chasing `llms.txt` variants | Little evidence crawlers use it; keep the one file current |

---

## 7. Measurement and review cadence

| Metric | Source | Target |
| --- | --- | --- |
| p75 LCP / INP / CLS (field) | Cloudflare RUM, CrUX | < 2.0 s / < 150 ms / < 0.05 |
| Lighthouse mobile, 10 page types | Monthly run (script in session notes) | ≥ 95 performance, 100 SEO |
| Steady-state main thread, home | CDP metrics script | < 60 ms/s after C1 |
| Coin-page impressions & avg. position | Search Console weekly digest | Up month over month; judged per the rules in SELF-IMPROVING.md |
| AI appearances / citations | GSC Search Appearance + D3 prompt set | Baseline in month 1, then growth |
| Embedding domains | Cloudflare referrers to /embed/ | Growing month over month |
| Accessibility | axe-core crawl (14 page types × 2 themes × 2 widths) | 0 violations |

**Cadence:**
- **Weekly:** the existing task, for data refresh and the SEO loop.
- **Monthly:** Lighthouse plus the citation check, appended to `content/experiments.json` as observations.
- **Quarterly:** revisit this document and the triggers in §4F.

---

## 8. Risks

- **An exchange API changes or blocks browser access.**
  - Mitigation: three independent feeds, `check-live.mjs` alerts, F1 as a fallback plan.
  - Coinbase's `ws-feed` endpoint was current as of November 2026.
- **AI answers keep eroding clicks.** Mitigation: Pillar A, so users come for the live tool rather than a fact AI can restate.
- **Speed erodes through small additions.** Mitigation: C3 budgets and C4 Lighthouse CI.
- **Logos for shared tickers point at the wrong project.** Mitigation: the contact-sheet review in `scripts/build-coin-icons.mjs` and the `EXCLUDE` list. Re-check whenever coins are added.
- **Speculation rules cost bandwidth on metered connections.** Browsers skip them under Save-Data and battery saver; the eagerness stays "moderate".

---

## Sources

- Search and AI answers:
  - [Google AI Search Shift Report (Tank)](https://tank.co.uk/the-google-ai-search-shift-report)
  - [AI Overviews traffic 2026 (SEO Kreativ)](https://www.seo-kreativ.de/en/blog/google-ai-overviews-updates-2026-en/)
  - [AI Overviews (Wikipedia)](https://en.wikipedia.org/wiki/AI_Overviews)
  - [Nov 2026 webmaster report (SER)](https://www.seroundtable.com/november-2026-google-webmaster-report-42431.html)
  - [AI SEO statistics 2026](https://www.goodfirms.co/resources/seo-statistics-ai-search-rankings-zero-click-trends)
- Citation research:
  - [Diagnosing citation failures in GEO (arXiv 2603.09296)](https://arxiv.org/pdf/2603.09296)
  - [GEO critical survey (arXiv 2607.14035)](https://arxiv.org/pdf/2607.14035)
  - [GEO guide (Kickads)](https://www.kickads.co/en/generative-engine-optimization)
  - [AEO guide (Frase)](https://www.frase.io/blog/what-is-answer-engine-optimization-the-complete-guide-to-getting-cited-by-ai)
- Core Web Vitals:
  - [CrUX release notes](https://developer.chrome.com/docs/crux/release-notes/?hl=en)
  - [Experimental soft-navigation metrics in CrUX (web.dev)](https://web.dev/blog/crux-experimental-soft-navs/)
- Structured data:
  - [Google drops FAQ rich results (SEJ)](https://www.searchenginejournal.com/google-drops-faq-rich-results/574429/)
  - [FAQ rich results deprecated (jsonld.com)](https://jsonld.com/google-faq-rich-results-deprecated/)
- Platform features:
  - [Customizable select (Chrome)](https://developer.chrome.com/blog/a-customizable-select)
  - [Branded select styling (Chrome)](https://developer.chrome.com/docs/modern-web-guidance/guides/forms/branded-select-styling)
  - [scheduler.yield (Chrome)](https://developer.chrome.com/blog/use-scheduler-yield?hl=zh_tw)
  - [Document PiP use cases (Chrome)](https://developer.chrome.com/blog/document-pip-use-case)
  - [Compression dictionary transport (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Compression_dictionary_transport)
  - [Cloudflare shared dictionaries beta](https://developers.cloudflare.com/changelog/post/2026-04-30-shared-dictionaries-passthrough-beta/)
  - [Prerender pages (Chrome)](https://developer.chrome.com/docs/web-platform/prerender-pages)
  - [Speculation-Rules header (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Speculation-Rules)
  - [Cross-document view transitions (Chrome)](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)
- Cloudflare:
  - [Pages vs Workers 2026](https://mecanik.dev/en/posts/cloudflare-pages-vs-workers-which-to-use-in-2026/)
  - [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
  - [Durable Objects WebSockets best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/index.md)
- Data feeds:
  - [Coinbase Exchange WebSocket overview](https://docs.cdp.coinbase.com/exchange/websocket-feed/overview)
- Crypto SEO:
  - [Crypto SEO 2026 (MadX)](https://www.madx.digital/learn/seo-for-crypto)
  - [Programmatic SEO for crypto](https://crypto-seo.net/articles/programmatic-seo-for-crypto-is/)
- Regulation:
  - [EAA briefing (Clifford Chance, May 2026)](https://www.cliffordchance.com/briefings/2026/05/bridging-the-accessibility-gap-the-strategic-imperative-of-the-european-accessibility-act.html)
  - [EAA requirements (accessibility.works)](https://www.accessibility.works/european-accessibility-act/)
