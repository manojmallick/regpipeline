# RegPipeline — Devpost Submission Copy

> Paste these sections into the Devpost form. Judge-skimmable: each section leads with the point.

**Elevator pitch (one line):**
An autonomous compliance analyst that uses Gemini, Google Cloud Agent Builder, and the real Fivetran MCP server to monitor EU regulatory sources every morning, score each change's impact, and — with a human's approval — fix the pipeline and re-classify your incident history before a regulator does.

**Try it now (judges):**
- 🔴 Live app: https://regpipeline-908307939543.us-central1.run.app — click **Judge Tour** (top-right) for a 60-second guided walkthrough.
- 💻 Code (public, MIT): https://github.com/manojmallick/regpipeline
- ✅ Live-stack proof: `npm run smoke` → 10/10 (`evals/live-proof.json`)

---

## Inspiration
EU financial firms are buried under DORA, NIS2, GDPR and the EU AI Act. A compliance analyst spends ~1.5 hours **every day** scanning regulatory bulletins, and the truly dangerous moment is a **threshold change** — when a delegated act quietly redefines what counts as a "major incident." Miss it, and every incident you reported last quarter may now be mis-classified. Fines run to the millions. We wanted an agent that doesn't just summarize the news, but tells you *exactly which of your past filings just became wrong.*

## What it does
Every morning RegPipeline:
1. **Monitors** Fivetran connector health (delayed/broken connectors, schema changes) via the **Fivetran MCP server**.
2. **Reads** the regulatory documents synced in the last 24h from **BigQuery**.
3. **Scores** each document's compliance impact (HIGH/MEDIUM/LOW) with **Gemini**, naming the affected DORA/NIS2/GDPR articles and the action + deadline.
4. **Retroactively re-classifies history** — when a DORA threshold moves (e.g. 10%→8%, 2.0h→1.5h), it re-runs every past incident and shows which ones would *now* be MAJOR.
5. **Proposes** the fix (resync the connector, send the digest, save remediation tasks) and **waits for human approval** before any consequential action.

## How we built it — required tech, invoked at runtime
- **Gemini** — `@google/genai`, called in `src/agent.js` to score impact and draft the digest as strict JSON. Runs **real Gemini 3** via the Developer API when a key is present, else Vertex `gemini-2.5-flash`.
- **Google Cloud Agent Builder** — the judged agent is defined in `agent-builder/agent.json` (Gemini 3 + the Fivetran MCP tool, with `trigger`/state changes gated on human approval).
- **Fivetran MCP** — the **real** `@getnao/fivetran-mcp-server`, spawned and called over stdio at runtime in `src/fivetran-mcp.js` (`FIVETRAN_USE_MCP=true`). Proof: `npm run mcp:selftest`. This is the partner superpower genuinely invoked, not just named.
- **BigQuery** — the warehouse Fivetran syncs into; queried live in `src/bigquery.js`.
- **Cloud Run + Cloud Scheduler** — hosting + the daily 06:00 UTC trigger.

## Architecture
```
                          ┌──────────────────────────────────────────────┐
   Cloud Scheduler  ──────▶  Cloud Run: RegPipeline (Express, src/)        │
   (daily 06:00 UTC)       │                                              │
   Judge's browser   ──────▶  GET /api/daily-run                          │
   (public/index.html)     │     │                                        │
                           │     1. connector health ──▶ Fivetran MCP ──▶ Fivetran API
                           │     2. new documents ──────▶ BigQuery (regulatory.*)
                           │     3. impact scoring ─────▶ Gemini (Vertex / Dev API)
                           │     4. threshold diff ─────▶ deterministic reclassify (eval 7/7)
                           │     5. PROPOSE  ──────────┐  (gated)                          │
   ApprovalBar (human) ────▶  POST /api/execute ──────┴▶ fivetran.modify_connection_state │
                           │                              + send digest + BigQuery audit   │
                           └──────────────────────────────────────────────┘
```

## The differentiator
Most hackathon agents are "LLM-summarizes-a-feed." Our **retroactive re-classification** is a deterministic, **eval-tested** engine (`src/diff.js`, 7/7 in `evals/report.json`, including boundary cases). When a threshold moves, it produces an exact, defensible list of incidents that flipped — the difference between a newsletter and an insurance policy.

## Challenges we ran into
- **Gemini JSON truncation** — `gemini-2.5-flash` "thinking" tokens were consuming the output budget and truncating the digest JSON. Fixed by disabling thinking (`thinkingBudget: 0`), raising `maxOutputTokens`, and adding a tolerant parser.
- **Vertex on Cloud Run** — `@google/genai` needs `GOOGLE_CLOUD_PROJECT` explicitly (BigQuery auto-detects it; Gemini doesn't), which surfaced as `projects/undefined`.
- **The real Fivetran MCP** — wiring the actual `@getnao/fivetran-mcp-server` over stdio and discovering its real tool names from `tools/list` rather than guessing.

## Accomplishments we're proud of
A genuinely **live** app where all three required technologies are provably invoked at runtime (smoke 10/10), a **human-in-the-loop approval gate** on every consequential action, a deterministic eval-tested core, and a built-in **Judge Tour** so reviewers can experience the whole flow in 60 seconds.

## What we learned
How to make an LLM agent *trustworthy* in a regulated context — deterministic math for the parts that must be defensible, Gemini for judgment, and a hard human gate on anything that touches production.

## What's next
Push changed articles downstream to re-embed in a RAG search index; expand beyond DORA to a full NIS2/GDPR/EU-AI-Act obligation ledger; and connect more live Fivetran connectors.
