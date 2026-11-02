> **Research snapshot, 2026-10-30.** SEO testing at small scale: what can be measured, cadence, scoring. Sources are cited inline; facts may have changed since. Current decisions and status live in [../PLAYBOOK.md](../PLAYBOOK.md) and [../DECISIONS.md](../DECISIONS.md).

# SEO experimentation methodology for a small templated site (cryptopriceticker.com), as of late Oct 2026

Context: one home page plus 114 coin pages built from one HTML template by a script, static on Cloudflare Pages, young domain, low traffic. An AI agent proposes changes from Google Search Console (GSC) data. Research date: 2026-10-30.

---

## Q1. SEO split testing (page-group A/B testing): how it works, why user-level A/B tests don't apply, minimum requirements, and what ~100 pages with low clicks can detect

### Takeaway
SEO split tests randomize **pages**, not users. Similar templated pages are split into control and variant groups, only the variants are changed, and variant traffic is compared with a counterfactual built from the controls (difference-in-differences, CausalImpact/BSTS, or a forecasting model). Every reputable source sets the bar far above this site: hundreds to thousands of pages per group and roughly 1,000 organic sessions a day to the tested section (30k a month). Even the lowest figure anyone has published, about 3k a month, came from a vendor's own model. With ~57 pages per arm and low clicks, a true randomized split test can only detect very large effects. Treat it as a directional tool, not a precise measurement.

### Cited Findings
**Why user-level A/B tests don't work for SEO**
- Google's ranking is driven by what Googlebot sees, and you cannot show Googlebot two versions of one URL. SearchPilot: "you can't split Google bot. You can't show Google bot two different templates on the same page… We split pages, rather than users and it's template-based." — [SearchPilot, A Year of SEO Testing (2019)](https://www.searchpilot.com/resources/blog/a-year-of-seo-testing-with-searchpilot)
- Airbnb: user A/B tests have good power and full randomization for engagement and conversion, but they "cannot measure the impact of changes on external search engine rankings." Airbnb therefore made the **canonical URL** the unit of randomization, so "when a search engine bot scrapes our site, it will consistently see the same treatment for each page." It applied this across ~100,000 landing-page URLs. — [Airbnb Engineering, Experimentation & Measurement for SEO (2018)](https://medium.com/airbnb-engineering/experimentation-measurement-for-search-engine-optimization-b64136629760)
- SearchPilot's description of the method: "We don't split users, we split pages… Create statistically-similar buckets of control and variant pages. Create a forecast of expected traffic… Measure the organic traffic to the two buckets. Calculate whether any difference in traffic compared to the forecast is statistically significant." — [SearchPilot, How it works](https://www.searchpilot.com/what-we-do) (vendor page; used only for the methodology)
- SearchPilot builds its pre-period model from "usually about 100 days of data" for the control and variant groups. It uses organic traffic as the "North Star" and treats GSC CTR and rank data as secondary because GSC "is sparse, incorrect, or averaged." — [SearchPilot, What is SEO split testing](https://www.searchpilot.com/resources/blog/what-is-seo-split-testing)
- Bucketing caveat: "often a small number of pages can make up a large percentage of traffic, so you have to be careful to distribute your high-traffic pages evenly." — [SearchPilot, What is SEO split testing](https://www.searchpilot.com/resources/blog/what-is-seo-split-testing)

**Analysis methods**
- **Difference-in-differences (Airbnb):** a linear model on log(daily traffic per page) with treatment, post-period and treatment×post terms. The interaction coefficient is the incremental effect. Logging handles right skew and heteroskedasticity. — [Airbnb Engineering](https://medium.com/airbnb-engineering/experimentation-measurement-for-search-engine-optimization-b64136629760)
- **Simulation-based power analysis (Airbnb):** Airbnb randomly reassigned historical URLs to treatment and control, injected synthetic lifts, and counted how often the model detected them. Result: ≥80% power for effects of about **2% or more** with ~100k URLs. The test ran **three weeks**. Airbnb automated analysis of more than 20 experiments this way. — [Airbnb Engineering](https://medium.com/airbnb-engineering/experimentation-measurement-for-search-engine-optimization-b64136629760)
- **CausalImpact / Bayesian structural time series (Google research):** a "diffusion-regression state-space model that predicts the counterfactual market response that would have occurred had no intervention taken place." Compared with classical DiD it can "infer the temporal evolution of attributable impact," incorporate priors, and use contemporaneous covariates as synthetic controls. R package: CausalImpact. — [Brodersen et al., Google Research](https://research.google/pubs/inferring-causal-impact-using-bayesian-structural-time-series-models/)
- **Etsy (title-tag tests):** randomly assigned pages to groups and used **two control groups** for an A/A check. Because daily visits per page are volatile, it needed "relatively large groups of **1000 pages each**." Simple random sampling produced groups that differed significantly before the test, so Etsy switched to **stratified sampling**: rank pages by visits, split into n-tiles, randomize within each tile. Pre-period t-tests checked group balance. CausalImpact built a synthetic control from both control groups. Effects appeared "as soon as a few days after the experiment start date." The winner was then rolled out to all groups, and the gap between buckets disappeared, which validated the result. — [Etsy Code as Craft, SEO Title Tag Optimization](https://www.etsy.com/codeascraft/seo-title-tag-optimization)
- **Etsy follow-up (multivariate):** six treatments and two controls. Shorter title tags won again. Meta description changes produced statistically significant changes in visits. H1 changes were significant but "interact with changes in title tags in hard to predict ways." Etsy's caveat: results "are only true for Etsy and do not necessarily reflect best practices for sites generally." — [Etsy Code as Craft, Multivariate SEO testing (2025)](https://www.etsy.com/codeascraft/optimizing-meta-descriptions-h1s-and-title-tags-lessons-from-multivariate-seo-testing-at-etsy)
- **Pinterest (secondary source; the original Medium post failed to load):** Casey Winters described grouping similar pages (boards, pins), randomly sampling e.g. 10% of boards, making a crawlable change only in the enabled group, and running "for at least three weeks." He said that if you get "only 100 visits from Google per day, it might be a waste of time." — [Leveling Up podcast interview (2015)](https://www.levelingup.com/marketing/casey-winters-pinterest/). Original post: https://medium.com/pinterest-engineering/demystifying-seo-with-experiments-a183b325cf4c (not retrieved).

**Minimum traffic and page-count thresholds**
- SearchPilot rule of thumb: the tested section should get **≥1,000 organic sessions per day**, excluding the home page. Smaller sections can sometimes work "if the traffic is particularly smooth and predictable, but in general, the power of tests is too low." — [SearchPilot, 5 minimum requirements (2022)](https://www.searchpilot.com/resources/blog/before-you-begin-seo-testing). The same rule is quoted by Sam Nenzer in [Moz (2020)](https://moz.com/blog/when-to-seo-split-test).
- SearchPilot: "at least **hundreds of pages** on the same template and at least **30,000 organic sessions per month**." Some customers test sections with "a couple of thousand sessions per month, but the changes in traffic need to be much higher to be able to reach statistical significance." — [SearchPilot, What is SEO split testing](https://www.searchpilot.com/resources/blog/what-is-seo-split-testing)
- SearchPilot (2019) said its neural-network model "doubles" the sensitivity of its earlier CausalImpact-based model and allowed valid experiments on sections with "less than 10% of" 30k sessions a month (about 3k). — [SearchPilot, Doubled sensitivity](https://www.searchpilot.com/resources/blog/weve-doubled-the-sensitivity-of-our-seo-split-testing-platform). This is the vendor's own claim about a proprietary model and has not been independently verified.
- In a SearchPilot talk, a site with **60 sessions a day** was described as "never close to" what is needed. — [SearchPilot, A Year of SEO Testing](https://www.searchpilot.com/resources/blog/a-year-of-seo-testing-with-searchpilot)
- Practitioner guidance (lower quality, no derivation): "each group should have at least 15–20 pages" and tests should run at least 4 weeks. — [SGAIndex (2026)](https://sgaindex.com/articles/seo-ab-testing-framework-guide). The figure is not backed by a power analysis, so treat it as anecdotal.

### Inferences
- With 114 coin pages, a 50/50 split gives ~57 per arm. That is roughly 20x fewer than one Etsy group and about 1,750x fewer URLs than Airbnb. Since Airbnb's ~2% MDE relied on ~100k URLs, the detectable effect here will be **much** larger. Rough expectation: only effects of tens of percent, or 2x-type changes, on impressions are likely to be detectable within weeks, and smaller effects will look like noise. The way to check is to run the Airbnb approach: simulate placebo splits and injected lifts on this site's own GSC history.
- Traffic is heavily concentrated: BTC, ETH and a few large caps probably dominate impressions. Stratify on pre-period impressions (Etsy-style n-tiles) or use matched pairs (pair coins of similar impression rank and randomize within each pair). Otherwise one bucket may simply hold the big coins.
- The home page is one URL with different intent and should never be in a page-group test.
- A pragmatic design for this site: randomize matched pairs → change the variant half → analyze daily **impressions** (more data than clicks) per page with DiD on log(impressions+1), or with CausalImpact using the control group's daily total as the covariate. Run an A/A placebo first, applying the same pipeline with no change, to measure the false-positive rate.
- The ~10 to 20 page-group tests that Airbnb or Etsy run per year are not achievable here. Each test will tie up the whole template for weeks, so the agent has to batch hypotheses and test few things.

### Gaps
- I could not retrieve the original Pinterest post. Only a secondary interview summary is cited.
- No source publishes a minimum-detectable-effect table for ~100-page sites. The MDE for this site has to be simulated from its own data.
- No peer-reviewed study validates SEO split testing on small sites. The evidence comes from engineering blogs and vendors.

---

## Q2. Low-traffic alternative: before/after with comparison groups, impressions and position instead of clicks, minimum observation windows

### Takeaway
For a site this size, the realistic method is a **pre/post comparison against an untouched comparison group**, analyzed on impressions and impression-weighted position. In effect this is DiD or CausalImpact with a small control group. A plain before/after on all pages is the weakest design because seasonality, market news, core updates and SERP-feature changes (AI Overviews) are confounded with the change. Allow at least 2 to 3 days for GSC lag. Title and snippet changes typically show in 1 to 2 days but can take weeks to months. Plan 2 to 4 week post windows for snippet changes, and months for content or quality changes.

### Cited Findings
- SearchPilot calls before/after "by far" the most common method and says it is uncontrolled: "it will be impossible to detect small effects, and larger impacts can be caused by confounding effects (like seasonality)." — [SearchPilot, DIY SEO testing pitfalls](https://www.searchpilot.com/resources/blog/pitfalls-of-diy-seo-testing)
- Ahrefs advises against time-based tests on a single page because "it's unwise to assume causation with a sample size of one." — [Ahrefs, SEO Testing guide (2021)](https://ahrefs.com/blog/seo-testing)
- Sitebulb / Giulia Panozzo: pre-post testing suits smaller sites. Example: compare the 28 days before an H1 change with the 28 days after. Use CausalImpact to build a counterfactual. Long durations add risk from algorithm updates, competitors and seasonality. — [Sitebulb, SEO testing with low traffic](https://sitebulb.com/resources/guides/seo-testing-with-low-traffic-how-to-make-smart-calls-on-small-sites)
- SEOTesting.com suggests minimum windows of **2 weeks** for title and meta-description changes and **4 weeks** for content changes, because GSC data "is always at least 2 days behind." — [SEOTesting.com guide](https://seotesting.com/blog/seo-testing-guide) (vendor; heuristic, not derived)
- **GSC lag:** "collected data should be available in 2-3 days." The Performance report labels daily data in Pacific Time. The newest data can be "preliminary" and may change. — [Search Console Help, About Search Console data](https://support.google.com/webmasters/answer/96568?hl=en); [Troubleshooting data discrepancies](https://support.google.com/webmasters/answer/17010575?hl=en); [About the data](https://support.google.com/webmasters/answer/17011364?hl=en)
- **GSC data limits:** reports omit rare (anonymized) queries; tables show at most 1,000 rows; "match"/"does not match" filter totals may not add up. Average position "averages the position value for all impressions," and "a position number can mean different things in different situations… we recommend that you monitor change in position over time." — [GSC Help: impressions, position, clicks](https://support.google.com/webmasters/answer/7042828?hl=en); [Troubleshooting](https://support.google.com/webmasters/answer/17010575?hl=en)
- **Google timing ranges (Gary Illyes, Search Central Live Deep Dive Europe, Barcelona, 2 Oct 2026; from an attendee recap reported by SEJ):** new-URL discovery typically ~20h; **refresh of a known URL typically ~30 days**; sitemap processing ~24h; **title change 1–2 days typical, "several weeks to months" slowest**; snippet change the same; canonicalization change 1–3 weeks; core-update recovery 3–6 months. "Reported ranges are reference points, not deadlines." — [Search Engine Journal (Oct 2026)](https://www.searchenginejournal.com/google-crawling-indexing-recovery-timing-ranges/591829). This is secondary reporting of a talk, not Google documentation.
- Google core-updates doc: "some changes can take effect in a few days, but it could take several months for our systems to learn and confirm that the site as a whole is now producing helpful, reliable, people-first content." It also advises waiting until an update completes, then comparing a week before with a week after. — [Google, Core updates](https://developers.google.com/search/docs/appearance/core-updates)
- Google's A/B testing doc: frequently crawled sites get experiments and later updates indexed "fairly quickly." — [Google, Minimize A/B testing impact](https://developers.google.com/search/docs/crawling-indexing/website-testing)
- John Mueller: "Changing things like titles or headings on pages can result in changes in Search… changing the meta description on a page can result in changes with how the snippet of a page is shown." In other words, title edits can move rankings as well as CTR, in either direction. — [SEJ (2024)](https://www.searchenginejournal.com/google-says-title-tags-maybe-impact-rankings/525297)
- Google uses sitemap `<lastmod>` only "if it's consistently and verifiably… accurate," and it should reflect "the last significant update." Main content, structured data and links count as significant. A copyright date does not. — [Google, Build a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap); [Google blog (2023)](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping). Mueller: auto-bumping sitemap dates doesn't help SEO. — [SEJ (2025)](https://www.searchenginejournal.com/googles-john-mueller-updating-xml-sitemap-dates-doesnt-help-seo/545547/)
- Confounder: AI Overview prevalence and the CTR curve itself shifted sharply during 2025–26. AWR shows desktop position-1 CTR on AIO SERPs falling to 1.96% in April 2026 and recovering to 9.69% by July. — [AWR CTR study](https://www.advancedwebranking.com/seo/organic-ctr). A pre/post test without controls during such a period would attribute Google's UI changes to your edit.

### Inferences
- **Recommended design for this site.** For each experiment, hold out a randomly chosen, impression-matched set of coin pages as the comparison group. Compute log(impressions) DiD per page-day, or use CausalImpact with the control group's daily impressions as the regressor. Report impression-weighted average position and CTR as secondary metrics.
  - Use **impressions** as primary for ranking-oriented changes such as content, internal links and headings. Impressions are 10 to 100 times more plentiful than clicks.
  - Use **CTR at constant position** as primary for snippet changes (title, meta description). Compare CTR within position bands, because a title change can also move position.
- **Windows.**
  - Pre-period: at least 28 days, ideally 56 to 100 (SearchPilot uses ~100 days). GSC keeps 16 months, so start exporting daily page×query data to storage now.
  - Washout: skip days 0 to 3 after deploy, plus GSC lag. Confirm recrawl through URL Inspection or the server logs for Googlebot hits.
  - Post-period: at least 14 days for title and meta changes and at least 28 days for content, linking or structured-data changes. Fix the evaluation date in advance; peeking inflates false positives.
  - Use whole weeks so day-of-week effects cancel.
- **Freeze rule.** Don't change the same pages again while a test is open. Don't evaluate a test whose window overlaps a Google core or spam update; log update dates from the Search Status Dashboard.
- **Regression to the mean.** If the agent picks the pages with the worst recent CTR or position, they will tend to improve on their own. The control group must come from the same eligible pool, chosen randomly **after** that selection.
- A crypto price site faces strong exogenous shocks: BTC price moves, ETF and news cycles, and coin-specific events can multiply impressions for a single coin overnight. That makes untreated per-coin controls essential and argues for excluding or separately stratifying coins that have a news spike in the window.

### Gaps
- Google has no documentation stating how long to wait before measuring a title change. The 1–2 day figure comes from an attendee recap of a conference talk.
- I found no rigorous study of how much better a small-control-group pre/post design is than a plain before/after at ~100-page scale.

---

## Q3. Google's official guidance relevant to an AI repeatedly editing pages

### Takeaway
Google allows testing and changing pages, but it expects no cloaking (one version per URL for users and Googlebot), tests that run only as long as necessary, titles that are descriptive, unique and not boilerplate, honest dates and lastmod, and content that adds value rather than templated or AI text at scale. The biggest policy risk for 114 templated coin pages is **scaled content abuse** and thin or doorway-like pages: near-identical pages that differ only by coin name and price, padded with generic AI text. Title churn is a smaller risk. It is mostly measurement noise plus Google rewriting the title.

### Cited Findings
**Title links**
- Google builds title links automatically from the `<title>` element, the main visual title, H1 and other headings, `og:title`, other large and prominent text, anchor text on the page, text of links pointing to the page, and WebSite structured data. — [Google, Influencing title links](https://developers.google.com/search/docs/appearance/title-link)
- Best practices: a unique, descriptive `<title>` on every page. Avoid keyword stuffing. Avoid "repeated or boilerplate text," including "long text… that varies by only a single piece of information." Make the main title clear, because Google may use the first heading when several prominent headings exist. Brand titles concisely. — [Google, title links](https://developers.google.com/search/docs/appearance/title-link)
- Relevant analogy for a price site: "Avoid including flight price information in `<title>` elements. Our systems will likely not show price information… pricing for flights can change so fast… that what's shown in title links may not correspond to the actual price." — [Google, title links](https://developers.google.com/search/docs/appearance/title-link)
- Google rewrites titles when they are half-empty, obsolete, inaccurate, micro-boilerplate, unclear about the main title, in the wrong language, or duplicate the site name. — [Google, title links](https://developers.google.com/search/docs/appearance/title-link)
- **How often Google rewrites (sources conflict):**
  - Google (Sept 2021): title elements "are now used around **87%** of the time, rather than around 80% before." — [Google Search Central Blog (2021)](https://developers.google.com/search/blog/2021/09/more-info-about-titles)
  - Third-party measurements are much higher because they count truncation and partial changes: Moz ~58% (Aug 2021) and ~57% (Mar 2022) — [Moz](https://moz.com/blog/title-tag-rewrites-7-months-later); Ahrefs 33.4% — [Ahrefs (2021)](https://ahrefs.com/blog/title-tags-study); Zyppy >61% — [SEJ (2022)](https://www.searchenginejournal.com/google-changes-more-than-61-percent-of-title-tags/435618); John McAlpin **76%** in Q1 2025, with 84.87% of unchanged titles between 30 and 60 characters — [McAlpin (2025)](https://www.johnmcalpin.com/seo-data-study-how-often-google-changes-title-tags-and-why)
  - These differences come from definitions; none of the numbers is clearly wrong.
- Etsy found shorter titles won in repeated tests. — [Etsy](https://www.etsy.com/codeascraft/optimizing-meta-descriptions-h1s-and-title-tags-lessons-from-multivariate-seo-testing-at-etsy)

**A/B testing guidance ("Minimize A/B testing impact in Google Search")**
- **Don't cloak:** "Don't show one set of URLs to Googlebot, and a different set to humans… whether you're running a test or not." Googlebot generally doesn't support cookies, so it sees the cookie-less version.
- Use **rel="canonical"** on alternate test URLs pointing to the original, not `noindex`.
- Use **302** (temporary) redirects, not 301, for redirect tests. JS redirects are also fine.
- Run the experiment only as long as necessary. "If we discover a site running an experiment for an unnecessarily long time, we may interpret this as an attempt to deceive search engines and take action accordingly. This is especially true if you're serving one content variant to a large percentage of your users."
- Source for all of the above: [Google, Minimize A/B testing impact](https://developers.google.com/search/docs/crawling-indexing/website-testing)

**Spam policies (updated Aug 2026)**
- **Scaled content abuse:** "when many pages are generated for the primary purpose of manipulating search rankings and not helping users… typically focused on creating large amounts of unoriginal content that provides little to no value to users, no matter how it's created." Examples include "Using generative AI tools… to generate many pages without adding value," "Scraping feeds… to generate many pages (including through automated transformations…)," "Stitching or combining content from different web pages without adding value," and "Creating many pages where the content makes little or no sense to a reader but contains search keywords." — [Google, Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- **Doorway abuse:** "when sites or pages are created to rank for specific, similar search queries. They lead users to intermediate pages that aren't as useful as the final destination." — [Google, Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- **Thin affiliation:** describes "cookie-cutter sites or templates with the same or similar content replicated." Good pages add "additional information about price… comparisons." — [Google, Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- **Keyword stuffing** includes "filling a web page with keywords or numbers." — [Google, Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- In May 2026 Google clarified that spam policies also apply to generative AI responses in Search. — [Google, Documentation updates](https://developers.google.com/search/updates)

**Generative AI content guidance (updated 2026-10-01)**
- "using generative AI tools… to generate many pages without adding value for users may violate Google's spam policy on scaled content abuse." Generative output "may contain inaccuracies… It is critical to manually" review it. Google's update log says the October 2026 revision draws on the Quality Rater Guidelines and points to sections 4.6.5 (scaled content abuse) and 4.6.6 (little effort, originality or added value). Consider disclosing how automation was used. — [Google, Using gen AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content); [Updates log](https://developers.google.com/search/updates)
- Secondary report: the Oct 1 update says manual fact-checking of AI text is "critical," and that includes titles and meta descriptions. — [Digital Applied (Oct 2026)](https://www.digitalapplied.com/blog/google-ai-content-fact-check-guidance-2026) (secondary; the Google page excerpt confirms "It is critical to manually…" but was truncated)

**Helpful content self-assessment (updated 2026-10-05)**
- Warning signs include: "Are you using extensive automation to produce content on many topics?", "mainly summarizing what others have to say without adding much value?", "**changing the date of pages to make them seem fresh when the content has not substantially changed?**", and "adding a lot of new content or removing a lot of older content primarily because" of search.
- The "Effort" criterion says "automatically generating pages from feeds or using generative AI to produce large amounts of text without manual oversight or curation represents little to no effort."
- Fabricated authorship is "a form of deception."
- Source for the above: [Google, Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- Core-updates doc: "Avoid doing 'quick fix' changes." Google also recommends avoiding changes to content that is already performing well. — [Google, Core updates](https://developers.google.com/search/docs/appearance/core-updates)

### Inferences
- **The AI-editing loop itself is not a policy violation.** The site serves one version per URL to everyone, so there is no cloaking. Static regeneration of all pages is fine, as long as the agent does not user-agent-sniff or serve different HTML to Googlebot.
- A page-group test on a static site changes the variant pages for real for everyone (no alternate URLs or redirects), so the canonical and 302 guidance doesn't apply. "Run only as long as necessary" still does: conclude, then roll out or revert.
- **Main risk vector for this site:** 114 near-identical coin pages. If the agent adds generic AI paragraphs ("Bitcoin is a decentralized digital currency…") to every page, that matches the scaled-content-abuse and low-effort descriptions. Per-coin value must come from real data: computed stats, price history, supply metrics, comparisons and sourced facts. Rewritten text from other sites does not count.
- **Date and freshness risk:** a price ticker legitimately changes data often. But bumping visible "updated" dates or `<lastmod>` on every build when only the template changed falls under Google's "changing the date… to make them seem fresh" warning, and teaches Google to ignore lastmod. Tie lastmod to meaningful content changes. Whether a price refresh counts as "significant" is debatable; Google's examples list main content, structured data and links.
- **Live prices in `<title>`:** by analogy with Google's flight-price guidance, a price in the title is likely to be stripped or rewritten and could be stale in the SERP. Note that SearchPilot has published a case study on "adding price to title," which I did not read.
- **Title churn:** Google doesn't say frequent title changes are penalized. Each change can still shift rankings and resets the measurement window. Limit any page to one title change per experiment cycle, roughly every 4 or more weeks.

### Gaps
- Google has no explicit guidance on how often you may change titles or content. No source found states a penalty for frequent edits.
- I didn't fetch the Quality Rater Guidelines PDF, so the YMYL treatment of financial and crypto price pages is unverified here. Crypto price information is plausibly YMYL-adjacent (financial), which would raise the bar for accuracy and trust.
- I did not read SearchPilot's "adding price to title" case study, so I can't report its result.

---

## Q4. Prioritization: is "striking distance (positions 8–20)" credible, what else is, and published CTR-by-position curves

### Takeaway
"Striking distance" is a practitioner heuristic with no published validation, and no one agrees on the band: 8–20, 11–20, 11–30, 4–20 and 5–15 are all in use. Its premise is that pages near page 1 can move with on-page work. That premise is plausible, but the payoff is often small today, because on AWR's 2026 data positions 4–10 get about 0.5–1.7% CTR on desktop. A more defensible approach scores opportunities as **impressions × (expected CTR at target position − current CTR)**, with the expected-CTR curve fitted to **this site's own GSC data**, and then gates the result by intent fit and feasibility. Published curves vary a lot by source, year, device, branded vs unbranded, and AI Overview presence.

### Cited Findings
**Striking distance**
- No agreed definition. One practitioner writes that the "usual definition is positions 11-20… Nobody standardized the boundary." On their own site, 234 queries at positions 11–20 produced 27,339 impressions and only **6 clicks** in 16 months, and moving from page 2 to the bottom of page 1 "did not buy traffic." — [swapbiswas.com (Sept 2026)](https://swapbiswas.com/blog/striking-distance-keywords/) (single-site anecdote)
- Semrush defines the band as 11–30 and cites Backlinko that "only 0.63% of searchers click on something from the second page." — [Semrush (2023)](https://www.semrush.com/blog/google-search-console-keywords)
- Sensible caveats from practitioners: prioritize by impressions first, not rank. Average position is a blend across devices and queries. Ignore poor-fit queries. "Do not rewrite titles every week because average position moved slightly." — [SearchTriage (2026)](https://searchtriage.com/guides/google-search-console/what-are-striking-distance-pages-in-seo); [aiseoshift (2026)](https://aiseoshift.com/blog/striking-distance-keywords); [DEV.to (2026)](https://dev.to/liaxim/finding-striking-distance-keywords-with-the-search-console-api-and-a-short-node-script-3l1b), which uses ≥100 impressions as a noise floor.
- **CTR-gap model with a site-specific curve:** compute observed CTR per position bucket from your own GSC data, smooth it so expected CTR never rises as position worsens, then estimate `additional clicks = max(0, impressions × expected CTR − current clicks)` with impressions held constant. It is "a diagnostic baseline… not an industry benchmark." — [Web Aloha GSC Opportunity Analyzer](https://webaloha.co/tools/gsc-opportunity-analyzer/) (tool page; method described transparently). Coupler.io's skill recommends the same: "compute the median CTR at each position band from this site's own data… rather than importing a benchmark curve." — [Coupler.io](https://www.coupler.io/ai-agent-skills/gsc-search-opportunity-finder/download)

**Published CTR curves**
- **Advanced Web Ranking (living study, July 2026 snapshot, Google US desktop, published 27 Oct 2026).**
  - Method: estimates from 1.75M+ tracked US SERPs per month; CTR = clicks ÷ impressions for the top 20 positions; the position-1 baseline uses 184.8M impressions.
  - Organic CTR by position, all SERPs: 1: 20.02% · 2: 10.36% · 3: 3.89% · 4: 1.71% · 5: 1.08% · 6: 0.73% · 7: 0.46% · 8: 0.47% · 9: 0.54% · 10: 0.58% · 11: 0.67% · 12: 0.70% · 13: 0.82% · 14: 0.88% · 15: 0.80% · 16–19: ~0.52–0.67% · 20: 0.27%.
  - With an AI Overview, position 1 drops to 9.69% (−52%). AIOs appeared on 43% of sampled desktop SERPs. 74.3% of AIO SERPs were zero-click, vs 53.6% without.
  - Positions 1–3 take ~92% of top-10 clicks.
  - Branded vs unbranded at position 1 (all devices): 27.3% vs 19.4%.
  - Mobile position 1 in July 2026: 35.74% organic, 12.02% with an AIO.
  - Source: [AWR Organic CTR study](https://www.advancedwebranking.com/seo/organic-ctr)
  - Caveat: the curve is non-monotonic past position 7, likely because of SERP-feature and position-counting effects. Monthly values swing widely; desktop position 1 ranged from 14.6% to 45.6% over 12 months.
- **Ahrefs** (GSC data, 300k keywords): an AIO correlated with 34.5% lower position-1 CTR (Mar 2025), updated to **58% lower** (Dec 2025). Position-1 CTR for informational keywords was 0.076 in Dec 2023 and 0.039 in Dec 2025. — [Ahrefs (Apr 2025)](https://ahrefs.com/blog/ai-overviews-reduce-clicks/); [Ahrefs update (Feb 2026)](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update)
- **Seer Interactive:** organic CTR on informational queries with AIOs fell 61% from mid-2024 to Sept 2025 (3,119 queries, 42 organizations, 25.1M impressions). Being cited in the AIO gives 35% more organic clicks. The 2026 update covers 53 brands and 2.43B impressions and says the decline is "leveling off." — [Search Engine Land on Seer (Nov 2025)](https://searchengineland.com/google-ai-overviews-drive-drop-organic-paid-ctr-464212); [Seer 2026 update](https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update)
- **GrowthSRC** (GSC data, 200k keywords): position-1 CTR fell from 28% (2024) to 19% (2025), and position 2 from 20.83% to 12.60%. — [GrowthSRC (2025)](https://growthsrc.com/google-organic-ctr-study)
- **SISTRIX** (Germany, 100M+ keywords): an AIO cuts position-1 CTR from 27% to 11%. — [SEJ on SISTRIX (Mar 2026)](https://www.searchenginejournal.com/google-ai-overviews-cut-germanys-top-organic-ctr-by-59/569954/)
- **First Page Sage 2026:** claims 1,184 domains and 3.67B impressions (Mar–Aug 2026), and that AI answers appear on 81.6% of US queries. — [First Page Sage](https://firstpagesage.com/reports/google-click-through-rates-ctrs-by-ranking-position). **Low confidence:** this is an agency report, the per-position method isn't independently checkable, and the 81.6% figure conflicts with AWR's 43% desktop AIO rate and SE Ranking's ~21%. Its older curve (position 1 = 39.8%), as cited by Semrush, is far above every other source.
- **Backlinko:** position 1 = 27.6%, page-2 clicks = 0.63% (older dataset, widely quoted). — via [Semrush](https://www.semrush.com/blog/google-search-console-keywords) and [seoforjournalism](https://www.seoforjournalism.com/p/what-are-striking-distance-keywords). The original page wasn't fetched and the year of its dataset wasn't confirmed.

### Inferences
- Under AWR's 2026 desktop curve, moving from position 12 (0.70%) to position 8 (0.47%) gains nothing; only reaching the **top 3** pays off. "Striking distance" is mainly worth pursuing for queries where a top-3 finish is realistic, or for mobile, where the curve is steeper.
- **Recommended prioritization for the agent:**
  1. Aggregate GSC page×query data over 28–90 days and drop rows under an impression floor (e.g. ≥100 impressions).
  2. Fit the site's own CTR-by-position curve and use AWR only as a sanity check.
  3. Score `opportunity = impressions × max(0, expectedCTR(target_pos) − currentCTR)`. The target position is the current position for pure snippet or CTR fixes, or a realistic higher position for ranking work.
  4. Multiply by intent fit, so a page that cannot serve the query scores 0.
  5. Group opportunities by **template element**. Most wins on this site come from template-wide changes, which then need page-group testing.
- For a crypto ticker, queries like "bitcoin price" probably trigger rich Google finance or crypto widgets and AIOs, so expected CTR is depressed. Long-tail queries (e.g. "[coin] market cap," "[coin] supply," "[coin] price history 2021") may have better CTR economics. This is inference and unverified.

### Gaps
- I found no peer-reviewed or academic validation of striking-distance prioritization.
- I found no CTR curve specific to finance or crypto queries. AWR has industry segments but I didn't extract a finance row.
- I couldn't confirm the year of Backlinko's original dataset.

---

## Q5. High-value vs risky change types for a price-ticker site, and which schema types still produce rich results

### Takeaway
High-value and low-risk:
- unique, descriptive per-coin titles and H1s (short and non-boilerplate)
- genuinely unique per-coin data content
- sensible internal linking (related coins, category hubs)
- accurate lastmod tied to real changes
- valid Organization/WebSite (site-name) and Breadcrumb markup

Risky:
- mass AI-generated prose
- boilerplate titles with live prices
- fake freshness dates
- doorway-style page multiplication (e.g. "[coin] price in [every currency]" without unique value)
- markup for rich-result types that no longer exist or don't apply

Many rich-result types were retired in 2023–2026. **FAQ rich results stopped showing for everyone on 7 May 2026**, and **Dataset markup is no longer used by Google Search** (only Dataset Search). Structured data is therefore rarely a lever for a price-ticker site.

### Cited Findings
**Structured data status**
- **FAQ:** in Aug 2023 it was limited to "well-known, authoritative government and health websites." — [Google blog (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes). Fully deprecated: "This feature will no longer appear in Google Search starting May 7, 2026." Documentation was removed in June 2026. — [Google, Documentation updates](https://developers.google.com/search/updates)
- **HowTo:** deprecated on all devices since Sept 2023. — [Google blog (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- **June 2025 phase-out:** Book Actions (later partly restored), Course Info, ClaimReview, Estimated Salary, Learning Video, Special Announcement, Vehicle Listing. "This update won't affect how pages are ranked." — [Google blog (June 2025)](https://developers.google.com/search/blog/2025/06/simplifying-search-results); [SEL (Sept 2025)](https://searchengineland.com/google-drops-reporting-on-several-structured-data-types-461744)
- **Nov 2025:** practice problem and **Dataset** were phased out of Google Search. "Dataset structured data is only used by Dataset Search, and not Google Search." — [Google, Documentation updates](https://developers.google.com/search/updates)
- **Retired markup is harmless:** "Structured data that's not being used does not cause problems for Search, but also has no visible effects." — [Google blog (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
- **Still listed in Google's Search Gallery (2026):** Article, Breadcrumb, Carousel, Course list, Discussion forum, Education Q&A, Employer aggregate rating, Event, Image metadata, Job posting, Local business, Math solver, Movie, Organization, Product (snippets and merchant listings), Profile page, Q&A, Recipe, Review snippet, Software app, Speakable, Subscription/paywalled content, Vacation rental, Video. — [Google Search Gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery) (page dated 2026-10-16); the consolidated list is from [SchemaForge (Sept 2026)](https://schemaforge.io/guides/retired-rich-results) (secondary; spot-checked against the gallery excerpt for Article, Breadcrumb, Carousel, Dataset, Discussion forum, Product, Profile page, Q&A, Recipe)
- Google lists `WebSite` structured data as one input to title links (site names). — [Google, title links](https://developers.google.com/search/docs/appearance/title-link)
- AI-generated structured data must follow the general structured-data guidelines and feature-specific policies, and must be validated. — [Google, Using gen AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)

**Evidence on change types (from controlled tests at other sites; may not transfer)**
- Titles: shorter titles won repeatedly at Etsy. Meta descriptions and H1s also had significant effects, and H1×title interactions were unpredictable. — [Etsy](https://www.etsy.com/codeascraft/optimizing-meta-descriptions-h1s-and-title-tags-lessons-from-multivariate-seo-testing-at-etsy)
- Visible content: SearchPilot reports that bringing content out of tabs and making it visible raised traffic in tests (e.g. +6% and +5% on two sites). — [SearchPilot, A Year of SEO Testing](https://www.searchpilot.com/resources/blog/a-year-of-seo-testing-with-searchpilot); [tabs case study](https://www.searchpilot.com/resources/case-studies/seo-split-test-lessons-bringing-content-out-of-tabs)
- Internal-linking tests "require careful planning" because they affect pages beyond the variants, i.e. spillover into the control group. — [SearchPilot](https://www.searchpilot.com/resources/blog/what-is-seo-split-testing)
- Google's new generative-AI optimization guide (May 2026) stresses "the importance of providing non-commodity content." — [Google, Documentation updates](https://developers.google.com/search/updates)
- Thin-affiliation guidance names "additional information about price… product comparisons" as value-adding. — [Google, Spam policies](https://developers.google.com/search/docs/essentials/spam-policies)

### Inferences
**High value, low risk (do first; many are hygiene and can ship without a test):**
- Unique, concise title and H1 per coin that match how people search (e.g. "Solana (SOL) Price, Market Cap & Supply | SiteName"), with no live price in `<title>`.
- Per-coin **data-derived** facts that competitors' boilerplate lacks: ATH/ATL and date, % from ATH, circulating vs max supply, 7d/30d/1y performance, rank, launch date, and comparisons with peers. These come from the data pipeline, not an LLM.
- Accurate `<lastmod>` and visible "data as of" timestamps that reflect real data refreshes.
- Internal links between related coins (same category or chain, adjacent market-cap rank) and from the home page to all coin pages, so every coin page is crawlable. SearchPilot's spillover caveat applies to link tests.
- Valid `Organization` / `WebSite` (site name) and `BreadcrumbList`. These have low upside and almost no downside.
- Performance and page experience: helpful but secondary. Google says not to focus "on only one or two aspects of page experience." — [Google, helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

**Medium (test before full rollout):**
- Meta description rewrites. Google may ignore them, but Etsy saw significant effects.
- Moving key data above the fold.
- Adding a short sourced description section per coin, human-reviewed.

**Risky or low value (avoid, or require human review):**
- LLM-written generic paragraphs across all 114 pages, which matches the scaled-content-abuse wording.
- Creating many new near-duplicate URL variants such as "[coin] price in EUR/GBP/JPY…" or "[coin] price prediction 2030," which risk doorway abuse and thin content. Price predictions also hit the "promise to answer a question that actually has no answer" warning.
- FAQPage, HowTo, Dataset, Product or FinancialProduct markup to chase rich results. FAQ, HowTo and Dataset no longer show in Google Search, and Product markup on a non-purchasable coin would likely violate the structured-data policies.
- Fake freshness (bumping dates without substantive change).
- Frequent title churn.
- Fabricated author bios.

### Gaps
- No controlled-test evidence specific to crypto price pages was found.
- Breadcrumb display: Google ran a January 2025 "simplifying breadcrumbs" change (linked from the June 2025 post: https://developers.google.com/search/blog/2025/01/simplifying-breadcrumbs). From memory and not verified in this session, the change removed breadcrumbs from mobile result URLs. Verify before relying on it.
- Whether Google shows its own crypto price feature for most "[coin] price" queries in 2026, which would cap CTR, was not checked.

---

## Q6. How to record experiments: an experiment-log schema

### Takeaway
Pre-register every change before deploy. Record the hypothesis, the exact diff, the randomization (which pages are variant vs control), the primary metric and analysis method, the pre, washout and post windows, a minimum detectable effect from simulation, guardrails, and a decision rule. Afterwards, record the result with its interval and the decision. This mirrors the practices of Airbnb (power analysis before launch), Etsy (two controls for A/A, stratified sampling, post-rollout validation) and Google (run only as long as necessary, then remove test elements).

### Cited Findings
- Power must be estimated before launch; "if the power of our experiment is very low, then it may be useless." — [Airbnb](https://medium.com/airbnb-engineering/experimentation-measurement-for-search-engine-optimization-b64136629760)
- Two control groups for A/A testing, pre-period balance checks, and post-rollout validation. — [Etsy](https://www.etsy.com/codeascraft/seo-title-tag-optimization)
- "Once you've concluded the test, update your site with the desired content variation(s) and remove all elements of the test as soon as possible." — [Google](https://developers.google.com/search/docs/crawling-indexing/website-testing)
- Decide test duration before starting and avoid peeking. — [SGAIndex (2026)](https://sgaindex.com/articles/seo-ab-testing-framework-guide) (practitioner)
- Log GSC data anomalies and Google update dates beside affected periods so a reporting gap isn't mistaken for a ranking loss. — [SEO Receipts (2026)](https://seoreceipts.com/blog/why-google-search-console-data-delayed/); [Google, Core updates](https://developers.google.com/search/docs/appearance/core-updates)
- Airbnb's guardrail framework escalates experiments with statistically significant negative effects on key metrics. — [Airbnb, Experimentation guardrails (2021)](https://medium.com/airbnb-engineering/designing-experimentation-guardrails-ed6a976ec669)

### Inferences
Proposed log schema (JSON or YAML per experiment, stored in the repo, e.g. `experiments/EXP-0007.yaml`):

```yaml
id: EXP-0007
status: proposed | running | evaluating | concluded | reverted
created_by: agent | human
approved_by: <human or null>           # human gate for content and template changes
hypothesis: "Shorter coin-page titles ('{Name} ({SYM}) Price & Market Cap') will raise CTR at constant position by >=15%."
rationale_data: "GSC 2026-08-01..2026-10-27: coin pages avg CTR 0.9% at avg pos 8.2 vs site curve expectation 1.4%"
change_type: title | meta_description | h1 | content_block | internal_links | structured_data | performance | other
change_diff: "<git commit SHA / template diff summary>"
scope:
  eligible_pages: [list or rule]       # e.g. all /coin/* with >=50 impressions in pre-period
  assignment_method: matched_pairs_by_pre_impressions | stratified_ntile | all_pages_prepost
  random_seed: 42
  variant_pages: [...]
  control_pages: [...]
  excluded_pages: [/, coins with news spikes]
metrics:
  primary: impressions | ctr_at_constant_position | clicks
  secondary: [avg_position_impr_weighted, clicks, indexed_status]
  guardrails: [total clicks to coin pages not down >X%, no indexing errors, CWV not regressed]
analysis_method: DiD_log_impressions | CausalImpact(control_sum as covariate) | descriptive_only
power:
  simulated_mde_80pct: "+35% impressions over 28d"   # from placebo simulation on history
  aa_placebo_false_positive_rate: 0.06
windows:
  pre_start: 2026-07-01
  pre_end: 2026-10-27
  deploy_date: 2026-10-28
  washout_days: 4                      # GSC lag + recrawl
  post_start: 2026-11-01
  evaluation_date: 2026-11-28          # fixed in advance; no peeking decisions before
  recrawl_confirmed: <date via URL Inspection / Googlebot log>
confounders_log: [Google core update dates, GSC data anomalies, major crypto news days, deploys touching other elements]
result:
  effect_estimate: "+12% (95% CI -8% to +34%)"
  p_or_posterior_prob: 0.21
  aa_check: pass | fail
  verdict: win | loss | inconclusive
decision: rollout_all | revert | iterate | keep_and_retest
decision_date: 2026-11-29
rollout_validation: "post-rollout gap closed? notes"
notes: ""
```

**Operating rules implied by the sources:**
- Only one open experiment per template element at a time, and no overlapping edits on the same pages.
- An "inconclusive" verdict is the expected common case at this traffic level. Keep the change only if it is also a best-practice or hygiene improvement; otherwise revert it.
- Changes that are policy-aligned hygiene can skip testing and be logged as "unmeasured rollout" with a descriptive pre/post. Examples: fixing duplicate titles, accurate lastmod, removing retired schema.
- Require human approval for any change that adds generated prose, creates new URLs, or alters dates or structured data, given the scaled-content and freshness-manipulation policies.

### Gaps
- None of the engineering sources publishes its actual experiment-log schema. The one above is synthesized from their described practices.
