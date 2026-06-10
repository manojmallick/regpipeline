// Seed the BigQuery `regulatory` dataset so a LIVE deploy's daily-run has data to read.
// Idempotent: creates the dataset + tables if missing and inserts a few recent rows
// (one HIGH-impact DORA threshold change within the 24h lookback) so Gemini has docs to score.
//
//   GOOGLE_CLOUD_PROJECT=<proj> BQ_DATASET=regulatory BQ_LOCATION=us-central1 node scripts/seed-bq.mjs
//
// Requires ADC with BigQuery write on the project. Source tables mirror what a Fivetran
// connector would land (title, document_id, published_date, summary, _fivetran_synced).

import { BigQuery } from "@google-cloud/bigquery";

const DATASET = process.env.BQ_DATASET || "regulatory";
const LOCATION = process.env.BQ_LOCATION || "us-central1";
const bq = new BigQuery();

const SOURCES = {
  eurlex: [{ title: "Delegated Regulation amending DORA incident thresholds", summary: "Lowers major-incident client threshold 10%→8% and duration 2.0h→1.5h.", hoursAgo: 3 }],
  eba: [{ title: "ICT concentration risk guidance published", summary: "Guidance on third-party ICT concentration risk registers.", hoursAgo: 6 }],
  esma: [{ title: "ESMA market-data reporting note", summary: "Clarifies transaction reporting timelines.", hoursAgo: 30 }],
  dnb: [{ title: "DNB supervisory priorities 2026", summary: "Operational resilience remains a top priority.", hoursAgo: 50 }],
  fifa: [{ title: "FIFA 2026 advertising guidelines", summary: "Marketing compliance notes for sponsors.", hoursAgo: 5 }],
};

const INCIDENTS = [
  { incident_id: "INC-2026-031", clients_affected_pct: 9, duration_min: 100, transaction_value_eur: 1_000_000, payments_down_min: 0 },
  { incident_id: "INC-2026-033", clients_affected_pct: 12, duration_min: 95, transaction_value_eur: 0, payments_down_min: 0 },
  { incident_id: "INC-2026-040", clients_affected_pct: 6, duration_min: 200, transaction_value_eur: 0, payments_down_min: 0 },
  { incident_id: "INC-2026-044", clients_affected_pct: 9, duration_min: 130, transaction_value_eur: 0, payments_down_min: 0 },
  { incident_id: "INC-2026-047", clients_affected_pct: 15.2, duration_min: 47, transaction_value_eur: 8_300_000, payments_down_min: 47 },
];

const iso = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600_000).toISOString();

async function ensureDataset() {
  const [exists] = await bq.dataset(DATASET).exists();
  if (!exists) { await bq.createDataset(DATASET, { location: LOCATION }); console.log(`  + dataset ${DATASET} (${LOCATION})`); }
  else console.log(`  = dataset ${DATASET} exists`);
}
async function ensureTable(name, schema) {
  const t = bq.dataset(DATASET).table(name);
  const [exists] = await t.exists();
  if (!exists) { await t.create({ schema }); console.log(`  + table ${name}`); }
  return t;
}

const docSchema = [
  { name: "title", type: "STRING" }, { name: "document_id", type: "STRING" },
  { name: "published_date", type: "DATE" }, { name: "summary", type: "STRING" },
  { name: "_fivetran_synced", type: "TIMESTAMP" },
];

async function main() {
  console.log(`Seeding ${DATASET} in ${bq.projectId || process.env.GOOGLE_CLOUD_PROJECT}...`);
  await ensureDataset();

  for (const [src, docs] of Object.entries(SOURCES)) {
    const t = await ensureTable(src, docSchema);
    const rows = docs.map((d, i) => ({
      title: d.title, document_id: `${src}-${Date.now()}-${i}`,
      published_date: iso(d.hoursAgo).slice(0, 10), summary: d.summary, _fivetran_synced: iso(d.hoursAgo),
    }));
    await t.insert(rows);
    console.log(`  → ${src}: +${rows.length} row(s)`);
  }

  const inc = await ensureTable("ict_incidents", [
    { name: "incident_id", type: "STRING" }, { name: "clients_affected_pct", type: "FLOAT" },
    { name: "duration_min", type: "INTEGER" }, { name: "transaction_value_eur", type: "INTEGER" },
    { name: "payments_down_min", type: "INTEGER" }, { name: "timestamp", type: "TIMESTAMP" },
  ]);
  await inc.insert(INCIDENTS.map((r) => ({ ...r, timestamp: iso(24 * 10) })));
  console.log(`  → ict_incidents: +${INCIDENTS.length} row(s)`);

  // Write targets for the approval step (insert-only; created empty).
  await ensureTable("obligations", [
    { name: "company_id", type: "STRING" }, { name: "obligation_id", type: "STRING" },
    { name: "regulation", type: "STRING" }, { name: "article", type: "STRING" }, { name: "who", type: "STRING" },
    { name: "what", type: "STRING" }, { name: "deadline", type: "STRING" }, { name: "authority", type: "STRING" },
    { name: "trigger", type: "STRING" }, { name: "impact", type: "STRING" }, { name: "status", type: "STRING" },
    { name: "created_at", type: "TIMESTAMP" },
  ]);
  await ensureTable("audit_log", [
    { name: "actor", type: "STRING" }, { name: "action", type: "STRING" },
    { name: "high", type: "INTEGER" }, { name: "tasks_saved", type: "INTEGER" }, { name: "at", type: "TIMESTAMP" },
  ]);
  console.log("✅ seed complete");
}
main().catch((e) => { console.error("❌ seed failed:", e.message); process.exit(1); });
