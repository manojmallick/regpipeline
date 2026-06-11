# RegPipeline — Architecture

![RegPipeline architecture](architecture.png)

RegPipeline is a daily **regulatory-monitoring agent** for EU financial entities. It runs as a
single stateless container on Cloud Run, triggered every morning by Cloud Scheduler (and on demand
by the dashboard). Each run is a read-only analysis pass that ends in a **proposal**; nothing
consequential happens until a human approves.

---

## 1. Components

| Layer | What | Where |
|---|---|---|
| **Trigger** | Cloud Scheduler (06:00 UTC) + browser dashboard | `gcloud scheduler` · `public/index.html` |
| **HTTP app** | Express server, static UI, JSON API | `src/server.js` |
| **Agent** | Multi-step orchestration (monitor → score → propose) | `src/agent.js` |
| **Partner (MCP)** | Real Fivetran MCP server, spawned over stdio at runtime | `src/fivetran-mcp.js` |
| **Partner (REST)** | Fivetran REST fallback (when `FIVETRAN_USE_MCP` unset) | `src/fivetran.js` |
| **LLM** | Gemini — Developer API (Gemini 3) or Vertex (`gemini-2.5-flash`) | `src/agent.js` |
| **Warehouse** | BigQuery — the tables Fivetran syncs into | `src/bigquery.js` |
| **Reasoning core** | Deterministic DORA threshold diff + reclassification | `src/diff.js` |
| **Judged agent** | Agent Builder definition (Gemini + Fivetran MCP) | `agent-builder/agent.json` |

## 2. Request flow

### `GET /api/daily-run` — the read-only analysis pass
1. **Monitor** — `listConnectors()` calls the Fivetran MCP tool `fivetran-list-connections`; flags
   delayed/broken connectors and schema changes.
2. **Collect** — `getNewDocuments(24h)` queries `regulatory.{eurlex,eba,esma,dnb,fifa}` in BigQuery
   on the `_fivetran_synced` column.
3. **Score** — Gemini scores each document HIGH/MEDIUM/LOW as strict JSON (affected DORA/NIS2/GDPR
   articles, action, deadline, `threshold_change`).
4. **Diff** — if any document changes a DORA threshold, `diff.js` re-runs **every historical
   incident** against the new thresholds and returns which ones flip to MAJOR.
5. **Propose** — assembles `proposedAction` (resync, send digest, save tasks) and returns it. **No
   writes.** Each external step is independently error-guarded, so one outage degrades the run
   instead of failing it.

### `POST /api/execute` — the gated write path
Returns **403** unless `{ approved: true }`. On approval: Fivetran `modify_connection_state`
(resume/resync the delayed connector), "send digest", and a BigQuery **audit-log** insert.

## 3. Two-agent design
- **PipelineMonitor** — connector health + schema-change detection + new-document retrieval.
- **RegulatoryAnalyst** — Gemini impact scoring, retroactive re-classification, and the proposal.

Both are surfaced in `agent-builder/agent.json` (the judged agent), and mirrored by the Express app
so the hosted UI and the Cloud Scheduler trigger exercise the **same** MCP server at runtime.

## 4. Why the partner MCP is real (not named)
`src/fivetran-mcp.js` spawns `@getnao/fivetran-mcp-server` over stdio via the official MCP SDK,
discovers tools from `tools/list`, and calls them. `/health` reports `partner_mcp_connected: true`
**only after a genuine handshake**, and `npm run mcp:selftest` proves the full tool-call path
(client → MCP server → tool → Fivetran API). This is the single biggest disqualifier in the
hackathon — required tech must be *invoked at runtime* — and it is.

## 5. Determinism where it matters
The headline feature (retroactive re-classification) is **not** an LLM guess. `src/diff.js` is a
pure function: `classify(incident, thresholds)` → MAJOR/MINOR, diffed across threshold versions and
re-run over history. It is eval-tested 7/7 (`evals/report.json`), including boundary cases
(`8% exactly → not >8% → stays MINOR`). Gemini supplies judgement; the math stays defensible.

## 6. Trust & safety
- **Human-in-the-loop:** every consequential action is gated behind `POST /api/execute` (403 without
  approval); `agent-builder/agent.json` marks `requireApprovalFor: [fivetran-modify-connection-state]`.
- **Audit:** every executed action writes a BigQuery `audit_log` row (`actor: "human"`).
- **No competing AI/cloud:** only Google (Gemini, BigQuery, Cloud Run) + the Fivetran partner.
- **Secrets:** Fivetran creds come from env / `.env` (gitignored), never committed.

## 7. Deployment
```
Cloud Run (us-central1)  ── container from Dockerfile (npm ci, node:20-slim)
  env: FIVETRAN_USE_MCP=true · GEMINI_MODEL · GOOGLE_CLOUD_PROJECT/LOCATION · BQ_DATASET
Cloud Scheduler          ── daily GET /api/daily-run
BigQuery                 ── dataset `regulatory` (US)
```
Verify live: `BASE=<url> npm run smoke` → 10/10 (`evals/live-proof.json`).

## 8. File map
```
src/server.js        HTTP + routes + /health (truthful stack report)
src/agent.js         the agent loop (Gemini client: Dev API or Vertex)
src/fivetran-mcp.js  real Fivetran MCP client (stdio)   ← partner superpower, runtime
src/fivetran.js      REST fallback + transport selector
src/bigquery.js      warehouse reads + obligation/audit writes
src/diff.js          deterministic DORA reclassification (eval 7/7)
agent-builder/agent.json   judged Agent Builder definition
public/               dashboard UI + Judge Tour
scripts/             eval.js · smoke-live.mjs · mcp-selftest.mjs
```
