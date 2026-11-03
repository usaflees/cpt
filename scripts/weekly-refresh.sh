#!/usr/bin/env bash
# Steps 2–4 of the weekly task in one command, with a short summary (fewer agent turns, less usage):
# refresh market data, rebuild pages, run seo-lint and the link check, then classify the change.
#   bash scripts/weekly-refresh.sh [git-base]    (default base: origin/main)
# Exit codes: 0 data-only (may auto-merge after CI + preview QA), 3 no changes, 2 needs review, 1 a step failed.
set -u
cd "$(dirname "$0")/.."
BASE="${1:-origin/main}"; LOG="$(mktemp -d)"; FAIL=0
step() {
  local name=$1; shift
  if "$@" >"$LOG/$name.log" 2>&1; then echo "ok    $name: $(grep -v '^\s*$' "$LOG/$name.log" | tail -1)"
  else echo "FAIL  $name:"; tail -15 "$LOG/$name.log" | sed 's/^/      /'; FAIL=1; fi
}
step refresh node scripts/refresh-coins.mjs
step stats   node scripts/fetch-coin-stats.mjs
step build   node scripts/build-coin-pages.mjs
step lint    node scripts/seo-lint.mjs
step links   node tests/links.mjs
# Warnings worth a line in the PR body (coins without feeds, missing supply, CoinLore disagreements, no candles).
grep -hE "⚠|disagreed|Not in CoinLore" "$LOG"/refresh.log "$LOG"/stats.log 2>/dev/null | sed 's/^/note  /'
[ "$FAIL" = 0 ] || { echo "RESULT: failed (full logs in $LOG)"; exit 1; }
CLASS="$(node scripts/classify-change.mjs "$BASE" 2>/dev/null)"; CODE=$?
echo "diff  $(git diff --shortstat | sed 's/^ //')"
echo "RESULT: $CLASS"
[ "$CODE" = 0 ] && { [ "$CLASS" = "no-changes" ] && exit 3; exit 0; }
exit 2
