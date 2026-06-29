#!/usr/bin/env bash
# Serve sponsorship-ui over HTTP (required for Weft API + Google Sheet proxy).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${SPONSORSHIP_UI_PORT:-8090}"

if lsof -ti ":$PORT" >/dev/null 2>&1; then
  echo "Sponsorship UI already running at http://localhost:$PORT"
  exit 0
fi

echo "Starting sponsorship UI at http://localhost:$PORT"
exec python3 "$ROOT/scripts/serve-ui.py"
