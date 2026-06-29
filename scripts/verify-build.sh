#!/usr/bin/env bash
# Verification script for Sponsorship Email Assistant build completeness.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

check() {
  local desc="$1"
  local path="$2"
  if [[ -f "$path" ]]; then
    echo "  ✓ $desc"
  else
    echo "  ✗ MISSING: $desc ($path)"
    FAIL=1
  fi
}

check_content() {
  local desc="$1"
  local path="$2"
  local pattern="$3"
  if grep -q "$pattern" "$path" 2>/dev/null; then
    echo "  ✓ $desc"
  else
    echo "  ✗ FAIL: $desc — expected pattern '$pattern' in $path"
    FAIL=1
  fi
}

echo "=== Sponsorship Email Assistant — Build Verification ==="
echo ""

echo "Core files:"
check "UI shell" "$ROOT/sponsorship-ui/index.html"
check "UI styles" "$ROOT/sponsorship-ui/style.css"
check "UI app logic" "$ROOT/sponsorship-ui/app.js"
check "LLM catalog" "$ROOT/sponsorship-ui/models.js"
check "Weft workflow" "$ROOT/weft/sponsorship_researcher.weft"
check "Env example" "$ROOT/.env.example"
check "Build loop skill" "$ROOT/.agents/skills/build-until-done/SKILL.md"

echo ""
echo "Feature checks:"
check_content "Template block annotator" "$ROOT/sponsorship-ui/index.html" "template-blocks"
check_content "LLM provider picker" "$ROOT/sponsorship-ui/index.html" "llm-provider"
check_content "Gemini option" "$ROOT/sponsorship-ui/models.js" "gemini"
check_content "Groq option" "$ROOT/sponsorship-ui/models.js" "groq"
check_content "OpenRouter option" "$ROOT/sponsorship-ui/models.js" "openrouter"
check_content "Fallback key chain" "$ROOT/sponsorship-ui/models.js" "FALLBACK_ORDER"
check_content "Company name only CSV" "$ROOT/sponsorship-ui/app.js" "Company Name"
check_content "Google SA write-back field" "$ROOT/sponsorship-ui/index.html" "google-sa-json"
check_content "Review process panel" "$ROOT/sponsorship-ui/index.html" "review-process"
check_content "Score justifications" "$ROOT/sponsorship-ui/index.html" "score-justifications"
check_content "HumanQuery in weft" "$ROOT/weft/sponsorship_researcher.weft" "HumanQuery"
check_content "Sheets write in weft" "$ROOT/weft/sponsorship_researcher.weft" "Write to Google Sheet"
check_content "Multi-provider LLM in weft" "$ROOT/weft/sponsorship_researcher.weft" "call_gemini"
check_content "Deeper dive branch" "$ROOT/weft/sponsorship_researcher.weft" "Deep Dive"
check_content "CHIMES template" "$ROOT/sponsorship-ui/templates/chimes.js" "CHIMES_TEMPLATE"

echo ""
echo "JS syntax:"
if node --check "$ROOT/sponsorship-ui/app.js" 2>/dev/null && node --check "$ROOT/sponsorship-ui/models.js" 2>/dev/null; then
  echo "  ✓ JavaScript parses cleanly"
else
  echo "  ✗ JavaScript syntax error"
  FAIL=1
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "RESULT: PASS — all checks green"
  exit 0
else
  echo "RESULT: FAIL — fix issues above"
  exit 1
fi
