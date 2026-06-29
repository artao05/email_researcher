#!/usr/bin/env bash
# Open sponsorship UI via local HTTP server (avoids file:// CORS errors with Weft API).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${SPONSORSHIP_UI_PORT:-8090}"
URL="http://localhost:$PORT"

if ! lsof -ti ":$PORT" >/dev/null 2>&1; then
  nohup bash "$ROOT/scripts/serve-ui.sh" > /tmp/sponsorship-ui-server.log 2>&1 &
  for _ in $(seq 1 20); do
    curl -sf "$URL" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

open "$URL"
echo "Sponsorship UI: $URL"
