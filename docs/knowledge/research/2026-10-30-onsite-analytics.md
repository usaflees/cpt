> **Research snapshot, 2026-10-30.** Cloudflare Web Analytics vs GA4, CrUX, PageSpeed. Sources are cited inline; facts may have changed since. Current decisions and status live in [../PLAYBOOK.md](../PLAYBOOK.md) and [../DECISIONS.md](../DECISIONS.md).

# On-site behaviour and performance analytics for a privacy-first static site on Cloudflare Pages (Free), for an automated "self-improving site" loop (as of 30 Oct 2026)

Context checked live on 2026-10-30: `https://cryptopriceticker.com/` is served by Cloudflare (`server: cloudflare`, `cf-ray` present, Cloudflare NEL headers), so it is a **proxied Cloudflare zone**, not only a `*.pages.dev` site. Fetched from a US vantage point (IAD), the HTML had **no** `data-cf-beacon` / `static.cloudflareinsights.com` beacon. `POST /cdn-cgi/rum` returned 404. The repo's `_headers` CSP already allows `script-src https://static.cloudflareinsights.com` and `connect-src https://cloudflareinsights.com`. (The live response did not show a CSP header, so the repo `_headers` may not be deployed yet. This came from my own curl and is not an official source.)

## 1. Cloudflare Web Analytics (RUM beacon): what it collects, privacy, sampling, retention, free-plan limits

### Takeaway
Cloudflare Web Analytics is free and uses no cookies or localStorage. It collects page views, visits, referrers, countries, browsers/OS/devices, and Core Web Vitals (LCP, INP, CLS) by path, now including LCP/INP sub-parts. Data is unsampled at ingest. After 7 days it is down-sampled to about 10%, and queries use adaptive sampling. The dashboard covers the last 6 months. **Major recent change:** since 15 Oct 2025 Cloudflare has turned Web Analytics on by default for Free zones, with EU/UK visitors excluded by default. The loop should check the zone's RUM setting before assuming "no analytics".

### Cited Findings
- Web Analytics is "free, privacy-first analytics", enabled with a JS beacon that collects metrics through the browser Performance API. It "does not collect or use your visitors' personal data." — [CF Web Analytics: About](https://developers.cloudflare.com/web-analytics/about/)
- The beacon "does not use any client-side state, such as cookies or `localStorage`" and does not fingerprint individuals by IP, User Agent, or other data. — [CF Core Web Vitals doc](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)
- "Visits" are page views that start from a distinct referral or navigation event, rather than unique IPs, so no per-visitor state is stored. The RUM service receives the client IP as part of normal HTTP handling but "discards the IP address at the nearest Cloudflare data center." — [Cloudflare blog: The RUM Diaries](https://blog.cloudflare.com/the-rum-diaries-enabling-web-analytics-by-default); [CF RUM beacon doc](https://developers.cloudflare.com/speed/observatory/rum-beacon)
- Core Web Vitals collected: LCP, INP, CLS, each rated Good / Needs Improvement / Poor on Google's thresholds. They can be filtered by URL, browser, OS, country, element, and more. Data captured includes the CSS-selector **element**, the **path**, and the **value** (ms for LCP/INP, score for CLS). For LCP it also records the source URL and size. CLS is only supported in Chromium browsers (no Layout Instability API in Firefox/Safari). — [CF Core Web Vitals doc](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)
- **New (13 Oct 2026):** RUM splits LCP into TTFB, resource load delay, resource load duration, and element render delay. It splits INP into input delay, processing duration, and presentation delay. Connection time is split into TCP and TLS. In GraphQL these appear on `rumWebVitalsEventsAdaptiveGroups` as percentiles (for example `lcpResourceLoadDelayP50`, `inpInputDelayP50`, with P25/P50/P75/P90/P95/P99/P999), in **microseconds**. A negative value means the data is not available. — [CF changelog 2026-10-13](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/changelog/web-analytics/2026-10-13-core-web-vital-subparts.mdx); [CF Web Analytics changelog](https://developers.cloudflare.com/changelog/product/web-analytics)
- Other 2026 beacon changes: the soft-navigation (SPA) measurement change, completed 2026-09-04, "may alter the volume of reported pageviews and visits". Since 2026-07-13 the beacon is injected with `type="module"`. The web-vitals library is at 6.2.3 as of 2026-10-16. Since 2026-05-13, `/cdn-cgi/rum` returns 405 for non-POST requests. — [CF Web Analytics changelog](https://developers.cloudflare.com/changelog/product/web-analytics); [beacon changelog RSS](https://developers.cloudflare.com/web-analytics/changelog/index.xml)
- Beacon endpoints: the script loads from `https://static.cloudflareinsights.com/beacon.min.js`. Data goes to `https://<yourdomain>/cdn-cgi/rum` for proxied sites, or to `https://cloudflareinsights.com/cdn-cgi/rum` for non-proxied sites. Core Web Vitals are reported when `visibilityState` first becomes hidden after load. — [CF Data origin and collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)
- Sampling: "We retain unsampled beacon data for the past 7 days, after this point data is aggregated down to around 10%." Dashboard and GraphQL queries pick a sampling level between 0.0001% and 100%, and GraphQL exposes `sampleInterval`. "Sites with very low traffic volumes are sampled to greater percentages." — [CF Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/)
- Practitioner report (small site with a few thousand pageviews a month, Aug 2026): daily RUM counts came back with `sampleInterval` ≈ 10–20, so counts were multiples of 10. The author advises always selecting `avg { sampleInterval }`. — [DEV Community, 28 Aug 2026](https://dev.to/robertcasschdot/your-cloudflare-analytics-are-rounded-to-the-nearest-10-and-the-api-will-tell-you-so-10nn) (non-official)
- Retention (dashboard): "you can access data for the previous six months." — [CF Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/)
- Query strings and UTM parameters are not logged, "to avoid collecting potentially sensitive data." — [CF Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/)
- Ad-blockers (Adblock Plus, Brave, DuckDuckGo extension, etc.) can block the beacon. — [CF Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/)
- Limits: up to 10 sites that are **not** proxied through Cloudflare, and **no limit** for proxied sites. Web Analytics *rules* (path-scoped injection) are 0 on Free, so the snippet is injected on all subdomains. — [CF Web Analytics Limits](https://developers.cloudflare.com/web-analytics/limits/)
- Pages one-click setup: Workers & Pages → project → **Metrics** → **Enable** under Web Analytics. Cloudflare then adds the snippet on the next deployment. Pages must be valid HTML for injection to work. — [CF Pages: Enable Web Analytics](https://developers.cloudflare.com/pages/how-to/web-analytics/)
- **On by default for Free zones:** "on October 15, 2025, … Cloudflare will enable Web Analytics for all free domains by default." "The version of Web Analytics that will be enabled by default excludes data from EU visitors (this can be changed in the dashboard)." Options are `Enable Globally` or `Exclude EU`. Once disabled, Cloudflare "will not re-enable it again." There is also a `rum/site_info` REST API (`auto_install`, `enabled`, `host`, `zone_tag`, returns `site_tag`). — [Cloudflare blog: The RUM Diaries (pub. 2025-09-17, updated 2026-07-15)](https://blog.cloudflare.com/the-rum-diaries-enabling-web-analytics-by-default)

### Inferences
- Because cryptopriceticker.com is a proxied Free zone, the default-on rollout may already apply, or may have been turned off. My live fetch (no beacon in HTML, 404 on `/cdn-cgi/rum`) suggests RUM is not active right now, but only the dashboard or the `rum/site_info` API can confirm it. The loop's first step should be: check RUM state, then enable it, either through Pages "Metrics → Enable" or the zone Web Analytics "Enable Globally / Exclude EU" setting.
- "Exclude EU" is the default for auto-enabled zones. If EU visitors are excluded, every metric is biased toward non-EU traffic. Pick deliberately: "Enable Globally" gives full coverage, "Exclude EU" gives maximum caution.
- On a proxied zone the beacon posts to same-origin `/cdn-cgi/rum`, which CSP `connect-src 'self'` already allows. The existing `cloudflareinsights.com` entries cover the script and the non-proxied case. No CSP change is needed.
- At this site's likely low traffic, per-path RUM numbers will be noisy, sampled around 10× after day 7, and ad-blocker-depleted. The loop should use them for relative trends and threshold checks (for example p75 LCP of the top N paths), not exact counts. It should prefer 7-day windows queried within the unsampled 7-day period and store snapshots locally.

### Gaps
- No official per-dimension list of `rumPageloadEventsAdaptiveGroups` fields was found. Field names used in examples (`requestPath`, `refererHost`, `countryName`, `deviceType`, `userAgentBrowser`, `visits`, `bot`) come from community examples and need confirming by introspection.
- Whether Pages "Metrics → Enable" and zone-level auto-injection create the same `siteTag` or two separate ones could not be determined.

## 2. Is Web Analytics / RUM data queryable via the Cloudflare GraphQL Analytics API on the free plan?

### Takeaway
Yes. Use the **account-scoped** RUM datasets `rumPageloadEventsAdaptiveGroups` (page views/visits), `rumPerformanceEventsAdaptiveGroups` (navigation/load timings), and `rumWebVitalsEventsAdaptiveGroups` (LCP/INP/CLS, Beta), plus the raw `rumWebVitalsEventsAdaptive`. Filter by `accountTag` (the account ID) at the `accounts` level and by `siteTag` inside the dataset filter. Authenticate with an API token that has **Account → Account Analytics → Read**. The default rate limit is 300 queries per 5 minutes. Check exact per-dataset retention and window limits with the `settings` node.

### Cited Findings
- Cloudflare staff list the GraphQL datasets for Web Analytics: "rumPageloadEventsAdaptiveGroups: for visits and pageloads; rumPerformanceEventsAdaptiveGroups: for legacy performance metrics; rumWebVitalsEventsAdaptiveGroups: for Web Vitals metrics." — [Cloudflare Community (staff answer)](https://community.cloudflare.com/t/downloading-web-analytics-data/473295)
- A schema dump lists account-level datasets `rumPageloadEventsAdaptiveGroups`, `rumPerformanceEventsAdaptiveGroups`, `rumWebVitalsEventsAdaptive` ("Beta. RUM Web Vitals event metrics with adaptive sampling"), and `rumWebVitalsEventsAdaptiveGroups` ("Beta. Aggregated RUM Web Vitals …"). — [GraphQL schema docs (J. Spurlock)](https://pages.johnspurlock.com/graphql-schema-docs/cloudflare.html)
- Token: in the dashboard, choose *Account* → *Account Analytics* → *Read*. — [CF: Configure an Analytics API token](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)
- Global limits: an account-scoped query can include only 1 account. The default user quota is **300 GraphQL queries per 5-minute window**, on top of general API rate limits. Account-based rate limiting is available as an opt-in. — [CF GraphQL Limits (updated 2 Oct 2026)](https://developers.cloudflare.com/analytics/graphql-api/limits/)
- Node limits (how far back, max time range per query, max fields, max records) depend on plan and on the requested `zoneTag`/`accountTag`. Query them through the `settings` node, which exposes `enabled`, `availableFields`, `maxPageSize`, `maxNumberOfFields`, `notOlderThan` (seconds), and `maxDuration` (seconds). — [CF GraphQL Limits](https://developers.cloudflare.com/analytics/graphql-api/limits/); [CF Settings node](https://developers.cloudflare.com/analytics/graphql-api/features/discovery/settings/)
- `siteTag` is a separate 32-hex identifier per Web Analytics site, visible in the `data-cf-beacon` attribute or the dashboard URL. One site tag can cover several hostnames, so group or filter by `requestHost`. Cloudflare GraphQL returns query errors as **HTTP 200 with an `errors` array**, so scripts must check `json.errors`. — [Pickuma, 21 Aug 2026](https://pickuma.com/for-dev/cloudflare-web-analytics-graphql-rum-pageload-events-sitetag) (non-official)
- Practitioner query using `rumPageloadEventsAdaptiveGroups` with `filter: { siteTag, date_geq, date_leq, bot: 0 }`, selecting `count`, `sum { visits }`, `avg { sampleInterval }`, `dimensions { date }`. The token needs only "Account · Account Analytics · Read". — [DEV Community, Aug 2026](https://dev.to/robertcasschdot/your-cloudflare-analytics-are-rounded-to-the-nearest-10-and-the-api-will-tell-you-so-10nn)
- Web Vitals template, scoped token, `rumWebVitalsEventsAdaptiveGroups` with `quantiles { largestContentfulPaintP75, interactionToNextPaintP75 … }` filtered by `requestHost` or `siteTag`. The template notes "Logpush cannot deliver Web Vitals. RUM data is only available via the GraphQL Analytics API." — [GitHub gist, Jun 2026](https://gist.github.com/taslabs-net/a206d93e3f057b2bfa398b18f5d3acde) (non-official)
- The dashboard's own query shape: `rumPageloadEventsAdaptiveGroups(filter: { AND: [{datetime_geq, datetime_leq}, {OR: [{siteTag}]}] }, limit, orderBy: [count_DESC]) { count sum { visits } avg { sampleInterval } dimensions { metric: countryName } }`. — [boehs.org notes](https://boehs.org/node/notes-on-the-cloudflare-web-analytics-api)
- No official Cloudflare tutorial page for querying Web Analytics through GraphQL was found. `developers.cloudflare.com/analytics/graphql-api/tutorials/querying-web-analytics/` returned 404 on 2026-10-30. — (direct fetch)

Example queries for the loop. They are assembled from the sources above. Field names other than `count`, `sum.visits`, `avg.sampleInterval`, `date`, and the documented sub-part/quantile names should be confirmed by introspection.

```graphql
# Endpoint: POST https://api.cloudflare.com/client/v4/graphql
# Header: Authorization: Bearer $CF_ANALYTICS_TOKEN   (Account > Account Analytics > Read)

# A) Page views + visits by path and device (last 7 days, unsampled window)
query Pages($acct: String!, $site: String!, $start: Date!, $end: Date!) {
  viewer { accounts(filter: { accountTag: $acct }) {
    rumPageloadEventsAdaptiveGroups(
      limit: 1000, orderBy: [count_DESC]
      filter: { siteTag: $site, date_geq: $start, date_leq: $end, bot: 0 }
    ) {
      count                      # page views (sample-corrected estimate)
      sum { visits }
      avg { sampleInterval }
      dimensions { requestPath deviceType countryName refererHost }
    }
  } }
}

# B) Core Web Vitals p75 by path (+ new sub-parts, microseconds)
query Vitals($acct: String!, $site: String!, $start: Time!, $end: Time!) {
  viewer { accounts(filter: { accountTag: $acct }) {
    rumWebVitalsEventsAdaptiveGroups(
      limit: 200, orderBy: [count_DESC]
      filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end }
    ) {
      count
      quantiles {
        largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75
        lcpResourceLoadDelayP75 inpInputDelayP75
      }
      dimensions { requestPath deviceType }
    }
  } }
}

# C) Check retention / max window for each RUM node on this account
query Limits($acct: String!) {
  viewer { accounts(filter: { accountTag: $acct }) { settings {
    rumPageloadEventsAdaptiveGroups  { enabled maxDuration notOlderThan maxPageSize }
    rumWebVitalsEventsAdaptiveGroups { enabled maxDuration notOlderThan maxPageSize }
  } } }
}
```

### Inferences
- The RUM datasets are account-scoped, so the account-level token (Account Analytics Read) is enough. No zone permission is needed for RUM.
- Gemini's GA4 metrics map onto Cloudflare RUM as follows: `screenPageViews` → `count`; `activeUsers` → `sum.visits` (only an approximation, since visits are not users); `deviceCategory` → `deviceType`; `pagePath` → `requestPath`. `engagementRate` and `averageSessionDuration` have **no equivalent**. Cloudflare deliberately does not keep sessions.
- Run query C once at setup and store the `notOlderThan`/`maxDuration` values. Do not hard-code retention.

### Gaps
- I found no official published values for `notOlderThan`/`maxDuration` on the RUM datasets for a Free account. The dashboard's 6-month figure may differ from what GraphQL allows. Verify with query C.
- I could not confirm whether `rumWebVitalsEventsAdaptiveGroups` is still labelled "Beta" in the live schema as of Oct 2026.

## 3. Zone-level HTTP analytics on the free plan via GraphQL (httpRequestsAdaptiveGroups / httpRequests1dGroups)

### Takeaway
On Free zones, `httpRequestsAdaptiveGroups` is available. **Since 2 Oct 2026** every plan, Free included, keeps at least 31 days and can query up to 30 days per request. It has `clientRequestPath` and `edgeResponseStatus` dimensions, so 404s by path and status-code health work. Referrer-host breakdowns from edge data are paid-only. `httpRequests1dGroups` keeps its own per-plan limits. This is server-side, ad-block-proof data, but it includes bots unless filtered, and it has no Web Vitals.

### Cited Findings
- **Changelog 2026-10-02:** "Adaptive analytics datasets, such as HTTP requests, security events, and DNS analytics, retain at least 31 days of data for Free and Pro domains, and you can query up to 30 days in a single request. Previously, Free and Pro domains could see between 24 hours and 8 days of history depending on the dataset." It "does not alter which datasets or fields your plan can access." Aggregated datasets such as `httpRequests1hGroups` keep their existing per-plan limits. — [CF changelog: 30 days of analytics data on every plan](https://developers.cloudflare.com/changelog/post/2026-10-02-30-days-analytics-on-every-plan)
- "We allow access to ALL plans for the essential datasets (like `httpRequestsAdaptiveGroups`, `firewallEventsAdaptive`, etc)." — [CF Settings node](https://developers.cloudflare.com/analytics/graphql-api/features/discovery/settings/). This conflicts with older community reports (2022–2025) of `"enabled": false` / "does not have access to the path" on Free. — [CF Community 2022/2025](https://community.cloudflare.com/t/cloudflare-graphql-analytics-api-does-not-have-access-to-the-path/395176)
- A live verification on a Free zone (Sep 2026, before the Oct change) found that `httpRequestsAdaptiveGroups` returned data for `clientCountryName`, `clientRequestHTTPHost`, `clientRequestPath`, `edgeResponseStatus`, `userAgentBrowser`, `clientDeviceType`, and `clientRequestHTTPProtocol`. At that time retention was 8 days with a one-day max window. Referrer was not available on Free. — [Selftend GitHub issue #2302 (Sep 2026)](https://github.com/Selftend/selftend/issues/2302) (non-official; retention part superseded by the 2 Oct 2026 change)
- Filter availability in Cloudflare docs: `requestSource: "eyeball"`, `edgeResponseStatus_geq/_lt`, and `clientRequestPath_like` are available on "All plans". `clientRefererHost_like` is "Paid plans only". — [cloudflare-docs: AI Crawl Control GraphQL reference](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/ai-crawl-control/reference/graphql-api.mdx)
- Official example, top paths in a zone: `httpRequestsAdaptiveGroups(filter: $filter, limit: 10, orderBy: [sum_edgeResponseBytes_DESC]) { count sum { edgeResponseBytes } dimensions { metric: clientRequestPath } }` with filter `requestSource: "eyeball"`. — [CF: Querying HTTP events by hostname](https://developers.cloudflare.com/analytics/graphql-api/tutorials/end-customer-analytics/)
- Key `httpRequestsAdaptiveGroups` dimensions include `cacheStatus`, `edgeResponseStatus`, `clientRequestPath`, `clientCountryName`, and `botScore`/`botManagementDecision`. `uniq { uniques }` exists only on the rollup (`*1hGroups`, `*1dGroups`) datasets. — [cloudflare/skills GraphQL reference](https://raw.githubusercontent.com/cloudflare/skills/main/skills/cloudflare/references/graphql-api/api.md)
- In the dashboard, Free-plan HTTP Traffic shows Requests, Bandwidth, Unique Visitors, and top countries. Path, referer, and status breakdowns in the dashboard are listed for Pro/Business/Enterprise. — [CF Zone Analytics](https://developers.cloudflare.com/analytics/account-and-zone-analytics/zone-analytics/)
- `httpRequests1dGroups` is said to have 365 days of retention. That is a community or support statement and not plan-specific. — [CF Community 2022](https://community.cloudflare.com/t/log-retention/400412); [CF Community 2025](https://community.cloudflare.com/t/can-we-get-statistics-analytics-for-the-past-year/760835)
- Example zone query for 404s by path (my construction from the documented filters and dimensions):
  ```graphql
  query NotFound($zone: String!, $start: Time!, $end: Time!) {
    viewer { zones(filter: { zoneTag: $zone }) {
      httpRequestsAdaptiveGroups(limit: 100, orderBy: [count_DESC],
        filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball", edgeResponseStatus: 404 }) {
        count dimensions { clientRequestPath }
      }
    } }
  }
  ```
  Zone-scoped queries need a token with zone Analytics Read for that zone. The official tutorial uses a "Read all resources" token. — [CF tutorial](https://developers.cloudflare.com/analytics/graphql-api/tutorials/end-customer-analytics/)

### Inferences
- For the loop, the most useful zone-level signals on Free are: 404/5xx counts by path (broken links, stale sitemap entries); request counts by path (an ad-block-proof cross-check on RUM page views, though bot-inflated); `cacheStatus` mix (CDN efficiency for static assets); and requests by country.
- Crawler traffic (Googlebot, GPTBot, etc.) also appears here, through `userAgent_like` filters, which is useful for SEO/AEO monitoring. Whether `userAgent` as a dimension is available on Free should be checked with `settings { httpRequestsAdaptiveGroups { availableFields } }`.

### Gaps
- `cacheStatus` availability on Free was not individually verified (the Sep 2026 Free-zone test did not list it). Confirm with `availableFields`.
- Free-plan `notOlderThan`/`maxDuration` for `httpRequests1dGroups` after the Oct 2026 change has no official number. Query `settings`.

## 4. GA4: requirements, consent/CSP implications, Data API quotas, service-account access, value over Cloudflare

### Takeaway
Adding GA4 means a Google tag (gtag.js from googletagmanager.com) that sets first-party analytics cookies. That requires several CSP additions and, for EEA visitors under ePrivacy Art. 5(3), almost certainly a consent banner. CNIL says most large analytics offerings do not qualify for its audience-measurement exemption. GA4 would contradict the site's "data stays in your browser" positioning. The Data API itself is easy to use: a service account added as **Viewer** on the property, 200k core tokens per property per day and 40k per hour on standard properties, and most requests cost 10 or fewer tokens. GA4's unique additions (engaged-session rate, session duration, user counts) are not worth the privacy cost for a small, zero-login, single-purpose ticker site.

### Cited Findings
- GA4 Data API standard-property quotas: Core Tokens Per Property Per Day **200,000**, Per Hour **40,000**, Per Project Per Property Per Hour **14,000**, Core Concurrent Requests **10**, Core Server Errors Per Project Per Property Per Hour **10**. Analytics 360 is 10×. Realtime and Funnel have identical separate buckets. A new **Chat** category has 3,750,000 tokens per day and 500,000 per hour. "Most requests will charge 10 or fewer tokens." Daily quotas refresh at midnight PST. `"returnPropertyQuota": true` returns consumption. Hitting zero gives `429 RESOURCE_EXHAUSTED`. There are 120 potentially-thresholded requests per hour (demographic dimensions). — [GA4 Data API limits and quotas (updated 2026-10-26)](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)
- The quickstart supports authenticating with a **service account** and requires giving that account access to the GA4 property. — [GA Data API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart). Admin → Property → Property Access Management → add the service-account email → role **Viewer** (untick "Notify new users"). — [Contentful help: GA4 service account setup](https://www.contentful.com/help/apps/google-analytics-4/google-analytics-service-account-setup) (vendor doc, not Google). Grant it on the property, not only the account. — [Rig guide](https://rig.so/guides/connect-google-analytics-4) (vendor)
- Engaged session: "lasts longer than 10 seconds, has a key event, or has at least 2 pageviews or screenviews." Engagement rate = engaged sessions / sessions, the inverse of bounce rate. — [GA4 Session (Google Help)](https://support.google.com/analytics/answer/12798876?hl=en); [GA4 Traffic acquisition report](https://support.google.com/analytics/answer/12923437)
- GA4 data retention for user-level and key-event data is **2 months or 14 months** on standard properties. Longer options (26/38/50 months) are 360 only for other event data. Standard aggregated reports are unaffected. — [Google Analytics Help: Data retention](https://support.google.com/analytics/answer/7667196?hl=en)
- CSP for Google Analytics: `script-src-elem https://www.googletagmanager.com`, plus `img-src` and `connect-src` entries for `https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com` and Google domains. "Each Google top-level domain (TLD) must be specified individually." — [Google Tag Platform: CSP (updated 2026-09-18)](https://developers.google.com/tag-platform/security/guides/csp)
- Consent mode: with `analytics_storage` denied, tags "won't read or write first-party analytics cookies", but cookieless pings are still sent to Google Analytics "for basic measurement and modeling purposes." The cookieless ping may include user agent, screen resolution, and IP address (Google says GA does not store or log IPs). — [Consent mode overview (2026-07-30)](https://developers.google.com/tag-platform/security/concepts/consent-mode); [Consent mode reference](https://support.google.com/analytics/answer/13802165)
- Google requires collecting consent from EEA end users, and sending consent signals, to keep using tags for measurement and ad features under the EU User Consent Policy. — [GA4 Verify and update consent settings](https://support.google.com/analytics/answer/14275483?hl=en)
- ePrivacy Art. 5(3): EDPB Guidelines 2/2023 (v2.0, adopted 7 Oct 2024) cover storing or accessing information on a terminal, including through distributed client-side code that makes the device send information. Whether an exemption applies is case-by-case under national transposition. — [EDPB Guidelines 2/2023 page](https://www.edpb.europa.eu/documents/guideline/guidelines-22023-on-technical-scope-of-art-53-of-eprivacy-directive_en); [v1 PDF](https://www.edpb.europa.eu/system/files/2023-11/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_en.pdf)
- CNIL (France): audience-measurement trackers are exempt from consent only if strictly limited. Conditions are: audience measurement or A/B only, no cross-checking with other processing, scope limited to one publisher, IP truncated, and similar. "Most large audience measurement offerings do not fall within the scope of the exemption, regardless of their configuration." — [CNIL Sheet 16](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications)
- "Cookieless" analytics does not automatically avoid consent. It depends on what the implementation does on the device. — [Consenteo (2026-09-19)](https://www.consenteo.com/knowledge-hub/GDPR/analytics-cookies-consent) (secondary; it cites the EDPB guidelines)

### Inferences
- Cost of GA4 for this site: (a) four or more CSP origin changes, including googletagmanager and google-analytics wildcards; (b) a consent banner for EEA/UK traffic (a CMP, or a home-made banner with Consent Mode v2), which hurts the clean zero-login UX; (c) a direct contradiction of "data stays in your browser" / private marketing; (d) third-party JS weight that affects the INP/LCP the loop is trying to improve. With consent denied by default, the "Advanced" consent-mode cookieless pings still go to Google, which arguably conflicts with the site's privacy claims as well.
- Value over Cloudflare: GA4 adds sessions, engagement rate, average session duration, user/returning-user counts, custom events (for example clicks on a coin row or a currency switch), and acquisition channels. For a single-page-ish ticker, "engagement" is dominated by people glancing at a price, so engagementRate (more than 10 s or 2+ pageviews) is a weak optimisation target. Cloudflare RUM page views, visits, and referrers by path, plus Web Vitals, cover the decisions the loop actually makes: which coin pages get traffic, which are slow, which 404.
- The Data API quota is not a constraint. A daily loop of tens of `runReport` calls at about 10 tokens each is far below 200k per day.
- Gemini's requested fields (`pagePath`, `deviceCategory`, `screenPageViews`, `activeUsers`, `engagementRate`, `averageSessionDuration`) are standard GA4 Data API names, but they presuppose a GA4 property that does not exist.

### Gaps
- I did not fetch Google's own "Add users / roles" help page (support.google.com/analytics/answer/9305788) for the Viewer-role wording. The service-account-as-Viewer steps come from the Google quickstart plus vendor docs.
- I did not research the status of EU–US data transfer challenges to GA (Data Privacy Framework litigation) in 2026.

## 5. Core Web Vitals field data alternatives: CrUX API / CrUX History API

### Takeaway
The CrUX API and CrUX History API are free. They need an API key and allow 150 queries per minute per Google Cloud project, shared between the two. They return p75 and histograms for LCP/INP/CLS/FCP/TTFB per origin or URL and form factor, as 28-day rolling windows. History gives 40 weekly periods, 25 by default. Inclusion requires the origin or page to be "publicly discoverable" and "sufficiently popular" (undisclosed threshold), counting only opted-in Chrome users. A small new site will likely get **no data**: the API returns 404 / NOT_FOUND for that origin. URL-level data is even less likely.

### Cited Findings
- Eligibility: origins and pages must be **publicly discoverable** and **sufficiently popular**. "An exact number is not disclosed… The minimum number is the same for pages and origins." Only users who have usage-statistics reporting on, sync browser history, have no Sync passphrase, and use a supported platform are counted. Origins or pages with more than 20% of traffic excluded for ineligible dimension combinations are dropped. — [CrUX methodology](https://developer.chrome.com/docs/crux/methodology)
- The CrUX API needs a Google Cloud API key provisioned for the "Chrome UX Report API". Endpoint: `POST https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=KEY` with a body like `{"origin":"https://example.com","formFactor":"PHONE","metrics":["largest_contentful_paint", …]}`. Metrics include `largest_contentful_paint`, `interaction_to_next_paint`, `cumulative_layout_shift`, `first_contentful_paint`, `experimental_time_to_first_byte`, LCP image sub-parts, `navigation_types`, `round_trip_time`, and experimental soft-nav variants. **Rate limit: 150 queries per minute per Google Cloud project, free, not purchasable.** Data runs about 2 days behind. — [CrUX API](https://developer.chrome.com/docs/crux/api)
- History API: `records:queryHistoryRecord`. It is updated each Monday around 04:00 UTC and covers the previous **40 weeks**, one 28-day period per week. It returns 25 periods by default; set `collectionPeriodCount` to 1–40. It shares the 150 queries per minute limit with the CrUX API. — [CrUX History API](https://developer.chrome.com/docs/crux/history-api). Older copies of the docs said 25 weeks, so the expansion to 40 is a change. — [CrUX tools table](http://developer.chrome.com/docs/crux/methodology/tools) vs [older mirror](https://chrome.jscn.org/docs/crux/methodology)
- No country dimension in the CrUX API or History API. — [CrUX tools](http://developer.chrome.com/docs/crux/methodology/tools)

### Inferences
- The loop should call the CrUX API (origin, PHONE and DESKTOP) weekly and treat a 404 as "not enough traffic yet", not as an error. Once the origin appears, it is the ground-truth signal Google Search uses, which makes it worth tracking alongside Cloudflare RUM. URL-level CrUX for individual `/coin/*` pages will probably never qualify at this traffic level.
- Until then, Cloudflare RUM is the only field-data source for Web Vitals.

### Gaps
- The popularity threshold is undisclosed by design, so no visitor count can be given for when a small site will qualify.

## 6. PageSpeed Insights API / Lighthouse lab data: quotas and API key

### Takeaway
PSI API v5 (`GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=…&key=…&strategy=mobile&category=performance`) is free. It gives Lighthouse lab data and, for now, CrUX field data. Google says it plans to drop the CrUX field data from PSI and points to the CrUX APIs. The key is optional but recommended for automation. Widely reported default quota: 25,000 queries per day, about 240 per minute (or 400 per 100 seconds), visible in Cloud Console. Running Lighthouse locally or in CI avoids quotas altogether.

### Cited Findings
- PSI returns CrUX real-world data and Lighthouse lab data. "We plan to discontinue including real-world data from the Chrome User Experience Report in this API. We recommend the CrUX API… or the CrUX History API instead." An API key is recommended for automated queries. Example: `curl https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://web.dev/&key=yourAPIKey`. — [PSI API Get Started](https://developers.google.com/speed/docs/insights/v5/get-started)
- Quotas: 25,000 requests per day and 240 per minute per key or project. — [Nexla docs](https://docs.nexla.com/user-guides/connectors/google_page_speed_insights_api) (third-party). Another third-party guide says the official Cloud quota is "25,000 queries per day and 400 queries per 100 seconds", and that the API is free with no paid tier. — [Unlighthouse](https://unlighthouse.dev/learn-lighthouse/pagespeed-insights-api/rate-limits.md). Not confirmed on a Google page in this session.

### Inferences
- For the loop, PSI or Lighthouse is the right tool for pre- and post-deploy lab regression checks on a fixed URL set (home plus top 5 coin pages, mobile). It is deterministic enough to compare builds and needs no visitors. Running the `lighthouse` CLI or Lighthouse CI inside the existing Playwright/CI job removes quota and Google-dependency concerns.

### Gaps
- The PSI quota numbers come from secondary sources. The authoritative value is on the project's Cloud Console quota page.

## 7. Recommendation: minimal set of sources for a small privacy-first site

### Takeaway
Use **Cloudflare only for behaviour**, plus **free Google performance APIs that do not touch visitors**. Do not add GA4. Recommended minimal stack:
1. **Cloudflare Web Analytics (RUM)**. Enable through Pages "Metrics → Enable" or the zone Web Analytics setting, and decide deliberately between "Enable Globally" and the default "Exclude EU". Query weekly via GraphQL `rumPageloadEventsAdaptiveGroups` (views/visits by `requestPath`, `refererHost`, `deviceType`, `countryName`) and `rumWebVitalsEventsAdaptiveGroups` (p75 LCP/INP/CLS plus sub-parts by path). Use one account-scoped token with Account Analytics Read.
2. **Cloudflare zone HTTP analytics** (`httpRequestsAdaptiveGroups`, 30-day window on Free since Oct 2026) for 404s and 5xx by path, request volume, and possibly cache status. Use a zone-scoped Analytics Read token, or the same token with zone access.
3. **Lighthouse (CI) or PSI API** for lab regression gating on each deploy.
4. **CrUX API / History API** polled weekly, treating 404 as "not yet eligible". It becomes the authoritative CWV signal once the site qualifies.

### Cited Findings
- All key facts are cited in sections 1–6 above. The privacy basis: no cookies or localStorage, no fingerprinting, IP discarded at the edge, visits not users ([CF blog](https://blog.cloudflare.com/the-rum-diaries-enabling-web-analytics-by-default); [CF CWV doc](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)). Contrast with CNIL's position that most large analytics offerings need consent ([CNIL](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications)).

### Inferences
- Rewrite the Gemini plan's GA4 `runReport` step as Cloudflare GraphQL query A (views/visits by path and device) plus query B (vitals by path). Drop `engagementRate` and `averageSessionDuration` as objectives. Use proxies the site already has instead: RUM page views per visit as a depth proxy, and the share of visits with a referrer from search engines.
- Guardrails for the loop: (a) always read `avg.sampleInterval` and skip decisions on paths with few raw samples; (b) snapshot weekly results into the repo or KV, since RUM is down-sampled after 7 days and HTTP data covers only 31 days; (c) branch on `errors` in GraphQL HTTP-200 responses; (d) note in the privacy page that Cloudflare Web Analytics (cookieless) is used, so the "data stays in your browser" claim stays accurate. That claim concerns the user's settings, not aggregate page-view beacons.
- Secrets needed: `CF_ACCOUNT_ID`, `CF_RUM_SITE_TAG`, `CF_ZONE_ID`, `CF_ANALYTICS_TOKEN` (Account Analytics Read, plus zone Analytics Read), and `GOOGLE_API_KEY` restricted to the Chrome UX Report API and PageSpeed Insights API. No Google OAuth or service account is needed.

### Gaps
- Whether the privacy-policy wording legally needs updating, and whether Cloudflare RUM qualifies for a consent exemption in each EU member state, is a legal question this research did not settle. Cloudflare's own default of excluding EU visitors suggests it treats this as a risk area.
