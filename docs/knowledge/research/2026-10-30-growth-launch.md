> **Research snapshot, 2026-10-30.** Getting visitors and links: launch venues, rules, widget links. Sources are cited inline; facts may have changed since. Current decisions and status live in [../PLAYBOOK.md](../PLAYBOOK.md) and [../DECISIONS.md](../DECISIONS.md).

# Launch & Growth Playbook for cryptopriceticker.com (as of Oct 30, 2026)

Scope: legitimate ways for a new, free, ad-free, no-login crypto price site (114 coin pages, sector filters, private in-browser portfolio + alerts, tab-title price, free iframe widget, open-source repo github.com/usaflees/cpt, Cloudflare Pages) to get indexed, get first visitors, earn links, and retain users. Solo builder, zero budget.

Repo facts checked locally (so drafts stay accurate): `sitemap.xml` has 116 `<loc>` entries; `robots.txt` references the sitemap and disallows `/scripts/`, `/content/`, `/docs/`; widget lives at `/embed/?layout=…&coins=…`; `site.webmanifest`, icons and `og-image.png` exist; README says there is no framework and no build step, so the repo is deployed as-is. Side note for the caller: `cpt-optimization.bundle` and `cpt-optimization.patch` sit in the repo root, and the README says whatever is in the repo gets deployed, so they may be publicly downloadable. Worth checking.

---

## 1. Indexing a brand-new site (Google Search Console, sitemaps, request-indexing limits, Bing, IndexNow, timelines)

### Takeaway
Set up Google Search Console (Domain property via DNS on Cloudflare), submit the existing sitemap, use "Request indexing" only for a handful of key URLs (the daily quota is unpublished), then import the property into Bing Webmaster Tools and keep IndexNow for changed URLs. Expect days to weeks. Links from pages that already get crawled, plus solid internal links, do more than repeated requests.

### Cited Findings
- Google: "It can take a few weeks for Google to notice a new site." Its advice when a small site is missed is to "Wait a while, and try to get linked from other sites." — [Google: Get your website on Google](https://developers.google.com/search/docs/fundamentals/get-on-google)
- "Crawling can take anywhere from a few days to a few weeks." Requesting a crawl "does not guarantee that inclusion in search results will happen instantly or even at all." The URL Inspection tool is for "just a few URLs" and has a quota. Requesting a recrawl of the same URL several times "won't get it crawled any faster." For many URLs, submit a sitemap, which "can be very helpful if you just launched your site." — [Google: Ask Google to recrawl your URLs](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl) (updated 2025-12-10)
- URL Inspection tool help: "Indexing typically takes only a day or so, but can take much longer in some cases." "There is a daily limit to how many index requests you can submit." — [Search Console Help: URL Inspection tool](https://support.google.com/webmasters/answer/9012289)
- Google does not publish the UI request-indexing quota. The URL Inspection **API** quota (2,000 queries/day and 600/minute per site) covers inspection only and does not request indexing. — [Search Console API usage limits](https://developers.google.com/webmaster-tools/limits); the UI-vs-API distinction is explained in [Incremys (secondary)](https://www.incremys.com/en/resources/blog/google-search-console-quota). Commonly repeated "~10 per day" figures are anecdotal and unverified.
- Google's Indexing API (200 publish requests/day by default) is officially limited to job-posting and livestream structured-data pages. Do not use it for coin pages. — [Indexing API quota](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing). The eligibility restriction comes from the Indexing API quickstart; I did not re-fetch it, so treat it as background knowledge.
- Submitting a sitemap "is merely a hint". It can be submitted via the Search Console Sitemaps report, the API, or a `Sitemap:` line in robots.txt (this site already has that line). Limit: 50,000 URLs or 50 MB per file. — [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) (updated 2026-07-08)
- Google's AI-features doc recommends "Making your content easily findable through internal links" and verifying in Search Console. — [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- Bing Webmaster Tools can **import verified sites from Google Search Console**. Imported sites are auto-verified and sitemaps come with them, and newly added GSC sitemaps keep syncing. Traffic data can take up to 48h. — [Bing: Add and verify site](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b); [Bing blog (updated June 2025)](https://blogs.bing.com/webmaster/2019/9/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools)
- Bing calls IndexNow "Strongly Recommended". Its URL Submission tool/API allows up to 10,000 URLs per domain per day (resets at midnight UTC), and the quota "may be revised". — [Bing: URL submission](https://www.bing.com/webmasters/help/URL-Submission-62f2860b)
- IndexNow: submitting "does not guarantee immediate indexing". Every submitted URL counts toward crawl quota. It is meant for **recently added/updated/deleted** URLs, not for resubmitting the whole site (except after a migration). Use sitemaps for the full inventory. Avoid "Submitting unchanged URLs repeatedly". The first request may return HTTP 202 while the key is verified. Up to 10,000 URLs per POST. — [IndexNow FAQ](https://www.indexnow.org/faq)

### Inferences
- Since IndexNow is already done, the biggest missing piece is GSC. Use a Domain property (DNS TXT record in Cloudflare), submit `https://cryptopriceticker.com/sitemap.xml`, then request indexing for maybe 5–10 priority URLs: home, /about/, /coin/btc/, /coin/eth/, /coin/sol/, and one sector view if it has its own URL. Spread these over a few days.
- Don't re-ping IndexNow for 114 coin pages every day just because prices changed. The HTML probably isn't materially different, and the FAQ warns against submitting unchanged URLs. Ping when page content actually changes, such as regenerated stats or new coins.
- Coin pages are near-template pages, so give each one unique text (the existing coin-about.json, computed stats) and link between them (related coins in the same sector, prev/next) to help discovery and avoid "Crawled – currently not indexed".
- One link from a page that is already crawled often (a GitHub README, a dev.to post, a Show HN thread) is the practical way to speed up first discovery. This follows from Google's "try to get linked from other sites".

### Gaps
- No official figure for the GSC UI "Request indexing" daily cap, and no official median time-to-index for new domains in 2026.
- Whether Google uses IndexNow: IndexNow's FAQ doesn't say. Historically Google has not been a participant. I did not re-verify this for 2026.

---

## 2. Launch venues and their current self-promotion rules

### Takeaway
Hacker News (Show HN), Product Hunt, r/SideProject, r/webdev (Saturdays only, "project not product"), Indie Hackers and dev.to all allow showing your own work if you follow their format rules. r/CryptoCurrency effectively blocks a new account from submitting (500 comment karma and 60 days) and bans promo links. Lobsters bars self-promo for the first 70 days and is invite-only. HN and r/webdev explicitly ban LLM-generated post text, so every draft below must be rewritten by the owner in their own words.

### Cited Findings
**Hacker News / Show HN**
- Show HN is "for something you've made that other people can play with". Make it easy to try, "ideally without barriers such as signups or emails". The title must begin with "Show HN". "The project should be non-trivial. Don't post quickly-generated one-offs." "Please don't ask friends to upvote or comment." No landing pages or fundraisers. Posts appear on /shownew and move to /show after a small points threshold. — [Show HN guidelines](https://news.ycombinator.com/showhn.html)
- HN guidelines: "Please don't use HN primarily for promotion. It's ok to post your own stuff part of the time." **"Please don't put generated text in HN posts. Write your text yourself… please don't automate posting."** "Don't solicit upvotes, comments, or submissions." Don't delete and repost. No uppercase or exclamation points in titles. — [HN guidelines](https://news.ycombinator.com/newsguidelines.html)
- Timing: blog guides suggest Tue–Thu 7–10am PT. A well-known launch guide argues there is no best time. One founder postmortem reported about 6k pageviews and 500+ uniques from an HN front-page appearance, with a 24h spike and a long tail. Its first attempt failed because the title sounded too "producty". All of this is anecdotal. — [Lucas F. Costa: How to do a successful HN launch](https://www.lucasfcosta.com/blog/hn-launch); [Indie Hackers postmortem](https://www.indiehackers.com/post/front-page-of-hn-the-full-postmortem-traffic-lessons-surprises-cbe9e0a7f6)

**Product Hunt**
- "never ask outright for upvotes or run anything that requires them… can get your launch disqualified." The help center links Featuring Guidelines. — [PH Launch Guide (help center)](https://help.producthunt.com/en/articles/17350772-launch-guide)
- Community Guidelines (Apr 2025): mass messaging, asking for upvotes, bots, and incentivized upvotes are "not acceptable". "Self-promoting in comments will also be removed." Incomplete profiles or company-style usernames raise the chance of review or limited visibility. — [PH Community Guidelines](https://help.producthunt.com/en/articles/3615694-community-guidelines)
- Asking friends or family to upvote "may trigger the algorithm to drop the product in the ranks or remove it from the homepage entirely." — [PH help: Can I ask my community to upvote?](https://help.producthunt.com/en/articles/484935-can-i-ask-my-community-friends-family-to-upvote-a-product)
- Self-hunting is fine: "79% of featured posts were by makers who self-hunted; 60% of #1 Product of the Day winners were self-hunted". Paying a hunter goes against the guidelines. — [PH: Before launch](https://www.producthunt.com/launch/before-launch)
- Format: Description max 500 characters. Up to 3 launch tags. The first comment should cover features, who it's for, your story, and "Ask for feedback (NOT upvotes)". Scheduling advice on the same page: 12:01am PST is the general rule of thumb, and the page also mentions a Friday 8am PT option. — [PH: Preparing for launch](https://www.producthunt.com/launch/preparing-for-launch)
- PH's leaderboard defaults to **featured** products. Featuring is a curation decision, and makers caught spamming or paying for upvotes are removed. — [PH: How Product Hunt works](https://www.producthunt.com/launch/how-product-hunt-works)
- Relaunching within six months may trigger a review of whether the update is "major". — [mean.ceo Oct 2026 (secondary)](https://blog.mean.ceo/product-hunt-launches-news-october-2026/). Not verified on a PH page.

**Reddit**
- r/CryptoCurrency Rule 2: "minimum of 50 comment karma with 30-days account age… for comments and **500 comment karma with 60 days account age for submissions**." "Self-Promotion content from accounts which do not engage with the community is not allowed. As a rule, an account should have 3 comments for every post." "Posting referral, promo links, or codes of any kind is strictly prohibited." Rule 3 covers vote manipulation and brigading. Circumventing rules can mean a permanent ban, and some violations get sites blacklisted. — [r/CryptoCurrency expanded rules](https://www.reddit.com/r/CryptoCurrency/wiki/expanded_rules)
- r/webdev: Rule 3 "no excessive self-promotion" (refers to the Reddit 9:1 rule). Rule 4 "We do not allow any commercial promotion or solicitation." Rule 5 limits project showcases to **Showoff Saturday**, with the correct flair: "Think project, not product. Focus on the technical details." Rule 8 removes "LLM generated posts or comments". — [r/webdev rules/about](https://www.reddit.com/r/webdev/about/)
- r/SideProject: self-promotion is the purpose of the sub, with no published karma minimum. One tracker reports a title format of "[Project name] - [Short description]". All of these are third-party summaries, so verify on the live rules page. — [AllDirectories (Feb 2026)](https://alldirectories.org/subreddit/r-sideproject); [Thread Otter (Jul 2026)](https://www.threadotter.com/subreddit-rules/sideproject); live rules: https://www.reddit.com/r/SideProject/about/rules
- Hidden AutoMod thresholds are common and not published. — [signals.sh (secondary)](https://signals.sh/blog/reddit-account-age-minimums-per-subreddit)

**Lobsters**
- Self-promo should be "less than a quarter of one's stories and comments in the last year". "New users (first 70 days) are not allowed to submit self-promo." New users can't submit links to domains not seen before. Membership is invite-only. — [Lobsters About](https://lobste.rs/about)

**dev.to / Indie Hackers**
- dev.to (archived FAQ): any post is fine if it meets community guidelines and gets past spam filters. You can set `canonical_url` for cross-posts. — [dev.to FAQ (archived 2023)](https://webcf.waybackmachine.org/web/20231202020802/https://dev.to/faq). I found no current official self-promo policy.
- Indie Hackers: no official self-promotion policy found. Community posts describe it as more liberal than Reddit. — [IH post (anecdotal)](https://www.indiehackers.com/post/how-do-you-deal-with-self-promotion-hate-0d64208508)

### Inferences
- Order of operations for a zero-audience solo builder: Show HN plus r/SideProject first (no karma gates). r/webdev on a Saturday with a technical write-up. dev.to article as a durable crawled backlink. Product Hunt later (week 3–4), once there are screenshots, a few real users, and a polished first comment. r/CryptoCurrency only after months of genuine participation, and even then probably only in a daily discussion thread if its rules allow.
- The crypto angle is a liability on dev-heavy venues (HN/webdev users are often crypto-skeptical). Lead with the engineering and privacy story (no tracking, no login, three exchange WebSockets merged client-side, no build step, open source) rather than "crypto".

### Gaps
- I could not fetch current rules for X/Twitter crypto communities, Bluesky, Farcaster/Warpcast channels, Telegram or Discord crypto servers, Hashnode, r/CryptoTechnology, r/Bitcoin, r/ethereum, or r/opensource. These are mostly per-group moderator rules; check each group's pinned rules before posting.
- I found no official r/SideProject rules text, only third-party summaries.
- Product Hunt's exact tagline character limit: not confirmed (commonly cited as 60; verify in the submission form).

---

## 3. Developer-angle distribution (GitHub, awesome-lists, widget demand and attribution norms)

### Takeaway
GitHub topics (up to 20) and a good README are free discoverability. The widget is the strongest durable link-earning asset, but Google's spam policy makes the brand-only credit link the right call: no keyword-rich or hidden links in widgets, and the link can't be a required term. Competitor widget attribution norms could not be verified from primary sources.

### Cited Findings
- GitHub topics: up to **20 per repo**, lowercase/numbers/hyphens, max 50 characters each. Topic pages list related repos and help people "find projects". — [GitHub Docs: Classifying your repository with topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)
- Google link spam includes "Keyword-rich, hidden, or low-quality links embedded in widgets that are distributed across various sites" and "Requiring a link as part of a Terms of Service, contract, or similar arrangement". Paid links are fine if marked `nofollow`/`sponsored`. — [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- Crypto price widgets are a real WordPress category. For example, "Cryptocurrency Widgets Pack" is built on CoinGecko's free API, and similar plugins show "Powered by CoinGecko" credits (attribution is common practice, but not confirmed as CoinGecko's requirement). — [WordPress.org: Cryptocurrency Widgets Pack](https://wordpress.org/plugins/cryptocurrency-widgets-pack); search summary, not primary terms

### Inferences
- Suggested repo topics, within the limit of 20: `cryptocurrency`, `crypto-prices`, `price-ticker`, `websocket`, `coinbase`, `binance`, `kraken`, `bitcoin`, `ethereum`, `static-site`, `cloudflare-pages`, `vanilla-js`, `no-framework`, `pwa`, `widget`, `embeddable-widget`, `portfolio-tracker`, `privacy`, `open-source`, `dataviz`.
- Keep the widget credit as plain brand text ("CryptoPriceTicker") linking to the home page, optional and removable, with no keyword anchors. Adding `rel="noopener"` is fine. Do not make the credit link a license condition. This is exactly the pattern Google's policy flags.
- Widget demand surfaces: WordPress (Custom HTML block accepts an iframe), Ghost (HTML card), Notion (`/embed` accepts URLs, though some sites block framing), Substack (generally does not allow arbitrary iframes; unverified), personal dashboards. A "How to embed live crypto prices in WordPress / Notion / Ghost" doc page targets the "free crypto price widget" query and gives users copy-paste snippets.
- Awesome lists: candidates to check for open-source crypto tools and dataviz (e.g., awesome-crypto-tools style lists, awesome-websockets, awesome-static-site style lists). Read each list's CONTRIBUTING.md first. Many require an established project (stars, age) and one PR per item.

### Gaps
- I did not verify any specific awesome-list's acceptance criteria. Names above are search targets, not confirmed venues.
- I could not fetch CoinGecko, CoinMarketCap or TradingView widget terms. Their attribution requirements and whether their credit links are follow/nofollow remain unverified.
- Notion embed behavior for this domain depends on the site's `X-Frame-Options`/CSP `frame-ancestors` for `/embed/` (check `_headers`). Not tested.

---

## 4. Legitimate link earning for a data site (original data, recaps, journalist requests, AI citations)

### Takeaway
The realistic zero-budget link sources are (a) original, regularly updated data pages built from the site's own computed stats (sector performance tables, weekly recap) and (b) answering journalist requests on the free, relaunched HARO and on Source of Sources. Google says AI Overviews/AI Mode citations follow normal SEO plus "unique, non-commodity" content. Raw price tables are commodity content; computed comparisons and methodology are not.

### Cited Findings
- HARO was acquired from Cision by Featured.com in **April 2025** and relaunched as a free email digest, free for journalists and sources. Cision had discontinued Connectively on Dec 9, 2024. Featured revived Connectively in 2026 (announced May 26, 2026) as a web platform with a free plan. — [Connectively docs](https://docs.connectively.us/en/articles/15233696-haro-is-acquired-by-featured-com); [Featured About](https://featured.com/about); [Press Gazette, Apr 2025](https://pressgazette.co.uk/news/cision-closes-journalism-jobs-board-and-sells-expert-enquiry-service/); [HARO blog May 2026](https://blog.helpareporter.com/connectively-is-back-and-haro-isnt-going-anywhere)
- HARO reports a 68% YoY rise in journalist requests (self-reported by the company founder). Every pitch is run through AI detection (Pangram), "35% of journalists now opt out of AI-flagged pitches", and an account is banned "roughly every 23 minutes" for spam. — [Featured press page, Aug 2026](https://featured.com/press/media-mention/haro-journalist-requests-climb-68-percent). A LinkedIn post adds a minimum outlet domain authority of 20. — [HARO LinkedIn](https://linkedin.com/company/help-a-reporter-haro)
- Source of Sources (Peter Shankman, HARO's founder) is free, sends up to 3 emails a day, and removes anyone who pitches off-topic even once. — [Source of Sources](https://www.sourceofsources.com/)
- Google: SEO best practices "remain relevant" for AI Overviews/AI Mode, which use "query fan-out" to show "a wider and more diverse set of helpful links". — [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- Google's generative-AI optimization guide (updated 2026-07-10) stresses "unique, valuable" content with "a unique point of view". A summary "simply restates information already available elsewhere." It warns against making separate content for every query variation. — [Google: Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- Google (June 2026): AI Overviews has over 2.5B monthly users and AI Mode over 1B. Google is testing a Search Console toggle to opt out of generative AI features. — [Google blog, Jun 3 2026](https://blog.google/products-and-platforms/products/search/new-controls-website-owners)
- Ahrefs: only 14% of the top-50 most-mentioned sources overlap across ChatGPT, Perplexity and AI Overviews. AI Overviews lean toward sites that already rank, ChatGPT toward publishers it has licensing deals with, and Perplexity pulls from a broader corpus. — [Ahrefs, Jun 2025](https://ahrefs.com/blog/top-mentioned-sources-are-not-shared-across-ai-assistants/)
- Mass-generating pages with AI "without adding value for users may violate Google's spam policy on scaled content abuse". — [Google: Using gen AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) (updated 2026-10-01)

### Inferences
- Linkable assets that come out of existing data (coin-stats.json already holds 7d–1y change, 52-week range and monthly closes):
  1. **Sector performance table** (AI vs DePIN vs L1 vs L2 vs DeFi/RWA vs Memes vs Privacy vs Gaming), 7d/30d/90d/YTD, equal-weighted with the method stated. Update it weekly on a stable URL (e.g., /sectors/) with a "last updated" date and a methodology note. Journalists and bloggers cite stable, dated tables.
  2. **Weekly market recap** (stable URL plus dated archive pages), written by the owner: top and bottom sectors, biggest 52-week-range moves. It must have real commentary to avoid thin or scaled content.
  3. **Methodology/About page** (exists) explaining exchange sources, how the price is picked when exchanges disagree, and latency. AI systems and journalists both reward clear sourcing.
- HARO/SOS tactic: answer only finance/crypto/fintech/web-dev queries where the owner has real expertise (e.g., "how do crypto price sites get data?", "are free trackers private?"). Write pitches by hand, since AI-flagged pitches are filtered.
- Small sites can be cited in AI answers mainly by ranking for long-tail, specific queries ("AI sector crypto performance this week", "DePIN tokens 30-day performance"). No shortcut tactics are supported by the evidence found.

### Gaps
- No rigorous, non-vendor study found on how often brand-new or small domains get cited by ChatGPT/Perplexity. Vendor studies (Ahrefs etc.) describe large-domain bias.
- HARO growth numbers are self-reported by the company.
- I did not verify Qwoted's 2026 free-tier status.

---

## 5. What gets sites penalized or banned (communities, Google, disclosure, crypto ads)

### Takeaway
The bans to avoid are vote solicitation or vote rings (HN, PH, Reddit), automated or LLM-written posting (HN, r/webdev), promo or referral links in r/CryptoCurrency, buying links or keyword links in widgets (Google), and undisclosed paid endorsements (FTC). Paid crypto ads are heavily restricted and need certification. They are irrelevant at $0 budget anyway.

### Cited Findings
- HN: no upvote/comment solicitation, no generated text, no automated posting, no delete-and-repost. — [HN guidelines](https://news.ycombinator.com/newsguidelines.html); [Show HN](https://news.ycombinator.com/showhn.html)
- PH: asking for or incentivizing upvotes, mass messaging and bots can lead to removal. Spammers are "permanently removed", and makers caught breaking rules "may be permanently banned". — [PH Community Guidelines](https://help.producthunt.com/en/articles/3615694-community-guidelines); [PH Before launch](https://www.producthunt.com/launch/before-launch)
- r/CryptoCurrency: vote manipulation and brigading are banned (sitewide too). Using alternate accounts to dodge karma multipliers means a permanent ban. Referral or promo links mean long-term or permanent bans. Some violations get the site blacklisted. — [r/CC rules](https://www.reddit.com/r/CryptoCurrency/wiki/expanded_rules)
- Lobsters: self-promo above about 25% of activity is unwelcome. New users can't self-promo at all. — [Lobsters About](https://lobste.rs/about)
- Google: buying or selling links for ranking, excessive link exchanges, automated links, keyword-rich widget links, ToS-required links, and scaled content abuse are all spam. — [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- FTC Endorsement Guides (updated June 29, 2023): disclose any "material connection" (payment, free product, relationship) clearly and conspicuously. Platform disclosure tools may not be enough on their own, and tagging a brand can count as an endorsement. — summaries: [Marketing Dive](https://www.marketingdive.com/news/what-brands-should-know-ftc-updated-endorsement-guides/690427/); [Quarles](https://quarles.com/newsroom/publications/deciphering-the-ftcs-updated-guidance-for-advertisers). Primary source: ftc.gov Endorsement Guides and FAQs, not fetched.
- Google Ads crypto policy: some crypto categories are allowed only with certification and in listed countries. Ads promoting buying, selling or trading crypto, ICOs, and DeFi trading protocols are listed as prohibited, as are destinations that **aggregate or compare crypto issuers**. The policy was updated Feb 2026. — [Google Ads: Cryptocurrencies and related products](https://support.google.com/adspolicy/answer/14009787); [Feb 2026 update notice](https://support.google.com/adspolicy/answer/16885619). This comes from a search summary; I could not open the full policy text, so verify before spending anything.

### Inferences
- If the owner asks friends to "check it out", the wording must be "I'd value feedback", never "upvote". Never share direct links to the HN item with a vote ask. Never post from multiple accounts.
- Disclosure line for any post by the owner: "I built this." For anything a friend posts, they should say they know the maker.
- A price/aggregator site running Google Ads would likely fall under the crypto policy's aggregator/comparison language. Treat paid ads as off the table, which is consistent with no budget.

### Gaps
- Meta and X crypto ad policies were not fetched (the search tool hit a rate limit). Background knowledge: both require prior authorization or licensing for crypto ads, but this is unverified for 2026.
- Primary FTC text was not fetched. Law-firm summaries were used.

---

## 6. Retention and "hype" features (PWA, push alerts, OG cards, widgets, tab price, shortcuts, dark mode)

### Takeaway
The highest-leverage repeat-visit features already exist (tab-title price, alerts, widget, themes). The remaining wins are making the site installable and, on iOS, explaining that alert pushes require Add to Home Screen. Per-coin OG images and a "copy share link" make shares look good. I found no rigorous public data on retention lift for price trackers specifically.

### Cited Findings
- iOS/iPadOS 16.4+ Web Push works only for **Home Screen web apps**. It requires a manifest with `display: standalone` or `fullscreen`, and permission can be requested only "in response to direct user interaction" (e.g., tapping a button). The Badging API (`setAppBadge`) works for installed web apps. — [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- Vendor docs add that after a user declines on iOS, the site must be removed and re-added to the Home Screen before the prompt can appear again. — [OneSignal: iOS web push](https://documentation.onesignal.com/docs/ios-web-push) (vendor doc, secondary)

### Inferences
- Alerts today are in-browser and private. They fire while a tab is open, unless a push service is added. True background push needs a service worker plus a push endpoint/VAPID server, which conflicts somewhat with the no-backend, static design. Be honest in copy: say "alerts while the page is open" if that's how it works.
- On iOS, show a small "Add to Home Screen to get alerts" hint only after the user creates an alert (a user-gesture moment). This follows WebKit's rule.
- Shareability: per-coin OG images (static, generated at build time, e.g., price-range or 30d sparkline snapshots) so links shared on X, Bluesky or Discord look distinct. The existing single og-image.png makes every share look the same.
- Keyboard shortcuts (e.g., `/` to search, `t` to cycle theme) are cheap HN-pleasers and worth mentioning in the Show HN text if they exist. Don't claim them if they don't.

### Gaps
- No primary, quantitative evidence found on how much PWA install, push alerts, dark mode or OG cards lift retention or sharing for price trackers. Treat these as best-practice judgment calls.

---

## 7. Synthesized launch playbook and ready-to-post drafts

### Takeaway
Week 1: indexing setup plus the developer-first launch (Show HN, r/SideProject, dev.to). Weeks 2–4: Saturday r/webdev, the linkable data pages, HARO/SOS, Product Hunt, and slow, genuine community participation. The drafts are skeletons the owner must rewrite in their own voice, because HN and r/webdev ban generated text.

### Cited Findings
(Every rule in the table and drafts is cited in sections 1–5 above. The key constraint is repeated here: "Please don't put generated text in HN posts. Write your text yourself" — [HN guidelines](https://news.ycombinator.com/newsguidelines.html); r/webdev removes "LLM generated posts or comments" — [r/webdev](https://www.reddit.com/r/webdev/about/).)

### Inferences

#### (1) Week-1 launch checklist (prioritized)
1. **Day 1 – Search Console:** add a Domain property via a DNS TXT record in Cloudflare. Submit `/sitemap.xml`. Run URL Inspection then "Request indexing" on: `/`, `/coin/btc/`, `/coin/eth/`, `/about/`. Add 2–4 more on days 2–3 (e.g., `/coin/sol/`, `/coin/xrp/`, top AI/DePIN coin). Don't repeat requests.
2. **Day 1 – Bing Webmaster Tools:** use "Import from Google Search Console" (auto-verifies and pulls in the sitemap). Check the IndexNow tab to confirm earlier submissions arrived.
3. **Day 1 – Pre-flight:** confirm `/embed/` can be framed by other sites (CSP `frame-ancestors` / X-Frame-Options in `_headers`), and that the main site isn't frameable if not intended. Confirm 404s return 404. Check that the OG image and title render (paste the URL into a Bluesky or Discord draft). Remove or move the `cpt-optimization.*` files from the deploy root if they're public.
4. **Day 1–2 – GitHub:** add 15–20 topics. Add a README hero screenshot or GIF, the live link, a "Embed the widget" snippet, a "How it works" section (three exchange WebSockets, no backend, no tracking) and a license. Pin the repo on the GitHub profile. Set the repo "Website" field to the site.
5. **Day 2 – Embed docs page:** "Free live crypto price widget": a copy-paste iframe, plus WordPress (Custom HTML block), Ghost (HTML card) and Notion instructions. Link it from the home page and footer.
6. **Day 2–3 (Tue–Thu, ~7–10am PT): Show HN** (draft A). Stay in the thread for hours and answer everything. Don't share the link with vote asks.
7. **Same week – r/SideProject** (draft B) on a different day from Show HN. Use screenshots or a GIF.
8. **Same week – dev.to article** (draft E), with the canonical pointing to dev.to or to a /blog post on the site if one exists. This gives a crawled backlink plus the developer audience.
9. **Saturday – r/webdev Showoff Saturday:** a technical-angle version of draft B with the "Showoff Saturday" flair and no commercial language (it's free and has no ads, so "project not product" fits).
10. **Ongoing from day 1:** sign up for HARO (helpareporter.com) and Source of Sources. Make an honest bio. Reply only to on-topic queries.
11. **Measurement:** GSC (impressions, pages indexed), Bing, Cloudflare Web Analytics (cookieless; consistent with the privacy positioning), and the referrer per venue.

#### (2) 30-day plan
- **Week 1:** checklist above. Goal: GSC and Bing set up, home and BTC/ETH pages indexed, first 200–1,000 visitors from HN/Reddit/dev.to (no guarantee; HN outcomes vary widely).
- **Week 2:** ship the **Sector performance page** (stable URL, weekly update, methodology). Post the first **weekly recap** written by hand. Fix any feedback from launch threads, and publicly credit the commenters who suggested fixes (a natural reason to reply in-thread). Start genuine participation on X/Bluesky (follow crypto-data and indie-dev accounts, reply with substance, post one chart or table from your own data per day with a link only sometimes). Begin commenting helpfully in r/CryptoCurrency daily threads, with no links, to build karma toward the 500 comment karma / 60 days bar.
- **Week 3:** **Product Hunt** launch (self-hunt; 12:01am PT; draft C). Prepare the gallery (3–5 screenshots: table, coin page, sector filter, widget builder, tab price) and the first comment. Tell existing users and followers "it's on PH today, feedback welcome". Second dev.to/Hashnode post on a technical topic (e.g., "Merging three exchange WebSocket feeds without a backend").
- **Week 4:** installable PWA (manifest `display: standalone`, service worker). Then a "what changed since launch" post on Indie Hackers with real numbers (traffic by source, indexing timeline), since postmortems with data do well there. Open PRs to 1–3 awesome-lists whose CONTRIBUTING rules the project now meets. Keep the weekly recap going. If the PWA or alerts are a substantial update, consider a Bluesky/X thread about it (not another Show HN; minor upgrades don't qualify).
- **Throughout:** IndexNow pings only for changed pages. Watch GSC "Pages" for "Crawled – currently not indexed" on coin pages, and enrich those pages' unique content.

#### (3) Per-venue rules table
| Venue | Self-promo allowed? | Rules link | Format | Timing / notes |
|---|---|---|---|---|
| Hacker News – Show HN | Yes, if it's something people can try, non-trivial, and made by you | https://news.ycombinator.com/showhn.html ; https://news.ycombinator.com/newsguidelines.html | Title "Show HN: …", link to the site, then a first comment written by you (no generated text) | Tue–Thu ~7–10am PT is common advice (anecdotal). Be present for hours. No vote asks, no reposting. |
| Product Hunt | Yes (self-hunting is normal) | https://help.producthunt.com/en/articles/17350772-launch-guide ; https://help.producthunt.com/en/articles/3615694-community-guidelines | Tagline, description (≤500 chars), up to 3 tags, gallery, maker first comment | 12:01am PT. Featuring is curated. Never ask for upvotes. Relaunch only for major updates. |
| r/SideProject | Yes, it's the purpose of the sub | https://www.reddit.com/r/SideProject/about/rules | Text post with screenshots and the story. Reported title format "Name - short description" | US morning. Don't repost within weeks. Reply to every comment. |
| r/webdev | Saturdays only, flaired "Showoff Saturday"; no commercial promotion; no LLM text | https://www.reddit.com/r/webdev/about/rules | Technical write-up: "project, not product" | Saturday only, or it gets removed |
| r/CryptoCurrency | Effectively no for a new account: submissions need 500 comment karma and 60 days; 3 comments per post; promo/referral links banned | https://www.reddit.com/r/CryptoCurrency/wiki/expanded_rules | Comments in daily threads; build karma first | Months out. Never use alt accounts. |
| Lobsters | No for the first 70 days; invite-only; self-promo under 25% of activity | https://lobste.rs/about | Need an invite from an existing member | Skip for now |
| Indie Hackers | Generally tolerated; no official rule found | https://www.indiehackers.com | Build-in-public post with numbers | Week 4 postmortem |
| dev.to | Yes, within community guidelines; supports canonical_url | https://dev.to/code-of-conduct (current) ; archived FAQ cited above | Technical article with embedded screenshots | Any weekday |
| HARO / Connectively / Source of Sources | Expert replies, not promotion; off-topic pitches get you banned; AI-flagged pitches are filtered | https://www.helpareporter.com ; https://www.sourceofsources.com | Short, human-written expert answers | Daily scan, reply before the deadline |
| X / Bluesky / Farcaster / Telegram / Discord | Per-community rules (not verified) | Each group's pinned rules | Native posts with your own charts; link sparingly | Ongoing; disclose "I built this" |
| GitHub awesome-lists | Per-list CONTRIBUTING.md (not verified) | Each list's CONTRIBUTING.md | One PR, one line, alphabetical, matching the format | After the repo looks mature (README, license, some stars) |

#### (4) Ready-to-post drafts (skeletons: the owner must rewrite these in their own words before posting; HN and r/webdev ban generated text. Every claim must match what the site actually does on posting day.)

**A. Show HN**
- Title options (no caps or exclamation points; plain description):
  - `Show HN: Live crypto prices streamed from exchange WebSockets, no login or ads`
  - `Show HN: An open-source crypto ticker that runs entirely in the browser`
- URL: https://cryptopriceticker.com
- First comment (outline to rewrite):
  > I built this because most crypto price sites I used were heavy with ads, trackers and sign-up prompts, and I just wanted a fast page of prices.
  >
  > How it works: the browser connects directly to Coinbase, Binance and Kraken public WebSocket feeds; there's no backend of mine in the price path. The site is plain static files on Cloudflare Pages: no framework, no build step. [Say how you pick a price when exchanges disagree.]
  >
  > Things you can try: sector filters (AI, DePIN, L1/L2, DeFi/RWA, memes, privacy, gaming, stables); per-coin pages with 7d–1y performance and 52-week range; a portfolio and price alerts that live only in your browser's storage; pinning a price into the tab title; and an iframe widget you can embed (the only credit is a small brand link).
  >
  > Source: https://github.com/usaflees/cpt
  >
  > Known limitations: [114 coins only; alerts only fire while a tab is open (if true); data depends on exchange availability in your region, e.g., Binance access]. I'd especially like feedback on [the latency/accuracy approach / the widget API / mobile layout].

**B. r/SideProject (adapt the technical version for r/webdev Showoff Saturday)**
- Title: `CryptoPriceTicker - live crypto prices from exchange WebSockets, no ads, no login, open source`
- Body outline:
  > What it is: a free page of live crypto prices streamed straight from Coinbase, Binance and Kraken into your browser. No account, no ads, no trackers I know of [verify analytics setup].
  >
  > Why I built it: [your honest reason, 1–2 sentences].
  >
  > What's in it: 114 coin pages with performance stats; sector filters; private in-browser portfolio and alerts; price in the browser tab; a free embeddable widget.
  >
  > How it's built: static HTML/CSS/JS, no framework or build step, Cloudflare Pages, a Node script that generates coin pages and the sitemap. Repo: github.com/usaflees/cpt
  >
  > What I'd love feedback on: [2 specific questions].
  >
  > [Screenshot/GIF: table → coin page → widget builder]
- r/webdev variant: drop "what it is" marketing. Lead with the engineering: merging three feeds, reconnect and backoff, CSP headers, generating 114 static pages without a framework, Lighthouse numbers if good.

**C. Product Hunt**
- Name: CryptoPriceTicker
- Tagline options (check the character limit in the form):
  - `Live crypto prices, no ads, no login`
  - `Open-source live crypto ticker you can embed`
- Description (≤500 chars):
  > Free live crypto prices streamed directly from Coinbase, Binance and Kraken WebSockets into your browser. No account and no ads. Filter by sector (AI, DePIN, L1, L2, DeFi/RWA, memes, privacy, gaming, stablecoins), open per-coin pages with 7-day to 1-year performance, keep a private portfolio and price alerts stored only in your browser, pin a price to your tab title, or embed a free live ticker on your own site. Open source.
- Launch tags (up to 3): e.g., Crypto, Developer Tools, Open Source (pick from PH's available tags).
- Maker first comment (outline):
  > Hi PH, I'm [name], a solo builder. [Why I made it, 2 sentences.] What makes it different: prices come straight from exchange WebSockets in your browser, there's no account, and nothing you enter (portfolio, alerts) leaves your device. The code is open source: github.com/usaflees/cpt. For bloggers and devs: there's a free widget builder on the home page; the only credit is a small brand link. I'd really like feedback on: [1–2 questions]. What coins or sectors should I add next?
  (No "upvote" or "support us" anywhere.)

**D. X / Bluesky thread (5 posts; rewrite in your voice; disclose that it's yours)**
1. "I built a free crypto price page with no ads, no login and no trackers: prices stream directly from Coinbase, Binance and Kraken into your browser. cryptopriceticker.com 🧵" (use an emoji or not to match your voice)
2. "Sector view: filter AI, DePIN, L1, L2, DeFi/RWA, memes, privacy, gaming, stables. [screenshot of this week's sector performance from your own data]"
3. "Each coin has a page with 7d → 1y performance and its 52-week range. [screenshot of /coin/btc/]"
4. "Portfolio and price alerts are stored only in your browser. You can also pin a coin's price to your tab title. [GIF]"
5. "There's a free embeddable live ticker for blogs and dashboards, and the whole thing is open source: github.com/usaflees/cpt. Feedback welcome."
- After launch, a recurring weekly post: "This week by sector (equal-weighted, method: [link])" with your own table image. This is native, linkable, and not shilling. Avoid price predictions and "to the moon" language.

**E. dev.to article outline**
- Title: "Building a live crypto ticker with no backend: merging Coinbase, Binance and Kraken WebSockets in the browser"
- Sections:
  1. Why no backend (cost, privacy, and a site that scales via static hosting).
  2. Feed details: subscription messages per exchange, symbol normalization (e.g., XBT vs BTC on Kraken), and how you choose or display a price when the feeds disagree.
  3. Reconnects, backoff and throttled DOM updates (rendering many ticking rows without jank).
  4. Pinning the price in the tab title (`document.title` updates and their throttling caveats in background tabs).
  5. Generating 114 static coin pages, the sitemap and redirects with a no-dependency Node script, plus SEO lint in CI.
  6. An embeddable iframe widget: URL params, CSP/`frame-ancestors`, and why the credit is a plain brand link (with a citation to Google's widget-link spam policy).
  7. Privacy: localStorage portfolio/alerts, no accounts.
  8. What I'd do differently, plus links to the repo and site.
- Tags: javascript, websocket, webdev, opensource (dev.to allows 4 tags; verify).

#### (5) What NOT to do
- Don't ask anyone to upvote on HN, PH or Reddit, and don't share an HN or PH link with "support us"/"upvote" wording. Don't use multiple accounts or vote groups, or swap upvotes.
- Don't post LLM-written text on HN or r/webdev (both say so explicitly). Don't automate posting.
- Don't delete and repost a Show HN that flopped. Don't relaunch on PH within about 6 months without a major update.
- Don't post to r/CryptoCurrency before meeting 500 comment karma / 60 days, never post promo or referral links there, and don't create alt accounts to get around limits.
- Don't post the same text across many subreddits in one burst.
- Don't buy links, join link exchanges, or submit to paid "dofollow directory" schemes (Google link-spam policy). Don't put keyword-rich or hidden links in the widget, or make the credit link mandatory.
- Don't mass-generate AI recap pages or near-duplicate coin pages ("scaled content abuse").
- Don't spam IndexNow with unchanged URLs or repeatedly click "Request indexing" on the same URL.
- Don't use shill language: no price predictions, "next 100x", or "best/most accurate" claims you can't support. Don't call it "real-time" without saying it comes from exchange feeds and can fail if an exchange is unreachable.
- Don't take payment or free products for posts without clear disclosure (FTC), and don't let friends post about it without saying they know you.
- Don't plan on paid crypto ads. Google requires certification and lists aggregator/comparison destinations as prohibited. Meta and X also restrict crypto ads (not verified in this research).

### Gaps
- No per-community rules verified for X, Bluesky, Farcaster, Telegram or Discord.
- Expected traffic per venue is anecdotal. I found no reliable 2026 benchmark for crypto tools specifically.
- Whether the site currently has background push alerts, keyboard shortcuts, or a /sectors URL was not checked. The drafts mark these as placeholders to verify.
