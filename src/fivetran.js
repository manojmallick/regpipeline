// Fivetran integration — the partner capability.
//
// Two transports, same shape:
//   • FIVETRAN_USE_MCP=true → calls the real Fivetran MCP server at runtime (fivetran-mcp.js).
//     This is the judged "partner MCP is invoked at runtime" path, mirroring agent-builder/agent.json.
//   • otherwise            → Fivetran REST API (below), the simple always-available fallback.
// MOCK=true short-circuits both with canned data (see agent.js / pingFivetran).

const USE_MCP = process.env.FIVETRAN_USE_MCP === "true";
const BASE = "https://api.fivetran.com/v1";
const auth = "Basic " + Buffer.from(`${process.env.FIVETRAN_API_KEY}:${process.env.FIVETRAN_API_SECRET}`).toString("base64");

async function ft(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: auth, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Fivetran ${res.status} ${path}: ${await res.text()}`);
  return res.json();
}

// --- READS (run automatically) ---

/** All connectors across all groups, with health summarized. */
export async function listConnectors() {
  if (USE_MCP) { const { listConnectorsViaMCP } = await import("./fivetran-mcp.js"); return listConnectorsViaMCP(); }
  const groups = (await ft(`/groups`)).data?.items || [];
  const out = [];
  for (const g of groups) {
    const cons = (await ft(`/groups/${g.id}/connectors`)).data?.items || [];
    for (const c of cons) {
      out.push({
        id: c.id,
        service: c.service,
        schema: c.schema,
        state: c.status?.sync_state,           // scheduled | syncing | paused
        setup: c.status?.setup_state,           // connected | incomplete | broken
        last_sync: c.succeeded_at,
        failed: c.status?.setup_state === "broken" || c.failed_at > c.succeeded_at,
        schema_change: c.status?.schema_status, // e.g. blocked_on_capture if new fields
      });
    }
  }
  return out;
}

// --- WRITES (consequential — gated on human approval in server.js /execute) ---
export async function triggerSync(connectorId) {
  if (USE_MCP) { const { resyncViaMCP } = await import("./fivetran-mcp.js"); return resyncViaMCP(connectorId); }
  return ft(`/connectors/${connectorId}/sync`, { method: "POST", body: JSON.stringify({ force: true }) });
}

/** Reachability probe. In MCP mode this is a real MCP handshake (connect + tools/list). */
export async function pingFivetran() {
  if (process.env.MOCK === "true") return true;
  if (USE_MCP) { const { pingMCP } = await import("./fivetran-mcp.js"); return pingMCP(); }
  try { await ft(`/groups`); return true; } catch { return false; }
}

export const fivetranTransport = () => (process.env.MOCK === "true" ? "mock" : USE_MCP ? "mcp" : "rest");
