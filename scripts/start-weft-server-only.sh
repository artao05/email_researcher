#!/usr/bin/env bash
# Start Weft backend only (API on :3000) — use if dashboard already running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ln -sf "$ROOT/.env" "$ROOT/weft-server/.env"
cd "$ROOT/weft-server"
exec ./dev.sh server
