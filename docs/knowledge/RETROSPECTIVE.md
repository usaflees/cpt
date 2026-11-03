# Retrospective: Oct 29 – Nov 3, 2026

## What we did
| Date | Release |
| --- | --- |
| Oct 30 | Split the single 100 KB page into shared assets; fixed live-data bugs; 114 coin pages, sitemap, 404, security headers, icons |
| Oct 30 | SEO content pass (computed stats per coin, sector hubs, trust pages); self-improving loop design and scripts; weekly scheduled task |
| Oct 30 | Home redesign; widgets page; installable app; per-coin share images; launch kit |
| Oct 30–31 | Live converter (114 coins × 20 currencies); live heatmap |
| Oct 31 | Readability/layout pass; performance pass (layout shift, main-thread work) |
| Nov 1 | Search on every page, device light/dark theme, alert notifications; faster coin pages; sturdier widgets |
| Nov 2 | Valid HTML everywhere; phone polish; knowledge base, QA suite, CLAUDE.md, ship skill; merged PRs #1–#8 from a parallel session (brand, logos, caching, strategy, consent-gated analytics) and fixed three bugs they carried |
| Nov 3 | Efficiency pass: one-command weekly refresh, deploy wait, quiet QA, whole-site crawl, compact stats file, shorter weekly prompt |

## Before → after
| | Before (Oct 29) | After (Nov 3) |
| --- | --- | --- |
| Indexable pages | 1 (every unknown URL returned the home page with 200) | 130 in the sitemap, real 404s |
| Data honesty | Simulated 24h changes and sine-wave sparklines; 6 coins never went live | Real exchange data only; "—" until it arrives |
| First load data | Full Binance ticker, 285 KB compressed / 1.9 MB parsed; a 2-coin widget pulled ~2 MB and opened 3 sockets | ~110 KB; WebSocket traffic −75% (home), −95% (widgets) |
| Home layout shift (CLS) | 0.832 | 0.003 |
| Coin page largest paint (throttled) | ~2.2 s | ~1.0 s |
| Home Lighthouse performance | 62 | 93 (before PRs #1–#8) |
| Accessibility | 336 unlabeled buttons, unreachable sort headers | 0 axe violations on 13 page types × 2 themes |
| Security | Inline handlers everywhere, no CSP | Strict CSP (hash for the one inline script), HSTS, origin allowlist |
| Verification | None | `bash tests/run.sh`: lint, links, live checks, 4 browser suites, accessibility, whole-site crawl |
| Maintenance | Manual | Weekly scheduled task (blocked until the repository is attached) |

## What went wrong, and what changed because of it
1. **The weekly task never pushed.** All runs (Oct 30 test, Nov 2) failed with 403 because the task's repository list is
   empty. Each run's refresh was thrown away. → Owner action; the prompt now reports it in one line instead of retrying.
2. **Two Claude sessions changed the site in parallel (Nov 2).** Eight PRs landed on `main` while this branch was in
   progress; the ancestry check stopped a push and the merge was clean, but it cost time. → One session at a time.
3. **Bugs that only showed up as warnings or in the real environment:** an invalid `speculation-rules.json` (Chrome
   silently ignored it: prerendering never ran), uncaught view-transition rejections (only on a real network), a
   phone CSS rule that broke narrow widget iframes. → The crawl now lists warnings; preview QA runs with real headers.
4. **Self-inflicted slips:** `pkill -f <pattern>` killed the shell running it (twice); `refresh-coins.mjs --help` ran a
   real refresh because unknown flags were ignored; a JSON conversion in Python wrote numbers differently from Node.
   → Scripts reject unknown flags; CLAUDE.md says to read script headers; conversions use the same code as the writer.
5. **Tests that depended on the market:** the alert-notification check waited for the price to rise. → It now tries
   both directions and fails explicitly if nothing fires.
6. **Measurement traps:** Lighthouse's simulated LCP (2.7 s) vs real loads (~1.0 s); Lighthouse counts layout shifts
   flagged "recent input" that a page-side observer ignores; low weekend volume looked like a bug. → Measure in a
   throttled real browser before optimising; note known differences in STATE.md.
7. **Costly shapes of work:** 20 turns for one weekly run, multi-thousand-line diffs, verbose QA output, polling loops.
   → See "Keeping Pro plan usage low" in [CLAUDE-OPUS-5-5.md](CLAUDE-OPUS-5-5.md).

## Lessons worth keeping
- Verify on the Cloudflare preview, not only locally: headers, CSP and network timing change behaviour.
- Read warnings, not just errors.
- Make generated data diff-friendly (one record per line) and keep generators deterministic.
- Script any chore an agent does more than once; give it a one-screen summary and meaningful exit codes.
- Reserve space for anything JavaScript fills in; never fade the largest element; avoid forced layouts per update.
- Keep owner-only settings in one list (STATE.md) and say them once, plainly.
