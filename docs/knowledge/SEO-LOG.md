# SEO log (newest first)

One dated entry per run of the "CPT daily SEO" scheduled task (prompt: `docs/DAILY-TASKS.md`): the check run and its
result, and the action taken. Durable findings go in `docs/knowledge/facts.jsonl`, not here. Keep under 150 lines.

## 2026-11-19 (full SEO pass, interactive)
- Checks: seo-lint 0 errors; seo-audit 0 findings; check-live 40/40; all 132 sitemap URLs 200 with self-canonicals; no
  noindex/nosnippet; JSON-LD parses everywhere and dateModified = lastmod; 159 internal link targets all 200; llms.txt
  covers every non-coin page; robots.txt has entries for Googlebot, Bingbot, OAI-SearchBot, PerplexityBot,
  Claude-SearchBot, GPTBot, ClaudeBot, Applebot; weakest coin page has 5 inbound links; crawl cost / 264 KB, /coin/btc/
  381 KB of same-origin resources (sprite 48 KB compressed, cached 7 days, shared).
- Found: HTML on the custom domain has no ETag/Last-Modified (pages.dev has one): owner fix in Cloudflare (facts:
  html-no-etag-custom-domain).
- Action: sameAs entity links for 28 coins (content/coin-entities.json).

## 2026-11-19 (interactive session)
- Check: CPT daily SEO run on 18 Nov stopped at its access step (no repository attached; 23 s).
- Action: shipped PR #18's content (sector hubs list each coin with dated figures; /heatmap/ and /race/ get a weekly
  moves table) after local and preview QA PASSED. seo-audit: 5 thin pages → 0 findings; sector hubs avg 303 → 984
  visible words, 64% own phrases. Live: check-live 40/40. PR #18's later commits (heading wording) are still on its branch.

## 2026-11-16 (set-up, interactive session)
- Check: test run of the new task, read-only (push refused: no repository attached). check-live 40/40, seo-lint 0
  errors, facts-and-dates check passed on 5 coin pages. seo-audit: 5 pages under 250 visible words in the static
  HTML (/heatmap/ 233, /race/ 183, /sector/privacy/ 195, /sector/gaming/ 233, /sector/stablecoins/ 179).
- News: November 2026 core update rolling out since 10 Nov (up to 2 weeks); Gemini 4 Hydrogen is AI Mode's default
  (12 Nov); ChatGPT Business Hub beta (10 Nov); Bing AI grounding preference from Feb 2027. All in facts.jsonl.
- Action: none on the site (core update in progress; task blocked on repository access).
