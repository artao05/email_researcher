#!/usr/bin/env bash
# Start Weft backend + dashboard from email_researcher (all-in-one).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEFT="$ROOT/weft-server"
ENV_FILE="$ROOT/.env"

if [[ ! -d "$WEFT" ]]; then
  echo "weft-server/ not found. Run: git clone https://github.com/WeaveMindAI/weft.git weft-server"
  exit 1
fi

# Single .env at project root → weft-server reads via symlink
ln -sf "$ENV_FILE" "$WEFT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE — add your API keys, then re-run this script."
  exit 1
fi

# Warn if keys look empty
missing=()
for k in TAVILY_API_KEY OPENROUTER_API_KEY GEMINI_API_KEY GROQ_API_KEY; do
  val="$(grep -E "^${k}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d ' \"' || true)"
  if [[ -z "$val" ]]; then missing+=("$k"); fi
done
if [[ ${#missing[@]} -gt 4 ]]; then
  echo "Note: add keys to $ENV_FILE (TAVILY + at least one LLM). UI keys work too."
fi

echo "Starting Weft from $WEFT ..."
echo "  API:       http://localhost:3000"
echo "  Dashboard: http://localhost:5173 (or next free port)"
echo ""

cd "$WEFT"
exec ./dev.sh all
