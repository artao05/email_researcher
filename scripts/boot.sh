#!/usr/bin/env bash
# One command: start Weft (if needed), UI server, register trigger, open browser.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing .env — copy from .env.example and add API keys."
  exit 1
fi

# Weft API
if ! curl -sf http://localhost:3000/health >/dev/null 2>&1; then
  echo "Starting Weft backend..."
  nohup bash "$ROOT/scripts/start-weft-server-only.sh" > /tmp/weft-server.log 2>&1 &
  for _ in $(seq 1 60); do
    curl -sf http://localhost:3000/health >/dev/null 2>&1 && break
    sleep 2
  done
fi

if ! curl -sf http://localhost:3000/health >/dev/null 2>&1; then
  echo "Weft API did not start. Check /tmp/weft-server.log"
  exit 1
fi

# UI server (required — do NOT open file://)
if ! curl -sf http://localhost:8090/api/health >/dev/null 2>&1; then
  echo "Starting sponsorship UI on :8090..."
  nohup bash "$ROOT/scripts/serve-ui.sh" > /tmp/sponsorship-ui-server.log 2>&1 &
  for _ in $(seq 1 20); do
    curl -sf http://localhost:8090/api/health >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

bash "$ROOT/scripts/register-trigger.sh"

echo ""
echo "Ready:"
echo "  UI:        http://localhost:8090"
echo "  Weft API:  http://localhost:3000"
echo "  Trigger:   0d745b4e-d532-4ac3-bce5-0de44bd7614f-trigger"
echo "  Ext token: local_sponsorship-ui"
echo ""

open "http://localhost:8090"
