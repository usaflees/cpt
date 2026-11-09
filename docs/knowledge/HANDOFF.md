# Handoff: start here in a new session (updated 2026-11-09)

Everything earlier sessions produced is in this repo; nothing lives only in a chat. This note is the short version
of where things stand and what the owner wants. Details are in the files it links.

## Read first (in this order, only as far as the task needs)
1. `CLAUDE.md`: check commands, traps in the code, decisions, working style (end runs with **Blocked on owner /
   Changed / Found**).
2. `docs/knowledge/STATE.md`: what's live, scores, open owner actions, known trade-offs.
3. `docs/STRATEGY.md` (roadmap; done items are ticked) and `docs/NEWS-AND-MONETIZATION.md` (news block and
   monetization plan, gated on owner decisions in §9).
4. `docs/knowledge/DECISIONS.md` before changing anything that touches SEO, content, data, analytics or design;
   `PLAYBOOK.md` for how changes are made and checked.
5. `docs/knowledge/CLAUDE-OPUS-5-5.md`: effort levels and keeping Pro plan usage low.

## What the owner wants (standing instructions from the Nov 1–4 sessions)
- **Approval to publish:** the owner has approved committing and publishing finished, QA-passed work ("I approve
  all commits and live publishes"). Ship with the `ship` skill: local QA → push branch → preview QA →
  fast-forward `main` → production check → IndexNow → update STATE/DECISIONS. Still ask before anything
  destructive or outside the repo (account, Cloudflare or Google settings, deleting data, force-push).
- **Direction:** keep optimizing speed, SEO and AI-answer visibility; add features that attract attention; keep
  the neon brand consistent; run QA passes (alignment, borders, readability, mobile) and fix what they find.
  The owner tests on Android Chrome (phone and "desktop site" mode) and sends screenshots.
- **Research-backed work:** the owner asks for "deep research" before strategy; cite sources and put plans in
  `docs/` so other sessions can build on them.
- **Measure before building:** several ideas were dropped after measuring (see "Decided against" below).

## Where things stand (2026-11-04)
- `main` = live site, last release `c2ffd44`. Every check green: local and preview QA PASSED (134-page crawl,
  0 errors/CSP issues; axe 0 violations across 13 page types × 2 themes), 19/19 live checks, Site checks on `main`.
- Shipped Nov 1–4 (PRs #1–#9, then direct fast-forwards):
  - Brand: neon logo set, animated mark, `/brand/` kit, Neon theme as default, branded Light theme, coin logos
    (98 of 114, `scripts/build-coin-icons.mjs`, licences in `coin-icons/LICENSES.md`).
  - Speed: content-hashed `/assets/` cached 1 year, inlined theme script (CSP hash kept in sync by the build),
    speculation-rules prerender, bfcache-safe feeds, view transitions, play-once logo animation.
  - SEO/content: dated key-facts line under each coin's price, best/worst month and 90-day correlation with BTC
    on coin pages, honest sitemap `lastmod`, robots.txt welcoming search, AI-search and AI-training crawlers
    (owner's choice, for reach), `/accessibility/` statement, `llms.txt` refresh.
  - Features: pop-out live ticker (Document Picture-in-Picture, Chrome/Edge desktop), `theme=auto` widgets,
    sticky header fixed (it never stuck before; see DECISIONS), phone header that tucks on scroll.
  - Analytics: Google Tag Manager `GTM-PD9TXJX` and GA4 `G-DF18LSQFVW` load from `assets/consent.js` behind a
    Consent Mode v2 banner (cookies only after "Accept", ads signals always denied, never inside widgets).
    **Don't add a GA4 tag for the same ID inside GTM** (double counting). GTM Custom HTML tags can't run
    (strict CSP).

## Latest work
- **Nov 9 (this session):** `.github/workflows/data-refresh.yml` refreshes data weekly without a Claude session
  (gates: data-only, `check-refresh.mjs`, full QA; pushes to `main`, checks production, IndexNow). Run it by hand
  from Actions → "Weekly data refresh" (untick publish for a dry run). "Open source" → "public source code"
  until the owner adds a LICENSE. Research: `research/2026-11-09-ai-search-updates.md`.
- **Live Nov 9 (`8b2325f`, PR #12):** audit fixes: GitHub Actions pinned to commit SHAs + Dependabot (monthly), job-level
  permissions, `pages.dev` host `noindex` (checked by `check-live`), `.gitignore`, `SECURITY.md`. Audit notes and the open
  owner decisions (empty GTM container ~280 KiB/page, no LICENSE behind "open source", `www` has no DNS) are in
  `research/2026-11-08-repo-audit.md`. `app.css` is at 79.7 KB of its 80 KB budget.
- **Live Nov 9 (`48da614`):** motion pass (DECISIONS 2026-11-09): rolling-digit prices on coin pages and the
  pop-out, gliding table rows, spring quick view and popover, scroll-driven section rise, spinning logo ring, market
  mood glow on the home hero. Mockups: claude.ai artifact "CPT Motion Lab". Local + preview QA PASSED.
- **Live Nov 9 (`62320c3`):** widget builder "Copy link" for Notion / Google Sites (A5 snippets done). Another
  session shipped the Newsflash and move alerts on Nov 8 (`5cf8510`, `assets/flash.js`). A5 left: measure embed
  domains. Next buildable: A2 SharedWorker (low value at today's traffic), D3 citation baseline (needs
  `usaflees/cpt-telemetry`).
- **Nov 8:** shipped the leftover PR #11 (app-icon alert badge, `Content-Signal` in robots.txt, Binance preconnect
  as an Early Hint) and the overdue data refresh (stats as of 7 Nov; the weekly task still can't push, see below).
  ScamAdviser rescanned ~2 Nov: still 0 ("Very Likely Unsafe"), now mainly for domain age; the rescan email draft
  in the owner's Gmail was not sent yet.
- **Live Nov 6 (`b5bd446`):** `/trust/` page and "Open source, hosted on Cloudflare Pages" + Trust & safety link in every
  footer; Organization `sameAs` GitHub; security.txt Policy. Why: ScamAdviser scores the domain 0/100 from its earlier
  registration (re-registered 22 Oct 2026). Local + preview QA PASSED, 19/19 live, Site checks green, IndexNow 200.
- **Live Nov 5 (`495543c`, PR #10):** largest fall, 1-year sector rank, sector-hub medians, Organization
  `ImageObject`, Google preferred-sources link, research `research/2026-11-04-search-updates.md`. Merged with `main`
  after another session shipped overlapping B1/B2 work; `main`'s versions were kept where both did the same thing.
  Production: 19/19 live checks, Site checks green on `main`, IndexNow 200 for 120 URLs.
- Two sessions worked the same roadmap items on Nov 4. Before starting a roadmap item, `git fetch origin main` and
  check STRATEGY.md / this file for work already shipped.

## Blocked on the owner (the most important open items)
0. **Reputation fixes outside the repo** (STATE.md "Owner actions" item 0): ScamAdviser rescan + Gmail draft,
   Gridinsoft claim, duplicate DMARC record, `www` custom domain.
1. **Search Console**: Domain property, submit `sitemap.xml`, request indexing for key pages. Google hasn't
   indexed the site yet; this is the biggest lever. Then Bing Webmaster Tools (import from Search Console).
2. **Weekly scheduled task** "CryptoPriceTicker weekly self-improvement" has **no repository attached**, so its
   pushes fail with 403: claude.ai/code → Scheduled tasks → the task → Edit → Advanced settings → Repository →
   add `usaflees/cpt`. Set its effort to **Medium**.
3. Cloudflare Web Analytics on (real-visitor speed data); Apps Script telemetry (`scripts/telemetry/README.md`).
4. News/monetization decisions (`docs/NEWS-AND-MONETIZATION.md` §9): editor of record, licensed headline source
   and budget, adding a Cloudflare Worker, sponsor-first vs ads, whether crypto sponsors may be shown to UK/EU
   visitors (FCA/MiCA: get legal advice). Nothing paid ships before that; the "no ads" wording must change first.
5. Launch posts in the owner's own words (`docs/LAUNCH-KIT.md`); GitHub repo description and topics.

## Next work (from STRATEGY.md, in order)
1. D2: weekly CrUX field data in the telemetry digest (useful once traffic exists).
2. D3: monthly AI-citation prompt check (baseline).
3. A2: one set of exchange sockets shared across tabs (SharedWorker).
4. News block phase 0–1 once the owner decides (§8 of NEWS-AND-MONETIZATION.md): masthead page,
   `scripts/build-news.mjs` daily data briefs, `/news/` hub, NewsArticle markup, news sitemap.

## Decided against (measured; don't redo without new evidence)
- Worker-thread feeds (C1): JS is ~4 ms/s of the home page's ~110–130 ms/s main thread.
- Opacity-overlay price flash: measured worse (layer churn). Flashes (~30 ms/s) are the feature; leave them.
- Rolling digits in the home table: measured ~115 → ~320 ms/s main thread.
- Fading scroll reveals (axe contrast failures) and `@property`-animated gradients for anything that runs
  forever (~30 ms/s main thread).
- Logos inside converter `<select>`s: ~20 KB extra HTML per coin page for a Chromium-only effect.
- Minify/bundle step, JS framework, FAQ/Dataset markup, price-prediction pages, per-currency pages.
- Mobile 7-day sparkline under 480 px: truncated 22 coin names at 412 px (1 without it).

## Tooling notes for a fresh cloud session
- QA: `bash tests/run.sh [preview-url]`. For the accessibility step install axe-core once:
  `npm i --no-save --prefix /tmp/cpt-axe axe-core@4.10.2`, then
  `AXE=/tmp/cpt-axe/node_modules/axe-core/axe.min.js bash tests/run.sh`.
  Don't set `NODE_PATH` for axe: it hides the preinstalled Playwright.
- Lighthouse (optional): `npm i --prefix /tmp/lh lighthouse@12.2.1`, then
  `CHROME_PATH=/opt/pw-browsers/chromium /tmp/lh/node_modules/.bin/lighthouse <url> --chrome-flags="--headless=new --no-sandbox"`.
  Local servers don't compress or cache; judge performance on the preview or production.
- Preview URL of a branch: `https://<alias>.cryptopriceticker.pages.dev`, alias = branch name lowercased,
  non-alphanumerics → `-`, cut to 28 characters.
- Wait for a deploy with `bash tests/wait-deploy.sh <url>` (give it ≥ 10 minutes of timeout; production can be
  slow). Then confirm a changed string with curl before trusting `check-live.mjs`.
- `node scripts/indexnow.mjs <sha>` takes the **old** `main` SHA (the commit before the release).
- Stop local servers with `pkill -f "^node .*serve\.mjs"` (a pattern without `^node` can kill your own shell).
- Headless Chromium refuses the back/forward cache for its own reasons; test the bfcache path by dispatching
  `pagehide`/`pageshow` (`persisted: true`) events instead.
- Force-push is blocked by the session's safety rules. After a squash-merged PR, a branch restarted from `main`
  can't push normally; `git merge -s ours origin/<branch>` records the old history without changing files.
