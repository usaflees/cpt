# AI search updates since 4 Nov, and what applies to this site (2026-11-09)

Sources: Google Search Central "What's new" and the generative AI features guide (15 May, updated 10 Jul 2026);
Search Engine Journal on Bing's AI Performance "Topics Portfolio" (13 Oct 2026); eSEOspace on Bing Webmaster Tools and
IndexNow (13 Oct 2026); Creative Data Engineers' AI search changelog (Cloudflare–OpenAI change-signal pilot, 15 Oct
2026); Onely and Verticality AI Mode guides (Oct–Nov 2026); Position Digital October recap. Third-party figures are
claims, not measurements.

| Change | Status for us | Action |
| --- | --- | --- |
| Search Console **Generative AI performance report** (all sites since 31 Aug 2026): impressions in AI Overviews + AI Mode by page, no queries or clicks | Needs Search Console | **Owner**: after verifying the property, check Performance → Generative AI features monthly (STRATEGY D3) |
| Search Console **"Search generative AI" setting** (Settings; default Include) decides eligibility for AI Overviews / AI Mode | Default is fine | **Owner**: confirm it says Include |
| Google: "optimizing for generative AI search is … still SEO"; no special markup; non-commodity content, update dates only when content changes | Matches B1/B2/B3 | None |
| Bing **AI Performance** report: Copilot citations, grounding queries, Citation Share, Topics Portfolio (beta, Oct 2026; needs enough data) | Needs Bing Webmaster Tools | **Owner**: import the site from Search Console |
| **Cloudflare Crawler Hints** send IndexNow change signals; Cloudflare–OpenAI pilot feeds change signals to OpenAI's search crawler | Zone setting | **Owner**: Cloudflare → Caching → Configuration → Crawler Hints: On |
| IndexNow participants unchanged (Bing, Yandex, Seznam, Naver, Yep, Internet Archive, Amazon; not Google, not OpenAI) | `indexnow.mjs` after deploys, and now in the weekly data-refresh Action | None |
| Third-party: AI Overviews on 80–93% of branded queries; LLM referrals ~0.7% of Google's | Google organic is still the main channel | Keep priority on indexing (Search Console) |

Not adopted: "GEO hacks" (FAQ blocks written for bots, keyword-stuffed summaries, invented authorities). They are
spam-policy risks and contradict DECISIONS.md.
