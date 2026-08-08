#!/usr/bin/env bash
#
# bootstrap-dockhand.sh - One-time setup of the "loterias" Dockhand git stack.
#
#   ./bin/bootstrap-dockhand.sh
#
# Idempotent: every step checks for the existing resource before creating it.
# Re-run for disaster recovery (e.g. Dockhand DB lost).
#
# Steps:
#   1. Ensure the host data directory ($LOTERIAS_DATA_DIR) exists on the VPS.
#   2. Ensure the VPS deploy public key is registered as a read-only deploy key
#      on the GitHub repository (requires `gh` authenticated as the repo owner).
#   3. Ensure a Dockhand SSH git credential named `jiban-deploy-key` exists.
#   4. Create the git stack `loterias` (branch main, compose.prod.yaml,
#      buildOnDeploy) with LOTERIAS_DATA_DIR as a SECRET env override — secrets
#      are injected into the compose shell at deploy time, which is what makes
#      the `${LOTERIAS_DATA_DIR}` interpolation in compose.prod.yaml resolve
#      without the path ever being committed.
#
# Afterwards: ./bin/copy-db.sh && ./bin/deploy.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a
DOCKHAND_URL="${DOCKHAND_URL:-http://jiban.lan:3000}"
DOCKHAND_API="${DOCKHAND_API:-${DOCKHAND_API_TOKEN:-}}"
ENV_ID="${DOCKHAND_ENV_ID:-1}"
VPS_USER="${VPS_USER:-bruno}"
VPS_HOST="${VPS_HOST:-jiban.lan}"
: "${DOCKHAND_API:?DOCKHAND_API(_TOKEN) not set in .env}"
: "${LOTERIAS_DATA_DIR:?LOTERIAS_DATA_DIR not set in .env}"

STACK_NAME="loterias"
REPO_SLUG="brunofunnie/ganhador-da-megasena"
REPO_SSH="git@github.com:${REPO_SLUG}.git"
CRED_NAME="jiban-deploy-key"

ssh_vps() { ssh -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" "$@"; }
api() { # METHOD PATH [JSON_BODY]
    local method="$1" path="$2" body="${3:-}"
    local args=(-sS -m 300 -X "$method" -H "Authorization: Bearer $DOCKHAND_API"
                -H "Accept: application/json")
    [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
    curl "${args[@]}" "$DOCKHAND_URL$path"
}

echo "==> 1/4 host data directory"
ssh_vps "mkdir -p '$LOTERIAS_DATA_DIR'" && echo "    $LOTERIAS_DATA_DIR ready"

echo "==> 2/4 GitHub deploy key on $REPO_SLUG"
PUBKEY="$(ssh_vps "ssh-keygen -y -f ~/.ssh/id_ed25519")"
if gh api "repos/$REPO_SLUG/keys" --jq '.[].key' | grep -qF "$(echo "$PUBKEY" | cut -d' ' -f2)"; then
    echo "    already present"
else
    gh api "repos/$REPO_SLUG/keys" -f "title=jiban-deploy-key" -f "key=$PUBKEY" -F read_only=true >/dev/null
    echo "    added (read-only)"
fi

echo "==> 3/4 Dockhand SSH git credential '$CRED_NAME'"
CRED_ID="$(api GET /api/git/credentials | python3 -c '
import sys, json
name = sys.argv[1]
try: data = json.load(sys.stdin)
except Exception: sys.exit(0)
for c in data:
    if c.get("name") == name:
        print(c["id"]); break
' "$CRED_NAME")"
if [ -z "$CRED_ID" ]; then
    echo "    ! credential '$CRED_NAME' not found in Dockhand; create it first" >&2
    exit 1
fi
echo "    credentialId=$CRED_ID"

echo "==> 4/4 git stack '$STACK_NAME'"
STACK_ID="$(api GET /api/git/stacks | python3 -c '
import sys, json
name = sys.argv[1]
try: data = json.load(sys.stdin)
except Exception: sys.exit(0)
for s in data:
    if s.get("stackName") == name or s.get("name") == name:
        print(s.get("id")); break
' "$STACK_NAME")"
if [ -n "$STACK_ID" ]; then
    echo "    already exists (id=$STACK_ID) — nothing to do"
else
    BODY="$(CRED_ID="$CRED_ID" ENV_ID="$ENV_ID" STACK_NAME="$STACK_NAME" \
            REPO_SSH="$REPO_SSH" LOTERIAS_DATA_DIR="$LOTERIAS_DATA_DIR" python3 -c '
import json, os
print(json.dumps({
    "stackName": os.environ["STACK_NAME"],
    "environmentId": int(os.environ["ENV_ID"]),
    "url": os.environ["REPO_SSH"],
    "repoName": os.environ["STACK_NAME"],
    "branch": "main",
    "credentialId": int(os.environ["CRED_ID"]),
    "composePath": "compose.prod.yaml",
    "buildOnDeploy": True,
    "deployNow": False,
    "envVars": [
        {"key": "LOTERIAS_DATA_DIR",
         "value": os.environ["LOTERIAS_DATA_DIR"],
         "isSecret": True},
    ],
}))')"
    api POST /api/git/stacks "$BODY" | head -c 400; echo
fi

echo
echo "Done. Next:"
echo "  ./bin/copy-db.sh      # seed $LOTERIAS_DATA_DIR with the local database"
echo "  ./bin/deploy.sh       # push + sync + build + up"
echo
echo "Cloudflare tunnel ingress (dashboard, remote-managed tunnel):"
echo "  loteria.funnie.dev -> http://loterias:3001"
