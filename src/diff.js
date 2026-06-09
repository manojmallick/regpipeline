// RegPipeline — regulatory diff + retroactive re-classification engine.
//
// The flagship from APP_IMPROVEMENT_PLAN.md: when a delegated act moves a DORA
// threshold (e.g. 10%/2h → 8%/1.5h), don't just say "something changed" — compute
// the precise delta AND re-run it against historical incidents to show exactly which
// ones would now be reclassified MAJOR. Then turn the change into tracked tasks
// (the shared Obligation schema). Deterministic, so it's eval-able with real numbers.

// DORA major-incident thresholds. v1 = baseline; a delegated act produces v2.
export const THRESHOLDS_V1 = {
  clients_pct: 10, clients_duration_min: 120, transaction_value_eur: 5_000_000,
  payments_down_min: 30, core_banking_down_min: 120,
};
export const THRESHOLDS_V2 = {
  clients_pct: 8, clients_duration_min: 90, transaction_value_eur: 5_000_000,
  payments_down_min: 30, core_banking_down_min: 120,
};

/** Deterministic DORA classification under a given threshold set. */
export function classify(m, T) {
  const triggered = [];
  if ((m.clients_affected_pct ?? 0) > T.clients_pct && (m.duration_min ?? 0) > T.clients_duration_min)
    triggered.push(`clients ${m.clients_affected_pct}% > ${T.clients_pct}% for >${T.clients_duration_min}min`);
  if ((m.transaction_value_eur ?? 0) > T.transaction_value_eur)
    triggered.push(`value €${((m.transaction_value_eur ?? 0) / 1e6).toFixed(1)}M > €${(T.transaction_value_eur / 1e6).toFixed(0)}M`);
  if ((m.payments_down_min ?? 0) > T.payments_down_min) triggered.push("payments down");
  if ((m.core_banking_down_min ?? 0) > T.core_banking_down_min) triggered.push("core banking down");
  return { classification: triggered.length ? "MAJOR" : "MINOR", triggered };
}

/** Field-level delta between two threshold sets. */
export function diffThresholds(oldT, newT) {
  const changes = [];
  for (const k of Object.keys({ ...oldT, ...newT })) {
    if (oldT[k] !== newT[k]) changes.push({ field: k, from: oldT[k], to: newT[k] });
  }
  return changes;
}

/**
 * Retroactive re-classification: which historical incidents change verdict under newT?
 * @returns {{ total, changed, rows }}  rows = [{ incident_id, was, now, flipped }]
 */
export function reclassify(incidents, oldT, newT) {
  const rows = (incidents || []).map((i) => {
    const was = classify(i, oldT).classification;
    const now = classify(i, newT).classification;
    return { incident_id: i.incident_id, was, now, flipped: was !== now };
  });
  return { total: rows.length, changed: rows.filter((r) => r.flipped).length, rows };
}

/** Convert digest items into tracked remediation tasks in the SHARED Obligation schema. */
export function changeToTasks(items = [], { authority = "DNB (Netherlands)" } = {}) {
  return items
    .filter((i) => i.impact === "HIGH" || i.impact === "MEDIUM")
    .map((i) => ({
      regulation: (i.affects || "").split(" ")[0] || "DORA",
      article: (i.affects || "").replace(/^\S+\s*/, "") || null,
      who: "Compliance team",
      what: i.action || `Review change: ${i.title}`,
      deadline: i.deadline || null,
      authority,
      trigger: `${i.source}: ${i.title}`,
      impact: i.impact,
    }));
}
