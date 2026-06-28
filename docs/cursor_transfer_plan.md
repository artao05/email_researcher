# Sponsorship Relevance Researcher — Cursor Transfer Plan

## What This Is

A two-part system:
1. **A standalone dark-mode web UI** (vanilla HTML/CSS/JS) — entry point to kick off research runs and review results
2. **A Weft workflow** (`.weft` file) — the backend orchestration engine that runs parallel research agents, pauses for human review, and writes results back to Google Sheets

The user pastes a Google Sheet URL + an event description into the UI, hits Run, and the Weft backend processes all companies in parallel. Results surface in a live queue in the UI where the user can annotate, approve, or request deeper dives — one company at a time.

---

## Project Location

```
/Users/arthurtao/Documents/Projects/Exploratory/weavemind/
├── weft/                          # The Weft repo (already running)
│   └── sponsorship_researcher.weft   # ← CREATE THIS
└── sponsorship-ui/                # ← CREATE THIS DIRECTORY + FILES
    ├── index.html
    ├── style.css
    └── app.js
```

### Running Services (already started)

| Service | URL | Notes |
|---|---|---|
| Weft Dashboard | `http://localhost:5174` | Bumped from 5173 (in use by another project) |
| **Weft API** | **`http://localhost:3000`** | All API calls go here |
| Executor | `http://localhost:9081` | Internal — UI never calls this directly |
| PostgreSQL | `localhost:5433` | Auto-provisioned via Docker |

> Check `.env` for actual `PORT` value. Default is `3000`. CORS allows any `http://localhost:*` in local mode — no CORS issues calling from the UI.

---

## Part 1: The Weft Workflow

### File to create
```
/Users/arthurtao/Documents/Projects/Exploratory/weavemind/weft/sponsorship_researcher.weft
```

### Language Primer

A `.weft` file is a declarative graph. Nodes are declared with a type and label, then wired with `node.port = other.port`. The compiler validates types at save time.

```weft
# Project: My Project
# Description: What it does

my_node = NodeType {
  label: "Human-readable name"
  fieldName: "value"
}

another_node = OtherNodeType -> (output1: String) {
  label: "Another Node"
}
another_node.inputPort = my_node.outputPort
```

**Key rules:**
- **Null propagation** — a required port receiving null causes the node to skip. This cascades downstream. This IS the branching mechanism — no if/else needed.
- **Optional ports** — append `?` to a type (`String?`) to accept null without cutting flow.
- **Parallel processing** — data-driven via pulse splitting. A `List[T]` fed into a supporting node spawns one "pulse" per item. Each runs independently. Each pulse can have its own `HumanQuery` task.

### Available Nodes (exact names for `.weft` files)

From `catalog/catalog-tree.json`:

| Category | Node name in `.weft` |
|---|---|
| AI | `LlmConfig`, `LlmInference` |
| Code | `ExecPython` |
| Communication | `EmailConfig`, `EmailSend`, `EmailReceive`, `DiscordConfig`, `DiscordSend`, `SlackConfig`, `SlackSend`, `TelegramConfig`, `TelegramSend` |
| Data | `Text`, `Number`, `Boolean`, `Dict`, `List`, `Credential` |
| Enrichment | `TavilyConfig`, `TavilySearch`, `Http`, `ApolloConfig`, `ApolloSearch` |
| Flow | `Gate`, `Notify` |
| Feedback | `HumanQuery`, `HumanTrigger` |
| Storage | `MemoryStore`, `MemoryQuery`, `MemoryDelete`, `PostgresDatabase` |
| Transform | `Pack`, `Unpack`, `Template` |
| Triggers | `ApiPost`, `Cron`, `Rss` |
| Debug | `Debug` |

### HumanQuery Node — Full Syntax

The HumanQuery node generates ports dynamically from its `fields` config. Each field type has specific input/output ports:

| `fieldType` | Input port | Output port | Type |
|---|---|---|---|
| `display` | `{key}` (Any) — wire data to show | none | Read-only display |
| `approve_reject` | none | `{key}_approved` (Boolean), `{key}_rejected` (Boolean) | Exactly one is true, other is null |
| `text_input` | none | `{key}` (String) | Short free text |
| `textarea` | none | `{key}` (String) | Long free text |
| `editable_textarea` | `{key}` (String) — pre-filled content | `{key}` (String) — edited version | Pre-filled long text |
| `select` | none | `{key}` (String) | Static option list |
| `select_input` | `{key}` (List[String]) — options | `{key}` (String) | Dynamic options |

```weft
review = HumanQuery {
  label: "Review Research"
  title: "Sponsorship Relevance Review"
  fields: [
    {"fieldType": "display", "key": "company_name"},
    {"fieldType": "display", "key": "brief"},
    {"fieldType": "display", "key": "scores"},
    {"fieldType": "approve_reject", "key": "decision", "config": {
      "approveLabel": "Approve & Draft Outreach",
      "rejectLabel": "Request Deeper Dive"
    }},
    {"fieldType": "textarea", "key": "annotation"},
    {"fieldType": "text_input", "key": "deeper_dive_direction"}
  ]
}
# Wire the display inputs
review.company_name = upstream.company_name
review.brief        = upstream.brief
review.scores       = upstream.scores
```

### Gate Node — Full Syntax

Gate routes flow based on a boolean. Null or false → output is null (cuts downstream). True → forwards the value.

```weft
# Approve branch
approve_gate = Gate { label: "If Approved" }
approve_gate.pass  = review.decision_approved   # Boolean — true or null
approve_gate.value = review.annotation          # Any type — forwarded if pass is true

# Reject / deeper dive branch
dive_gate = Gate { label: "If Deeper Dive" }
dive_gate.pass  = review.decision_rejected      # Boolean — true or null
dive_gate.value = review.deeper_dive_direction  # Forwarded if pass is true

# Downstream nodes auto-skip on the null branch
outreach_llm.direction = approve_gate.value     # only runs when approved
reresearch.focus       = dive_gate.value        # only runs on deeper dive
```

### Full Workflow Design

```weft
# Project: Sponsorship Researcher
# Description: Parallel company-event relevance research with human-in-the-loop review

# ── Entry point ───────────────────────────────────────────
trigger = ApiPost -> (companies: String, event_description: String, sheet_id: String) {
  label: "Research Trigger"
}

# ── LLM config (shared across all research) ───────────────
llm_config = LlmConfig {
  label: "Research LLM"
  model: "anthropic/claude-sonnet-4-5"
  temperature: "0.3"
}

tavily_config = TavilyConfig {
  label: "Tavily Config"
}

# ── Per-company research (each company is a parallel pulse) ─
# Note: Companies come in as a JSON string; use ExecPython or
# Unpack to iterate. Each pulse carries one company object.

# Search 1: Recent news
news_search = TavilySearch {
  label: "News Search"
}
news_search.config = tavily_config.config
news_search.query  = trigger.companies  # compiler resolves per-pulse

# Search 2: Mission/focus
mission_search = TavilySearch {
  label: "Mission Search"
}
mission_search.config = tavily_config.config

# HTTP: Scrape company website
scrape = Http {
  label: "Scrape Website"
}

# Synthesize research
synthesizer = LlmInference -> (response: String) {
  label: "Synthesizer"
  systemPrompt: "You are a sponsorship research analyst. Given an event description and research on a company, produce: (1) Mission alignment score 1-10 + reasoning, (2) Recent activity alignment score 1-10 + reasoning, (3) Audience alignment score 1-10 + reasoning, (4) Overall score 1-10, (5) 2-3 paragraph summary brief. Format as JSON."
}
synthesizer.config  = llm_config.config
synthesizer.prompt  = news_search.results  # + mission + scrape via Template

# ── Human review ──────────────────────────────────────────
review = HumanQuery {
  label: "Review Research"
  title: "Sponsorship Relevance Review"
  fields: [
    {"fieldType": "display", "key": "brief"},
    {"fieldType": "approve_reject", "key": "decision", "config": {
      "approveLabel": "Approve & Draft Outreach",
      "rejectLabel": "Request Deeper Dive"
    }},
    {"fieldType": "textarea", "key": "annotation"},
    {"fieldType": "text_input", "key": "deeper_dive_direction"}
  ]
}
review.brief = synthesizer.response

# ── Routing ───────────────────────────────────────────────
approve_gate = Gate { label: "If Approved" }
approve_gate.pass  = review.decision_approved
approve_gate.value = review.annotation

dive_gate = Gate { label: "If Deeper Dive" }
dive_gate.pass  = review.decision_rejected
dive_gate.value = review.deeper_dive_direction

# ── Approved branch: draft outreach ───────────────────────
outreach_llm = LlmInference -> (response: String) {
  label: "Outreach Drafter"
  systemPrompt: "Write a concise, tailored sponsorship outreach email. Use the event description and research brief. Be specific and compelling."
}
outreach_llm.config  = llm_config.config
outreach_llm.prompt  = approve_gate.value  # annotation used as direction

output_debug = Debug { label: "Final Output" }
output_debug.data = outreach_llm.response

# ── Deeper dive branch ────────────────────────────────────
deep_search = TavilySearch {
  label: "Deep Search"
}
deep_search.config = tavily_config.config
deep_search.query  = dive_gate.value  # direction from user
```

> **Note on parallel processing:** The Weft compiler handles pulse splitting when a `List[T]` is processed. You may need to use a `Python` node to parse the incoming companies JSON string into a list before feeding into the research pipeline. Ask the Weft compiler — it will tell you if types don't match.

### Example `.weft` file to reference syntax

Read `email_agent.weft` in the repo root — it's a minimal working example.

---

## Part 2: The Standalone Web UI

### Files to create
```
/Users/arthurtao/Documents/Projects/Exploratory/weavemind/sponsorship-ui/
├── index.html
├── style.css
└── app.js
```

### UI Structure: 3 Views

**View 1 — Setup**
- App title: "Sponsorship Researcher" (dark, premium header)
- `<textarea>` — "Event Description" (multi-line, the event scope text)
- `<input>` — "Google Sheet URL" (shareable link to the companies sheet)
- `<input>` — "Extension Token" (Weft auth token — see below)
- `<input>` — "Trigger ID" (the ApiPost trigger ID from Weft dashboard — see below)
- `<button>` — "Run Research" → fetches sheet, parses companies, POSTs to Weft
- Small status line: "Found 12 companies. Starting research..."
- Token + Trigger ID stored in `localStorage` so only entered once

**View 2 — Queue** (after Run is clicked)
- Status bar: "14 companies · 3 researching · 2 needs review · 9 pending"
- Scrollable list of company cards, each with:
  - Company name + URL (clickable)
  - Status badge: `Researching` (pulsing dot) | `Needs Review` (amber glow) | `Approved` (green) | `Skipped` | `Re-researching`
  - "Review →" button visible when status is `Needs Review`
- Polls `GET /ext/{token}/tasks` every 3 seconds to update statuses

**View 3 — Review Panel** (slide-in right drawer when "Review →" clicked)
- Company name (large) + URL (small, clickable)
- Four score pills side by side: Mission · Recent Activity · Audience · Overall
  - Color: ≥8 → green `#22c55e`, 5–7 → amber `#f59e0b`, <5 → red `#ef4444`
- Research brief (formatted text paragraphs)
- Annotation `<textarea>` — "Add notes or context"
- If requesting deeper dive: "Direction" `<input>` appears
- Three action buttons:
  - ✅ **Approve** — calls complete_task with `decision: true`
  - 🔍 **Deeper Dive** — calls complete_task with `decision: false` + direction
  - ⏭ **Skip** — calls cancel_task
- After action: auto-advance to next "Needs Review" card

### Design Direction

- **Background**: `#0a0d14` (deep navy-black)
- **Card surface**: `rgba(255,255,255,0.04)` + `backdrop-filter: blur(12px)` + `border: 1px solid rgba(255,255,255,0.08)` (glassmorphism)
- **Typography**: Inter from Google Fonts — weights 400, 500, 600
- **Accent**: `#6366f1` (indigo) for buttons and active highlights
- **Status colors**: pulsing `#f59e0b` dot for Researching, `#22c55e` for Approved, `#ef4444` for Skipped
- **Review panel**: slides in from right with `transform: translateX()` transition, `300ms ease`
- **Hover states**: cards lift with `box-shadow` on hover
- **Loading skeleton**: shimmering placeholder while research is in progress

---

## The Weft API — Exact Endpoints

All API calls go to **`http://localhost:3000`** (or whatever `PORT` is in `.env`).

### Auth: Extension Token

The extension token authenticates all `/ext/{token}/...` calls. It's not a Bearer token — it's embedded in the URL path.

**How to create one:**
1. Go to `http://localhost:5174` → Settings → Extension Tokens → Create
2. Copy the token string
3. User pastes it into the UI's "Extension Token" field (stored in `localStorage`)

### 1. Trigger the workflow

```
POST http://localhost:3000/api/v1/webhooks/{trigger_id}
Content-Type: application/json

{
  "companies": "[{\"name\":\"Acme\",\"url\":\"https://acme.com\"}, ...]",
  "event_description": "An annual conference focused on...",
  "sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
}
```

Response:
```json
{ "status": "success", "message": "Project execution {executionId} started" }
```

**How to get `trigger_id`:**
1. Load `sponsorship_researcher.weft` into the Weft dashboard
2. Click the `ApiPost` node → the trigger URL will be displayed
3. Copy the UUID from the URL — that's the trigger ID
4. Paste it into the UI's "Trigger ID" field

### 2. Poll for pending tasks (the review queue)

```
GET http://localhost:3000/ext/{token}/tasks
```

Response:
```json
{
  "tasks": [
    {
      "executionId": "uuid-of-project-execution",
      "nodeId": "review",
      "title": "Sponsorship Relevance Review",
      "description": null,
      "data": {
        "brief": "...",
        "scores": { "mission": 8, "recent": 6, "audience": 7, "overall": 7 }
      },
      "createdAt": "2026-06-28T20:00:00Z",
      "taskType": "human_query",
      "formSchema": { ... },
      "metadata": {
        "callbackId": "{executionId}-{nodeId}-{pulseId}-{seq}",
        "source": "human"
      }
    }
  ]
}
```

> **Important:** The `callbackId` is in `task.metadata.callbackId`. You need this for the complete_task call.

Poll every 3 seconds. Track which `executionId`s are known locally and update their statuses.

### 3. Approve or deeper dive (complete a task)

```
POST http://localhost:3000/ext/{token}/tasks/{executionId}/complete
Content-Type: application/json

{
  "nodeId": "review",
  "callbackId": "{executionId}-review-{pulseId}-{seq}",
  "input": {
    "decision": true,          // true = approve, false = deeper dive
    "annotation": "Good fit — focus on their AI infrastructure angle",
    "deeper_dive_direction": "" // only relevant if decision is false
  }
}
```

- `callbackId` — copy exactly from `task.metadata.callbackId`
- `nodeId` — must match the node label used in the `.weft` file (e.g. `"review"`)
- `input` keys must match the `key` values in the HumanQuery `fields` config

Response: `{ "status": "completed" }`

### 4. Skip a task

```
POST http://localhost:3000/ext/{token}/tasks/{executionId}/cancel
```

This sends a null through the workflow, propagating a skip to all downstream nodes. Response: `{ "status": "cancelled" }`

---

## Google Sheets — Read Side (no OAuth needed)

The UI reads the sheet via a public CSV export URL. The sheet must be shared with "Anyone with the link can view."

```javascript
function sheetUrlToCsvUrl(sheetUrl) {
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = match[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

async function fetchCompanies(sheetUrl) {
  const res = await fetch(sheetUrlToCsvUrl(sheetUrl));
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      name: values[headers.indexOf('company name')] || values[0],
      url: values[headers.indexOf('website url')] || values[1]
    };
  });
}
```

**Expected sheet format (row 1 = headers):**

| Company Name | Website URL |
|---|---|
| Acme Corp | https://acme.com |
| Widget Co | https://widget.co |

---

## Google Sheets — Write-Back (MVP: skip, do later)

For MVP, output the final package (brief + scores + annotation + outreach draft) to a `Debug` node in Weft. The user can copy from the Weft dashboard.

For the full write-back, the Weft workflow would use an `Http` node to call the Google Sheets API v4 `PUT /values/{range}` with a service account Bearer token. This requires a service account JSON key stored as a `Credential` node in Weft. **Leave this for a follow-up.**

---

## Current Status

| Item | Status |
|---|---|
| Architecture designed | ✅ Done |
| Weft server running | ✅ `http://localhost:5174` (dashboard), API on `http://localhost:3000` |
| Exact API endpoints verified | ✅ Done (from source code) |
| HumanQuery field syntax verified | ✅ Done |
| Gate node syntax verified | ✅ Done |
| `.weft` workflow file | ❌ Not yet created |
| Standalone UI | ❌ Not yet created |
| Extension token | ❌ Generate in Weft dashboard before testing |
| ApiPost trigger ID | ❌ Available after loading `.weft` into dashboard |
| Google Sheets write-back | ⚠️ Optional — skip for MVP |

---

## Implementation Order

### Step 1 — Create the `.weft` file
Write `sponsorship_researcher.weft` in the repo root. Start with a simplified single-company version:
`ApiPost` → `TavilySearch` → `LlmInference` → `HumanQuery` → `Gate` → `LlmInference` → `Debug`

Load it in the Weft dashboard (`http://localhost:5174`). The compiler will catch any type errors immediately. Fix until it compiles cleanly and appears as a graph.

### Step 2 — Get the trigger ID + extension token
1. In the Weft dashboard, run the project (click Play / Start)
2. Click the `ApiPost` node — copy the trigger ID from its webhook URL
3. Go to Settings → Extension Tokens → Create — copy the token
4. Note both for use in the UI

### Step 3 — Verify HumanQuery via curl
Manually POST to the webhook to start an execution, then poll `GET /ext/{token}/tasks` and confirm a task appears with the right `data` shape.

```bash
# Start a research run
curl -X POST http://localhost:3000/api/v1/webhooks/{trigger_id} \
  -H "Content-Type: application/json" \
  -d '{"companies": "[{\"name\":\"Test Co\",\"url\":\"https://test.com\"}]", "event_description": "Test event"}'

# Wait ~10 seconds, then check for tasks
curl http://localhost:3000/ext/{token}/tasks
```

### Step 4 — Build the UI
Build `index.html`, `style.css`, `app.js`. Start with Setup view → wires to the webhook → transitions to Queue view with polling. Then add the Review Panel with the three actions.

Open the UI as a local file: `open sponsorship-ui/index.html` (CORS is permissive for localhost so no dev server needed).

### Step 5 — End-to-end test
1. Paste a test sheet URL with 2-3 companies
2. Paste event description
3. Click Run — confirm Weft dashboard shows parallel executions
4. Wait for tasks to appear in the UI queue
5. Click Review, annotate, click Approve
6. Confirm Weft shows the outreach drafter running and the Debug output

### Step 6 (optional) — Add Google Sheets write-back
Add an `Http` node at the end of the approved branch that calls the Google Sheets API v4 to update the row.

---

## Key Files to Read First

| File | Why |
|---|---|
| `weft/README.md` | Language syntax overview |
| `weft/email_agent.weft` | Real working `.weft` example |
| `weft/DESIGN.md` | Null propagation, Gate, composability — read before writing weft code |
| `weft/catalog/catalog-tree.json` | Complete node name list |
| `weft/crates/weft-api/src/extension_api.rs` | `list_tasks`, `complete_task`, `cancel_task` implementation |
| `weft/crates/weft-api/src/main.rs` | All registered routes + ports |
| `weft/.env` | Actual port values (default PORT=3000) |
