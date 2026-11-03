# Handoff: start here in a new session (updated 2026-11-03)

The previous long working session ended on Nov 3, 2026. Everything it produced is in this repo; nothing lives
only in that chat.

## Read first (in this order, only as far as the task needs)
1. `CLAUDE.md`: check commands, traps in the code, decisions, working style.
2. `docs/knowledge/STATE.md`: what's live, scores, open owner actions, known trade-offs.
3. `docs/STRATEGY.md`: the roadmap (next items: B1 answer-first coin summaries, C1 worker feeds, D2 CrUX).
4. `docs/knowledge/PLAYBOOK.md` and `DECISIONS.md` before changing anything that touches SEO, content or data.
5. `docs/knowledge/CLAUDE-OPUS-5-5.md`: effort levels and keeping Pro plan usage low.

## Where things stand
- `main` = live site (Cloudflare Pages deploys it). Last release: `eed0ced` (Nov 3): efficiency pass, QA suite,
  knowledge base. Every check green: QA PASSED on preview, 19/19 live checks, 134-page crawl with 0 errors/warnings.
- Work branches: `claude/*`. Ship with the `ship` skill (QA → preview QA → fast-forward `main` → live check →
  IndexNow). Always `git fetch` first: other sessions also push to `main` (PRs #1–#9 on Nov 2).
- Weekly scheduled task "CryptoPriceTicker weekly self-improvement" (Mondays 18:41 UTC, Opus 5.5) runs the
  prompt in `docs/WEEKLY-TASK.md` (already saved to the task on Nov 3).

## Latest work
- B1 answer-first coin summaries, B2 key facts (first slice) and B4 Organization logo built on branch `ccr-764a878f-teac16` (draft PR), local QA PASSED. Not live until
  the owner asks; ship with the `ship` skill.

## Blocked on the owner (the most important open items)
1. The weekly task has **no repository attached**, so every run's push fails with 403. Fix: claude.ai/code →
   Scheduled tasks → the task → Edit → Advanced settings → Repository → add `usaflees/cpt`.
2. Set that task's effort to **Medium** (model selector → Effort).
3. Search Console + Bing Webmaster Tools setup, Cloudflare Web Analytics, Apps Script telemetry collector
   (`scripts/telemetry/README.md`), launch posts (`docs/LAUNCH-KIT.md`). See STATE.md for the full list.
4. Owner decisions pending in `docs/NEWS-AND-MONETIZATION.md` §9.

## Tooling notes for a fresh cloud session
- QA: `bash tests/run.sh [preview-url]`. For the accessibility step install axe-core once:
  `npm i --no-save --prefix /tmp/cpt-axe axe-core@4.10.2` then run with
  `AXE=/tmp/cpt-axe/node_modules/axe-core/axe.min.js bash tests/run.sh`.
- Lighthouse (optional, for performance work): `npm i --prefix /tmp/lh lighthouse@12.2.1`, then
  `CHROME_PATH=/opt/pw-browsers/chromium /tmp/lh/node_modules/.bin/lighthouse <url> --chrome-flags="--headless=new --no-sandbox"`.
- Preview URL of a branch: `https://<alias>.cryptopriceticker.pages.dev`, alias = branch name lowercased,
  non-alphanumerics → `-`, cut to 28 characters (e.g. `claude-static-html-optimizat`).
- Wait for a deploy with `bash tests/wait-deploy.sh <url>`; don't poll turn by turn.
- Stop local servers with `pkill -f "^node .*serve\.mjs"` (a pattern without `^node` can kill your own shell).
