#!/usr/bin/env bash
# Register (or refresh) the Weft webhook trigger with current weft + API keys from .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
WEFT_FILE="$ROOT/weft/sponsorship_researcher.weft"
PROJECT_ID="${WEFT_PROJECT_ID:-0d745b4e-d532-4ac3-bce5-0de44bd7614f}"
TRIGGER_ID="${PROJECT_ID}-trigger"
API="${WEFT_API:-http://localhost:3000}"
DASHBOARD="${WEFT_DASHBOARD:-http://localhost:5174}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

python3 << PY
import json, urllib.request, os, re

weft = open("$WEFT_FILE").read()
tavily = os.environ.get("TAVILY_API_KEY", "")
openrouter = os.environ.get("OPENROUTER_API_KEY", "")

def inject_api_key(block_name, key_value):
    global weft
    if not key_value:
        return
    pattern = rf'({block_name} = \w+ \{{\n  label: "[^"]+")'
    repl = rf'\1\n  apiKey: "{key_value}"'
    weft, n = re.subn(pattern, repl, weft, count=1)
    if n == 0:
        print(f"warn: could not inject apiKey into {block_name}")

inject_api_key("tavily_config", tavily)
inject_api_key("llm_config", openrouter)

project_id = "$PROJECT_ID"
for url, body, method in [
    (f"$DASHBOARD/api/projects/{project_id}", {"weftCode": weft, "userId": "local"}, "PUT"),
    (f"$API/api/v1/triggers", {
        "triggerId": "$TRIGGER_ID",
        "triggerCategory": "Webhook",
        "projectId": project_id,
        "triggerNodeId": "trigger",
        "config": {"nodeType": "ApiPost", "label": "Research Trigger"},
        "userId": "local",
        "weftCode": weft,
    }, "POST"),
]:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req) as r:
        print(method, r.status, r.read()[:120])

print("Trigger ID:", "$TRIGGER_ID")
print("Webhook:", f"$API/api/v1/webhooks/$TRIGGER_ID")
PY
