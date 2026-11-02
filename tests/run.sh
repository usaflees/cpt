#!/usr/bin/env bash
# Full QA pass. Usage: bash tests/run.sh [base-url]
#   No argument: builds, lints, starts the local Pages emulator (tests/serve.mjs) and tests it.
#   With a URL (e.g. a Cloudflare preview): runs the live checks and browser tests against it.
set -u
cd "$(dirname "$0")/.."
BASE="${1:-}"; FAIL=0
step() { echo; echo "== $*"; }
run() { "$@" || { FAIL=1; echo "!! FAILED: $*"; }; }
if [ -z "$BASE" ]; then
  step "generator is deterministic";   run node scripts/build-coin-pages.mjs
  git diff --quiet -- coin sector convert heatmap sitemap.xml _redirects || echo "(note: generated files differ from the last commit; commit them)"
  step "seo-lint";                     run node scripts/seo-lint.mjs
  step "links / anchors / ids";        run node tests/links.mjs
  BASE=http://localhost:8788
  if ! curl -s -o /dev/null "$BASE/"; then node tests/serve.mjs >/tmp/cpt-serve.log 2>&1 & SERVER=$!; sleep 1; fi
fi
step "check-live $BASE";              run node scripts/check-live.mjs "$BASE"
step "smoke (home, coin, sector, widgets, embed, 404, mobile)"; run node tests/smoke.cjs "$BASE"
step "converter";                     run node tests/converter.cjs "$BASE"
step "heatmap";                       run node tests/heatmap.cjs "$BASE"
step "search, theme, notifications";  run node tests/search.cjs "$BASE"
step "accessibility";                 run node tests/axe.cjs "$BASE"
[ -n "${SERVER:-}" ] && kill "$SERVER" 2>/dev/null
echo; [ "$FAIL" = 0 ] && echo "QA PASSED" || echo "QA FAILED"; exit $FAIL
