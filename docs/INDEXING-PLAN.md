# Getting indexed and ranked on Google: step-by-step plan (12 Nov 2026)

Written from the owner's first Search Console exports (Page indexing and Crawl stats, to 9 Nov). The figures
themselves stay out of this public repo; this file records what they mean and what to do.

## What the exports say
- **Only the home page is indexed.** Every other sitemap URL is "Discovered – currently not indexed": Google
  knows the address from the sitemap but has never fetched it. The three other excluded URLs are expected (the
  widget's `noindex`, one redirect, one canonical alternate).
- **Google is barely crawling.** After the first three days it dropped to a handful of requests a day. Almost all
  of them re-rendered the home page: about two thirds were images and other page resources, only a few percent
  were HTML pages, and under 1% was discovery of new URLs.
- **About a fifth of requests failed, all inherited from the domain's previous owner:** 404s for old addresses and
  DNS errors for two old hosts (`mail.` and `secure.`). Our own server is fast and Search Console reports no host
  problems.
- **Conclusion:** nothing technical is blocking Google. It has little demand for a re-registered domain with an old
  footprint and no links. The levers, in order: check the domain's history, ask for the key pages, earn the first
  links, keep the site cheap to crawl, and give it weeks.

## A. Owner, once (about 20 minutes)
1. Search Console → **Security & Manual actions**: both reports must say "No issues detected". If a manual action
   from the old site is listed, press *Request review* and say the domain changed hands on 22 Oct 2026 and now
   serves a new site. Nothing else in this plan works while a manual action is open.
2. Search Console → **Removals**: nothing should be listed for this domain. Cancel any old request.
3. **Sitemaps:** submit `sitemap.xml`, `sitemap-coins.xml`, `sitemap-sectors.xml` and `sitemap-pages.xml`. The three
   section files let the Page indexing report show coins, sectors and other pages separately.
4. **Bing Webmaster Tools:** *Import from Google Search Console*. Bing usually indexes a new site sooner, and it
   feeds DuckDuckGo, Copilot and part of ChatGPT search. IndexNow already reports every change to Bing.
5. Crawl stats → *By response* → **Not found (404)** → export the examples and drop the file in a chat. Old
   addresses that match a current page get a redirect; the rest are left to expire.
6. **DNS (Cloudflare):** add `www` (AAAA `100::`, Proxied) plus the www → root redirect rule, and delete the
   duplicate `_dmarc` record that contains `p=none`.
7. **GitHub repo → About:** Website `https://cryptopriceticker.com`, a one-line description and topics. It is a
   crawlable link from a site Google visits constantly.

## B. Owner, daily for about two weeks (5 minutes)
Search Console → URL Inspection → paste one URL → **Request indexing**. Google accepts roughly 10 a day, and asking
twice for the same URL doesn't help. All URLs start with `https://cryptopriceticker.com`.

| Day | URLs |
| --- | --- |
| 1 | `/sector/layer-1/` `/sector/layer-2/` `/sector/ai/` `/sector/defi/` `/sector/depin/` `/sector/memecoins/` `/sector/privacy/` `/sector/gaming/` `/sector/stablecoins/` `/convert/` |
| 2 | `/heatmap/` `/widgets/` `/about/` `/trust/` `/coin/btc/` `/coin/eth/` `/coin/bnb/` `/coin/xrp/` `/coin/sol/` `/coin/doge/` |
| 3 | `/coin/trx/` `/coin/hype/` `/coin/zec/` `/coin/xmr/` `/coin/link/` `/coin/ada/` `/coin/bch/` `/coin/xlm/` `/coin/near/` `/coin/uni/` |
| 4 | `/coin/ltc/` `/coin/avax/` `/coin/sui/` `/coin/gram/` `/coin/hbar/` `/coin/shib/` `/coin/qnt/` `/coin/tao/` `/coin/pepe/` `/coin/okb/` |
| 5 | `/coin/aave/` `/coin/sky/` `/coin/mnt/` `/coin/dot/` `/coin/icp/` `/coin/paxg/` `/coin/wlfi/` `/coin/ondo/` `/coin/aster/` `/coin/ena/` |
| 6+ | The remaining coins in the order of the home page table, 10 a day; stablecoins last. |

Stop once the Page indexing report shows Google crawling pages by itself (the "Discovered" count falling without
requests).

## C. First links, one a day (the real unlock)
"Discovered – currently not indexed" on a new domain is mostly a demand problem, and links from sites Google
already crawls are what create demand. `docs/LAUNCH-KIT.md` has the drafts. In order of effort:
1. GitHub repo About link (step A7) and the repo README link (already there).
2. Your own profiles: X, LinkedIn, GitHub profile, any site you control. Embed the widget on one of them.
3. Listings: AlternativeTo (as an alternative to CoinMarketCap/CoinGecko), Product Hunt, relevant GitHub
   "awesome" lists (crypto tools, self-hosted dashboards), free widget directories.
4. One community post where the tool answers a question (a ticker for a stream, a no-login tracker, a price
   widget for a blog). Write it yourself; don't mass-post.
Never buy links or use link exchanges: on a domain with an old footprint that is the fastest way to a manual action.

## D. Site side (the daily build task works through `docs/QUEUE.md`)
- Done: honest `lastmod`, section sitemaps, IndexNow after every release, name and upper-case redirects,
  `pages.dev` copies `noindex`, valid robots.txt, crawler-access checks in `check-live`.
- Queued: fewer image requests when Google renders the home page (one icon sprite instead of a request per coin),
  so the little crawling Google does goes to pages instead of logos.
- Keep releases batched (the daily build ships at most once a day): every asset change makes Google re-fetch the
  scripts and styles before it gets to pages.

## E. Hold for now
- **No new URL families** (comparison pages, category hubs, per-currency pages, PR #16) until at least half of
  today's pages are indexed. Google has not crawled the pages that exist; more templated URLs lengthen the queue and
  raise the risk that the site is judged as mass-produced.
- **Don't `noindex` or remove coin pages yet.** If the indexed count hasn't moved four weeks after steps A–C,
  the fallback is to list only the top ~40 pages in the sitemap and let the rest be found through links.

## F. Measure weekly (Mondays)
Export the same two reports (Page indexing → Export; Settings → Crawl stats → Export) and drop them in a chat, or
finish the Apps Script collector (`scripts/telemetry/README.md`) so the numbers arrive by themselves. Watch three
things: pages indexed, crawl requests per day, and the share of requests that are HTML.

## What to expect
Google's own figures put first crawling of a new URL anywhere from hours to "weeks or never" on a site it does
not yet trust. Requested URLs are usually fetched within days; pages left to the sitemap follow once links exist.
Rankings come after indexing: the pages have to be in the index for a few weeks before positions settle.
