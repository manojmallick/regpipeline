// RegPipeline hosted backend — Express. Daily run + approval-gated resync/digest.
// Designed to be triggered by Cloud Scheduler at 06:00 UTC (08:00 CET) — see README.

import express from "express";
import { dailyRun, executeProposed } from "./agent.js";
import { pingFivetran, fivetranTransport } from "./fivetran.js";
import { pingBigQuery, getHistoricalIncidents, listTasks } from "./bigquery.js";
import { THRESHOLDS_V1, THRESHOLDS_V2, diffThresholds, reclassify } from "./diff.js";
import { getSyncHistory } from "./synchistory.js";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

// --- Health: proves the required stack is wired ---
app.get("/health", async (_req, res) => {
  const transport = fivetranTransport();          // "mock" | "mcp" | "rest"
  const partnerOk = await pingFivetran();
  res.json({
    status: "ok",
    service: "regpipeline",
    version: "2.0.0",
    mode: process.env.MOCK === "true" ? "demo" : "live",
    model: process.env.GEMINI_MODEL || "gemini-3",
    partner: "fivetran",
    partner_transport: transport,                  // how Fivetran is reached this run
    partner_connected: partnerOk,                  // reachable on whichever transport
    partner_mcp_connected: transport === "mcp" && partnerOk, // true ONLY on a real MCP handshake
    bigquery_connected: await pingBigQuery(),
    agents: ["PipelineMonitor", "RegulatoryAnalyst"],
    sources: ["EUR-Lex", "EBA", "ESMA", "DNB", "FIFA"],
    features: ["regulatory_diff", "retroactive_reclassification", "change_to_tasks", "obligation_ledger", "sync_history"],
    timestamp: new Date().toISOString(),
  });
});

// --- Sync History view: per-connector ingestion stats, cadence, volume + execution logs ---
app.get("/api/sync-history/:connector", async (req, res) => {
  try { res.json(await getSyncHistory(req.params.connector)); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// --- Regulatory diff + retroactive re-classification (the flagship), on demand ---
app.get("/api/diff", async (_req, res) => {
  try {
    const history = await getHistoricalIncidents();
    res.json({ changes: diffThresholds(THRESHOLDS_V1, THRESHOLDS_V2), ...reclassify(history, THRESHOLDS_V1, THRESHOLDS_V2) });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// --- Shared obligation/task ledger (JSON; ?format=csv to export) ---
app.get("/api/obligations/:companyId", async (req, res) => {
  try {
    const rows = await listTasks(req.params.companyId);
    if (req.query.format === "csv") {
      const cols = ["regulation", "article", "who", "what", "deadline", "authority", "impact", "status", "created_at"];
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
      res.setHeader("content-type", "text/csv");
      res.setHeader("content-disposition", `attachment; filename="tasks-${req.params.companyId}.csv"`);
      return res.send(csv);
    }
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// --- Beat 1→2: run the daily monitoring pass (read-only steps 1-4) ---
// GET so Cloud Scheduler can hit it directly; the UI also calls it.
app.get("/api/daily-run", async (_req, res) => {
  try { res.json(await dailyRun()); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});
app.post("/api/daily-run", async (_req, res) => {
  try { res.json(await dailyRun()); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// --- Beat 3→4: human approved → resync delayed connectors + send digest ---
app.post("/api/execute", async (req, res) => {
  const { approved, payload } = req.body || {};
  if (!approved) return res.status(403).json({ error: "human approval required" });
  try { res.json(await executeProposed(payload)); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`RegPipeline listening on :${port}`));
