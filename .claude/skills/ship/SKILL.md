---
name: ship
description: Take a finished change on cryptopriceticker.com from the working branch to the live site with full QA (local QA, push, Cloudflare preview QA, fast-forward main, production check, IndexNow). Use when the owner asks for changes to go live. Not for the automated weekly task, which ships through pull requests.
---

# Ship a change to cryptopriceticker.com

Only ship when the owner has asked for the change to go live. Stop at the first failing step, fix it, and start
that step again.

1. **Local QA.** `bash tests/run.sh` must end with `QA PASSED` (install axe-core first as described in
   `tests/axe.cjs`). Generated files must be rebuilt and committed (`node scripts/build-coin-pages.mjs`).
2. **Commit and push the working branch** (never `main` directly): `git push -u origin <branch>`.
3. **Wait for the Cloudflare preview** of that commit. The branch alias is the branch name lowercased, with every
   character other than letters and digits replaced by `-`, cut to 28 characters:
   `https://<alias>.cryptopriceticker.pages.dev`. Poll until it serves the new content (grep for a string you
   changed), about 1–3 minutes.
4. **Preview QA:** `bash tests/run.sh https://<alias>.cryptopriceticker.pages.dev` must end with `QA PASSED`.
   The preview applies the real `_headers`, so CSP problems show up here.
5. **Go live:** `git fetch origin main`, confirm `git merge-base --is-ancestor origin/main HEAD`, then
   `git push origin HEAD:main` (fast-forward only; never force-push).
6. **Production check:** poll https://cryptopriceticker.com until it serves the change, then
   `node scripts/check-live.mjs` (all checks must pass) and confirm the "Site checks" GitHub Actions run on `main`
   is green.
7. **Tell search engines:** `node scripts/indexnow.mjs <the old origin/main sha>` (only changed pages are sent).
8. **Record it:** update `docs/knowledge/STATE.md` (scores, page count, open items) and log any non-obvious
   choice in `docs/knowledge/DECISIONS.md`.
