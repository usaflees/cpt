# News block and monetization: strategy and roadmap

Written 2 November 2026. It extends `docs/STRATEGY.md`, whose rules still apply: speed budgets,
honest freshness, no price predictions, and nothing that tracks visitors without consent.

**The approach in one line:** build the news block for readers and search first, with original,
data-driven briefs plus properly licensed headlines. Then earn money in the order that protects
speed, trust and legal safety:
1. house promotions;
2. one direct sponsor;
3. a crypto ad network on news pages only;
4. AdSense, only if it beats the alternatives.

**Contents:** 1 What the research says · 2 The news block · 3 Architecture · 4 SEO specifics ·
5 Monetization options · 6 Ad placement rules · 7 Legal and policy gates · 8 Roadmap ·
9 Owner decisions · 10 Answer: the sitemap date · Sources

---

## 1. What the research says

**Google News and Top Stories**
- There's no application to get into Google News or Top Stories; publishers are considered automatically if they meet Google's News content policies.
- AMP is no longer required.
- `NewsArticle` structured data is recommended but not required.
- News sitemaps speed up discovery of fresh articles but aren't an eligibility gate.
- The content policies require transparency, and sponsored content must be disclosed.

**Spam policies**
- *Scaled content abuse*: mass-produced, low-value pages, whether made by AI or not, have been the main target of the 2026 core and spam updates.
- Google judges usefulness, not how content was produced. Rewritten or scraped news at scale is exactly what it demotes.
- *Site reputation abuse* targets third-party or sponsored content published to ride on a host site's rankings.

**AdSense**
- Crypto as a topic isn't an automatic rejection. Sites still need original content and transparent ownership.
- **Consent:** for personalized ads to visitors in the EEA and UK (since 16 Jan 2024) and Switzerland (since 31 Jul 2024), Google requires a **Google-certified consent tool (CMP) integrated with the IAB TCF**. Without one, only limited ads serve there.
- Google's own "Privacy & messaging" consent message is certified.
- **Our current banner (`assets/consent.js`) is not a TCF CMP.** It's fine for analytics only.

**Google Ads crypto policy (the advertiser side)**
- Exchanges and wallets may advertise only where they hold local licences and Google certification; the list of allowed countries expanded in Aug and Oct 2026.
- Aggregators, affiliate sites and broker reviews are restricted as advertisers.
- **Effect for us:** AdSense on a crypto site fills mostly with general finance ads, not exchange ads.

**Crypto ad networks**
- Coinzilla, Bitmedia, HypeLab and A-Ads quote roughly $1–15 eCPM on US traffic. These are vendor figures, not independent benchmarks.
- A higher price with partial fill can beat cheap 100% fill.
- Some networks only accept high-engagement sites.

**UK (FCA)**
- Since October 2023, crypto promotions to UK consumers must come from authorised or registered firms, or be approved by one.
- The FCA issued 1,500+ alerts in the regime's first year and began enforcement proceedings in February 2026. The approver route changes in 2026–27.
- **Effect for us:** any crypto ad, sponsor or affiliate link shown to UK visitors is a regulated promotion.

**Disclosure**
- Paid links get `rel="sponsored"` (Google).
- Sponsored content is labelled clearly, e.g. "Sponsored" or "Advertisement" (FTC native-advertising guidance). Vague labels like "More from the web" count as deceptive.

**Ads and Core Web Vitals**
- Reserve every ad slot's space (CSS `min-height`, sized for the largest creative), lazy-load slots below the fold, and keep the placeholder when a slot doesn't fill.
- Lab tests miss ad-caused layout shift, so trust field data.

---

## 2. The news block: what to build

Three layers, in this order of SEO value:

| Layer | What it is | Indexed? | Why |
| --- | --- | --- | --- |
| **A. Daily market brief** (original) | One short article per day written from *our own data*: biggest movers, sector moves, volatility, notable 52-week highs and lows, cross-exchange spreads. Each figure links to its coin page. | **Yes**: `/news/YYYY-MM-DD-<slug>/` | Unique data nobody else has; it feeds Top Stories and Discover and gives AI answers dated facts to cite. It's the only layer that builds rankings. |
| **B. Latest headlines** (curated, licensed) | 5–10 headlines from licensed sources (title, source, time, link out). Shown on the home page, the `/news/` hub and filtered by ticker on each coin page. | Shown on indexed pages, but never one page per headline | Freshness and return visits; makes coin pages more useful. Aggregation alone adds no ranking value, and copying text would be scaled content abuse. |
| **C. Weekly sector recap** | A longer weekly piece per sector, built from the weekly stats refresh | Yes | Deeper and more evergreen; links into the sector hubs |

**Editorial rules (written into the news template and lint):**
- **No price predictions,** no "should you buy", no advice.
- **Every number** has an "as of" time and a source.
- **Automation is disclosed.** For example: "Compiled automatically from exchange data; reviewed by the editor".
- **Human review before publishing,** for the first 8 weeks at least. Use a PR per brief, like the SEO loop.
- **A brief only publishes when the data has a story** (e.g. a move of at least 5%, or a sector divergence). Quiet days get one line on the hub, not a thin page.
- **Corrections** are made in place, with a visible "Updated" note.
- **Headlines** never reproduce article text or images. Title and link only, unless a licence allows more.

---

## 3. Architecture (fits the static site; one new moving part)

**Daily briefs** (layer A):
- Generated by a script (`scripts/build-news.mjs`) from data we already fetch (`content/coin-stats.json` plus a daily movers snapshot).
- A scheduled GitHub Action opens a PR each morning, the owner merges, and Cloudflare deploys.
- That's about 30 deploys a month, well within Pages limits.
- Static HTML means zero runtime cost, and crawlers see everything.

**Headlines** (layer B) **need fresh data without a deploy per update:**

| Option | How it works | Verdict |
| --- | --- | --- |
| Commit `news.json` hourly | GitHub Action → commit → Pages deploy | **No:** about 720 deploys a month exceeds the Pages build quota and floods git history |
| Visitors' browsers call the news API | Fetch in the page | **No:** exposes the API key, rate limits per visitor, needs CSP changes for a third party |
| **Cloudflare Worker cron + KV** | A Worker fetches licensed feeds every 10–15 minutes, cleans them (title, source, time, link, tickers) and stores the result in KV. `/api/news.json` serves it with a 5-minute edge cache, from our own origin, so the CSP doesn't change. | **Yes.** This is the "F2 trigger" in STRATEGY.md: the first real reason to add Workers. Free tier: cron triggers plus 100k KV reads a day |

**In the page:**
- The headline block renders after the page loads (same pattern as GTM), with a fixed-height placeholder so it can't cause layout shift.
- Without JavaScript, the hub page shows the last headlines that were built into it.

**Sources to license** (verify terms before use; most publisher RSS feeds are for personal, non-commercial use):
- CryptoPanic API, a paid tier with a commercial licence;
- the CoinMarketCap or CoinGecko news APIs on a commercial plan;
- direct permission from 2–3 publishers, for example in exchange for a link.

**Budget:** add `/api/news.json` (same origin) and the news hub HTML to the `seo-lint` page budgets. No new CSP origins.

---

## 4. SEO specifics

- **URLs:**
  - `/news/` is the hub: today's brief, the last 7 briefs, live headlines and links to sectors.
  - `/news/2026-11-03-bitcoin-holds-77k-as-ai-tokens-slide/` is a brief. Use a date-led slug, and keep URLs stable.
- **Structured data:** `NewsArticle` with:
  - `headline` (110 characters or fewer), `datePublished`, `dateModified`;
  - `author` (Organization, or a named editor with an author page);
  - `publisher` with its logo;
  - an `image` at least 1200 px wide in 16:9, 4:3 and 1:1, generated like the OG cards;
  - `about`, which lists the coins mentioned.
- **News sitemap:** `sitemap-news.xml` lists only briefs from the last 2 days. The normal sitemap keeps every brief, with `lastmod` equal to its real modified date.
- **IndexNow ping on publish.** `scripts/indexnow.mjs` already exists.
- **Trust pages,** which Google's News policies and YMYL expect:
  - a masthead/editorial page (who runs the site, how briefs are made, the AI-assistance disclosure, a corrections policy, a contact route);
  - linked from every article with `publishingPrinciples` in the structured data.
- **Internal links:** brief → coin pages and sector hubs; coin page → its latest brief mention. This builds topical authority without new thin URLs.
- **Discover:** large images (`max-image-preview:large` is already on the home page), clear headlines, no clickbait.
- **Measure:**
  - Search Console's News and Discover reports, and the "AI Mode" and "AI Overviews" appearance filters;
  - the citation prompt set (STRATEGY D3), with "bitcoin price today news" style prompts added.

---

## 5. Monetization options, ranked for this site

| # | Option | Revenue potential | Speed, privacy and brand cost | Legal exposure | Fit |
| --- | --- | --- | --- | --- | --- |
| 1 | **House promotions** (widgets, brand kit, newsletter) | Indirect | None | None | Start now; it proves the slots work |
| 2 | **Direct sponsorship.** One sponsor per placement, e.g. "Live prices supported by X" in the footer, a sponsored sector page or a newsletter slot. A static image plus a `rel="sponsored"` link: no third-party script. | Medium (flat monthly fee; quote using $5–15 CPM equivalents) | Very low: no tracking and no CSP change | Medium: if the sponsor is a crypto firm, the promotion must be FCA-compliant for UK visitors and MiCA-consistent for the EU | **Best fit** |
| 3 | **Newsletter** (daily or weekly brief by email, with a sponsor slot) | Medium–high per subscriber | Needs an email provider (a new processor; update privacy text) | Same as #2 | Strong once there's an audience |
| 4 | **Crypto ad network** (HypeLab, Coinzilla, Bitmedia, A-Ads) on `/news/` only | Low–medium ($1–15 eCPM, vendor figures) | Third-party script, CSP origins and some layout-shift risk; ad quality varies, including scam risk | **High:** crypto ads shown to UK visitors are financial promotions. Geo-exclude the UK or require compliant advertisers | Test only, after a traffic gate |
| 5 | **Google AdSense** on news and content pages | Low–medium (crypto advertisers are restricted, so fill is mostly general finance) | Heavy JS, several Google ad domains in the CSP, layout-shift management, and **a switch to a Google-certified TCF consent tool** for EEA/UK/CH | Lower than #4 (Google screens advertisers) | Last; only if it beats #2–4 and Core Web Vitals stay green |
| 6 | **Exchange affiliate links** | Potentially highest per user | Low tech cost | **Highest:** FCA and MiCA promotion rules; brand conflict ("no ads", "no paid placements") | Not recommended without legal sign-off |
| 7 | **Widget Pro** (no credit link, custom themes, more coins) | Low–medium, recurring | Needs payments, so a Worker plus a payment provider | Low | Good later product line |

---

## 6. Ad and sponsor placement rules (protect Core Web Vitals and trust)

1. **Never inside the price table, the heatmap, the converter result or the widgets.**
   - Ads next to live prices invite accidental clicks and damage trust. In widgets they'd appear on other people's sites.
2. **Placement limits:**
   - at most one slot above the fold on mobile, and never above the H1;
   - none in the first screen of a coin page.
3. **Reserved space for every slot:** fixed `min-height` per breakpoint, sized for the largest creative. An unfilled slot shows a house promotion instead of collapsing.
4. **Below-the-fold slots load when near the viewport** (IntersectionObserver), after the page's load event, like GTM.
5. **Labelling:**
   - "Sponsored" or "Advertisement", visible and not disguised;
   - links use `rel="sponsored noopener"`;
   - sponsored articles, if ever published, carry `rel="sponsored"` and are excluded from the news sitemap.
6. **Guardrails in CI.**
   - The `seo-lint` budgets stay.
   - Ad origins get added to the allowlist one by one, with a reason.
   - Lighthouse checks on 3 pages must stay at 90 or above.
   - If field CLS rises above 0.1 or INP above 200 ms, ads come off that template.

---

## 7. Legal and policy gates (before the first paid placement)

| Gate | What's needed |
| --- | --- |
| **UK crypto promotions** | Any crypto sponsor, ad network or affiliate link shown to UK visitors needs either: an FCA-authorised or registered advertiser (or an approved promotion) with the required risk warnings; *or* those placements hidden from UK visitors. **Take legal advice.** |
| **EU (MiCA)** | Crypto-asset marketing must be identifiable as marketing, fair and consistent with the white paper. Sponsors offering crypto services should be licensed CASPs. Take legal advice. |
| **Consent** | AdSense or ad networks in the EEA/UK/CH need a TCF-certified CMP (Google's Privacy & messaging is certified), replacing or extending `assets/consent.js`. Direct static sponsors don't need ad consent. |
| **Privacy text** | Update the About/Privacy page for each new processor (email provider, ad network). |
| **"No ads" claims** | Rewrite them before the first ad or sponsor goes live:<br>• the home hero ("No login, no ads");<br>• the FAQ;<br>• the meta and OG descriptions on the home page;<br>• the About intro ("no paid placements");<br>• `llms.txt` ("ad-free");<br>• the brand kit.<br>A sponsor-only model can honestly say "no ad networks, no ad tracking". |
| **Taxes and contracts** | Sponsor contract template: placement, dates, labelling, no editorial control, the right to refuse, and payment terms. |

---

## 8. Roadmap

| Phase | When | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| **0. Foundations** | Now | GA4 tag published in GTM (owner); Search Console verified; masthead/editorial page; news template and NewsArticle schema; `build-news.mjs` (brief generator, dry run) | First brief drafted from real data and reviewed |
| **1. Briefs live** | Weeks 1–4 | Daily brief PRs (human-reviewed); `/news/` hub; `sitemap-news.xml`; IndexNow on publish; internal links from briefs to coins | 20+ briefs; news impressions appear in Search Console |
| **2. Headlines** | Weeks 3–6 | Licensed source chosen; Worker cron + KV + `/api/news.json`; headline block on home, hub and coin pages | Block loads after the page with zero layout shift; Core Web Vitals unchanged |
| **3. House slots** | Weeks 4–8 | Reserved sponsor slots (footer, hub, newsletter) showing house promotions; GA4 events for slot views and clicks | Slot click-through measured; no Core Web Vitals regression |
| **4. First sponsor** | Gate: about 25k+ monthly pageviews *or* inbound interest | Rate card (per slot per month); one direct sponsor; UK/EU compliance checked | Sponsor live, labelled, `rel="sponsored"`; privacy and claims updated |
| **5. Network test** | Gate: about 50k+ monthly pageviews | 30-day A/B test of a crypto ad network on `/news/` only, with the UK geo-excluded for crypto promotions, against sponsor RPM | Keep only if RPM beats house/sponsor, field CLS stays under 0.1 and INP under 200 ms |
| **6. AdSense (optional)** | Gate: phase 5 inconclusive, consent tool chosen | Certified TCF CMP; AdSense on news pages; CSP and budget updates | Same keep/kill rule as phase 5 |

**KPIs:**
- briefs published;
- Search Console news and Discover clicks;
- returning users (GA4);
- citations in AI answers;
- RPM per 1,000 pageviews;
- field LCP, INP and CLS (must stay green).

---

## 9. Decisions only the owner can make

1. **Editor of record:** your name, or the site's name, on the masthead and articles. Named people raise trust for YMYL topics.
2. **Headline source and budget:** e.g. a CryptoPanic commercial tier or a CoinGecko or CoinMarketCap news plan.
3. **Workers:** whether to add a Cloudflare Worker for the headline cache. It's free at our scale, but it's a new component.
4. **Monetization model and "no ads" positioning:** the sponsor-first path is recommended.
5. **UK and EU:** whether crypto sponsors are allowed at all, or kept out of the UK and EU, pending legal advice.

---

## 10. Answer: why the sitemap said 30 October

- The sitemap's `lastmod` for coin, sector, home, converter and heatmap pages is **the date of the last market-data refresh**, which was 30 October. Hand-written pages (about, widgets, brand, accessibility) use their own content-change date.
- The refresh is normally done by the weekly scheduled task.
- On 2 November we ran it by hand:
  - supplies and seed prices came from CoinLore and the exchanges;
  - performance stats run through the 1 November daily close;
  - every page's `lastmod` is now 2 November.
- It also exposed a bug: the asset cache-busting (`?v=` hashes) made every data refresh look like a code change to `scripts/classify-change.mjs`, which would have stopped the weekly task from auto-merging. That's fixed: pure hash re-stamps now count as data.
- **Keep the dates honest.** Moving `lastmod` without a real change is a known spam signal, so the daily briefs (phase 1) are the legitimate way to show daily freshness.

---

## Sources

- **Google News / Top Stories:**
  - [Google News SEO (Patrick Stox)](https://patrickstox.com/technical-seo/news-seo/google-news-seo/)
  - [NewsArticle schema guide](https://schemavalidator.org/guides/news-article-schema-markup)
  - [News SEO and Top Stories](https://seohandbook.co.uk/search-surfaces/news-seo-top-stories/)
  - [Coywolf Google News guide](https://coywolf.com/guides/how-to-get-into-google-news/)
- **Spam policies:**
  - [Scaled content abuse explained](https://ppc.land/scaled-content-abuse/)
  - [June 2026 spam update](https://cliquestudios.com/university/resources/google-june-2026-spam-update)
  - [Scaled content abuse in the March update](https://www.digitalapplied.com/blog/scaled-content-abuse-google-march-update-ai-pages-decimated)
- **Google Ads crypto policy:**
  - [Cryptocurrencies and related products policy](https://support.google.com/adspolicy/answer/14009787?hl=en)
  - [Oct 2026 update](https://support.google.com/adspolicy/answer/18785604?hl=en)
  - [Aug 2026 update](https://support.google.com/adspolicy/answer/17264747)
- **AdSense and consent:**
  - [AdSense for crypto content (secondary)](https://adsenseaudit.net/guides/adsense-approval-crypto-finance-content)
  - [Google: European regulations / certified CMP](https://support.google.com/admanager/answer/13554116)
  - [Google AdSense help 13554020](https://support.google.com/adsense/answer/13554020?hl=en)
  - [Sourcepoint on the CMP requirement](https://sourcepoint.com/blog/google-to-require-that-publisher-partners-use-google-certified-cmp-for-eea-uk/)
- **Crypto ad networks:**
  - [HypeLab: how crypto publishers choose a network](https://www.hypelab.com/blog/how-crypto-publishers-choose-ad-network)
  - [Top crypto ad networks 2026](https://coinbound.io/top-crypto-ad-networks)
  - [Bitmedia vs Coinzilla](https://bitmedia.io/blog/bitmedia-vs-coinzilla)
- **UK FCA:**
  - [FCA: back-end crypto promotions rules](https://www.fca.org.uk/publications/good-and-poor-practice/assessing-compliance-back-end-cryptoasset-financial-promotions-rules)
  - [FCA: 146 alerts in 24 hours](https://www.fca.org.uk/news/statements/fca-issues-146-alerts-first-24-hours-new-crypto-marketing-regime)
  - [Norton Rose Fulbright on s.21 (Mar 2026)](https://www.nortonrosefulbright.com/en/inside-fintech/blog/2026/03/cryptoasset-financial-promotions-fca-sets-out-information-on-authorised-firms-services-under-s21)
- **Disclosure:**
  - [Ahrefs: sponsored link attribute](https://ahrefs.com/seo/glossary/sponsored-link-attribute)
  - [Katten on FTC native-ad guidance](https://katten.com/FTC-Issues-Much-Anticipated-Guidance-Regarding-Native-Advertising)
- **Ads and Core Web Vitals:**
  - [Ads and Core Web Vitals (PubPerf)](https://www.pubperf.com/blog/ads-core-web-vitals-guide)
  - [Fix ads and iframes for CLS (Unlighthouse)](https://unlighthouse.dev/learn-lighthouse/cls/ads-embeds-iframes)
