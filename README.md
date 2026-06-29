# Sponsorship Email Assistant

A personal research assistant for tailoring sponsorship outreach emails. Paste your example email, mark which blocks stay identical vs. get personalized, run parallel company research, review results, and write approved drafts back to Google Sheets.

## What It Does

1. **Template-first** — Paste an example sponsorship email and annotate each paragraph as *Keep identical* (your org intro, tier structure) or *Personalize* (company-specific hooks).
2. **Research** — For each company in your sheet, searches news, mission, and web presence; highlights relevance to your event.
3. **Scores with justification** — Mission, recent activity, and audience alignment (1–10) each include a one-line rationale.
4. **Human review** — See research brief + personalization plan before approving; request deeper dives with a direction.
5. **Draft & write-back** — On approve, drafts the email (fixed blocks verbatim, variable blocks tailored) and writes to your Google Sheet via service account.

## Stack

| Layer | Tech |
|-------|------|
| UI | Vanilla HTML/CSS/JS (`sponsorship-ui/`) |
| Orchestration | [Weft](https://weavemind.ai) (`.weft` workflow) |
| Search | Tavily |
| LLM | OpenRouter, Gemini (direct), or Groq (direct) — pick in UI |
| Sheet I/O | Public CSV read; service-account API write |

## Google Sheet Format

**Your columns (input — fill what you have):**

| Col | Header | Required | Used for |
|-----|--------|----------|----------|
| A | Company Name | Yes | Research target |
| B | POC Name | No | `Dear [NAME]` in salutation |
| C | POC Email | No | Your manual send (not written by workflow) |
| D | Industry | No | Extra context for research |
| E | URL/link | No | Skips website lookup when filled |

**Add these output columns (workflow writes on approve):**

| Col | Header | Written by |
|-----|--------|------------|
| F | Research Brief | Workflow |
| G | Scores | Workflow (JSON) |
| H | Email Draft | Workflow |
| I | Status | e.g. `Approved` |

No sponsorship tiers column needed — attach tiers manually when sending.

Share the sheet with your **service account** `client_email` (Editor access).

## Project Structure

```
email_researcher/
├── .env                    # Your API keys (symlinked into weft-server/)
├── sponsorship-ui/         # Browser UI
├── weft/                   # Workflow definition (.weft files)
├── weft-server/            # Weft platform (git clone — run backend here)
├── scripts/
│   ├── start-weft.sh       # Start API + dashboard
│   ├── start-weft-server-only.sh
│   ├── open-ui.sh
│   └── verify-build.sh
└── docs/
```

## Quick Start

### 1. API keys

Edit **`.env`** in this folder (project root):

```bash
TAVILY_API_KEY=tvly-...
OPENROUTER_API_KEY=sk-or-...   # or OPENAI / GEMINI / GROQ
OPENAI_API_KEY=sk-...
```

### 2. Start Weft

```bash
bash scripts/start-weft-server-only.sh   # API on :3000 (already running if you used setup)
# OR both API + dashboard:
bash scripts/start-weft.sh
```

- **API:** http://localhost:3000  
- **Dashboard:** http://localhost:5173 (or 5174 if 5173 is taken)

### 3. Load workflow

Copy `weft/sponsorship_researcher.weft` into the Weft dashboard editor → Save → Run.

### 4. UI

```bash
bash scripts/open-ui.sh
# or: open sponsorship-ui/index.html
```

### 3. Review loop

- Queue shows each company: Researching → Needs Review
- **Review** → see brief, scores, personalization plan
- **Approve & Write to Sheet** → drafts email, writes columns B–E
- **Deeper Dive** → add direction, agent re-researches
- **Skip** → cancels that company

## LLM Provider Selection

| Provider | UI key field | Example models |
|----------|--------------|----------------|
| OpenAI | OpenAI key | `gpt-4o-mini`, `gpt-4o` |
| OpenRouter | OpenRouter key | Claude Sonnet 4, Gemini Flash via OR |
| Gemini | Gemini key | `gemini-2.0-flash` |
| Groq | Groq key | Llama 3.3 70B |

**Fallback:** If the selected provider's key is missing, tries OpenRouter → Gemini → Groq (UI keys first, then Weft `.env`).

## Build Verification Loop

An agent skill loops until the build passes all checks:

```bash
bash scripts/verify-build.sh
```

Or in Cursor: `/build-until-done` (uses `.agents/skills/build-until-done/SKILL.md`).

## Project Structure

```
email_researcher/
├── sponsorship-ui/
│   ├── index.html      # Setup, queue, review
│   ├── style.css
│   ├── app.js          # Sheet fetch, template blocks, Weft API
│   └── models.js       # LLM provider catalog
├── weft/
│   └── sponsorship_researcher.weft
├── scripts/
│   └── verify-build.sh
├── docs/
│   ├── implementation_plan.md
│   └── cursor_transfer_plan.md
└── .env.example
```

## Weft API

| Action | Endpoint |
|--------|----------|
| Trigger | `POST /api/v1/webhooks/{trigger_id}` |
| Poll tasks | `GET /ext/{token}/tasks` |
| Approve / deeper dive | `POST /ext/{token}/tasks/{executionId}/complete` |
| Skip | `POST /ext/{token}/tasks/{executionId}/cancel` |

Trigger payload includes: `companies`, `event_description`, `sheet_id`, `template`, `llm_provider`, `llm_model`, `api_keys`, `google_credentials`.

## Notes

- Fixed template blocks are enforced verbatim in the draft step; personalize blocks use research highlights.
- You send emails manually after drafts land in the sheet.
- The `.weft` file uses `ExecPython` for multi-provider LLM routing and Google Sheets writes — validate in the Weft compiler after loading; adjust port wiring if your Weft version differs.
