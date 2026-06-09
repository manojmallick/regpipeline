// BigQuery — the regulatory data warehouse Fivetran syncs into.
// RegPipeline reads the newly-synced regulatory documents here for impact analysis.

import { BigQuery } from "@google-cloud/bigquery";

const bq = new BigQuery(); // uses GOOGLE_CLOUD_PROJECT + ADC
const DATASET = process.env.BQ_DATASET || "regulatory";

/** New regulatory documents synced in the last N hours, across all source tables. */
export async function getNewDocuments(lookbackHours = 24) {
  // Fivetran connectors land in tables like regulatory.eurlex, regulatory.eba, etc.
  // _fivetran_synced is the standard Fivetran sync-timestamp column.
  const sources = ["eurlex", "eba", "esma", "dnb", "fifa"];
  const unions = sources
    .map(
      (s) => `SELECT '${s}' AS source, title, document_id, published_date, summary
              FROM \`${DATASET}.${s}\`
              WHERE _fivetran_synced >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @h HOUR)`
    )
    .join("\nUNION ALL\n");
  const [rows] = await bq.query({ query: unions, params: { h: lookbackHours } });
  return rows;
}

/** Historical incidents to re-run when a threshold changes (retroactive re-classification).
 *  In live mode this would join the firm's incident store; canned in MOCK for the demo. */
export async function getHistoricalIncidents() {
  if (process.env.MOCK === "true") {
    return [
      { incident_id: "INC-2026-031", clients_affected_pct: 9, duration_min: 100, transaction_value_eur: 1_000_000, payments_down_min: 0 },
      { incident_id: "INC-2026-033", clients_affected_pct: 12, duration_min: 95, transaction_value_eur: 0, payments_down_min: 0 },
      { incident_id: "INC-2026-040", clients_affected_pct: 6, duration_min: 200, transaction_value_eur: 0, payments_down_min: 0 },
      { incident_id: "INC-2026-044", clients_affected_pct: 9, duration_min: 130, transaction_value_eur: 0, payments_down_min: 0 },
      { incident_id: "INC-2026-047", clients_affected_pct: 15.2, duration_min: 47, transaction_value_eur: 8_300_000, payments_down_min: 47 },
    ];
  }
  const [rows] = await bq.query({
    query: `SELECT incident_id, clients_affected_pct, duration_min, transaction_value_eur, payments_down_min
            FROM \`${DATASET}.ict_incidents\` WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 180 DAY)`,
  });
  return rows;
}

// --- SHARED Obligation ledger + audit log (same schema as RegQuery / IncidentIQ) ---
const mem = { tasks: [], audit: [] };
export async function recordTasks(companyId, tasks = []) {
  const now = new Date().toISOString();
  const docs = tasks.map((t) => ({
    company_id: companyId,
    obligation_id: t.obligation_id || `${t.regulation || "?"}-${(t.article || "?").replace(/\s+/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    regulation: t.regulation || null, article: t.article || null, who: t.who || null,
    what: t.what || null, deadline: t.deadline || null, authority: t.authority || null,
    trigger: t.trigger || null, impact: t.impact || null, status: "open", created_at: now,
  }));
  if (!docs.length) return { inserted: 0 };
  if (process.env.MOCK === "true") { mem.tasks.push(...docs); return { inserted: docs.length }; }
  await bq.dataset(DATASET).table("obligations").insert(docs);
  return { inserted: docs.length };
}
export async function listTasks(companyId) {
  if (process.env.MOCK === "true") return mem.tasks.filter((t) => t.company_id === companyId);
  const [rows] = await bq.query({ query: `SELECT * FROM \`${DATASET}.obligations\` WHERE company_id=@c ORDER BY created_at DESC`, params: { c: companyId } });
  return rows;
}
export async function recordAudit(entry) {
  const doc = { ...entry, at: new Date().toISOString() };
  if (process.env.MOCK === "true") { mem.audit.push(doc); return doc; }
  await bq.dataset(DATASET).table("audit_log").insert([doc]);
  return doc;
}

export async function pingBigQuery() {
  if (process.env.MOCK === "true") return true;
  try { await bq.query({ query: "SELECT 1", maxResults: 1 }); return true; } catch { return false; }
}
