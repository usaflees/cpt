# Decision log

Newest first. Reverse a decision by adding a new row that says so; don't edit old rows.

| Date | Decision | Why | Source |
| --- | --- | --- | --- |
| 2026-11-03 | Weekly task runs `scripts/weekly-refresh.sh` and `tests/wait-deploy.sh`; its prompt shrank from 4,893 to 3,324 characters; recommended effort Medium | Fewer turns and less output per run (Pro plan usage) with the same gates | measured Nov 2 run |
| 2026-11-03 | `content/coin-stats.json` written one coin per line | A weekly refresh changed ~7,300 lines of it; now ~114 | measured |
| 2026-11-03 | Data scripts reject unknown arguments | `refresh-coins.mjs --help` silently ran a real refresh | incident |
| 2026-11-03 | `tests/crawl.cjs` checks every page for errors and lists browser warnings; `run.sh` prints one line per check | Whole-site coverage; an invalid speculation-rules file only ever showed as a warning | incident |
| 2026-11-03 | No `.claude/settings.json` permission allowlist from Claude | Claude Code's auto-mode classifier blocks an agent writing its own permissions; the owner can add one | — |
| 2026-11-02 | Removed `relative_to` from the top level of `speculation-rules.json` | Chrome rejected the whole rule ("A document rule cannot have relative_to outside the where clause"), so prerendering never ran; all patterns are absolute paths anyway | Chrome console |
| 2026-11-02 | Google Tag Manager + GA4 behind a consent banner (`assets/consent.js`, "Cookie settings" in the footer) | Owner's choice; **supersedes** the 2026-10-30 "Cloudflare Web Analytics, not GA4" row. Consent-gated so EU/UK rules and the privacy promise hold | PR #7 |
| 2026-11-02 | Performance budgets and a third-party-origin allowlist enforced by seo-lint | Keep speed from eroding one PR at a time | PR #6, STRATEGY C3 |
| 2026-11-02 | `classify-change` treats pure `?v=` hash re-stamps as data | Cache-busting made every data refresh look like a code change, blocking auto-merge | PR #8 |
| 2026-11-02 | Content-hashed asset URLs + long-lived caching; inlined theme script allowed by CSP hash; speculation-rules prerender | Faster repeat visits and navigations without a build step | PRs #2–#3 |
| 2026-11-02 | New brand identity (live logo, icon set, /brand/ kit), coin logos, accessibility statement page, explicit crawler rules in robots.txt | Trust (YMYL), recognisable sharing, European Accessibility Act | PRs #1, #2, #6 |
| 2026-11-02 | Roadmap lives in `docs/STRATEGY.md`; news and monetization are phased and gated on owner decisions (`docs/NEWS-AND-MONETIZATION.md`) | One source for priorities; nothing paid ships without legal checks | PRs #5, #8 |
| 2026-11-02 | QA suite lives in `tests/` (`bash tests/run.sh`) and the weekly agent may not edit it | Anthropic's top Claude Code practice is giving Claude a check it can run; the agent must not be able to weaken its own gate | [CLAUDE-OPUS-5-5.md](CLAUDE-OPUS-5-5.md) |
| 2026-11-02 | Root `CLAUDE.md` kept short: check commands, misleading spots, decisions, stop rules | Loaded into every session; Anthropic advises < ~200 lines and only what the code can't tell Claude | research/2026-11-02 |
| 2026-11-02 | Don't add the shared AI-training opt-out token to robots.txt | We want to be cited in AI answers; Google support isn't live until 2027 anyway | research/2026-11-02 |
| 2026-11-02 | Phone coin-page link list starts collapsed (links stay in the HTML) | Phone page was 7,776 px; crawlers still see all 114 links; without JS it stays open | — |
| 2026-11-01 | Widget text ≥ 12 px; phone metric-row rule scoped to `body:not(.is-embed)` | Lighthouse legibility; the phone rule broke narrow iframes | Lighthouse |
| 2026-11-01 | Snapshot hero price muted by colour, not opacity | Opacity delayed LCP until the first live tick (2.2 s → 1.0 s) | measured |
| 2026-11-01 | First visit follows the OS light/dark setting; theme saved only on an explicit choice | Default dark was being persisted for everyone on first load | — |
| 2026-11-01 | Price alerts may raise a system notification; permission asked only when saving an alert | Useful when the tab is in the background; never prompt on page load | — |
| 2026-10-31 | Price flash restarts via two identical keyframes instead of forced reflow | `void el.offsetWidth` per cell cost ~570 ms of main thread | CPU profile |
| 2026-10-31 | Reserve space for JS-filled regions (tape, movers, table, charts) | Home CLS 0.832 → 0.003 | Lighthouse trace |
| 2026-10-31 | Home table shows the top 50; "Show all" for the rest; filters/search cover all | Shorter page, FAQ and links reachable | — |
| 2026-10-31 | Heatmap defaults to "balanced" (√market cap) sizing | True market cap makes BTC ~60% of the map and hides small coins | — |
| 2026-10-31 | Tick-based mini charts need ≥ 5 ticks; 7-day column waits for real candles | Two-point lines looked like trends (misleading) | — |
| 2026-10-30 | Converter uses Coinbase's public exchange-rates API for 20 fiat currencies | CORS-enabled, free, already a trusted data source; cached 15 min per tab | — |
| 2026-10-30 | No pages per currency pair or price predictions; converter is one page plus a section per coin | Scaled-content risk; converter state lives in the query string with a fixed canonical | [SEO][EXP] |
| 2026-10-30 | Weekly scheduled task: data refresh auto-merges only when `classify-change` says data-only and CI passes; SEO proposals at most monthly, always via PR | Google re-crawls ~monthly; faster changes chase noise; humans approve content changes | [EXP][AGENT] |
| 2026-10-30 | Telemetry: Apps Script → private Sheet → sanitized digest in private `usaflees/cpt-telemetry`; agent never sees credentials or raw queries | Public repo; prompt-injection risk through search queries; service-account "Add user" bug in 2026 | [SEC][AGENT][LOOP] |
| 2026-10-30 | Cloudflare Web Analytics, not GA4 | GA4 needs CSP changes and a consent banner, contradicts the privacy promise, adds little | [ANA] |
| 2026-10-30 | Titles ≤ 60 chars without prices or dates; descriptions ≤ 160 | Google drops fast-changing prices from titles; stale dates mislead | [SEO][EXP] |
| 2026-10-30 | No FAQ/HowTo/Dataset/Product markup; keep Breadcrumb/Organization/WebSite | Those rich results are gone or don't apply | [EXP] |
| 2026-10-30 | Sector hub pages (9) generated from `content/sectors.json` | Hubs and crawlable internal links; distinct, data-based tables | [SEO] |
| 2026-10-30 | Per-coin static stats computed from exchange candles (longest history wins) | Gives each templated page unique, verifiable content in the indexed HTML | [SEO] |
| 2026-10-30 | Widget credit links are brand-only ("CryptoPriceTicker.com" variants) | Google's link-spam policy names keyword-rich widget links (owner chose this) | [SEO] |
| 2026-10-30 | Generate 114 static coin pages, refreshed weekly; registry in `assets/coins.js` | A single-URL site can't rank for "<coin> price" (owner chose this) | audit |
| 2026-10-30 | Split one 100 KB `index.html` into `assets/app.js`, `app.css`, `coins.js` with event delegation | Shared code across pages; strict CSP without inline JS | audit |
| 2026-10-30 | Remove fake data: simulated 24h changes and sine-wave sparklines; show "—" until a live tick | Accuracy on a finance site (YMYL) | audit |
| 2026-10-30 | TON → GRAM, FTM → S, MATIC → POL, MKR → SKY with redirects and per-exchange ticker aliases | Exchanges renamed the tickers; old links and saved watchlists keep working | — |
