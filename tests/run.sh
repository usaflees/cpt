#!/usr/bin/env bash
# Full QA pass. Usage: bash tests/run.sh [base-url] [--verbose]
#   No URL: builds, lints, starts the local Pages emulator (tests/serve.mjs) and tests it.
#   With a URL (e.g. a Cloudflare preview): runs the live checks, browser tests and full-site crawl against it.
# Prints one line per check and the log of any check that fails (--verbose prints everything), to keep agent
# sessions short. Ends with QA PASSED, QA FAILED, or QA INCOMPLETE when a check could not run (axe-core missing:
# see the header of tests/axe.cjs); only QA PASSED counts as a pass. Full logs stay in $LOG.
set -u
cd "$(dirname "$0")/.."
BASE=""; VERBOSE=0; for a in "$@"; do [ "$a" = "--verbose" ] && VERBOSE=1 || BASE="$a"; done
FAIL=0; SKIP=""; LOG="$(mktemp -d)"; N=0; LABEL=""
step() { LABEL="$*"; }
run() {
  N=$((N + 1)); local f="$LOG/$N.log"
  if [ "$VERBOSE" = 1 ]; then echo; echo "== $LABEL"; "$@" 2>&1 | tee "$f"; local rc=${PIPESTATUS[0]}; else "$@" >"$f" 2>&1; local rc=$?; fi
  local last; last="$(grep -E 'ISSUES|passed|problem|axe:|crawl:|seo-lint:|links:|kb:|Built ' "$f" | tail -1)"
  if [ "$rc" = 0 ] && grep -q ': skipped' "$f"; then SKIP="${SKIP:+$SKIP, }$LABEL"; echo "SKIP  $LABEL${last:+ — $last}"
  elif [ "$rc" = 0 ]; then echo "ok    $LABEL${last:+ — $last}"; else FAIL=1; echo "FAIL  $LABEL"; [ "$VERBOSE" = 1 ] || tail -25 "$f" | sed 's/^/      /'; fi
}
if [ -z "$BASE" ]; then
  step "generator is deterministic";   run node scripts/build-coin-pages.mjs
  git diff --quiet -- coin sector compare convert heatmap market content/market-reports.json sitemap.xml sitemap-coins.xml sitemap-sectors.xml sitemap-pages.xml _redirects || echo "(note: generated files differ from the last commit; commit them)"
  step "seo-lint";                     run node scripts/seo-lint.mjs
  step "links / anchors / ids";        run node tests/links.mjs
  step "knowledge store";              run node scripts/kb.mjs --check
  BASE=http://localhost:8788
  if ! curl -s -o /dev/null "$BASE/"; then node tests/serve.mjs >/tmp/cpt-serve.log 2>&1 & SERVER=$!; sleep 1; fi
fi
step "check-live $BASE";              run node scripts/check-live.mjs "$BASE"
step "smoke (home, coin, sector, widgets, embed, 404, mobile)"; run node tests/smoke.cjs "$BASE"
step "converter";                     run node tests/converter.cjs "$BASE"
step "heatmap";                       run node tests/heatmap.cjs "$BASE"
step "search, theme, notifications";  run node tests/search.cjs "$BASE"
step "backup and restore";            run node tests/backup.cjs "$BASE"
step "Bell Brief (/bell edition swap)"; run node tests/bell.cjs "$BASE"
step "AI-agent tools (WebMCP)";      run node tests/agent.cjs "$BASE"
step "On-device AI (coin pages)";      run node tests/ondevice.cjs "$BASE"
step "plain-words filter (home table)"; run node tests/screener.cjs "$BASE"
step "big-order cost (coin pages)";   run node tests/depth.cjs "$BASE"
step "accessibility";                 run node tests/axe.cjs "$BASE"
step "every page: errors, CSP, failed requests"; run node tests/crawl.cjs "$BASE"
[ -n "${SERVER:-}" ] && kill "$SERVER" 2>/dev/null
if [ "$FAIL" != 0 ]; then echo "QA FAILED (logs: $LOG)"; exit 1; fi
if [ -n "$SKIP" ]; then echo "QA INCOMPLETE (not checked: $SKIP)"; exit 2; fi
echo "QA PASSED"
