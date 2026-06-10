# RegPipeline — 3-Minute Demo Script (word-for-word)

**Record against the live URL:** https://regpipeline-908307939543.us-central1.run.app
**Tip:** click **Judge Tour** (top-right) and let it drive the navigation while you read — each tour step maps to a beat below. ~430 words ≈ 2:55 at a calm pace. Set screen recording to 1080p, hide bookmarks bar.

---

### 0:00 — Open on the Health view
> "This is **RegPipeline** — an autonomous compliance analyst for EU financial firms. Every morning it watches five regulatory sources — EUR-Lex, the EBA, ESMA, DNB and FIFA — that **Fivetran** syncs into **BigQuery**. What you're seeing is live: this app is calling Fivetran, BigQuery and Gemini right now."

### 0:22 — Point at the delayed connector + schema alert
> "Straight away it's caught two problems. The **DNB connector is delayed**, and it detected a **schema change** — a new `enforcement_priority` column — and traced the blast radius: one downstream query broken, one view stale. That's data-ops awareness you'd normally pay an engineer to notice."

### 0:42 — Click "Run Now" (Tour step 3 → "Run ▶")
> "Now I run the agent. It checks every connector's health through the **Fivetran MCP server**, pulls the documents synced in the last 24 hours from BigQuery, and **Gemini** scores each one's compliance impact — High, Medium or Low — naming the exact DORA articles affected."

### 1:05 — The approval bar slides up
> "Here's the part that matters for regulated industries. The agent does **not** act on its own. It *proposes* — resync the connector, send the digest, save the remediation tasks — and then it **waits for a human**. I'll approve it."  *(click Approve & Run)*  "Now it triggers the resync and writes an audit record. Human-in-the-loop, by design."

### 1:30 — Switch to the Impact view (the money shot)
> "And this is the payoff. A new delegated act just **tightened the DORA major-incident threshold** — client impact from 10 percent down to 8, and the time window from two hours to one-and-a-half. Most tools would just say 'something changed.' RegPipeline does something far more useful."

### 1:55 — Point at the analysis + reclassified count
> "**Gemini retroactively re-classifies history.** It re-runs every past incident against the new thresholds and shows you exactly which ones — three of them here — would *now* count as MAJOR and were therefore mis-reported. That's the difference between a newsletter and an insurance policy against a regulatory fine."

### 2:20 — Switch to the History view
> "Everything is auditable — per-connector sync telemetry: the availability matrix, cadence, volume, and execution logs with that schema change captured inline."

### 2:38 — Close (back on Health, or full-screen the stack)
> "Under the hood: **Gemini, Google Cloud Agent Builder, and the real Fivetran MCP server**, with BigQuery as the warehouse and Cloud Run on a daily schedule. Zero manual monitoring hours, new regulations surfaced in about six hours instead of days — and a human always approves the consequential step. That's RegPipeline."

---
**After recording:** upload to YouTube/Vimeo set to **Public**, then paste the link into the Devpost submission and the top of `README.md`.
