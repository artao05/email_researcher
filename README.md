# Sponsorship Relevance Researcher

A two-part system for researching how well a list of potential sponsors aligns with a specific event:

1. **Standalone Web UI** (`sponsorship-ui/`) — paste a Google Sheet URL + event description, trigger research, and review results one-by-one in a live queue
2. **Weft Workflow** (`weft/sponsorship_researcher.weft`) — backend orchestration that runs parallel web research agents per company, synthesizes relevance scores + briefs, pauses for human review, drafts outreach on approval

## How It Works

```
UI: paste Google Sheet URL + event description → Run
       │
       POST /api/v1/webhooks/{trigger_id}  (Weft API)
       │
Weft: for each company (in parallel):
       ├── TavilySearch (news + press)
       ├── TavilySearch (mission / LinkedIn)
       └── Http (scrape company website)
             │
         LlmInference → relevance brief + scores (mission, recent activity, audience, overall)
             │
         HumanQuery ← pauses here, surfaces to UI queue
             │
       [You review, annotate, choose: Approve / Deeper Dive / Skip]
             │
         Gate → approved branch:
                  LlmInference → draft outreach message → Debug output
              → deeper dive branch:
                  TavilySearch (re-research with your direction) → HumanQuery again
```

## Stack

- **Weft** — [weavemind.ai](https://weavemind.ai) — orchestration, durable execution, human-in-the-loop
- **UI** — vanilla HTML/CSS/JS, dark mode, glassmorphism
- **LLM** — via OpenRouter (configurable in `.weft` file)
- **Search** — Tavily API
- **Data source** — Google Sheets (public CSV export, no OAuth needed to read)

## Quick Start

### Prerequisites
- Weft running locally — see [weft repo](https://github.com/WeaveMindAI/weft) for setup
- API keys in `.env`: `OPENROUTER_API_KEY`, `TAVILY_API_KEY`

### Setup

1. **Load the workflow** — open the Weft dashboard (`http://localhost:5174`), paste the contents of `weft/sponsorship_researcher.weft` into a new project
2. **Get your trigger ID** — click the `ApiPost` node in the graph, copy the trigger UUID from the webhook URL
3. **Get an extension token** — Weft dashboard → Settings → Extension Tokens → Create
4. **Prepare your Google Sheet** — two columns: `Company Name` | `Website URL`. Share with "Anyone with the link can view."
5. **Open the UI** — open `sponsorship-ui/index.html` in your browser, enter your trigger ID and extension token (saved to localStorage)

### Running a Research Session

1. Paste your Google Sheet URL and event description into the Setup view
2. Click **Run Research** — the UI fetches the sheet, sends all companies to Weft
3. Watch the Queue view as companies move from `Researching` → `Needs Review`
4. Click **Review →** on any card to open the research brief, scores, and annotation form
5. Choose **Approve** (triggers outreach draft generation), **Deeper Dive** (re-researches with your direction), or **Skip**

## Project Structure

```
email_researcher/
├── weft/
│   └── sponsorship_researcher.weft   # Weft workflow definition
├── sponsorship-ui/
│   ├── index.html                    # App shell (3 views: Setup, Queue, Review)
│   ├── style.css                     # Dark mode design system
│   └── app.js                        # Google Sheets fetch, Weft API calls, polling
└── docs/
    ├── cursor_transfer_plan.md       # Full implementation spec for AI-assisted development
    └── implementation_plan.md        # Architecture decisions and open questions
```

## Weft API Reference

All calls go to `http://localhost:3000` (default Weft API port).

| Action | Endpoint |
|---|---|
| Trigger workflow | `POST /api/v1/webhooks/{trigger_id}` |
| List pending review tasks | `GET /ext/{token}/tasks` |
| Approve / deeper dive | `POST /ext/{token}/tasks/{executionId}/complete` |
| Skip | `POST /ext/{token}/tasks/{executionId}/cancel` |

See `docs/cursor_transfer_plan.md` for full request/response shapes.
