# Setup — file locations (Part 5)

Everything lives here:

```
/Users/arthurtao/Documents/Projects/sponsorship_researcher/
```

## Part 5: load the workflow in Weft

**File to copy into Weft dashboard:**

```
/Users/arthurtao/Documents/Projects/sponsorship_researcher/sponsorship_researcher.weft
```

Also at: `weft/sponsorship_researcher.weft` (same file)

**Steps:**

1. Open **Weft dashboard**: http://localhost:5173 or http://localhost:5174
2. **New project**
3. Open `sponsorship_researcher.weft` in Finder or Cursor → Select all → Copy
4. Paste into Weft code editor → **Save**
5. Click **Run** / deploy the project

## Other key files

| What | Path |
|------|------|
| Browser UI | `/Users/arthurtao/Projects/sponsorship_researcher/sponsorship-ui/index.html` |
| API keys | `/Users/arthurtao/Projects/sponsorship_researcher/.env` |
| CHIMES email template | `sponsorship-ui/templates/chimes.js` |
| Start Weft | `bash scripts/start-weft-server-only.sh` |
| Open UI | `bash scripts/open-ui.sh` |

## Open in Finder

```bash
open /Users/arthurtao/Projects/sponsorship_researcher
open /Users/arthurtao/Projects/sponsorship_researcher/sponsorship_researcher.weft
```
