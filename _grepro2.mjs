import { GoogleGenAI } from "@google/genai";
import { listConnectors } from "./src/fivetran.js";
import { getNewDocuments } from "./src/bigquery.js";
const ai = new GoogleGenAI({ vertexai: true });
const DIGEST_SYSTEM = `You are RegPipeline, a regulatory-change analyst for an EU financial
entity. Given newly-published regulatory documents and pipeline health, produce a daily
digest. For each document assign impact HIGH/MEDIUM/LOW, name the affected regulation
articles (DORA/NIS2/GDPR/EU AI Act), and state the action required + deadline if any.
Mark threshold_change:true if the document changes a numeric DORA incident threshold.
Use ONLY the documents provided; do not invent regulations. Return STRICT JSON:
{ "items": [{ "source": string, "title": string, "impact": "HIGH"|"MEDIUM"|"LOW",
   "affects": string, "action": string, "deadline": string, "threshold_change": boolean }],
  "summary": string }`;
const connectors = await listConnectors();
const delayed = connectors.filter((c) => c.failed || c.state === "paused");
const schemaChanges = connectors.filter((c) => c.schema_change && c.schema_change !== "ready");
const docs = await getNewDocuments(24);
const res = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  config: { systemInstruction: DIGEST_SYSTEM, responseMimeType: "application/json" },
  contents: `NEW DOCUMENTS:\n${JSON.stringify(docs, null, 2)}\n\nPIPELINE HEALTH:\n${JSON.stringify({ delayed, schemaChanges }, null, 2)}`,
});
const t = res.text;
console.log("len:", t?.length, "| finishReason:", res.candidates?.[0]?.finishReason);
console.log("last 60:", JSON.stringify((t||"").slice(-60)));
try { const p = JSON.parse(t); console.log("✅ parse OK items:", p.items?.length); }
catch(e){ console.log("❌ parse FAIL:", e.message); }
