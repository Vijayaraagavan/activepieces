#!/usr/bin/env bash
#
# Kill all Activepieces dev processes (API, worker, web, admin-ui, redis, turbo).
# Usage: ./kill-dev.sh [--dry-run]
#

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

PATTERNS=(
  # API server (tsx watch + node bootstrap)
  "tsx.*watch.*packages/server/api"
  "packages/server/api/src/bootstrap"

  # Worker (tsx watch + node bootstrap)
  "tsx.*watch.*packages/server/worker"
  "packages/server/worker/src/bootstrap"

  # Web frontend (vite dev server started by turbo)
  "node.*vite.*activepieces"

  # Admin UI (custom vite dev server)
  "packages/custom/admin-ui/node_modules/.bin/vite"

  # Turbo task runner
  "turbo.*run.*serve.*filter"
  "turbo.*--skip-infer.*daemon"

  # In-memory Redis spawned by the API
  "redis-memory-server.*redis-binaries.*redis-server"
  "redis-memory-server/scripts/redis_killer"

  # esbuild service processes spawned by tsx/vite inside the repo
  "activepieces.*esbuild.*--service"

  # The npm run dev shell wrapper
  "sh.*-c.*turbo run serve.*filter"
)

killed=0
for pat in "${PATTERNS[@]}"; do
  pids=$(pgrep -f "$pat" 2>/dev/null || true)
  for pid in $pids; do
    # never kill ourselves
    [[ "$pid" == "$$" ]] && continue
    cmd=$(ps -p "$pid" -o args= 2>/dev/null || echo "(gone)")
    # skip Cursor IDE extension-host processes that happen to match "activepieces"
    [[ "$cmd" == *"Cursor Helper"* ]] && continue
    if $DRY_RUN; then
      printf "[dry-run] would kill %s  %s\n" "$pid" "$cmd"
    else
      kill "$pid" 2>/dev/null && printf "killed %s  %s\n" "$pid" "$cmd" || true
    fi
    ((killed++)) || true
  done
done

if (( killed == 0 )); then
  echo "No Activepieces dev processes found."
else
  $DRY_RUN || echo ""
  $DRY_RUN || echo "Sent SIGTERM to $killed process(es). Run again if any linger."
fi
