> **Research snapshot, 2026-10-30.** Search Console API, URL Inspection, Bing, IndexNow. Sources are cited inline; facts may have changed since. Current decisions and status live in [../PLAYBOOK.md](../PLAYBOOK.md) and [../DECISIONS.md](../DECISIONS.md).

# Free search-engine data sources for a small static site's "self-improving" loop (as of Oct 2026)

Context: cryptopriceticker.com, static on Cloudflare Pages (free plan), ~115 URLs. Proposed plan (from Gemini): nightly GSC `searchanalytics.query`, dimensions [query, page], rowLimit 500, last 28 days ending 2 days ago, flag "striking distance" (pos 8–20) and "low CTR" (pos ≤10, ≥50 impressions, CTR <3%).

## Q1. Google Search Console API (searchanalytics.query): limits, freshness, aggregation, anonymization, truncation

### Takeaway
At this site's scale, quota is not a constraint (1,200 QPM per site/user, 30M QPD per project). Data loss is the real constraint. Rows come back sorted by clicks, descending. Rare "anonymized" queries never appear as rows. Google also says it "may drop some data" when you group by page and/or query. A `rowLimit` of 500 is an arbitrary cap below the 25,000 maximum: it keeps the top 500 rows by clicks, so the zero- or low-click rows that striking-distance analysis needs are the first to be cut. Use `rowLimit: 25000` and paginate with `startRow` until you get an empty response.

### Cited Findings
**Quotas (Usage Limits page, last updated 2025-08-28)**
- Search Analytics QPS quota: **per-site 1,200 QPM; per-user 1,200 QPM; per-project 30,000,000 QPD and 40,000 QPM**. Example given: "User A can make up to 1,200 QPM combined to her 3 websites." — [Usage Limits](https://developers.google.com/webmaster-tools/limits)
- Search Analytics also has an unpublished **"load quota"**. The short-term quota is measured "in 10 minute chunks" ("wait 15 minutes and try again"). The long-term quota is measured "in 1 day chunks". Google's own wording: "Queries are expensive when you group and/or filter by either page or query string. Queries grouped/filtered by page AND query string are the most expensive." "Query load increases with the date range queried." "Avoid requerying the same data (for example, querying all data for last month over and over)." — [Usage Limits](https://developers.google.com/webmaster-tools/limits)
- URL Inspection: **per-site 2,000 QPD and 600 QPM; per-project 10,000,000 QPD and 15,000 QPM**. — [Usage Limits](https://developers.google.com/webmaster-tools/limits)
- All other resources (sites, sitemaps): **per-user 20 QPS and 200 QPM; per-project 100,000,000 QPD**. — [Usage Limits](https://developers.google.com/webmaster-tools/limits)

**rowLimit / pagination / max rows**
- `rowLimit`: "Valid range is 1–25,000; Default is 1,000". `startRow`: "Zero-based index… If startRow exceeds the number of results… zero rows." — [searchanalytics.query reference (updated 2026-08-11)](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- Rows are sorted by click count, descending ("If two rows have the same click count, they are sorted in an arbitrary way"). "The API is bounded by internal limitations of Search Console and does not guarantee to return all data rows but rather top ones." — [searchanalytics.query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- Daily cap: "a maximum of 50K rows of data per day per search type (web, image, and so on--sorted by clicks)". Google's recommended loop sets rowLimit to 25,000 and increments `startRow` by 25,000 "until you reach the last page (a response with 0 rows)". — [Getting your performance data](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)
- "the upper limit for the data exported through the Search Analytics API… is 50,000 rows per day per site per search type, which may not be reached in all cases… For requests that don't involve query or URL dimensions, such as countries, devices, and Search Appearances, Search Console will display and export all the data." UI export max is 1,000 rows. — [Google Search Central blog: performance data deep dive (Oct 2022)](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive)

**Freshness / dataState / history**
- `dataState`: "all" includes fresh (not yet final) data. "final", or omitting the parameter, returns finalized data only. "hourly_all" returns an hourly breakdown, to be used with the `HOUR` dimension. When fresh data is requested, the response `metadata` carries `first_incomplete_date` or `first_incomplete_hour`, in America/Los_Angeles time. — [searchanalytics.query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- "Data is typically available after 2-3 days". Google recommends finding the latest available date by querying grouped by date over the past 10 days, and recommends "running a query each day for one day's worth of data". — [Getting your performance data](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)
- **Recent change (Apr 9 2025):** the API added an `HOUR` dimension and a `HOURLY_ALL` dataState, which expose the "24 hours" view (data "with a delay of only a few hours"). Search Engine Land reports this covers the past 10 days. — [Google blog: Search Analytics API now supports hourly data](https://developers.google.com/search/blog/2025/04/san-hourly-data); [Search Engine Land](https://searchengineland.com/google-search-analytics-api-gains-hourly-break-down-for-past-10-days-454167)
- History: performance data covers 16 months. Google states this when describing the branded-query filter ("provides a 16-month history of data"). — [Search Console Help: Dimensions and data groupings](https://support.google.com/webmasters/answer/17011259?hl=en); a third party also says "GSC stores performance data for 16 months" — [SEOTesting](https://seotesting.com/google-search-console/data-limitations/)

**aggregationType and average position**
- `aggregationType`: `auto` (default), `byPage`, `byProperty`, or `byNewsShowcasePanel`. "If you group or filter by page, you cannot aggregate by property." — [searchanalytics.query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- By property vs by page: with property aggregation, several links from one site on a single SERP count as one impression. With page aggregation, each URL gets its own impression. The help example is a knowledge panel that counts as 1 impression by property and 5 by page. — [What are impressions, position, and clicks?](https://support.google.com/webmasters/answer/7042828)
- Position: "the **topmost** position occupied by a link to your property or page in search results, **averaged across all queries**". Worked example: (2+3)/2 = 2.5. A position is recorded only when the result gets an impression, so a page-3 result that nobody scrolled to records nothing. Ads do not occupy a position. A featured snippet typically counts as position 1. Data is attributed to the Google-selected canonical URL. — [What are impressions, position, and clicks?](https://support.google.com/webmasters/answer/7042828)
- Google's own advice: "In general, it's recommended to focus more on trends in impressions and clicks than on position alone." — [Performance report: Common tasks](https://support.google.com/webmasters/answer/17010961?hl=en)

**Anonymized queries and data loss with the query dimension**
- Anonymized queries are "those that aren't issued by more than a few dozen users over a two-to-three month period". They are "always omitted from the tables" but included in chart totals unless a query filter is applied. There is no API row for them, so row sums will be lower than the totals. — [Performance data deep dive](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive)
- "When you group by page and/or query, our system may drop some data in order to be able to calculate results in a reasonable time". For accurate counts, "you must omit the page and query dimensions". — [Getting your performance data](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)
- Discrepancy causes Google lists: aggregation difference, the table row limit (1,000 in the UI), anonymized queries, and "match"/"does not match" totals failing to add up because of anonymization and truncation. — [Troubleshooting data discrepancies](https://support.google.com/webmasters/answer/17010575)

**Recent changes affecting interpretation (flag)**
- **Sept 2025:** Google ended support for the `&num=100` results parameter around Sept 12 2025. Practitioners observed lower impressions, changed average positions, and more queries showing in positions 1–20. The interpretation is that impressions from third-party and automated scrapers had inflated earlier 2025 data. Avoid comparing baselines across that date. — [Search Engine Land (Oct 2025)](https://searchengineland.com/why-google-search-console-impressions-dropped-interpret-data-463677) (practitioner analysis, not a Google statement)
- **2026:** Google launched "Search Generative AI performance reports" (AI Overviews / AI Mode impressions) on June 3 2026 and rolled them out to all sites by Aug 31 2026. AI-feature data "is included in the overall performance report". — [Google Search Central blog, June 2026](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports); [Help: Generative AI performance report](https://support.google.com/webmasters/answer/16984139?hl=en)
- **Mar 2026:** the branded/non-branded query filter (introduced Mar 11 2025) expanded to all eligible sites. It is not available for low-impression sites. — [Search Engine Land](https://searchengineland.com/google-search-console-branded-queries-filter-expands-471387); [Help: Common tasks](https://support.google.com/webmasters/answer/17010961?hl=en)

### Inferences
- **The 500-row cap is the main defect in Gemini's plan.** Rows are sorted by clicks, descending, so rowLimit 500 keeps the 500 highest-click (query, page) pairs. Striking-distance rows at positions 8–20 usually have few or zero clicks, so they are exactly the rows most likely to be cut. The response gives no truncation signal: a full 500 rows just looks like "the data". Fix: `rowLimit: 25000`, then loop `startRow += 25000` until 0 rows. For a ~115-page site this will likely be one page.
- **A 28-day window re-queried every night** is the pattern Google tells you to avoid for load quota (query+page is the most expensive grouping, and load grows with the date range). It is unlikely to break at this scale. The better design is a nightly one-day pull (date = latest final date) stored in the repo or KV, with 28-day aggregates computed locally. That also yields per-day history beyond 16 months.
- **"Ending 2 days ago" is not always finalized.** Google says 2–3 days. Either omit `dataState` (final only) and detect the latest available date with a date-grouped query, or use `dataState: "all"` and drop dates at or after `first_incomplete_date` (that field only appears when grouping by date).
- **Averages must be recomputed with weights.** Never average the API's `position` values across rows; weight by impressions (sum(position×impr)/sum(impr)). Same for CTR: sum(clicks)/sum(impr). With a one-day nightly pull this is required to build 28-day aggregates.
- **Expect sparse data for a young crypto ticker site.** Many long-tail coin queries ("xyz price usd today") may fall below the "few dozen users over 2–3 months" anonymization threshold, so per-page totals from [query,page] will sum to less than the page-only totals. Pull both: (a) `[page]` only for accurate page totals, and (b) `[query, page]` for the query detail.
- The dimensions are generic: a third parallel query `[page, device]` helps tell real ranking from device-mix effects.

### Gaps
- Google publishes no numeric value for the "load quota", and none was found.
- No official statement on how much data is lost when adding the query dimension (only "may drop some data"). Practitioner estimates vary by site and were not verified from a reputable source in this pass.
- 16-month retention is stated in Google help only indirectly, through the branded-filter doc; the main performance-report help excerpt fetched did not state it.

## Q2. Is the striking-distance (pos 8–20) / low-CTR heuristic sound?

### Takeaway
It works as a candidate generator, with caveats. "Position 8–20" is practitioner convention, not a Google threshold. Average position is a blend of the topmost rank across every impression (devices, countries, personalization), so a "pos 11" row may never have been seen at 11. Google's own optimization framework (the bubble chart) uses relative quadrants: the site's own average CTR and position as reference lines, not fixed cutoffs like 3%. A fixed "CTR <3% at pos ≤10" rule will misfire on queries where SERP features or AI Overviews suppress clicks.

### Cited Findings
- Google's recommended framework: a bubble chart with y = average position (inverted, log scale) and x = CTR (log scale), bubble size = clicks, color = device. **Red reference lines at the site's average** split it into quadrants: "Top position, high CTR" (nothing to do); "Low position, high CTR" ("invest in optimizing them!"); "Low position, low CTR"; "Top position, low CTR" (check the largest bubbles for causes such as SERP rich results). — [Google Search Central: bubble chart analysis (updated 2025-12-10)](https://developers.google.com/search/docs/monitor-debug/bubble-chart-analysis); [Google blog 2022](https://developers.google.com/search/blog/2022/04/performance-optimization-bubble-chart)
- Google suggests finding low-CTR pages by sorting the Pages tab by CTR ascending, and says "it's recommended to focus more on trends in impressions and clicks than on position alone." — [Help: Common tasks](https://support.google.com/webmasters/answer/17010961?hl=en)
- Position is "the average position for all searches. For your specific search your position might be different… because of many variables, such as your search history, location". A value of 11 could even mean a desktop knowledge-panel slot. — [What are impressions, position, and clicks?](https://support.google.com/webmasters/answer/7042828)
- Practitioner: "Positions 8 to 20 are a common starting range, but they are not a rule… A position-nine query for the wrong audience may deserve none." Start from the query, then find the ranking page. — [SearchTriage guide (2026)](https://searchtriage.com/guides/google-search-console/what-are-striking-distance-pages-in-seo) (SaaS-adjacent blog; used for practitioner convention only)
- Practitioner script (Oct 2026): positions 8–20 with a **minimum of 100 impressions** per query ("Average position over a handful of impressions is noise"). For each query it uses the **lead page** (the URL with the most impressions) rather than the query average. It warns that "CTR depends on the result page… full of ads and SERP features" and that anonymized queries mean rows don't sum to totals. — [DEV Community: striking-distance keywords with the GSC API](https://dev.to/liaxim/finding-striking-distance-keywords-with-the-search-console-api-and-a-short-node-script-3l1b)
- Averaging pitfall: "a page showing at position 2 for some searches and position 20 for others reports position 11, which is a number nobody ever actually saw". Average position often gets worse when a page starts ranking for new, lower queries, which is a good thing. Compare CTR between queries at similar positions; brand queries skew CTR. — [QueryWatch blog (Oct 2026)](https://querywatch.app/blog/search-console-metrics-explained) (SaaS blog; reasoning consistent with Google's definition)
- Low-impression distortion: "For queries and pages that get a low number of appearances… the average position… can be really misleading", for example the owner's own searches. Sitelinks can also distort CTR. — [SEOTesting](https://seotesting.com/google-search-console/data-limitations/) (SaaS blog)

### Inferences
- **Recommended thresholds for this site:**
  - Striking distance: impression-weighted position 8–20 over 28 days, with **≥100 impressions** (≥50 at minimum) and the query appearing on ≥N distinct days.
  - Low CTR: compare CTR against the **site's own CTR for the same position bucket** (for example, below the 25th percentile of the site's CTR at positions 1–3, 4–6 and 7–10), not a flat 3%.
  - At ≥50 impressions and 3% CTR the expected count is 1.5 clicks. A row with 0–1 clicks over 28 days is statistically indistinguishable from a 3% CTR, so the flat rule would mostly flag noise. Use a binomial or Wilson lower or upper bound, or require ≥200–300 impressions for CTR flags.
- **Crypto-price queries carry specific CTR risks.** Google shows its own price box or finance cards for "[coin] price" queries, and AI Overviews now appear too (and since 2026 count in the main report). A low CTR at position 1–5 may therefore reflect the SERP, not the title or meta. The loop should not keep rewriting titles for these. A guardrail is needed: change a page at most once per N weeks and measure before and after.
- **Segment by device and country** before acting. One query+page row blends mobile and desktop and every country.
- **Account for the Sept 2025 `num=100` break** in any baseline that reaches back to 2025. Only a problem for history pulled from before then.
- Cannibalization check: if one query shows ≥2 pages (likely, for example, the home page and /coin/btc/ for "bitcoin price"), flag it separately instead of treating each as a striking-distance candidate.

### Gaps
- No Google-published numeric threshold for "striking distance" or "low CTR" exists; Google's method is relative quadrants.
- No reputable, current (2025–2026) CTR-by-position curve was retrieved. Published curves vary widely and mostly come from SaaS vendors, which were excluded.

## Q3. Service accounts as Search Console users; Domain properties; permissions needed

### Takeaway
Yes, a GCP service account can be a Search Console user or owner. Google's own Indexing API docs tell you to add one as a (delegated) owner, and the API accepts `sc-domain:` site URLs. For read-only Search Analytics and URL Inspection, the `webmasters.readonly` scope plus Restricted or Full user access is the minimum. **New in 2026:** many reports say the Search Console "Add user" UI rejects newly created service-account emails ("Email not found"). Workarounds: wait (reports say a few hours) or make the SA a verified owner via the Site Verification API.

### Cited Findings
- Permission levels: Owner (verified or delegated, full control); **Full user** ("view rights to all data and can take some actions"); **Restricted user** ("simple view rights on most data"). — [Managing owners, users, and permissions](https://support.google.com/webmasters/answer/7687615?hl=en)
- The API's `permissionLevel` values are `siteOwner`, `siteFullUser`, `siteRestrictedUser` and `siteUnverifiedUser`. `siteUrl` takes `http://www.example.com/` (URL-prefix) or `sc-domain:example.com` (Domain). — [Sites resource](https://developers.google.com/webmaster-tools/v1/sites)
- searchanalytics.query needs scope `webmasters.readonly` or `webmasters`. URL Inspection `index.inspect` accepts either too. `sitemaps.submit` requires the `webmasters` (write) scope. — [query ref](https://developers.google.com/webmaster-tools/v1/searchanalytics/query); [inspect ref](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect); [sitemaps.submit ref](https://developers.google.com/webmaster-tools/v1/sitemaps/submit)
- Google's Indexing API prerequisites: create a service account and JSON key, verify the site (Domain or URL-prefix property), then "add your service account as a (delegated) site owner" by entering the service account email in Search Console. — [Indexing API prerequisites (updated 2026-07-16)](https://developers.google.com/search/apis/indexing-api/v3/prereqs)
- **2026 issue:** a Google Developer forum thread (May–Sept 2026) reports that "Service Accounts created after this date can't be added" to Search Console/GA4. Later posts say the delay was "down to a couple of hours", that adding via the API worked, and in Sept 2026 that new SAs were again rejected in GA4. — [discuss.google.dev thread](https://discuss.google.dev/t/problem-with-new-service-accounts/362176)
- A Search Central Community thread (Apr 2026) reports "Email not found" for all permission levels. The suggested workaround: enable the Site Verification API, authenticate as the SA with `siteverification` + `webmasters` scopes, verify `sc-domain:` via a DNS TXT record (left in place permanently), then call `sites.add`. "No Google Workspace / domain-wide delegation needed." — [Search Central Community thread](https://support.google.com/webmasters/thread/429020059/unable-to-add-service-account-email-to-google-search-console?hl=en) (community, not official)

### Inferences
- Recommended setup: one service account, added as a **Restricted** user (enough to read performance data and URL inspection). Upgrade to Full only if the loop must submit sitemaps via the API. Owner is only needed for the Indexing API, which does not apply to this site (job postings and livestreams only). Keep the JSON key as a GitHub Actions secret.
- Domain properties (`sc-domain:cryptopriceticker.com`) work with the API. The Domain property is the better choice: it covers http/https and www/non-www, and it is likely where the owner already has the site verified, since Cloudflare manages the DNS.
- Fallback if the UI rejects the SA: run the job with OAuth user credentials (a refresh token for the owner's Google account stored as a secret). Downside: the token can expire if the OAuth app stays in "testing" status.

### Gaps
- No official Google statement on the 2026 "new service account can't be added" behavior was found, only community reports.
- No official per-feature permission matrix (which features need Full vs Restricted) was retrieved in this pass. That URL Inspection and Search Analytics work for Restricted users is inferred from "view rights on most data".

## Q4. URL Inspection API

### Takeaway
The URL Inspection API is free and allows 2,000 inspections per site per day. That covers all ~115 URLs daily with about 17× headroom. It returns the *indexed* version's status (verdict, coverageState, lastCrawlTime, googleCanonical vs userCanonical, robots/indexing/fetch state, referring URLs, sitemaps). It cannot run a live test or request indexing.

### Cited Findings
- Endpoint: `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect` with `inspectionUrl`, `siteUrl` (URL-prefix with a trailing slash, or `sc-domain:`) and an optional `languageCode`. "Presently only the status of the version in the Google index is available; you cannot test the indexability of a live URL." — [index.inspect](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- `IndexStatusInspectionResult` fields:
  - `sitemap[]`, `referringUrls[]`
  - `verdict` (PASS = Valid, FAIL = Error, NEUTRAL = Excluded)
  - `coverageState` (string), `robotsTxtState`, `indexingState` (noindex)
  - `lastCrawlTime` (RFC3339), `pageFetchState`
  - `googleCanonical`, `userCanonical`
  - `crawledAs` (desktop or mobile)

  The result also includes `richResultsResult`, `ampResult` and a link to the UI. `mobileUsabilityResult` is deprecated. — [UrlInspectionResult](https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult)
- Quota: 2,000 QPD and 600 QPM per site; 10M QPD per project. — [Usage Limits](https://developers.google.com/webmaster-tools/limits)

### Inferences
- High value for this site. Nightly, or a rotating ~40/day, inspection of all 114 coin pages catches:
  - pages "Discovered/Crawled – currently not indexed" (common for thin, templated price pages)
  - Google choosing a different canonical (for example, consolidating near-duplicate coin pages)
  - a stale `lastCrawlTime` after content changes

  These are leading indicators that the performance data cannot show: a page with zero impressions never appears in searchanalytics at all.
- Diff `coverageState` and `googleCanonical` against the previous run and alert on changes, rather than storing raw dumps.

### Gaps
- Google has no API to "request indexing" for regular pages; the Indexing API is limited to JobPosting and BroadcastEvent. This comes from secondary sources ([IndexBolt](https://www.indexbolt.com/blog/indexnow-vs-google-indexing-api), vendor blog). The official Indexing API docs were not re-fetched for the eligibility wording.

## Q5. Search Console Bulk Data Export to BigQuery

### Takeaway
Bulk export is available to any property via Settings → Bulk data export. It needs a Google Cloud project **with billing enabled** and BigQuery enabled. It has no 50k-row cap, carries anonymized-query rows (flagged, with the query blank), and gives exact position sums. It does **not backfill** history; it starts within 48 hours of setup. For a 115-page site the data volume would almost certainly stay inside BigQuery's free tier (10 GiB storage and 1 TiB queries per month). Even so, the API is simpler, and its row limits do not bind at this size.

### Cited Findings
- "you'll see all the performance data available to Search Console for your property, with the exception of anonymized queries". — [About bulk data export](https://support.google.com/webmasters/answer/12918484)
- Setup:
  1. Create a Cloud project "with billing" and enable the BigQuery API and BigQuery Storage API.
  2. Grant `search-console-data-export@system.gserviceaccount.com` the BigQuery Job User and BigQuery Data Editor roles.
  3. Enter the project ID in Search Console.

  The first export comes "up to 48 hours after" setup. For history before setup, "use the Search Console API". "Data will be accumulated forever… unless you set an expiration"; partition expiration must be ≥14 days. — [Start a new bulk data export](https://support.google.com/webmasters/answer/12917675)
- Tables: `searchdata_site_impression` (by property), `searchdata_url_impression` (by URL), and `ExportLog`. `is_anonymized_query` marks rare queries (query blank). Average position = `SUM(sum_top_position)/SUM(impressions) + 1` (site table) or `SUM(sum_position)/SUM(impressions) + 1` (URL table). Rows repeat keys, so always aggregate. Old data can be revised atomically. — [Table guidelines and reference](https://support.google.com/webmasters/answer/12917991)
- BigQuery free tier: first **10 GiB storage/month** and first **1 TiB of query processing/month** free. The sandbox is usable "without a credit card". — [BigQuery pricing](https://cloud.google.com/bigquery/pricing)
- Google positions the API as "free… ideal for… medium-sized sites" and notes its 50K rows/day/type limit. — [Export using the Search Console API](https://support.google.com/webmasters/answer/12919192?hl=en)

### Inferences
- Pros for this site: complete rows (no 50k cap or "may drop" sampling), anonymized impressions visible as a bucket, and exact weighted-position math.
- Cons: billing account required (a credit card on file even if the cost is $0); no backfill; one more cloud dependency and IAM to manage from a GitHub Action; SQL needed. At ~115 URLs the API's 50k/day/type cap will not bind.
- Recommendation: start with the API (paginated, nightly 1-day pulls stored in the repo). Consider bulk export later if query-level completeness becomes important.

### Gaps
- Whether a BigQuery **sandbox** (no billing) project can receive the export was not confirmed. The help page says billing is required.
- Which permission level is required to configure the export (owner vs full) was not confirmed in the fetched excerpts.

## Q6. Bing Webmaster Tools API

### Takeaway
The Bing Webmaster API is free with a per-user API key (or OAuth 2.0). Its search-performance endpoints are per-query, per-page and query×page stats: clicks, impressions, average click and impression position. The data is **updated weekly** and only covers the period since the site was added. **Recent change: the SOAP and POX endpoints were retired Aug 31 2026; use `/api.svc/json/`.** It is worth including cheaply as a second signal, especially since Bing data feeds Copilot/ChatGPT-style search. It is not essential for the loop.

### Cited Findings
- **The legacy SOAP and POX APIs were retired on August 31, 2026.** Use JSON/REST: `https://ssl.bing.com/webmaster/api.svc/json/METHOD_NAME?apikey=API_KEY`. Responses are wrapped in `{"d": ...}`, dates use the `/Date(ticks)/` format, and "Quotas, rate limits, and permissions are unchanged." — [Bing: SOAP/POX retirement](https://www.bing.com/webmasters/help/soap-pox-api-retirement-s0appox01); [Bing Webmaster API overview](https://learn.microsoft.com/en-us/bingwebmaster)
- Access: OAuth 2.0 ("Recommended") or an API key generated under Settings → API Access. "Only one API key can be generated per user." The key "is generated for a user and not a site". — [Getting Access](https://learn.microsoft.com/en-us/bingwebmaster/getting-access)
- `GetQueryStats` remarks: "The data will be updated every week." `GetPageQueryStats` (siteUrl, page) carries the same remark. — [GetQueryStats](https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi.getquerystats?view=bing-webmaster-dotnet); [GetPageQueryStats](https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi.getpagequerystats?view=bing-webmaster-dotnet)
- The method list includes:
  - `GetQueryStats`, `GetQueryTrafficStats`, `GetQueryPageStats`, `GetQueryPageDetailStats`, `GetPageStats`, `GetPageQueryStats`, `GetRankAndTrafficStats`
  - `GetUrlInfo`, `GetUrlTrafficInfo`, `GetCrawlStats`, `GetCrawlIssues`
  - `SubmitUrl`, `SubmitUrlBatch` (500 per call), `GetUrlSubmissionQuota`
  - feeds/sitemaps methods

  `QueryStats` fields: AvgClickPosition, AvgImpressionPosition, Clicks, Date, Impressions, Query. — [third-party transcription of Microsoft's IWebmasterApi reference (GitHub, Aug 2026)](https://raw.githubusercontent.com/stufently/bing-webmaster-mcp/main/docs/api-surface.md) (secondary; method names match Microsoft Learn pages)
- In the UI, the Search Performance report covers "up to the past six months". Keyword and page data is "only available for Web traffic". Data collection starts when the site is added: "you cannot see backdated data". The "Web and Chat" source includes Bing Chat "Learn more" link clicks. — [Bing: Search performance help](https://www2.bing.com/webmasters/help/search-performance-c680da36)
- URL Submission API: "may be deprecated in the future as Microsoft transitions toward broader IndexNow adoption". — [Bing: URL Submission](https://www.bing.com/webmasters/help/URL-Submission-62f2860b)

### Inferences
- Worth adding as a low-effort secondary source: one GET per week (`GetPageQueryStats` per page, or `GetQueryStats` plus `GetQueryPageStats`). The weekly refresh means a nightly pull is pointless. Treat it as a weekly job.
- Any Bing integration written now must use the JSON endpoints; tutorials using `/pox/` or SOAP are now broken.

### Gaps
- No published numeric rate limit or quota for Bing's read (stats) API calls was found. Only submission quota is exposed (`GetUrlSubmissionQuota`).
- The exact per-query row limits or truncation in Bing stats responses are undocumented in the sources retrieved.

## Q7. IndexNow, Cloudflare Crawler Hints, and Google's stance

### Takeaway
IndexNow is an open push protocol. One ping to any participating endpoint is shared with all participants: Bing, Yandex, Seznam, Naver, Yep, Amazonbot and the Internet Archive. **Google does not participate.** It said in 2021 that it would test IndexNow, never adopted it, and is absent from the official participant list as of Oct 2026. Cloudflare **Crawler Hints is available on the Free plan** and sends IndexNow signals automatically, based on cache MISSes.

### Cited Findings
- Participants per the official registry: bing, yandex, seznam, naver, yep, internetarchive, amazonbot. **No Google.** — [indexnow.org/searchengines.json](https://www.indexnow.org/searchengines.json)
- Endpoints: `api.indexnow.org`, Amazon, Bing, Naver, Seznam, Yandex and Yep; "your submission will be shared across all IndexNow-enabled search engines". Up to **10,000 URLs per POST**. The key file is hosted at the root as `{key}.txt`. Rate limits are not public ("each participating search engine sets its own"); handle 429 with Retry-After. "Cloudflare offers native IndexNow integration." — [IndexNow FAQ](https://www.indexnow.org/faq)
- Crawler Hints availability: **Free: Yes, Pro: Yes, Business: Yes, Enterprise: Yes**. It "uses cache-status MISS to determine when content has likely been updated and sends it to IndexNow". Responses with error status are not reported. — [Cloudflare docs: Crawler Hints (modified 2026-08-14)](https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/)
- Google 2021: a spokesperson told SEJ that Google "will be testing the IndexNow protocol". — [Search Engine Journal, Nov 2021](https://www.searchenginejournal.com/google-will-be-testing-indexnow/426602/)
- A Google Product Expert (Gold) in the official community (2024): "Google does not support Index Now". — [Search Central Community](https://support.google.com/webmasters/thread/278807782/indexnow-implementation?hl=en) (community expert, not Google staff)
- Several 2026 secondary sources agree that Google still does not support IndexNow (for example [IndexBolt, Jul 2026](https://www.indexbolt.com/blog/indexnow-vs-google-indexing-api)). These are SaaS blogs, cited only for consistency.

### Inferences
- For a Cloudflare Pages site, turning on Crawler Hints (zone → Caching → Configuration) is effectively zero-cost IndexNow coverage. Caveat: it is driven by cache MISSes, so it may ping on cache expiry or purges rather than real content changes. Pages deployments purge the cache, so every deploy may re-ping many URLs. That is likely harmless but noisy.
- An explicit IndexNow POST from the deploy pipeline, listing only the changed URLs, is more precise. The site would host `/{key}.txt` as a static file. Pick one approach to avoid duplicate pings.
- For Google, the only levers are the sitemap (accurate `<lastmod>`), internal links, and manual URL Inspection "Request indexing" in the UI (not available via API).

### Gaps
- No official, dated Google statement saying "we don't support IndexNow" was found. The evidence is Google's absence from the participant registry, the 2021 "testing" quote, and no adoption since.
- The Cloudflare docs excerpt did not say whether Crawler Hints works identically for Cloudflare **Pages** projects (vs proxied zones). It is a zone-level setting, so it should apply to a custom domain on a Cloudflare zone. Not verified.

## Q8. Sitemaps API / sitemap submission via API

### Takeaway
The Search Console API can submit, list, get and delete sitemaps (`PUT .../sites/{siteUrl}/sitemaps/{feedpath}`, `webmasters` write scope). That needs Full or Owner access and a write-scoped credential. For a site whose sitemap URL never changes, one-time submission plus accurate `<lastmod>` is enough. Re-submitting nightly adds little.

### Cited Findings
- `sitemaps.submit`: `PUT https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}`. It requires the `https://www.googleapis.com/auth/webmasters` scope (not readonly). `siteUrl` accepts `sc-domain:`. The response body is empty on success. — [Sitemaps: submit](https://developers.google.com/webmaster-tools/v1/sitemaps/submit)
- Other sitemap methods fall under "All other resources": 20 QPS and 200 QPM per user. — [Usage Limits](https://developers.google.com/webmaster-tools/limits)
- Bing exposes feed/sitemap submission in its Webmaster API, and its URL Submission API allows up to 500 URLs per batch call within a daily quota. — [Bing URL Submission](https://www.bing.com/webmasters/help/URL-Submission-62f2860b); [API surface transcription](https://raw.githubusercontent.com/stufently/bing-webmaster-mcp/main/docs/api-surface.md)

### Inferences
- Use `sitemaps.get` or `list` (read-only scope) nightly to check `lastDownloaded`, errors and warnings. Use `submit` only after the sitemap URL changes. This keeps the service account read-only (Restricted user).
- Google's unauthenticated sitemap "ping" endpoint was deprecated in 2023 (Google Search Central blog, June 2023, "Sitemaps ping endpoint is going away"). That URL was not re-fetched in this session; treat it as unverified here. Do not build on `google.com/ping?sitemap=`.

### Gaps
- The fields of the Sitemaps `get`/`list` response (lastSubmitted, lastDownloaded, isPending, warnings, errors, contents) were not re-fetched this session.
- The deprecation of Google's sitemap ping endpoint (2023) was not re-verified against the primary source in this session.
