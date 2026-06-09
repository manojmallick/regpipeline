// RegPipeline eval — verifies the retroactive re-classification engine (src/diff.js).
// Deterministic, no creds: real, reproducible accuracy for the diff/reclassify logic.
//
//   node scripts/eval.js

import { readFile, writeFile } from "node:fs/promises";
import { classify, THRESHOLDS_V1, THRESHOLDS_V2 } from "../src/diff.js";

const TARGET = Number(process.env.EVAL_TARGET ?? 1.0);

async function main() {
  const gold = JSON.parse(await readFile(new URL("../evals/golden-diff.json", import.meta.url)));
  let correct = 0;
  const rows = [];
  for (const c of gold.cases) {
    const was = classify(c.incident, THRESHOLDS_V1).classification;
    const now = classify(c.incident, THRESHOLDS_V2).classification;
    const ok = was === c.expect_was && now === c.expect_now;
    if (ok) correct++;
    rows.push({ name: c.name, was, now, expect_was: c.expect_was, expect_now: c.expect_now, ok });
  }
  const accuracy = correct / gold.cases.length;
  console.log("\nRegPipeline — retroactive re-classification eval (v1 → v2 thresholds)\n");
  for (const r of rows) console.log(`  ${r.ok ? "✅" : "❌"} ${r.name.padEnd(48)} ${r.was}→${r.now}`);
  const flips = rows.filter((r) => r.was !== r.now && r.ok).length;
  console.log(`\n  Accuracy ${(accuracy * 100).toFixed(1)}%  (${correct}/${gold.cases.length})  ·  ${flips} correct flips MINOR→MAJOR`);

  const report = { ran_at: new Date().toISOString(), target: TARGET, total: gold.cases.length, correct, accuracy, flips, rows };
  await writeFile(new URL("../evals/report.json", import.meta.url), JSON.stringify(report, null, 2));
  const passed = accuracy >= TARGET;
  console.log(`  ${passed ? "✅ PASS" : "❌ FAIL"} — target ${(TARGET * 100).toFixed(0)}%  (report → evals/report.json)\n`);
  process.exit(passed ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
