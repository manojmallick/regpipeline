// Sync History — per-connector ingestion telemetry for the History view.
//
// In live mode this reads Fivetran sync logs + BigQuery row-count deltas. In MOCK
// (or without creds) it returns deterministic, design-faithful data so the History
// dashboard (availability matrix, cadence, volume chart, execution logs) renders fully.

const LABELS = {
  eurlex: "EUR-Lex", eba: "EBA", esma: "ESMA", dnb: "DNB", fifa: "FIFA",
};

/** Deterministic pseudo-random so charts are stable across reloads (no flicker). */
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

export async function getSyncHistory(connector = "eurlex") {
  const key = String(connector).toLowerCase();
  const name = LABELS[key] || connector;
  const rnd = seeded([...key].reduce((a, c) => a + c.charCodeAt(0), 7));

  // 120-cell availability matrix (~last 4 months of polls): healthy / partial / idle / failed
  const matrix = Array.from({ length: 120 }, (_, i) => {
    if (i === 105) return "failed";
    const r = rnd();
    return r > 0.8 ? "full" : r > 0.5 ? "partial" : "idle";
  });

  // 30-day volume series (records ingested per 24h window) + 30-day rolling avg
  const daily = Array.from({ length: 30 }, () => Math.floor(20 + rnd() * 230));
  const avg = Math.round(daily.reduce((a, b) => a + b, 0) / daily.length);

  // Execution logs — newest first; one schema-change row + one failure (matches design).
  const logs = [
    { date: "May 17, 2026", time: "02:00:04", status: "Success", records: 142, schema: "v2.4.1", duration: "1m 12s", source: "Production" },
    {
      date: "May 15, 2026", time: "02:00:11", status: "Success", records: 89, schema: "v2.4.1", duration: "2m 45s", source: "Production",
      schemaChange: { field: "eu_directive_ref_id", type: "String (UUID)", note: "Connector successfully mapped 1 new field discovered in source payload." },
    },
    { date: "May 02, 2026", time: "02:00:02", status: "Failed", records: null, schema: "v2.4.0", duration: "4s", source: "Production" },
    { date: "Apr 30, 2026", time: "02:00:09", status: "Success", records: 211, schema: "v2.4.0", duration: "1m 58s", source: "Production" },
    { date: "Apr 28, 2026", time: "02:00:06", status: "Success", records: 173, schema: "v2.4.0", duration: "1m 41s", source: "Production" },
  ];

  const total = 30;
  const failed = 1;
  const successful = total - failed;

  return {
    connector: key,
    connectorName: name,
    active: true,
    description: `Active ingestion pipeline for ${name === "EUR-Lex" ? "European Union Law database" : name + " regulatory source"}.`,
    range: "Last 30 days",
    stats: {
      total,
      successful,
      failed,
      reliability: +((successful / total) * 100).toFixed(1),
      lastFailure: "May 02, 2026",
    },
    cadence: {
      automation: true,
      text: `The ${name} connector is configured to poll for new records every 24 hours at 02:00 UTC.`,
      lastTrigger: "Today, 02:00",
      nextExpected: "Tomorrow, 02:00",
    },
    matrix,
    months: ["Feb 2026", "Mar 2026", "Apr 2026", "May 2026"],
    volume: { daily, rollingAvg: avg },
    logs,
  };
}
