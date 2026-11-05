# Search updates, Oct–Nov 2026, and what applies to this site (2026-11-04)

Sources: Google Search Central "What's new" (updated Oct 26), the preferred-sources and favicon docs, the Google
blog post on a shared AI training control (Oct 30), the OpenAI crawler docs, Search Engine Roundtable's November 2026
report, and IndexNow/Bing coverage (Oct 13). Third-party claims are marked as such.

| Change | Status for us | Action |
| --- | --- | --- |
| **Preferred sources**: users pick favourite sites, now honoured in Top Stories, AI Overviews and AI Mode (May 2026). Sites can add a JS button or a plain deeplink `https://www.google.com/preferences/source?q=<domain>` | Not linked before | **Done Nov 4:** plain deeplink in the home footer and on /about/ (no Google script, so the CSP is unchanged) |
| **Favicon doc** (Oct 27): Googlebot must reach the home page and follow its redirects; ≥ 48×48 recommended; listed formats | favicon.ico has 16/32/48 px; robots.txt allows everything except /scripts/, /content/, /docs/ | None |
| **Gen-AI content guidance** (Oct 1): fact-check AI content incl. titles, descriptions, structured data, alt text; no invented authors | Our summaries and key facts are computed, not written; titles/descriptions come from templates | Keep "no AI filler"; human review of coin-about.json stays |
| **"Read more" deep links** (Apr 2026): clear sections with headings help | Coin pages have id'd h2/h3 sections | None |
| **og:image used for Search/Discover thumbnails** (Mar 2026) | Per-coin og images exist | None |
| **Shared AI-training control in robots.txt** (IETF AIPREF policy token), Google support planned in 2027 | Owner chose to welcome training crawlers | Nothing to add until the token is final; then, if wanted, state it explicitly |
| **AI Overviews on ~80% of queries; ~0.9% CTR in one opt-out study** (third-party) | Clicks come from what AI answers can't do: live, interactive data | Supports pillar A (live product) and B (citable dated facts) |
| **OpenAI**: OAI-SearchBot governs ChatGPT search inclusion; GPTBot is training only | Both allowed | None |
| **IndexNow**: Bing, Yandex, Seznam, Naver, Yep, Internet Archive, Amazon; Google is not a participant; OpenAI doesn't document using it | `scripts/indexnow.mjs` runs after deploys | None |
| **No core update since May**; spam update Sep 24–Oct 8; forecasters expect one soon (prediction) | Not indexed yet anyway | Keep a baseline once Search Console is set up |

Not adopted (and why): "hidden tricks" such as hidden text, mass AI pages, invented authors or fake freshness are
explicit spam-policy violations and contradict DECISIONS.md.
