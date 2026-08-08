#!/usr/bin/env bash
#
# copy-db.sh - Copy the local SQLite database to the VPS data directory that the
#              "loterias" stack bind-mounts at /data.
#
#   ./bin/copy-db.sh
#
# Raw copy of all three SQLite files (megasena.db, -wal, -shm). The container is
# stopped for the duration of the copy when it is running, so the destination is
# never written by two processes at once, and restarted afterwards.
#
# DESTRUCTIVE: overwrites the database on the VPS with the local one.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a
VPS_USER="${VPS_USER:-bruno}"
VPS_HOST="${VPS_HOST:-jiban.lan}"
: "${LOTERIAS_DATA_DIR:?LOTERIAS_DATA_DIR not set in .env}"

SRC_DIR="$ROOT/backend/data"
[ -f "$SRC_DIR/megasena.db" ] || { echo "! $SRC_DIR/megasena.db not found" >&2; exit 1; }

ssh_vps() { ssh -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" "$@"; }

echo "==> destination ${VPS_USER}@${VPS_HOST}:${LOTERIAS_DATA_DIR}"
ssh_vps "mkdir -p '$LOTERIAS_DATA_DIR'"

WAS_RUNNING=0
if ssh_vps "docker ps --format '{{.Names}}' | grep -qx loterias"; then
    WAS_RUNNING=1
    echo "  - stopping container 'loterias'"
    ssh_vps "docker stop loterias" >/dev/null
fi

for f in megasena.db megasena.db-wal megasena.db-shm; do
    if [ -f "$SRC_DIR/$f" ]; then
        echo "  - scp $f ($(du -h "$SRC_DIR/$f" | cut -f1))"
        scp -q "$SRC_DIR/$f" "${VPS_USER}@${VPS_HOST}:${LOTERIAS_DATA_DIR}/$f"
    else
        echo "  - removing stale remote $f"
        ssh_vps "rm -f '$LOTERIAS_DATA_DIR/$f'"
    fi
done

if [ "$WAS_RUNNING" = 1 ]; then
    echo "  - starting container 'loterias'"
    ssh_vps "docker start loterias" >/dev/null
fi

echo "  ✓ done"
ssh_vps "ls -la '$LOTERIAS_DATA_DIR'"
