# Launch kit: getting the first visitors, links and indexing

Researched October 2026 from each venue's own rules plus Google/Bing documentation. **Rewrite every draft
in your own words before posting.** Hacker News ("Please don't put generated text in HN posts") and
r/webdev both remove AI-written posts, and honest, specific writing performs better everywhere anyway.

## Already done on the site
- Sitemap (126 URLs), robots.txt, IndexNow submission (Bing, Yandex, Seznam, Naver…), per-coin share images
- 9 sector pages (`/sector/ai/` …), About & methodology, free widget page (`/widgets/`), installable app (PWA)
- Brand-only, optional widget credit link (Google treats keyword-rich or mandatory widget links as spam)

## Week 1 — your checklist
1. **Google Search Console** (day 1): add a *Domain* property via a DNS TXT record in Cloudflare; submit
   `https://cryptopriceticker.com/sitemap.xml`. Use **URL Inspection → Request indexing** once each for `/`,
   `/coin/btc/`, `/coin/eth/`, `/about/`, then 2–4 more over the next days (`/sector/ai/`, `/widgets/`).
   Don't repeat requests for the same URL — it doesn't help.
2. **Bing Webmaster Tools** (day 1): *Import from Google Search Console* (verifies and imports the sitemap).
3. **Cloudflare** (day 1): enable Web Analytics (cookieless) so you can see where visitors come from.
4. **GitHub repo** (day 1–2): add the website URL in the repo's *About* box; add topics such as
   `cryptocurrency`, `crypto-prices`, `websocket`, `price-ticker`, `widget`, `static-site`, `cloudflare-pages`,
   `vanilla-js`, `bitcoin`, `defi`; pin the repo on your profile. Choose a license if you want others to reuse
   the code (that's your decision — none is set today).
5. **Show HN** (a Tuesday–Thursday, ~7–10 am Pacific): draft A. Stay in the thread for a few hours and answer
   every comment. Never ask anyone to upvote.
6. **r/SideProject** (another day that week): draft B with screenshots.
7. **dev.to article** (same week): draft E — a real technical write-up earns a crawled link and developer readers.
8. **r/webdev "Showoff Saturday"** (Saturday only, with that flair): the technical version of draft B.
9. **Journalist requests** (ongoing): sign up for HARO (helpareporter.com, relaunched 2025) and Source of
   Sources; answer only on-topic crypto-data questions, in your own words.

## Days 8–30
- **Week 2:** post one chart or table per day on X/Bluesky from the sector pages (say you built the site; link sparingly).
  Comment helpfully in r/CryptoCurrency daily threads *without links* — it needs 500 comment karma and a
  60-day-old account before you can post there.
- **Week 3:** **Product Hunt** (self-hunt, goes live 12:01 am Pacific): draft C, 3–5 screenshots (table, coin page,
  sector page, widget builder, price in tab). Never write "upvote" or "support us".
- **Week 4:** an Indie Hackers post with real numbers (visitors by source, how long indexing took). Open a PR to
  1–3 relevant GitHub "awesome" lists, following each list's CONTRIBUTING rules.
- **Throughout:** watch Search Console → *Pages* for "Crawled – currently not indexed" coin pages; those need more
  unique content, not more requests.

## Where you can post (and the rules)
| Venue | Allowed? | Format & timing |
| --- | --- | --- |
| [Show HN](https://news.ycombinator.com/showhn.html) | Yes — something people can try without signing up | "Show HN: …" title, your own first comment; Tue–Thu morning PT; no vote requests, no reposting |
| [Product Hunt](https://help.producthunt.com/en/articles/17350772-launch-guide) | Yes, self-hunting is normal | Tagline, ≤500-char description, ≤3 tags, gallery; 12:01 am PT; never ask for upvotes |
| [r/SideProject](https://www.reddit.com/r/SideProject/about/rules) | Yes, that's the sub's purpose | "Name - short description", screenshots, reply to everyone |
| [r/webdev](https://www.reddit.com/r/webdev/about/rules) | Saturdays only, "Showoff Saturday" flair | Technical, "project not product", no AI text |
| [r/CryptoCurrency](https://www.reddit.com/r/CryptoCurrency/wiki/expanded_rules) | Not yet: 500 comment karma + 60-day account | Comment in daily threads; never promo links or alt accounts |
| dev.to / Hashnode | Yes, as real articles | Technical posts; can set a canonical URL |
| Lobsters | Invite-only, no self-promo for 70 days | Skip for now |
| HARO / Source of Sources | Expert answers only | Human-written replies before the deadline |

## Drafts (skeletons — rewrite them)

**A. Show HN**
- Title: `Show HN: Live crypto prices streamed from exchange WebSockets, no login or ads`
- First comment: why you built it (your words); how it works — the browser connects straight to Coinbase,
  Binance and Kraken public WebSockets, static files on Cloudflare Pages, no framework; what to try — sector
  filters, coin pages with 7-day to 1-year performance, private portfolio and alerts stored only in the browser,
  price in the tab title, the free widget; the repo link; honest limitations (114 coins; alerts only fire while
  the page is open; Binance may be unreachable in some regions); one or two specific questions for feedback.

**B. r/SideProject** — `CryptoPriceTicker - live crypto prices from exchange WebSockets, no ads, no login, open source`
- What it is · why you built it · what's in it · how it's built · the repo · two feedback questions · a GIF of
  table → coin page → widget builder. For r/webdev, lead with the engineering instead (merging three feeds,
  reconnects, CSP, generating 126 static pages with a no-dependency script).

**C. Product Hunt**
- Tagline: `Live crypto prices, no ads, no login`
- Description: "Free live crypto prices streamed directly from Coinbase, Binance and Kraken into your browser.
  No account and no ads. Filter by sector, open per-coin pages with 7-day to 1-year performance, keep a private
  portfolio and price alerts stored only in your browser, pin a price to your tab, or embed a free live ticker on
  your site. Open source."
- First comment: who you are, why you made it, what's different, the repo, and a question ("Which coins or
  sectors should I add next?").

**D. X / Bluesky thread** (say it's yours) — 1) what it is + link; 2) a sector-performance screenshot from
`/sector/…`; 3) a coin page screenshot; 4) a GIF of the portfolio/alerts/tab price; 5) the widget + repo, ask for
feedback. Afterwards, a weekly "this week by sector" post using the site's own tables. No price predictions.

**E. dev.to** — "Building a live crypto ticker with no backend: merging Coinbase, Binance and Kraken WebSockets
in the browser": why no backend · per-exchange subscriptions and ticker renames (TON→GRAM, XBT→BTC) ·
reconnects and throttled rendering · price in the tab title · generating static pages + SEO lint in CI ·
the iframe widget and why its credit link is brand-only · privacy · what you'd do differently.

## Don't
- Ask for upvotes, use multiple accounts or vote groups, or post the same text to many subreddits at once.
- Post AI-written text on HN or r/webdev; automate posting; delete and repost a Show HN that didn't take off.
- Buy links, join link exchanges or paid "dofollow" directories; make the widget link mandatory or keyword-rich.
- Mass-generate pages (e.g., "price prediction 2030" pages) — Google calls that scaled content abuse.
- Use shill language ("next 100x", price predictions) or unsupported "best/most accurate" claims.
- Run crypto ads: Google requires certification and prohibits crypto aggregator/comparison destinations.
