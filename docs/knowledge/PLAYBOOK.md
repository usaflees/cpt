# Playbook: what works for this site

The roadmap (what to build next and in which order) is [../STRATEGY.md](../STRATEGY.md); this file holds the rules
for doing it well.

Consolidated from the research notes in [research/](research/README.md) (Oct 30 and Nov 2, 2026) and from what we
measured while building the site. Status: ✅ in place · 👤 owner action · 🔜 good next step · ⛔ don't.
Bracketed codes point to the research file: [SEO] seo-tactics-2026, [EXP] seo-experimentation, [DATA]
search-data-sources, [ANA] onsite-analytics, [SEC] pipeline-security-hosting, [AGENT] ai-agent-loop,
[GROW] growth-launch, [LOOP] self-improving-loop-report, [NEW] 2026-11-02-opus-5-5-and-search-news.

## 1. Indexing and technical SEO
- ✅ Real `404.html` so unknown URLs return 404, not a copy of the home page (Cloudflare Pages' SPA fallback). [SEO]
- ✅ `robots.txt`, `sitemap.xml` (128 URLs), canonical in the initial HTML, plain `<a href>` links. Google renders a
  page once and indexes that snapshot; links and canonicals must not depend on JavaScript. [SEO]
- ✅ Live WebSocket prices are probably not indexed, so every page also ships a **static snapshot** in its HTML:
  computed performance stats, monthly closes, seeded converter tables, sector tables. [SEO]
- ✅ Sitemap `lastmod` changes only when visible content changes (it uses the data date). Google warns against
  bumping dates to look fresh. [SEO][EXP]
- ✅ JSON-LD: WebSite, Organization, WebPage/CollectionPage/WebApplication and BreadcrumbList. These are still
  supported and cheap. [EXP]
- ✅ IndexNow after each deploy with only the URLs whose HTML changed (`node scripts/indexnow.mjs <old-main-sha>`).
  Bing, Yandex, Seznam, Naver and others use it; **Google does not** (it reads the sitemap). [DATA]
- 👤 Search Console Domain property, submit the sitemap, Request Indexing only for a few key pages (home,
  /heatmap/, /convert/, /widgets/). Bing Webmaster Tools can import from Search Console. [SEO]
- ⛔ Re-requesting indexing repeatedly, faking freshness dates, `noindex` on pages you want found.

## 2. Content quality (the main ranking risk)
Crypto prices are "Your Money or Your Life" content, and 114 templated coin pages sit close to what Google's
scaled-content policy describes. Google's John Mueller said in September 2026 that low-value programmatic pages can hold
a whole site back for a long time. [SEO]
- ✅ Each coin page has data-derived facts nobody else phrases the same way: 7/30/90-day and 1-year change, 52-week
  range with dates, 30-day volatility, monthly closes, per-exchange prices and spread, converter tables. [SEO][EXP]
- ✅ Sector hubs (9) with performance tables; breadcrumbs from every coin to its sector; related-coin links.
- ✅ Trust pages: About and methodology, data sources, AI-assistance disclosure, contact via GitHub issues,
  "not financial advice" on every page. No invented author profiles. [SEO]
- 🔜 Static per-exchange spread snapshot and all-time-high/drawdown figures in the HTML (needs a reliable ATH source).
- ⛔ AI-written filler paragraphs; near-duplicate page families ("price in every currency", "price prediction
  2030"); fake authors or reviews. Google's spam policies (May 2026) also cover attempts to manipulate AI answers,
  and Anthropic's usage policy (effective Nov 12, 2026) bars using Claude for that. [SEO][NEW]

## 3. Titles, descriptions and structured data
- ✅ Titles ≤60 characters, descriptions ≤160, unique, no live prices or dates (Google says it drops fast-changing
  prices from titles). `scripts/seo-lint.mjs` enforces this. [SEO][EXP]
- ✅ Google keeps the page's own title about 87% of the time by its count; independent studies measure 33–76%
  rewrites. Write titles for people, then leave them alone. [EXP]
- ⛔ FAQ markup (no FAQ rich results since May 7, 2026), HowTo, Dataset (Google Search stopped using it in
  Nov 2025), Product markup on coins, keyword lists. [EXP]
- ⛔ `llms.txt` or special markup for AI features: Google says no extra optimisation is needed and ignores them
  (we keep a small `llms.txt` for other tools; it costs nothing). [SEO]

## 4. Performance (Core Web Vitals)
Targets: LCP ≤ 2.5 s, INP < 200 ms, CLS < 0.1. Current numbers are in [STATE.md](STATE.md).
Techniques that measurably worked here:
- ✅ **Reserve space for anything JavaScript fills in** (ticker tape height, placeholder mover cards in the HTML,
  table min-height until rows render, fixed chart box). This took home-page CLS from 0.832 to 0.003.
- ✅ **Never use opacity on the largest element.** The coin price was dimmed with opacity until live data arrived,
  which delayed LCP to the first tick (~2.2 s). Muting it with colour instead: ~1.0 s.
- ✅ **No forced layout per update.** Restart CSS flash animations by switching between two identical keyframes
  instead of `void el.offsetWidth` (that alone cost ~570 ms of main thread at startup).
- ✅ Reuse `Intl.NumberFormat` instances; skip DOM writes whose value didn't change; redraw slow-moving charts at
  most every 10 s; cache element lookups that run on every tick.
- ✅ Subscribe only to the coins a page shows (WebSocket traffic −75% on home, −95% in widgets); Binance REST
  `type=MINI` with a symbol list instead of the full 285 KB ticker.
- ✅ Preload CSS, defer scripts, no web fonts, per-coin JPEG share images.
- ✅ Content-hashed asset URLs (`/assets/app.js?v=…`) stamped by the build, with long-lived caching; the theme
  script is inlined (allowed by its CSP hash); speculation rules prerender likely next pages (PRs #2–#3). Validate
  `speculation-rules.json` by loading a page and reading Chrome's console: an invalid rule is silently ignored.
- ✅ Performance budgets in `seo-lint` (app.js 115 KB, app.css 80 KB, coins.js 25 KB, consent.js 6 KB raw,
  60 KB HTML per page) and an allowlist of third-party origins in the CSP. Raise a budget only on purpose, in the
  same PR, with the reason.
- 🔜 Field data (CrUX) once the site passes Google's popularity threshold; until then "not found" is expected. [ANA]
- Lighthouse's simulated LCP can stay high (2.7 s on coin pages) even when real throttled loads paint at ~1.0 s;
  trust field data and real measurements over the simulation.

## 5. Accessibility and ease of use
- ✅ axe-core: 0 violations on every page type, dark and light themes (`bash tests/run.sh`).
- ✅ One type scale: page H1 38 px (25 on phones), section H2 18 px, H3 15 px, body prose 14.5 px with a
  72-character line length, nothing below 12 px (Lighthouse's legibility threshold).
- ✅ Touch targets ≥ 38 px on phones; link lists as tap-sized pills; no horizontal scrolling at 375 px.
- ✅ Accessible names start with the visible text (voice control); combobox pattern for search; dialogs with focus
  return; `prefers-reduced-motion`; colour contrast checked per theme.
- ✅ First visit follows the device's light/dark setting; a saved choice wins; widgets keep their own theme.
- ✅ Honest placeholders: no fake sparklines from 2–3 ticks, "—" until real data, dimmed snapshot prices.
- 🔜 Heatmap's smallest boxes are under the 24 px target size (inherent to a treemap); accept, or hide links on
  boxes under 24 px.

## 6. Growth and links
- ✅ Free embeddable widget with a **brand-only, optional** credit link. Google's link-spam policy names
  keyword-rich links in widgets and links required by terms of use. [SEO][GROW]
- ✅ Shareable tools with their own share images: live heatmap, converter, sector tables.
- 👤 Launch posts in the owner's own words, following each venue's self-promotion rules
  ([LAUNCH-KIT.md](../LAUNCH-KIT.md)). Generated-looking posts get removed. [GROW]
- 🔜 Original data posts (for example "which sectors moved most this month", built from the sector tables) are the
  most linkable content a data site can produce. [GROW]
- Google's "preferred sources" now also applies in AI Mode and AI Overviews (usage grew 7× in 2026), but it is
  aimed at news sources; low value for a price site. [NEW]
- Decision: don't set the new shared AI-training opt-out in robots.txt (`__usage_ai-training`, announced
  Oct 30, 2026; Google support planned for 2027). Being cited in AI answers is visibility we want. [NEW]

## 7. Measurement and the self-improving loop
Rules in [../SELF-IMPROVING.md](../SELF-IMPROVING.md); evidence in [LOOP] and [EXP].
- ✅ The AI never holds credentials or reads raw search queries: a non-AI Apps Script collector writes a sanitized,
  page-level digest to the private telemetry repo. [LOOP][SEC][AGENT]
- ✅ Analyse weekly, ship SEO changes at most monthly, at most 2 coins per batch, 28-day cooldown per page,
  experiment logged before the change ships. [EXP]
- ✅ Candidate score = impressions × (site's own expected CTR at that position − current CTR), with ≥ 100
  impressions in 28 days. "Striking distance" (positions 8–20) alone is folklore: positions 4–10 get only
  0.5–1.7% of desktop clicks. [EXP][DATA]
- ✅ Search Console: `rowLimit 25000` with pagination (rows are sorted by clicks, so a low cap drops exactly the
  rows you want), one finalized day per night, page-only query for totals, impression-weighted position. [DATA]
- Expect "inconclusive": the site is far below published minimums for SEO split tests (~1,000 organic visits a
  day). Judge on impressions and position first; compare against unchanged coins. [EXP]
- Data delays: Search Console final data lags 2–3 days; title changes show in days to weeks. Measure ≥ 14 days for
  titles/descriptions, ≥ 28 days for content. [EXP][DATA]
- ✅ Google Tag Manager + GA4 load only through `assets/consent.js` behind a consent banner (owner decision,
  Nov 2, 2026, PR #7). This supersedes the Oct 30 research advice to skip GA4 [ANA]; keep it consent-gated, keep
  "Cookie settings" in the footer, and keep the CSP origins in seo-lint's allowlist.
- 👤 Cloudflare Web Analytics on (choose "Enable globally" vs "Exclude EU" deliberately) for cookieless field
  data and Core Web Vitals (STRATEGY D1). [ANA]
- 👤 Bing Webmaster Tools: its AI Performance report now groups the queries a site is cited for in Copilot answers
  into topics (Oct 13, 2026). [NEW]

## 8. Security and hosting
- ✅ Strict CSP: no inline handlers, no inline scripts except the build-inlined theme script (allowed by its hash),
  everything wired through `data-action`; HSTS;
  `frame-ancestors *` only so widgets embed. [SEC]
- ✅ Public repo: nothing private is committed; the repo's working files return 404 on the site (`functions/_middleware.js`).
- ✅ Who can publish is written down in [ACCESS.md](ACCESS.md). Workflow rules are enforced by seo-lint (section 3c):
  SHA-pinned `actions/*` only, read-only tokens, no secrets, no privileged triggers, no expressions in shell scripts.
  The one job that can push (`data-refresh.yml` → `publish`) installs nothing and re-checks the patch it is given.
- 👤 Owner settings from ACCESS.md §3: ruleset on `main` (no deletion, no force-push), Actions limits, account 2FA.
- ✅ Agent guardrails: `claude/*` branches only, CI "Site checks" on every PR, `classify-change` auto-merges data
  refreshes only, forbidden-file list enforced on `claude/seo-*` branches, the agent edits JSON overrides, never
  HTML. [AGENT]
- Cloudflare Pages facts: free plan 500 builds a month; every branch gets a **public** preview URL; skip a build
  only with a prefix like `[CI Skip]` at the start of the commit message; no ignore file, so anything in the repo
  is downloadable. [SEC]
- ⛔ Service-account JSON keys in GitHub secrets, unpinned `npm install` in jobs that hold credentials, letting
  issues or comments in the public repo trigger an agent. [SEC][AGENT]

## 9. Working with Claude on this site
See [CLAUDE-OPUS-5-5.md](CLAUDE-OPUS-5-5.md). In short: give the whole task with a clear "done means…",
verify with `bash tests/run.sh`, use effort `medium` for routine work and `high`/`xhigh` for audits, redesigns and
debugging, and put rules that must never be broken in CI or hooks, not in prose.
