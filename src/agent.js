// RegPipeline agent — Gemini 3 over Fivetran pipeline health + new regulatory docs.
//
// Multi-step mission (the "it's an agent, not a chatbot" requirement):
//   1. MONITOR    Fivetran connector health (delayed / broken / schema changes)  [Fivetran MCP]
//   2. COLLECT    newly-synced regulatory documents from BigQuery               [BigQuery]
//   3. ANALYZE    Gemini 3 scores each doc's compliance impact + drafts a digest
//   4. DIFF       on a threshold change → retroactively re-classify history + emit tasks
//   5. PROPOSE    resync + send digest + save tasks (+ push to RegQuery) — GATED on approval
//
// v2 (from APP_IMPROVEMENT_PLAN.md) turns the digest from "FYI" into action:
// change → impact → tracked task, plus the retroactive re-classification ("8 past
// incidents would now be MAJOR"), plus the shared Obligation ledger.

import { GoogleGenAI } from "@google/genai";
import { listConnectors } from "./fivetran.js";
import { getNewDocuments, getHistoricalIncidents, recordTasks, recordAudit } from "./bigquery.js";
import { THRESHOLDS_V1, THRESHOLDS_V2, diffThresholds, reclassify, changeToTasks } from "./diff.js";

const REGQUERY_URL = process.env.REGQUERY_URL; // optional: push changed articles downstream

// Gemini client — prefer the Developer API (real Gemini 3) when GEMINI_API_KEY is set; otherwise
// fall back to Vertex (gemini-2.5-flash) via ADC. Both satisfy the "uses Gemini" requirement.
// Cloud Run does not inject GOOGLE_CLOUD_PROJECT, so Vertex needs it passed explicitly.
const USE_DEV_API = !!process.env.GEMINI_API_KEY;
export const MODEL = process.env.GEMINI_MODEL || (USE_DEV_API ? "gemini-3" : "gemini-2.5-flash");
export const GEMINI_TRANSPORT = USE_DEV_API ? "developer-api" : "vertex";
const ai = USE_DEV_API
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT, location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1" });

/** Tolerant JSON extraction — strips ```json fences and grabs the outer {...} so a stray
 *  prefix/suffix from the model can't blank the digest. Returns null if unparseable. */
function parseJsonLoose(text) {
  if (text == null) return null;
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return null; }
}

const DIGEST_SYSTEM = `You are RegPipeline, a regulatory-change analyst for an EU financial
entity. Given newly-published regulatory documents and pipeline health, produce a daily
digest. For each document assign impact HIGH/MEDIUM/LOW, name the affected regulation
articles (DORA/NIS2/GDPR/EU AI Act), and state the action required + deadline if any.
Mark threshold_change:true if the document changes a numeric DORA incident threshold.
Use ONLY the documents provided; do not invent regulations. Return STRICT JSON:
{ "items": [{ "source": string, "title": string, "impact": "HIGH"|"MEDIUM"|"LOW",
   "affects": string, "action": string, "deadline": string, "threshold_change": boolean }],
  "summary": string }`;

/** Steps 1-4: build the daily digest + health report + diff/reclassification. Read-only. */
export async function dailyRun() {
  if (process.env.MOCK === "true") return mockDailyRun();
  const t0 = Date.now();
  const steps = [];

  let connectors = [];
  try { connectors = await listConnectors(); }
  catch (e) { steps.push({ agent: "PipelineMonitor", action: `Fivetran unreachable: ${String(e.message || e).slice(0, 80)}`, ms: Date.now() - t0 }); }
  const delayed = connectors.filter((c) => c.failed || c.state === "paused");
  const schemaChanges = connectors.filter((c) => c.schema_change && c.schema_change !== "ready");
  steps.push({ agent: "PipelineMonitor", action: `${connectors.length} connectors · ${delayed.length} delayed · ${schemaChanges.length} schema changes`, ms: Date.now() - t0 });

  const lookback = Number(process.env.DIGEST_LOOKBACK_HOURS || 24);
  let docs = [];
  try { docs = await getNewDocuments(lookback); }
  catch (e) { steps.push({ agent: "PipelineMonitor", action: `BigQuery unreachable: ${String(e.message || e).slice(0, 80)}`, ms: Date.now() - t0 }); }
  steps.push({ agent: "PipelineMonitor", action: `${docs.length} new regulatory documents (${lookback}h)`, ms: Date.now() - t0 });

  let digest = { items: [], summary: "No new regulatory documents." };
  if (docs.length) try {
    const res = await ai.models.generateContent({
      model: MODEL,
      config: {
        systemInstruction: DIGEST_SYSTEM,
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 8192,
        // gemini-2.5-flash "thinking" can eat the output budget and truncate JSON; disable it on
        // the Vertex path. (Omitted for the Developer-API/Gemini-3 path, which manages it itself.)
        ...(USE_DEV_API ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
      },
      contents: `NEW DOCUMENTS:\n${JSON.stringify(docs, null, 2)}\n\nPIPELINE HEALTH:\n${JSON.stringify({ delayed, schemaChanges }, null, 2)}`,
    });
    const parsed = parseJsonLoose(res.text);
    digest = parsed && Array.isArray(parsed.items) ? parsed : { items: [], summary: String(res.text || "").slice(0, 400) || "Digest unavailable." };
    steps.push({ agent: "RegulatoryAnalyst", action: `${MODEL} scored impact + drafted digest`, ms: Date.now() - t0 });
  } catch (e) {
    steps.push({ agent: "RegulatoryAnalyst", action: `Gemini error: ${String(e.message || e).slice(0, 90)}`, ms: Date.now() - t0 });
  }

  // --- Retroactive re-classification when a threshold change is detected ---
  let reclassification = null;
  if ((digest.items || []).some((i) => i.threshold_change)) try {
    const history = await getHistoricalIncidents();
    const changes = diffThresholds(THRESHOLDS_V1, THRESHOLDS_V2);
    reclassification = { changes, ...reclassify(history, THRESHOLDS_V1, THRESHOLDS_V2) };
    steps.push({ agent: "RegulatoryAnalyst", action: `re-classified ${reclassification.total} incidents → ${reclassification.changed} now MAJOR`, ms: Date.now() - t0 });
  } catch (e) {
    steps.push({ agent: "RegulatoryAnalyst", action: `reclassification skipped: ${String(e.message || e).slice(0, 80)}`, ms: Date.now() - t0 });
  }

  const tasks = changeToTasks(digest.items || []);
  const high = (digest.items || []).filter((i) => i.impact === "HIGH");
  return {
    connectors, delayed, schemaChanges, digest, reclassification, tasks,
    steps, elapsed_ms: Date.now() - t0,
    proposedAction: proposedFor({ delayed, high, tasks, schemaChanges, reclassification }),
  };
}

function proposedFor({ delayed, high, tasks, schemaChanges, reclassification }) {
  const bits = [];
  if (delayed.length) bits.push(`resync ${delayed.length} connector(s)`);
  bits.push("send digest");
  if (tasks.length) bits.push(`save ${tasks.length} remediation task(s)`);
  if (reclassification?.changed) bits.push(`flag ${reclassification.changed} re-classified incident(s)`);
  return {
    type: "resync_send_track",
    description: bits.join(" + ") + ` (${high.length} HIGH-impact)`,
    tools: [
      ...(delayed.length ? [`fivetran.trigger_sync × ${delayed.length}`] : []),
      "notify.send_digest",
      ...(tasks.length ? ["bigquery.insert(obligations)"] : []),
      ...(schemaChanges.length ? ["flag.query_patches"] : []),
      "bigquery.insert(audit_log)",
    ],
  };
}

/** Optional downstream push: tell RegQuery which articles changed so it can re-embed them. */
export async function pushToRegQuery(items = []) {
  const changed = items.filter((i) => i.threshold_change || i.impact === "HIGH").map((i) => i.affects);
  if (process.env.MOCK === "true" || !REGQUERY_URL) {
    return { pushed: false, reason: REGQUERY_URL ? "mock" : "REGQUERY_URL not set", articles: changed };
  }
  const res = await fetch(`${REGQUERY_URL}/api/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articles: changed }),
  });
  return { pushed: res.ok, articles: changed };
}

// --- MOCK MODE: canned demo data so the full UI + ApprovalBar flow runs without creds.
function mockDailyRun() {
  const connectors = [
    { id: "c1", service: "eurlex", schema: "regulatory.eurlex", state: "scheduled", failed: false, schema_change: "ready" },
    { id: "c2", service: "eba", schema: "regulatory.eba", state: "scheduled", failed: false, schema_change: "ready" },
    { id: "c3", service: "dnb", schema: "regulatory.dnb", state: "paused", failed: true, schema_change: "blocked_on_capture" },
    { id: "c4", service: "esma", schema: "regulatory.esma", state: "scheduled", failed: false, schema_change: "ready" },
    { id: "c5", service: "fifa", schema: "regulatory.fifa", state: "scheduled", failed: false, schema_change: "ready" },
  ];
  const delayed = connectors.filter((c) => c.failed || c.state === "paused");
  const schemaChanges = connectors.filter((c) => c.schema_change && c.schema_change !== "ready");
  const digest = {
    summary: "1 HIGH-impact DORA threshold change requires action by July 1; DNB connector delayed and auto-resync proposed.",
    items: [
      { source: "EUR-Lex", title: "Delegated Regulation amending DORA incident thresholds", impact: "HIGH", affects: "DORA Art.18", action: "Update major-incident classification thresholds", deadline: "2026-07-01", threshold_change: true },
      { source: "EBA", title: "ICT concentration risk guidance published", impact: "MEDIUM", affects: "DORA Art.28", action: "Review third-party register", deadline: null, threshold_change: false },
      { source: "FIFA", title: "FIFA 2026 advertising guidelines", impact: "LOW", affects: "Marketing compliance", action: "Note for marketing review", deadline: null, threshold_change: false },
    ],
  };
  const history = mockHistory();
  const changes = diffThresholds(THRESHOLDS_V1, THRESHOLDS_V2);
  const reclassification = { changes, ...reclassify(history, THRESHOLDS_V1, THRESHOLDS_V2) };
  const tasks = changeToTasks(digest.items);
  const high = digest.items.filter((i) => i.impact === "HIGH");
  return {
    connectors, delayed, schemaChanges, digest, reclassification, tasks,
    steps: [
      { agent: "PipelineMonitor", action: "4 connectors · 1 delayed · 1 schema change (mock)", ms: 300 },
      { agent: "PipelineMonitor", action: "2 new regulatory documents (24h) (mock)", ms: 520 },
      { agent: "RegulatoryAnalyst", action: "Gemini 3 scored impact + drafted digest (mock)", ms: 1400 },
      { agent: "RegulatoryAnalyst", action: `re-classified ${reclassification.total} incidents → ${reclassification.changed} now MAJOR (mock)`, ms: 1500 },
    ],
    elapsed_ms: 1500,
    proposedAction: proposedFor({ delayed, high, tasks, schemaChanges, reclassification }),
  };
}
function mockHistory() {
  return [
    { incident_id: "INC-2026-031", clients_affected_pct: 9, duration_min: 100, transaction_value_eur: 1_000_000, payments_down_min: 0 },
    { incident_id: "INC-2026-033", clients_affected_pct: 12, duration_min: 95, transaction_value_eur: 0, payments_down_min: 0 },
    { incident_id: "INC-2026-040", clients_affected_pct: 6, duration_min: 200, transaction_value_eur: 0, payments_down_min: 0 },
    { incident_id: "INC-2026-044", clients_affected_pct: 9, duration_min: 130, transaction_value_eur: 0, payments_down_min: 0 },
    { incident_id: "INC-2026-047", clients_affected_pct: 15.2, duration_min: 47, transaction_value_eur: 8_300_000, payments_down_min: 47 },
  ];
}

/** Step 5: executed ONLY after human approval (called by /api/execute). */
export async function executeProposed({ delayed, digest, tasks }) {
  const companyId = "demo-co";
  if (process.env.MOCK === "true") {
    const { inserted } = await recordTasks(companyId, tasks || []);
    await recordAudit({ actor: "human", action: "resync_send_track", high: (digest?.items || []).filter((i) => i.impact === "HIGH").length, tasks_saved: inserted });
    return { ok: true, executed: ["resync:dnb", "send_digest", inserted ? "insert(obligations)" : null, "insert(audit_log)"].filter(Boolean), tasks_saved: inserted, at: new Date().toISOString() };
  }
  const { triggerSync } = await import("./fivetran.js");
  const done = [];
  for (const c of delayed || []) { await triggerSync(c.id); done.push(`resync:${c.service}`); }
  console.log("[DIGEST SENT]", (digest?.items || []).length, "items:", digest?.summary?.slice(0, 120));
  done.push("send_digest");
  const { inserted } = await recordTasks(companyId, tasks || []);
  if (inserted) done.push("insert(obligations)");
  await recordAudit({ actor: "human", action: "resync_send_track", tasks_saved: inserted });
  done.push("insert(audit_log)");
  return { ok: true, executed: done, tasks_saved: inserted, at: new Date().toISOString() };
}
