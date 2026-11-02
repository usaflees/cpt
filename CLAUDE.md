# CryptoPriceTicker.com: notes for Claude

Static site on Cloudflare Pages, deployed from `main` (repo root, no build step). The repo is **public**.
Roadmap: `docs/STRATEGY.md`. Knowledge base: `docs/knowledge/README.md` (playbook, decisions, current state, Opus 5.5
guide, research).

## Check your work
- Full QA: `bash tests/run.sh` (local Pages emulator) or `bash tests/run.sh <preview-url>`. Must end with `QA PASSED`.
  Accessibility needs axe-core; see the header of `tests/axe.cjs`.
- Quick: `node scripts/build-coin-pages.mjs && node scripts/seo-lint.mjs` (0 errors) and `node tests/links.mjs`.
- After a deploy: `node scripts/check-live.mjs` and `node scripts/indexnow.mjs <previous-main-sha>`.
- To ship a human-requested change, follow the `ship` skill (`.claude/skills/ship/SKILL.md`).

## Where the code misleads
- `coin/`, `sector/`, `convert/`, `heatmap/`, `sitemap.xml`, `_redirects` and the coin list in `index.html` (between the
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
- `scripts/`, `tests/`, `_headers`, `.github/`, `assets/app.*`, `CLAUDE.md` are off-limits to the automated weekly task
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
