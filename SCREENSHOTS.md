# Devpost Gallery — Plan & Guide

The Devpost gallery is the **first thing judges see** — order it as a story, lead with the strongest
frame, and caption every image (judges skim captions). Three high-res shots are already captured in
[`screenshots/`](screenshots/) straight from the **live** app; add 1–2 more by hand for the win.

## ✅ Already captured (live, 2960×1840)

| Order | File | Caption to paste in Devpost |
|---|---|---|
| 1 | `screenshots/02-impact.png` | **The payoff:** Gemini re-classifies history when DORA tightens 10%→8% / 2.0h→1.5h — 3 past incidents would now be MAJOR. |
| 2 | `screenshots/01-health.png` | **Morning health:** 5 Fivetran sources → BigQuery, a Gemini-scored daily digest, a live schema-change alert, and the human-approval bar. |
| 3 | `screenshots/03-history.png` | **Audit trail:** per-connector sync telemetry — availability matrix, cadence, volume, execution logs. |

> Lead with **Impact** (#1) — it's the differentiator. Health is the "what is this," History is the "it's real/auditable."

## 📸 Add these by hand (2 minutes, big payoff)

Take these as real screenshots (they need interaction headless can't do):

4. **Judge Tour spotlight** — open the live URL, click **Judge Tour**, advance to step 4 (the
   approval gate). Screenshot the dimmed spotlight + the stepper card.
   *Caption:* "Built-in Judge Tour — a 60-second guided walkthrough for reviewers."
5. **Approval executed** — click **Approve & Run**, screenshot the green toast
   ("Executed: resync… · tasks saved").
   *Caption:* "Human-in-the-loop: nothing consequential runs without approval; every action is audited."
6. *(optional)* **`/health` JSON** — open `…/health` in the browser.
   *Caption:* "Proof the stack is real — `partner_mcp_connected:true` only after a genuine MCP handshake."

### How to take a clean manual shot
- Browser at **1440×900**, zoom 100%, hide the bookmarks bar (⌘⇧B), use an incognito window (no extensions in frame).
- macOS region capture: **⌘⇧4** then drag; or full window **⌘⇧4 → Space → click window**.
- Save into `screenshots/` as `04-tour.png`, `05-approved.png`.

### Re-capture the automated three (if you change the UI)
```bash
U=https://regpipeline-908307939543.us-central1.run.app
curl -s -o /dev/null "$U/api/daily-run"   # warm the instance first
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for v in health:01-health impact:02-impact history:03-history; do
  hash="#${v%%:*}"; out="screenshots/${v##*:}.png"
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=1480,920 --virtual-time-budget=22000 --screenshot="$PWD/$out" "$U/$hash"
done
```

## Devpost upload checklist
- [ ] Gallery order: Impact → Health → History → Tour → Approved
- [ ] Every image has a caption (above)
- [ ] First image is the **Impact** shot (the thumbnail judges see)
- [ ] Also embed `architecture.png` in the written description
- [ ] Add the YouTube/Vimeo demo video as the gallery's first media slot (video out-ranks stills)
