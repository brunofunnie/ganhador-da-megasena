#!/usr/bin/env bash
#
# deploy.sh - Non-destructive deploy of the "loterias" stack via Dockhand.
#
#   ./bin/deploy.sh [--no-push]
#
# Steps:
#   1. git push (current branch -> origin/main)
#   2. Dockhand: sync the git stack (pull latest commit into the stack dir)
#   3. Dockhand: deploy the git stack (build + docker compose up)
#
# The SQLite database lives OUTSIDE the image, in the host directory bound to
# /data ($LOTERIAS_DATA_DIR), so redeploys never touch existing data.
# Use ./bin/copy-db.sh to (re)seed that directory.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a
DOCKHAND_URL="${DOCKHAND_URL:-http://jiban.lan:3000}"
DOCKHAND_API="${DOCKHAND_API:-${DOCKHAND_API_TOKEN:-}}"
: "${DOCKHAND_API:?DOCKHAND_API(_TOKEN) not set in .env}"

STACK_NAME="loterias"
PUSH=1
[ "${1:-}" = "--no-push" ] && PUSH=0

api() { # METHOD PATH [JSON_BODY]
    local method="$1" path="$2" body="${3:-}"
    local args=(-sS -m 900 -X "$method" -H "Authorization: Bearer $DOCKHAND_API"
                -H "Accept: application/json")
    [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
    curl "${args[@]}" "$DOCKHAND_URL$path"
}

stack_id_by_name() { # NAME -> numeric id or empty
    api GET /api/git/stacks | python3 -c '
import sys, json
name = sys.argv[1]
try: data = json.load(sys.stdin)
except Exception: sys.exit(0)
for s in data:
    if s.get("stackName") == name or s.get("name") == name:
        print(s.get("id")); break
' "$1"
}

echo "==> $STACK_NAME"

if [ "$PUSH" = 1 ]; then
    echo "  - git push origin HEAD:main"
    git push origin HEAD:main
else
    echo "  - skipping git push (--no-push)"
fi

id="$(stack_id_by_name "$STACK_NAME")"
if [ -z "$id" ]; then
    echo "  ! Dockhand git stack '$STACK_NAME' not found. Run bin/bootstrap-dockhand.sh first." >&2
    exit 1
fi
echo "  - stack id=$id"

echo "  - sync"
api POST "/api/git/stacks/$id/sync" '{}' | head -c 400; echo
echo "  - deploy (build)"
api POST "/api/git/stacks/$id/deploy" '{"pull":false,"build":true,"forceRecreate":true}' | head -c 800; echo
echo "  ✓ done — https://loteria.funnie.dev"
