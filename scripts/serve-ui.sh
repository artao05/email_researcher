#!/usr/bin/env bash
# Serve sponsorship-ui over HTTP (required for Weft API calls — file:// is blocked by CORS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UI_DIR="$ROOT/sponsorship-ui"
PORT="${SPONSORSHIP_UI_PORT:-8090}"

if lsof -ti ":$PORT" >/dev/null 2>&1; then
  echo "Sponsorship UI already running at http://localhost:$PORT"
  exit 0
fi

echo "Starting sponsorship UI at http://localhost:$PORT"
cd "$UI_DIR"
exec python3 -m http.server "$PORT"
