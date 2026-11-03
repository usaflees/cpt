#!/usr/bin/env bash
# Waits until a deployment serves the current local build: its home page references the same content-hashed assets
# as the local index.html and its sitemap.xml is identical, so an agent needs one command instead of many polling turns.
#   bash tests/wait-deploy.sh <base-url> [timeout-seconds]   e.g. https://claude-weekly-2026-11-09.cryptopriceticker.pages.dev
set -u
cd "$(dirname "$0")/.."
URL="${1:?usage: bash tests/wait-deploy.sh <base-url> [timeout-seconds]}"; URL="${URL%/}"; MAX="${2:-600}"
WANT="$(grep -oE '/assets/[a-z-]+\.(js|css)\?v=[0-9a-f]+' index.html | sort -u)"
[ -n "$WANT" ] || { echo "no hashed asset links found in index.html"; exit 1; }
for ((t = 0; t < MAX; t += 10)); do
  GOT="$(curl -s --max-time 10 "$URL/" | grep -oE '/assets/[a-z-]+\.(js|css)\?v=[0-9a-f]+' | sort -u)"
  SITEMAP_OK=0; [ "$(curl -s --max-time 10 "$URL/sitemap.xml" | md5sum)" = "$(md5sum < sitemap.xml)" ] && SITEMAP_OK=1
  [ "$GOT" = "$WANT" ] && [ "$SITEMAP_OK" = 1 ] && { echo "deployed: $URL serves the current build (after ${t}s)"; exit 0; }
  sleep 10
done
echo "timeout: $URL did not serve the current build within ${MAX}s"; exit 1
