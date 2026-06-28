# Sponsorship Relevance Researcher

A tool that takes a Google Sheet of potential sponsors, researches each company's alignment with an event you're covering, runs all research in parallel in the background, and surfaces results one-by-one in a purpose-built UI where you can annotate, approve, request deeper dives, and write final packages back to the sheet.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              STANDALONE WEB UI              │
│  - Paste Google Sheet URL                   │
│  - Paste / write event description          │
│  - Hit "Run" → calls Weft API               │
│  - Live queue: review companies one-by-one  │
│  - Annotate, approve, request re-research   │
└──────────────────┬──────────────────────────┘
                   │ HTTP (Weft ApiPost trigger)
┌──────────────────▼──────────────────────────┐
│              WEFT WORKFLOW                  │
│                                             │
│  1. Read Google Sheet → list of companies   │
│  2. For each company (in parallel):         │
│     ├── Web Search (news, press releases)   │
│     ├── Web Scrape (company website)        │
│     └── Web Search (LinkedIn / blog)        │
│  3. LLM synthesizes → relevance brief       │
│     + holistic score (mission, recent       │
│     activity, audience alignment)           │
│  4. HumanQuery → pause, send to UI queue   │
│  5. Human annotates / approves / requests   │
│     deeper dive                             │
│  6. If deeper dive → re-research loop       │
│     If approved:                            │
│  7. LLM drafts tailored outreach message    │
│  8. HTTP → write back to Google Sheet row   │
└─────────────────────────────────────────────┘
```

---

## Open Questions

> [!IMPORTANT]
> **Google Sheets access**: Does the Weft backend have a way to authenticate with Google Sheets (service account key, OAuth)? Or should the UI pre-fetch the sheet data and pass it to Weft as a raw list? The simpler path for the MVP is for the UI to fetch the sheet via the Google Sheets public CSV export URL, then pass the company list to Weft as JSON. This avoids needing Google OAuth in the Weft backend.

> [!IMPORTANT]
> **HumanQuery ↔ UI integration**: Weft's `HumanQuery` node pauses execution and waits for a response. The UI will need to call the Weft API to resume the workflow once you submit your annotation. Does the Weft API expose a webhook/endpoint for this? We'll need to verify the `weft-api` routes for resuming paused workflows before building the UI polling layer.

> [!IMPORTANT]
> **Event description input**: You mentioned it could be text or a Google Doc. For MVP, the UI will have a text area. Google Doc import can be a follow-up (the UI would just fetch the doc's plain text via the Google Docs export URL).

---

## Proposed Changes

### Component 1: Standalone Web UI

A purpose-built single-page app built in HTML/CSS/JS (vanilla, no framework overhead for this scope).

#### [NEW] `ui/index.html`
Main app shell. Three views:
1. **Setup View** — Google Sheet URL field, event description textarea, "Run" button
2. **Queue View** — live list of companies with status badges (Researching / Needs Review / Approved / Re-researching). Click any "Needs Review" card to open the Review Panel.
3. **Review Panel** — full research brief, relevance score breakdown (mission / recent activity / audience), annotation text box, three action buttons: **Approve**, **Request Deeper Dive** (with a direction field), **Skip**.

Design direction: dark mode, premium feel — deep navy/slate palette, glass-morphism cards, smooth status transitions, subtle animations as research results arrive.

#### [NEW] `ui/style.css`
Full design system: color tokens, typography (Inter from Google Fonts), card components, status pill components, animated progress indicators.

#### [NEW] `ui/app.js`
- Fetches Google Sheet data (via CSV export URL → parse to company list)
- Calls Weft `ApiPost` trigger with company list + event description
- Polls or listens for workflow updates (per company status)
- Handles annotation submission → calls Weft resume endpoint
- Manages local state for the queue

---

### Component 2: Weft Workflow

A single `.weft` file describing the full orchestration graph.

#### [NEW] `weft/sponsorship_researcher.weft`

Key nodes used (all from the existing catalog):
- `ApiPost` — entry point trigger (receives company list + event description as JSON)
- `TavilySearch` — web search for news, press releases, LinkedIn
- `Http` — scrape company website
- `LlmConfig` + `LlmInference` — synthesize research into brief + score
- `HumanQuery` — pause and wait for UI annotation/approval
- `Gate` — route based on approve vs. re-research decision
- `Template` — assemble the outreach draft
- `Http` (second instance) — write back to Google Sheet (via Google Sheets API or a simple webhook)
- `Debug` — log intermediate outputs for visibility in the Weft dashboard

> [!NOTE]
> The Weft compiler will validate all connections and types at save time, so we'll know immediately if anything is wired incorrectly.

---

## Verification Plan

### Manual Verification
1. Open the UI, paste a test Google Sheet URL (with 2-3 companies), enter a short event description, hit Run.
2. Confirm the Weft dashboard shows the workflow executing with parallel branches per company.
3. Confirm the UI queue populates with company cards transitioning from "Researching" → "Needs Review".
4. Click a card, review the research brief and score, submit an annotation and hit Approve.
5. Confirm the workflow resumes, the outreach draft is generated, and the Google Sheet row is updated.
6. Test the "Request Deeper Dive" path — confirm the agent re-researches and re-surfaces the card in the queue.
