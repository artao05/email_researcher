#!/usr/bin/env bash
# Fire a test webhook and poll for a human review task.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${WEFT_PROJECT_ID:-0d745b4e-d532-4ac3-bce5-0de44bd7614f}"
TRIGGER_ID="${PROJECT_ID}-trigger"
TOKEN="${WEFT_EXT_TOKEN:-local_sponsorship-ui}"
API="${WEFT_API:-http://localhost:3000}"
COMPANY="${1:-Lucimed}"

bash "$ROOT/scripts/register-trigger.sh"

python3 << PY
import json, urllib.request, time

template = {
  "subject_mode": "personalize",
  "blocks": [
    {"text": "Dear [NAME],", "mode": "personalize"},
    {"text": "I'm writing to see if [COMPANY NAME] would be interested in sponsoring the CHIMES Symposium. [[WRITE CUSTOM HERE]]", "mode": "personalize"},
    {"text": "I've attached sponsorship tiers. Thank you!\\nBest regards,\\nArthur", "mode": "fixed"},
  ],
}
payload = {
  "companies": json.dumps([{"name": "$COMPANY", "row": 2}]),
  "event_description": "CHIMES Symposium — circadian health, sleep, and epidemiology. Oct 13, Boston.",
  "sheet_id": "test-sheet-id",
  "template": json.dumps(template),
  "llm_provider": "openrouter",
  "llm_model": "google/gemini-2.5-flash",
  "api_keys": json.dumps({}),
  "google_credentials": "",
}
req = urllib.request.Request(
    "$API/api/v1/webhooks/$TRIGGER_ID",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as r:
    print("WEBHOOK:", r.read().decode())

for i in range(60):
    time.sleep(3)
    with urllib.request.urlopen("$API/ext/$TOKEN/tasks", timeout=10) as r:
        tasks = json.loads(r.read().decode()).get("tasks") or []
    human = [t for t in tasks if (t.get("metadata") or {}).get("source") == "human"]
    if human:
        t = human[0]
        print("\\n=== REVIEW TASK READY ===")
        print("executionId:", t.get("executionId"))
        d = t.get("data") or {}
        fields = {f.get("key"): f.get("value") for f in (t.get("formSchema") or {}).get("fields", []) if f.get("key")}
        company = d.get("company_name") or fields.get("company_name")
        brief = d.get("brief") or fields.get("brief") or ""
        scores = d.get("scores") or fields.get("scores") or ""
        print("company:", company)
        print("brief:", str(brief)[:400])
        print("scores:", str(scores)[:300])
        print("\\nOpen sponsorship-ui and approve/reject in the review panel.")
        break
    if i % 5 == 0:
        print(f"poll {i+1}: waiting for research + review task...")
else:
    print("No human task after 3 minutes. Check weft logs for Tavily/LLM errors.")
    exit(1)
PY
