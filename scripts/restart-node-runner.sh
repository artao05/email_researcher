#!/usr/bin/env bash
# Restart node-runner with API keys from project .env (Tavily + OpenRouter).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
WEFT="$ROOT/weft-server"
PORT="${NODE_RUNNER_PORT:-9082}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if lsof -ti ":$PORT" >/dev/null 2>&1; then
  kill "$(lsof -ti ":$PORT")" 2>/dev/null || kill -9 "$(lsof -ti ":$PORT")"
  sleep 2
fi

cd "$WEFT"
echo "Starting node-runner on :$PORT with TAVILY + OPENROUTER from .env ..."
exec env TAVILY_API_KEY="${TAVILY_API_KEY:-}" OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" DEPLOYMENT_MODE=local \
  NODE_ID=node-runner-local NODE_PORT="$PORT" ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:8080}" \
  cargo run --release --bin node-runner
