> **Research snapshot, 2026-11-16.** Search, AI-search and Claude Code changes from 6 to 16 November 2026, why Google's
> AI Mode calls this site "offline or defunct", why Preferred Sources finds nothing, and how to use Opus 5.5 to find SEO
> work in this codebase. Every finding is also a line in [../facts.jsonl](../facts.jsonl) (view: [../FACTS.md](../FACTS.md)).
> Confidence words: **official** (the platform's own page), **reported** (trade press), **claim** (vendor or single blog).

# 1. What changed, 6–16 November 2026

| Date | Change | Confidence | What it means here |
| --- | --- | --- | --- |
| 10 Nov | **Google November 2026 core update** started 10:07 PT, global, all languages, "may take up to 2 weeks" ([Search Status Dashboard](https://status.search.google.com/incidents/WLxcJyC6jMWMfryxsKMc)). Third core update of 2026; Google gave no new guidance ([SEJ](https://www.searchenginejournal.com/seo-pulse-core-update-chatgpt-business-hub-ai-modes-new-model/597135/)). | official | Don't read ranking changes until about a week after Google marks it complete. Annotate 10 Nov. |
| 10 Nov | **ChatGPT Business Hub** (beta): claim or create a profile at chatgpt.com/business-hub, DNS TXT domain check, identity check, category and description. Online-only businesses are eligible. Insights: *mentions* (ChatGPT referencing your website) and website clicks ([SEJ how-to](https://www.searchenginejournal.com/submit-website-chatgpt/596785/), [OpenAI](https://openai.com/index/introducing-businesses-chatgpt/)). | official | First source of ChatGPT mention/click counts. Owner action (needs the owner's identity and DNS). |
| 12 Nov | **Gemini 4 Hydrogen** is AI Mode's default model and answers the "hardest" AI Overview questions; Google says it fans out wider and links a broader range of sites ([SEJ](https://www.searchenginejournal.com/google-gemini-4-hydrogen-default-ai-mode/597096/), [Google](https://blog.google/products-and-platforms/products/search/gemini-4-hydrogen-search-upgrade/)). | official | Log 12 Nov separately from the core update when reading AI citation data. |
| 12 Nov | New Search Central page **"Identify Google Search traffic"**: Referer uses the `origin` policy (`https://www.google.com/`, local Google domains, `android-app://com.google.android.googlequicksearchbox/`), no query, sometimes blank ([doc](https://developers.google.com/search/docs/monitor-debug/identify-google-search-traffic)). | official | Our redirects are server-side 301s, so the Referer survives. Nothing to change. |
| 9 Nov | Aggregator/supplier units support "things to do" queries ([What's new](https://developers.google.com/search/updates)). | official | Not relevant. |
| 5–8 Nov | **Cloudflare**: OpenAI pays Cloudflare for "this page changed" hints so its crawler stops re-fetching unchanged pages; over half of AI-crawler fetches hit unchanged pages; Crawler Hints (all plans) also send IndexNow ([SEJ](https://www.searchenginejournal.com/cloudflare-ai-agent-optimization-new-seo/596248/), [Cloudflare docs](https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/)). | reported | Owner: switch Crawler Hints on. Honest `lastmod` and our IndexNow job matter more now. |
| 11 Nov | **Bing** documented an AI-off switch: a preview Chrome/Edge extension and the `-ai` operator ([Bing blog](https://blogs.bing.com/search/2026/11/your-choice-turn-ai-answers-on-or-off-in-bing)). | official | Nothing to do. |
| 13 Nov | Yahoo Scout will pay publishers via the ILC for AI-answer use; Google is testing removing AI Mode from the search bar ([SER](https://www.seroundtable.com/ilc-yahoo-42528.html), [SER](https://www.seroundtable.com/google-dropping-ai-mode-again-42534.html)). | reported | Watch only. |
| 2 Nov | Gary Illyes implied click and query data won't come to Search Console's AI report soon ([SER](https://www.seroundtable.com/click-data-search-console-ai-reporting-42437.html)). | reported | Judge AI visibility by impressions per page plus GA4 referrals. |
| 30 Oct (context) | Google, Bing, OpenAI and Anthropic back one robots.txt AI-training opt-out (`__usage_ai-training`), Google support in early 2027 ([Search Central blog](https://developers.google.com/search/blog/2026/10/ai-training-control)). | official | Owner welcomes training crawlers: add nothing. |
| 14 Nov | Ziff Davis: organic Google referrals −37% year on year, "not planning on a search recovery" ([SEJ](https://www.searchenginejournal.com/seo-pulse-core-update-chatgpt-business-hub-ai-modes-new-model/597135/)). | reported | Growth can't rest on Google clicks alone: alerts, widgets, the installable app, direct visits. |

Claude Code (22 Oct–3 Nov, v2.1.308–2.1.318; [roundup](https://claude-world.com/articles/claude-code-november-2026-whats-new/), [changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)):
`ultrathink` runs that turn at `xhigh`; `CLAUDE_CODE_SUBAGENT_EFFORT` and a subagent's `effort:` frontmatter set
subagent effort; the Read tool no longer returns an "unchanged since last read" stub (re-reading costs tokens again);
Opus 4.8 fast mode is removed 30 Nov (no effect: sessions use Opus 5.5); Agent Skills were donated to the Agentic AI
Foundation (SKILL.md stays portable).

# 2. "Appears to be offline or defunct": Google AI Mode on this site (owner's screenshot, 16 Nov)

Asked for "a great website called cryptopriceticker that was privacy based", AI Mode answered that CryptoPriceTicker.com
"appears to be offline or defunct", active "around 2018–2022", with an X handle `@CoinPriceTicker` and a Quora space,
and recommended Coinlib, Coinpaprika and others.

**Why:** AI Mode grounds answers in Google's index and its memory of the domain. Google has indexed only the home page of
the new site (INDEXING-PLAN.md), and until today no page said, in plain words, that the site is live, relaunched by the
same owner in October 2026, and privacy-first. `/trust/` even described the domain's past as an unrelated earlier
registration and its meta description said "a new domain owner", which reads as a different entity.

**How AI answers get corrected** (no one can edit an AI answer; vendor guides agree on the method,
e.g. [Kismet](https://kismetcreativeco.com/seo/google-ai-overview-wrong-business-information/),
[LogicBalls](https://logicballs.com/blog/ai-overviews-accuracy-what-google-documents-and-what-businesses-can-do)):
1. Fix the source: state the correct facts plainly, with dates, near the top of pages Google indexes first. **Done
   16 Nov:** home (hero line, a "Back and live since October 2026" card, description), `/about/#history-h` (dated
   history), `/trust/` (same-owner wording), `llms.txt` (status line), Organization/WebSite JSON-LD (`alternateName`,
   `description`).
2. Get those pages crawled: Search Console → URL Inspection → Request indexing for `/`, `/about/`, `/trust/` after
   the release (owner).
3. Report the answer: thumbs-down under the AI Mode answer → quote the wrong sentence, give the fact and the proving URL
   (`https://cryptopriceticker.com/about/#history-h`). No promise of a change (owner).
4. Fix third-party profiles the answer cites: if `@CoinPriceTicker` and the Quora space are the owner's, update their
   bio/pinned post ("back at cryptopriceticker.com since Oct 2026") and tell a session so they can join `sameAs`; if
   not, leave them out of our markup (owner).
5. Re-test the same question in AI Mode and AI Overviews after the pages are re-crawled; answers can lag weeks.

`foundingDate` was deliberately not added: the founding date of the original site isn't verified.

# 3. Preferred Sources shows "No results"

Google's tool lists only sites it treats as regularly updated sources ("Sources that are not updated regularly may be
unavailable"); domains and subdomains only, and the site must be included in Search generative AI features in Search
Console ([doc](https://developers.google.com/search/docs/appearance/preferred-sources)). With one indexed page and no
dated, regularly published content, the site doesn't qualify yet, so the "Add us as a preferred source" links were a
dead end. **Removed 16 Nov** from the home footer and `/about/`; re-add when the tool finds the domain (fact
`google-preferred-sources-ineligible`, re-check by 15 Jan 2027).

What would make the site eligible later: being indexed, and a dated page that changes on a schedule (for example a
weekly, computed market report with an RSS/Atom feed; QUEUE item, gated on the news decisions in
NEWS-AND-MONETIZATION.md §9).

# 4. Other "add us / claim us" channels like Preferred Sources

| Channel | What it does | Cost | Status |
| --- | --- | --- | --- |
| ChatGPT Business Hub | Profile ChatGPT can use; mention and click counts | Owner identity + DNS TXT | Owner action |
| Bing Webmaster Tools | Bing/Copilot indexing; AI Performance (citations, grounding queries) | Free, import from Search Console | Owner action |
| AlternativeTo listing | Appears on "alternatives to CoinMarketCap/CoinGecko/Coinlib" pages that AI answers draw on (the screenshot's answer was an alternatives list) | Free (slow queue) or $5 priority; new listings' link usually nofollow ([guide](https://saascity.io/directories/alternativeto)) | Owner action |
| PWA stores and directories | Microsoft Store (PWABuilder + Partner Center), Google Play (Trusted Web Activity, one-time fee), pwa.directory, awesome-pwa ([list](https://pwa.directory/blog/where-to-list-your-pwa)) | Developer accounts | Owner decision; the site is already an installable PWA |
| Launch platforms | Product Hunt, Show HN (wants something usable without sign-up: fits), DEV #showdev | Owner's own words | Owner action (LAUNCH-KIT.md) |
| GitHub repo About | Website link, description, topics on a site Google crawls constantly | Free | Owner action |
| Cloudflare Crawler Hints | Tells crawlers what changed (IndexNow + the OpenAI pilot) | Free toggle | Owner action |
| RSS/Atom feed | Followable in feed readers; Chrome iOS still has Follow (Android retired it) ([Feeder](https://feeder.co/knowledge-base/rss-for-your-browser/chrome-rss-feed-readers)) | Needs dated content | Next build, with the weekly report |

Not recommended: Google Business Profile (online-only businesses are ineligible); a Wikidata item before independent
coverage exists (likely deleted as not notable); paid directory links (link spam).

# 5. Using Opus 5.5 to find SEO work in this codebase

What worked in this session, and what the sources above suggest:
- **Deterministic first, model second.** `node scripts/seo-audit.mjs` reads every sitemap page as a crawler gets it (no
  JavaScript) and reports what seo-lint doesn't: visible words, share of each page's 3-word phrases that are its own
  (template risk), title/H1/description agreement, heading order, alt text, link text, inbound internal links, Open
  Graph/Twitter tags, JSON-LD fields, stray template text, and the brand facts AI answers need. It found the missing
  brand facts and Organization description in seconds; the model then fixed them.
- **Read what the crawler reads.** Strip one page per template to text and read the first 300 words: that's how the
  converter's option labels were found ahead of each coin page's unique figures (moved below "About", 16 Nov).
- **Fresh news needs search, then the primary page.** Several `extended` web searches in one turn, then fetch the
  platform's own page (Search Central "What's new", Status Dashboard, the vendor's blog) before recording a fact as
  official.
- **Fan out only for breadth.** For a whole-repo read, split by directory into subagents at `low`/`medium`
  effort (`CLAUDE_CODE_SUBAGENT_EFFORT`) with one checklist, then verify their evidence in the main session; use
  `ultrathink` for the one synthesis turn. Third-party skills such as `claude-seo` crawl up to 500 pages with parallel
  subagents ([directory](https://tessl.io/registry/skills/github/AgriciDaniel/claude-seo/seo-audit)), but they're
  unvetted code: read before installing, and prefer this repo's own scripts.
- **Record, don't re-research.** Every finding goes into `docs/knowledge/facts.jsonl` with a date, confidence and
  re-check date; `node scripts/kb.mjs` prints what's open at the start of each session.
