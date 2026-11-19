# CryptoPriceTicker.com: notes for Claude

Static site on Cloudflare Pages, deployed from `main` (repo root, no build step). The repo is **public**.
New session? Run `node scripts/kb.mjs` (digest of the knowledge store: open owner actions, next builds, facts due for a
re-check), then read `docs/knowledge/HANDOFF.md`. Roadmap: `docs/STRATEGY.md`. Knowledge base: `docs/knowledge/README.md` (playbook, decisions, current state, Opus 5.5
guide, research). How sessions work here (cloud/Duet threads, feature recipe): `docs/knowledge/CLAUDE-CODE-WORKFLOW.md`.

## Goals, in priority order (every session works toward these; details in the linked file)
1. **Get indexed and ranked:** `docs/INDEXING-PLAN.md` (Google has indexed 1 of 134 pages; no new URL families until it catches up).
2. **Keep the live site correct and fast:** every change passes `bash tests/run.sh` locally and on the preview.
3. **Unique, verifiable data features** users can't get free elsewhere: `docs/QUEUE.md` "Ready", one item per daily build.
4. **Revenue only after AdSense approves**, per `docs/NEWS-AND-MONETIZATION.md` §6–7 (queue: "Waiting on the owner").
5. **Low usage:** one chat at a time; record durable lessons in `docs/knowledge/facts.jsonl`, not in chat.

## Check your work
- Full QA: `bash tests/run.sh` (local Pages emulator) or `bash tests/run.sh <preview-url>`. Must end with `QA PASSED`.
  Accessibility needs axe-core; see the header of `tests/axe.cjs`.
- Quick: `node scripts/build-coin-pages.mjs && node scripts/seo-lint.mjs` (0 errors) and `node tests/links.mjs`.
- SEO pass: `node scripts/seo-audit.mjs` before and after (reports what crawlers see on every page; seo-lint is the gate).
- Learned something durable (a platform change, a measurement)? Add a line to `docs/knowledge/facts.jsonl` (format in
  the header of `scripts/kb.mjs`), run `node scripts/kb.mjs --write`, commit both. QA runs `kb.mjs --check`.
- After a deploy: `node scripts/check-live.mjs`. IndexNow is sent by the `indexnow` CI job (don't run it by hand).
- To ship a human-requested change, follow the `ship` skill (`.claude/skills/ship/SKILL.md`).

## Keep sessions cheap (Pro plan usage)
- Prefer the summary commands: `bash tests/run.sh` and `bash scripts/weekly-refresh.sh` print one line per check;
  open a log only for a FAIL. Wait for deploys with `bash tests/wait-deploy.sh <url>`, not repeated polling.
- Don't read generated or large files whole (`coin/`, `sector/`, `content/coin-stats.json`, `og/`, `brand/`,
  `docs/knowledge/research/`): grep, or read only the lines you need.
- One chat at a time on this repo. Routine builds go through `docs/QUEUE.md` and the daily scheduled tasks (build, SEO, check)
  (`docs/DAILY-TASKS.md`); don't run deep research or parallel chats for work the queue can carry.
- Default effort `medium`; use `high`/`xhigh` for audits, redesigns and hard bugs (docs/knowledge/CLAUDE-OPUS-5-5.md).
- Scripts reject unknown flags; read a script's header comment for its usage instead of trying `--help`.

## Where the code misleads
- `coin/`, `sector/`, `compare/`, `convert/`, `heatmap/`, `sitemap.xml`, `_redirects` and the coin list in `index.html` (between the
  `coin-index` markers) are generated. Edit `scripts/build-coin-pages.mjs` or `content/*.json`, then rebuild.
- `assets/app.css` is layered: later sections override earlier ones. Add changes in the matching late section and check
  both dark and light themes and a 375 px viewport.
- Strict CSP: no `on*` attributes and no inline scripts except the theme script the build inlines (allowed by its hash).
  Wire UI through `data-action` and the `actions` map in `assets/app.js`.
- Asset URLs carry a content hash (`?v=…`) that the build stamps: after editing anything in `assets/`, run
  `node scripts/build-coin-pages.mjs`. seo-lint enforces size budgets and a CSP origin allowlist.
- Widgets (`/embed/`) run in narrow iframes: phone-width rules for the site must be scoped to `body:not(.is-embed)`.
- Prices start as a build-time snapshot (`is-stale`) and go live in the browser. Don't put opacity on the largest
  element, and reserve space for anything JavaScript fills in (layout shift).
- `scripts/`, `tests/`, `_headers`, `.github/`, `assets/app.*`, `CLAUDE.md` are off-limits to the automated daily build and the data-refresh workflow
  (enforced by `seo-lint --base` on `claude/seo-*` branches and by `classify-change`).

## Decisions (details in docs/knowledge/DECISIONS.md)
- No live prices or dates in titles; titles ≤ 60, descriptions ≤ 160 (seo-lint enforces).
- No FAQ/Product/Dataset markup, no AI filler text, no per-currency or price-prediction pages.
- Widget credit links are brand-only.
- Never commit telemetry, search queries, analytics or personal data; telemetry lives in the private `usaflees/cpt-telemetry`.
- Sitemap `lastmod` changes only when content changes.
- No fake data: show "—" or a placeholder until real data arrives.

## Working style
- When a step doesn't need the owner's input, keep going, and put status notes in the same message as the next action.
  Stop and ask only when you can't continue without the owner, or before anything destructive or outside this
  repository: deleting data, force-pushing, changing account or Cloudflare settings.
- Pushing to `main` deploys the live site: do it only when the owner asked for the change to go live.
- End every run with three headings: **Blocked on owner**, **Changed**, **Found**.
