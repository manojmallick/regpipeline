# RegPipeline — Demo Runbook & Pitch

> Goal: in 3 minutes, prove this is **an agent that takes gated action**, not a chatbot —
> and land the differentiator (Gemini 3 retroactive re-classification).

![RegPipeline demo](docs/demo.gif)

---

## ⏱️ 3-minute demo script

**Setup (before you screen-share):**
```bash
npm install
npm run demo        # MOCK=true → http://localhost:8080
```

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | **Health** | Land on the dashboard | "RegPipeline watches 5 regulatory sources through **Fivetran**, synced into **BigQuery**. This is the morning health view." |
| 0:20 | **Health** | Point at the **DNB** connector (amber) + **Schema Change Detected** alert | "It caught a schema change — a new `enforcement_priority` column — and traced the **downstream impact**: one query BROKEN, one view STALE. That's data-ops awareness, automatically." |
| 0:45 | **Health** | Click **Run Now** | "Now the agent runs its pass — connector health, new docs, and **Gemini 3** scores each document's compliance impact." |
| 1:00 | **Approval bar** | Point at the bottom bar | "Here's the key: it does **not** act on its own. It proposes — resync DNB, send the digest, save tasks — and waits for a human." |
| 1:10 | **Approval bar** | Click **Approve & Run** | "I approve. Now it triggers the Fivetran resync and records an audit entry. Human-in-the-loop, by design." |
| 1:30 | **Impact** | Click **Impact** | "This is the payoff. A delegated act tightened the DORA major-incident threshold — **10% → 8%**, **2.0h → 1.5h**." |
| 1:50 | **Impact** | Point at the analysis line | "Gemini 3 doesn't just summarize — it **retroactively re-classifies history**: 3 past incidents would now be MAJOR. Projected compliance score drops **89 → 87**, with the exact affected entities." |
| 2:20 | **History** | Click **History** | "Full sync telemetry per connector — availability matrix, cadence, volume, execution logs with the schema-change captured inline." |
| 2:40 | — | — | "Gemini 3 + Agent Builder + Fivetran MCP. Zero manual monitoring hours; new regulations surfaced in ~6h instead of days — **and a human always approves the consequential step.**" |

**Money shot:** the Impact view. Lead the judges there.

---

## 📈 Impact, quantified

Assumptions (state them — they're conservative and defensible):

- A mid-size EU financial entity tracks ~5 regulatory sources; a compliance analyst spends
  **~1.5 h/day** manually scanning bulletins + triaging relevance (`[assumption]`).
- RegPipeline reduces that to a **~10 min** review of a pre-scored digest.

| Metric | Manual | With RegPipeline |
|---|---|---|
| Daily monitoring | 1.5 h | ~0.17 h |
| **Annual (250 working days)** | **~375 h** | **~42 h** |
| **Saved** | — | **~333 compliance-analyst-hours / yr / entity** |
| Time-to-surface a new regulation | 1–3 days | **~6 h** |

At a blended compliance-analyst cost of ~€70/h `[assumption]`, that's **~€23k/yr/entity** in
recovered capacity — before counting **avoided fines** from a missed threshold change (DORA
penalties run to the millions). The retroactive re-classification is the insurance policy:
when a threshold moves, you instantly know *which past incidents you mis-reported*.

> Numbers above are illustrative planning figures with stated assumptions, not measured
> results — calibrate to the target entity before quoting externally.

---

## ✅ P0 — Prove the live stack (retires the `[TESTED: NO]` flag)

The strongest single credibility lift. With real GCP + Fivetran credentials:

```bash
cp .env.example .env          # fill GOOGLE_CLOUD_PROJECT, FIVETRAN_API_KEY/SECRET, BQ_DATASET
gcloud auth application-default login
gcloud config set project "$GOOGLE_CLOUD_PROJECT"
npm run dev                   # LIVE mode (no MOCK) → http://localhost:8080

# in a second terminal — automated proof:
npm run smoke                 # → evals/live-proof.json + PASS/FAIL summary
```

Screenshot **two things** for the submission:
1. The `npm run smoke` terminal output (all ✅, real `partner_mcp_connected` / `bigquery_connected`).
2. The **Health** view after clicking **Run Now** against live data.

Against Cloud Run instead of localhost:
```bash
BASE=https://<your-cloud-run-url> npm run smoke
```

---

## 🎥 P1 — 20-second Loom (optional but converts)

`docs/demo.gif` (above) is auto-generated from the real app and already covers the flow.
For a narrated version, screen-record the 3-minute script above and trim to the
Health → Run Now → Approve → Impact beats (~20s). Embed the Loom link here and in `README.md`.
