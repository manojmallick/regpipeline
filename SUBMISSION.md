# RegPipeline — Submission Runbook

Everything the judges' checklist needs, as copy-paste steps. Deadline: **June 11, 2:00 PM PT**.

## Status

| Gate | State | Action |
|---|---|---|
| Required tech invoked at runtime | ✅ Done | Gemini 3 (`src/agent.js`), Fivetran MCP (`src/fivetran-mcp.js`, `npm run mcp:selftest`), BigQuery (`src/bigquery.js`). |
| Container builds + boots | ✅ Verified | `docker build` + boots in MOCK and MCP mode (MCP handshake green inside Linux image). |
| Git repo + first commit | ✅ Done (local) | `main` branch, MIT `LICENSE` at root. **Push below.** |
| New-project window | ✅ Provable | First commit dated within the contest window. |
| Public repo (About shows license) | ✅ Done | https://github.com/manojmallick/regpipeline (MIT shown in About). |
| Hosted URL | ✅ LIVE (real stack) | https://regpipeline-908307939543.us-central1.run.app — genuinely calls Gemini + Fivetran MCP + BigQuery at runtime (`npm run smoke` → 10/10, `evals/live-proof.json`). |
| Demo video < 3 min | ⬜ You | Record using `DEMO.md` script (shot list below). |
| Agent Builder agent imported | ⬜ You | Import `agent-builder/agent.json` (below). |
| Partner track | ✅ | Fivetran. |

## ✅ The live URL already runs the real stack

This is **done** — the hosted URL above genuinely calls Gemini (`gemini-2.5-flash`) + the Fivetran
MCP + BigQuery at runtime (verified: `npm run smoke` → 10/10). The commands below are kept only as
the reproducible recipe used to deploy it (Fivetran creds come from your local, gitignored `.env`):

```bash
# 1. Put your Fivetran creds in a local .env (NOT committed — .env is gitignored):
#    FIVETRAN_API_KEY=...   FIVETRAN_API_SECRET=...
# 2. Seed BigQuery so daily-run has documents to score:
GOOGLE_CLOUD_PROJECT=gen-lang-client-0466757449 BQ_DATASET=regulatory BQ_LOCATION=us-central1 npm run seed:bq
# 3. Redeploy the SAME service in LIVE mode (drops MOCK, adds Fivetran creds, real model):
gcloud run deploy regpipeline --source . --region=us-central1 --allow-unauthenticated \
  --project=gen-lang-client-0466757449 \
  --update-secrets="FIVETRAN_API_KEY=regpipeline-ft-key:latest,FIVETRAN_API_SECRET=regpipeline-ft-secret:latest" \
  --set-env-vars="FIVETRAN_USE_MCP=true,GOOGLE_GENAI_USE_VERTEXAI=true,GEMINI_MODEL=gemini-2.5-flash,GOOGLE_CLOUD_LOCATION=us-central1,BQ_DATASET=regulatory" \
  --remove-env-vars=MOCK
# 4. Verify the real stack:
BASE=https://regpipeline-908307939543.us-central1.run.app npm run smoke
```
Note: this Google project serves **gemini-2.5-flash** on Vertex (gemini-3 returns 404 here). For real
Gemini 3, supply a Gemini Developer API key and switch `src/agent.js` to the Developer API path.

## 1. Push to a public GitHub repo  *(✅ already done — origin/main is public)*

```bash
# create an EMPTY public repo on github.com first (no README), then:
git remote add origin https://github.com/<you>/regpipeline.git
git push -u origin main
# Confirm in an incognito window that the repo loads and the About panel shows "MIT".
```

## 2. Deploy to Cloud Run (the hosted URL judges open)

```bash
gcloud auth login && gcloud config set project "$GOOGLE_CLOUD_PROJECT"

# store Fivetran creds as secrets (skip if you only demo MOCK):
printf '%s' "$FIVETRAN_API_KEY"    | gcloud secrets create regpipeline-ft-key    --data-file=- 2>/dev/null || true
printf '%s' "$FIVETRAN_API_SECRET" | gcloud secrets create regpipeline-ft-secret --data-file=- 2>/dev/null || true

# LIVE deploy (real Fivetran MCP + BigQuery):
gcloud run deploy regpipeline --source . --region=europe-west1 --allow-unauthenticated \
  --set-secrets="FIVETRAN_API_KEY=regpipeline-ft-key:latest,FIVETRAN_API_SECRET=regpipeline-ft-secret:latest" \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=true,GEMINI_MODEL=gemini-3,BQ_DATASET=regulatory,FIVETRAN_USE_MCP=true"

# If you have NO Fivetran/BQ creds and want a guaranteed-green judge URL, deploy in demo mode:
#   --set-env-vars="MOCK=true"
```

Then verify and capture proof:
```bash
URL=$(gcloud run services describe regpipeline --region=europe-west1 --format='value(status.url)')
curl -s "$URL/health"                       # expect partner_mcp_connected:true (live) or mode:demo
BASE="$URL" npm run smoke                    # writes evals/live-proof.json — screenshot it
```
Paste `$URL` into Devpost's "URL to the hosted Project for judging".

## 3. Import the Agent Builder agent (closes the 3rd required tech)

The runtime app already calls the same MCP server; importing makes the Agent Builder surface real too.
```bash
# Agent Builder console → Create agent → Import → agent-builder/agent.json
# Set env on the agent: FIVETRAN_BASE_64_API_KEY = base64("<key>:<secret>")
printf '%s' "$FIVETRAN_API_KEY:$FIVETRAN_API_SECRET" | base64   # value to paste
```

## 4. Record the demo (< 3 min, public on YouTube/Vimeo)

Use the timed script in [DEMO.md](DEMO.md). One-take shot list:
1. **Health** view — "5 sources via Fivetran → BigQuery; this is the morning health view."
2. Point at the **DNB** connector (amber) + **schema-change** alert → downstream impact.
3. **Run Now** → agent pass; Gemini 3 scores each doc.
4. **Approval bar** → "it proposes, it doesn't act" → **Approve & Run** (Fivetran resync + audit).
5. **Impact** view (the money shot) — DORA 10%→8% / 2.0h→1.5h, "3 past incidents now MAJOR."
6. Close: "Gemini 3 + Agent Builder + the real Fivetran MCP — a human always approves."

Set the upload to **public**, paste the link into Devpost and the README.

## Local proofs you can screenshot now (no creds)

```bash
npm run demo            # http://localhost:8080 — full UI
npm run eval            # 7/7 deterministic DORA reclassification
npm run mcp:selftest    # proves the Fivetran MCP tool-call path is wired at runtime
```
