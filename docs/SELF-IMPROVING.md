# How the site improves itself (and the rules it follows)

```
nightly  Apps Script collector ──► private Google Sheet ──weekly──► private repo digest/latest.json
                                                                        │
weekly   Claude scheduled task (Opus) ──reads──► digest + live-site audit + fresh market data
             │
             ├─ data refresh (supplies, stats, coin pages) ── lint passes ──► merged automatically
             └─ SEO proposals (≤ 2 coins, content/seo-overrides.json) ──► pull request ──► you merge
```

The collector holds every credential and is not AI. The agent never sees credentials or raw search
queries, and never changes code, headers or workflows on its own.

## Phases
| Phase | Status | What happens |
| --- | --- | --- |
| 0. Setup | **owner** | Search Console Domain property + sitemap; Cloudflare Web Analytics; telemetry collector (`scripts/telemetry/README.md`) |
| 1. Self-auditing | **live** | Weekly task refreshes market data, rebuilds pages, runs `seo-lint`, audits the live site, and opens PRs for anything unusual |
| 2. Self-optimizing | after 4–8 weeks of Search Console data | Weekly task reads `digest/latest.json` and may propose up to 2 title/description changes per week |
| 3. Experiments | when coin pages get ≥ ~100 impressions/day | Page-group tests with an untouched control group, evaluated by script |

## What the automated loop may change
- **Merged automatically** (data only, and only if `node scripts/seo-lint.mjs` passes):
  `assets/coins.js` supply/price numbers, `content/coin-stats.json`, `coin/**`, `sitemap.xml`,
  the generated coin list in `index.html`.
- **Pull request for a human** (never auto-merged): adding/removing/renaming coins or changing feeds,
  `content/seo-overrides.json` (title / description / h1 per coin — nothing else), `content/experiments.json`.
- **Never** (CI rejects it on `claude/seo-*` branches): `_headers`, `_redirects`, `.github/`, `assets/app.*`,
  `scripts/`, `content/coin-about.json`, `CLAUDE.md`, `.mcp.json`.

## Rules for SEO proposals
1. At most **2 coins** per week, one hypothesis each, recorded in `content/experiments.json` **before** the change ships.
2. **28-day cooldown** per page; evaluate no earlier than 14 days (titles/descriptions) or 28 days (content).
3. Pick candidates by *impressions × (the site's own expected CTR at that position − current CTR)*, with
   ≥ 100 impressions in 28 days. Ignore "striking distance" ranges on their own.
4. No prices or dates in titles, no keyword lists, no new URL families, no generated filler text.
5. Judge with impressions and position first (clicks are too few on a small site); compare against coins
   that were **not** changed in the same period. "Inconclusive" is the normal outcome — keep a change only
   if it is also clearly better for readers, otherwise revert.

## Experiment log format (`content/experiments.json`)
```json
[
  {
    "id": "2026-11-kas-title",
    "pages": ["/coin/kas/"],
    "control": ["/coin/sui/", "/coin/apt/"],
    "change": "title: 'Kaspa (KAS) Price: Live Chart & Market Cap' → 'Kaspa Price Today (KAS): Live Chart & Stats'",
    "hypothesis": "Leading with the query wording raises CTR at position ~9",
    "metric": "CTR at same position band, impressions",
    "start": "2026-11-09",
    "evaluateOn": "2026-11-30",
    "status": "running",
    "result": null
  }
]
```
`status` is one of `running`, `kept`, `reverted`, `inconclusive`.
