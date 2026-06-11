# RegPipeline — Pitch Deck

> Source for `DECK.pdf` (rendered landscape). Google Cloud Rapid Agent Hackathon — Fivetran track.

---

## 1 · RegPipeline
**An autonomous compliance analyst for EU finance.**
Gemini + Google Cloud Agent Builder + the real Fivetran MCP server + BigQuery.
🔴 Live: regpipeline-908307939543.us-central1.run.app

---

## 2 · The problem
- EU financial firms drown in DORA, NIS2, GDPR, EU AI Act.
- A compliance analyst spends **~1.5 h/day** scanning regulatory bulletins.
- The dangerous moment is a **threshold change** — a delegated act quietly redefines a "major incident."
- Miss it, and **last quarter's filings are now wrong.** Fines run to the millions.

---

## 3 · The solution
Every morning, RegPipeline:
1. Checks Fivetran connector health (delayed / schema changes) — **via the Fivetran MCP**.
2. Reads newly-synced regulatory docs from **BigQuery**.
3. Scores each one's compliance impact with **Gemini** (article + action + deadline).
4. **Retroactively re-classifies** your incident history when a threshold moves.
5. Proposes the fix — and **waits for a human to approve.**

---

## 4 · The differentiator
**It doesn't summarize the news — it tells you which of your past filings just became wrong.**
When DORA tightens 10%→8% / 2.0h→1.5h, a deterministic, **eval-tested (7/7)** engine re-runs every
historical incident and returns the exact list that now counts as MAJOR.
→ The difference between a newsletter and an insurance policy against a fine.

---

## 5 · Trust by design
- **Human-in-the-loop:** nothing consequential runs without `POST /api/execute` approval (403 otherwise).
- **Auditable:** every action writes a BigQuery audit log.
- **Deterministic core + Gemini judgement:** the math is defensible; the LLM does the reading.

---

## 6 · Required tech — invoked at runtime
- **Gemini** — `@google/genai`, scores impact as strict JSON (`src/agent.js`).
- **Agent Builder** — judged agent in `agent-builder/agent.json` (Gemini + Fivetran MCP, gated).
- **Fivetran MCP** — the **real** `@getnao/fivetran-mcp-server`, spawned & called at runtime
  (`src/fivetran-mcp.js`). Proof: `npm run mcp:selftest`.
- **No competing AI/cloud.** Google + Fivetran only.

---

## 7 · Proof it's real
- ✅ Live hosted URL with real data — `npm run smoke` → **10/10** (`evals/live-proof.json`).
- ✅ `/health`: `partner_mcp_connected:true` only after a genuine MCP handshake.
- ✅ Deterministic reclassification eval — **7/7** including boundary cases.
- ✅ Public, MIT, container builds & boots (verified in Linux image).

---

## 8 · Impact
- ~1.5 h/day → ~10 min review → **~333 analyst-hours saved / yr / entity** (~€23k recovered capacity).
- New regulations surfaced in **~6 h instead of days**.
- The reclassification is the real prize: instant proof of *which incidents you mis-reported*.

---

## 9 · What's next · Try it
- Push changed articles downstream to a RAG re-embed; full NIS2/GDPR/EU-AI-Act obligation ledger; more live connectors.
- **Try it:** open the live URL → click **Judge Tour** (60-sec walkthrough).
- Code (MIT): github.com/manojmallick/regpipeline
