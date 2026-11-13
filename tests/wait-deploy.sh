#!/usr/bin/env bash
# Waits until a deployment serves the current local build: its home page references the same content-hashed assets
# as the local index.html, its sitemap.xml is identical, and files changed in the latest commit match, so an agent needs one command instead of many polling turns.
#   bash tests/wait-deploy.sh <base-url> [timeout-seconds]   e.g. https://claude-weekly-2026-11-09.cryptopriceticker.pages.dev
set -u
cd "$(dirname "$0")/.."
URL="${1:?usage: bash tests/wait-deploy.sh <base-url> [timeout-seconds]}"; URL="${URL%/}"; MAX="${2:-600}"
WANT="$(grep -oE '/assets/[a-z-]+\.(js|css)\?v=[0-9a-f]+' index.html | sort -u)"
[ -n "$WANT" ] || { echo "no hashed asset links found in index.html"; exit 1; }
# Also compare (byte for byte) up to 5 served, non-HTML files changed in the latest commit, so a commit that touches
# neither assets nor the sitemap is detected too. HTML is skipped: the CDN may rewrite it.
# Files the site deliberately does not serve (functions/_middleware.js + _routes.json) are skipped too: they return 404.
# assets/ is skipped as well: the hashed-URL check above covers it, and the plain /assets/x URL is cached for a year
# (immutable), so it can serve an older copy and never match.
CHANGED="$(git diff --name-only --diff-filter=AM HEAD~1 HEAD 2>/dev/null | grep -vE '^_|^\.git|\.html$|^assets/|^(scripts|docs|content|tests|functions|\.claude|\.github)/|^(CLAUDE|README|SECURITY)\.md$' | head -5)"
files_match() { local f; for f in $CHANGED; do [ "$(curl -s --max-time 10 "$URL/$f" | md5sum)" = "$(md5sum < "$f")" ] || return 1; done; }
for ((t = 0; t < MAX; t += 10)); do
  GOT="$(curl -s --max-time 10 "$URL/" | grep -oE '/assets/[a-z-]+\.(js|css)\?v=[0-9a-f]+' | sort -u)"
  SITEMAP_OK=0; [ "$(curl -s --max-time 10 "$URL/sitemap.xml" | md5sum)" = "$(md5sum < sitemap.xml)" ] && SITEMAP_OK=1
  [ "$GOT" = "$WANT" ] && [ "$SITEMAP_OK" = 1 ] && files_match && { echo "deployed: $URL serves the current build (after ${t}s)"; exit 0; }
  sleep 10
done
echo "timeout: $URL did not serve the current build within ${MAX}s"; exit 1
