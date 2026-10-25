#!/usr/bin/env bash
# Pull main and rebuild dist/ if there are new commits. Safe to run from cron:
# it exits quietly when nothing changed and only touches dist/ after a build
# succeeds, so a failed build never takes the live site down.
#
# Server: ~/apps/websites/dailydrip/deploy.sh, next to the clone in ./source
# (the "dailydrip" nginx container mounts ./source/dist). It lives outside the
# clone because `git reset --hard` would rewrite it mid-run.
#
# Expo SDK 58 needs Node 22+, newer than the server's Node, so the build runs
# in a throwaway node:24 container instead of on the host.
set -euo pipefail

main() {
  cd "$(dirname "${BASH_SOURCE[0]}")/source"

  umask 022
  export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
  local LOG="${DEPLOY_LOG:-/tmp/dailydrip-deploy.log}"
  log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }

  git fetch -q origin main
  local REMOTE DEPLOYED
  REMOTE=$(git rev-parse origin/main)
  # Compare against the commit actually built into dist/, not HEAD.
  DEPLOYED=$(cat dist/.deployed 2>/dev/null || echo none)

  if [[ "$DEPLOYED" == "$REMOTE" && "${FORCE:-0}" != "1" ]]; then
    ensure_mount
    return 0
  fi

  log "deploying $REMOTE (live: $DEPLOYED)"
  git reset -q --hard origin/main

  rm -rf dist.new
  # --clear: Metro caches transforms without env values; a stale cache can
  # silently bake in an old/undefined EXPO_PUBLIC_* value.
  docker run --rm -v "$PWD:/app" -w /app -u "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 node:24-slim \
    sh -c 'npm ci --no-audit --no-fund && npx expo export --platform web --clear --output-dir dist.new' \
    >>"$LOG" 2>&1
  echo "$REMOTE" > dist.new/.deployed

  # Update dist/ IN PLACE. The nginx container bind-mounts this directory by
  # inode, so replacing it with mv would leave the container serving nothing.
  mkdir -p dist
  rsync -a --delete dist.new/ dist/
  rm -rf dist.new
  log "live: $(git rev-parse --short HEAD)"

  ensure_mount
}

# If the container's view of dist/ is empty (dangling bind mount), restart it.
ensure_mount() {
  if docker inspect dailydrip >/dev/null 2>&1 &&
    ! docker exec dailydrip test -f /usr/share/nginx/html/index.html 2>/dev/null; then
    echo "$(date '+%F %T') container mount stale; restarting nginx" | tee -a "${DEPLOY_LOG:-/tmp/dailydrip-deploy.log}"
    docker restart dailydrip >/dev/null 2>&1 || true
  fi
}

main "$@"; exit $?
