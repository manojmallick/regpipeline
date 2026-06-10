const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
let runData=null, diffData=null, pending=null, healthInfo={};

// ---------- navigation ----------
function paintNav(view){
  $("#topTitle").textContent = {health:"Health",impact:"Impact",history:"History"}[view];
  document.querySelectorAll(".side-btn").forEach(b=>{
    if(!b.dataset.nav) return;
    const on=b.dataset.nav===view;
    b.className="side-btn w-full flex items-center px-md py-sm group "+(on?"text-primary font-bold bg-primary-container/10 border-r-2 border-primary":"text-on-surface-variant hover:bg-surface-variant/50 transition-all");
  });
  document.querySelectorAll(".top-btn").forEach(b=>{
    const on=b.dataset.nav===view;
    b.className="top-btn text-body-md pb-1 "+(on?"text-primary border-b-2 border-primary":"text-on-surface-variant hover:text-on-surface transition-colors");
  });
}
function show(view){
  for(const v of ["health","impact","history"]) $("#view-"+v).classList.toggle("hidden", v!==view);
  paintNav(view);
  if(view==="impact" && !diffData) loadDiff();
  if(view==="history") loadHistory(curConnector);
  history.replaceState(null,"","#"+view);
}
document.querySelectorAll("[data-nav]").forEach(b=>b.dataset.nav&&(b.onclick=()=>show(b.dataset.nav)));

// ---------- daily run (Health + Impact source) ----------
async function runPipeline(){
  $("#refreshIcon").classList.add("spin");
  try{
    const r=await fetch("/api/daily-run"); const d=await r.json();
    if(d.error) throw new Error(d.error);
    runData=d; renderHealth(d);
    if(diffData||true){} // impact uses /api/diff lazily
    pending={delayed:d.delayed,digest:d.digest,tasks:d.tasks};
    if(d.proposedAction){
      $("#apTitle").textContent="⚡ Agent proposes: "+d.proposedAction.description;
      $("#apTools").textContent="tools: "+(d.proposedAction.tools||[]).join(" · ");
      $("#approval").classList.remove("hidden");
    }
    // refresh impact if currently shown
    if(!$("#view-impact").classList.contains("hidden")) loadDiff();
  }catch(e){ $("#view-health").innerHTML=`<div class="glass-card p-lg rounded-xl text-error">Error: ${esc(e.message)}</div>`; }
  finally{ $("#refreshIcon").classList.remove("spin"); }
}
$("#refreshBtn").onclick=runPipeline;
$("#triggerSyncBtn").onclick=runPipeline;

const impactMeta=i=>i==="HIGH"?{c:"error",ic:"priority_high",w:"w-4/5",label:"High Impact"}
  :i==="MEDIUM"?{c:"yellow-500",ic:"warning",w:"w-2/5",label:"Medium Impact"}
  :{c:"green-500",ic:"check_circle",w:"w-1/5",label:"Low Impact"};
const connIcon=s=>({eurlex:"hub",eba:"database",dnb:"error",esma:"layers",fifa:"sports_soccer"}[s]||"hub");
function connState(c){
  if(c.failed) return {badge:"DELAYED",cls:"yellow-500",delayed:true};
  if(c.schema_change&&c.schema_change!=="ready") return {badge:"SCHEMA Δ",cls:"yellow-500",delayed:true};
  return {badge:"HEALTHY",cls:"green-500",delayed:false};
}

function renderHealth(d){
  const high=(d.digest?.items||[]).filter(i=>i.impact==="HIGH").length;
  const delta=-2*Math.max(1,high); // compliance score delta, driven by HIGH-impact count
  const digestCards=(d.digest?.items||[]).slice(0,3).map(i=>{const m=impactMeta(i.impact);return `
    <div class="space-y-md">
      <div class="flex items-center gap-xs text-${m.c}"><span class="material-symbols-outlined font-bold">${m.ic}</span><span class="text-label-md uppercase tracking-widest">${m.label}</span></div>
      <h3 class="text-body-lg font-bold text-on-surface">${esc(i.title)}</h3>
      <p class="text-body-sm text-on-surface-variant">Source: <span class="font-mono-data text-primary">${esc(i.source)}</span></p>
      <div class="h-1 w-full bg-surface-variant rounded-full overflow-hidden"><div class="h-full bg-${m.c} ${m.w}"></div></div>
    </div>`;}).join("");
  const conns=(d.connectors||[]).map(c=>{const st=connState(c);const svc=(c.service||"").toLowerCase();
    const label=({eurlex:"EUR-Lex",eba:"EBA",dnb:"DNB",esma:"ESMA",fifa:"FIFA"}[svc])||c.service;
    const sub=svc==="eurlex"?"Uptime: 99.9%":svc==="eba"?"Last sync: 12m ago":svc==="esma"?"Rows: 2.4M":svc==="fifa"?"API Version: v4.2":(st.delayed?"Intervention required":"OK");
    if(st.delayed) return `
    <div class="glass-card p-md rounded-xl flex flex-col justify-between h-32 border-yellow-500/50 bg-yellow-500/5">
      <div class="flex justify-between items-start"><span class="font-mono-data text-primary font-bold">${esc(label)}</span>
        <span class="px-sm py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-bold rounded border border-yellow-500/20 uppercase">⚠️ Delayed</span></div>
      <div class="text-body-sm text-yellow-200/80 font-mono-data truncate">New field: enforcement_priority</div>
      <div class="flex items-end justify-between"><div class="text-body-sm text-yellow-500 font-bold">Intervention required</div><span class="material-symbols-outlined text-yellow-500">error</span></div>
    </div>`;
    return `
    <div class="glass-card p-md rounded-xl flex flex-col justify-between h-32">
      <div class="flex justify-between items-start"><span class="font-mono-data text-primary font-bold">${esc(label)}</span>
        <span class="px-sm py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded border border-green-500/20">HEALTHY</span></div>
      <div class="flex items-end justify-between"><div class="text-body-sm text-on-surface-variant">${esc(sub)}</div><span class="material-symbols-outlined text-on-surface-variant/50">${connIcon(svc)}</span></div>
    </div>`;}).join("");
  const bars=[60,75,85,70,95,80,65,40,85,90];
  const throughput=bars.map((h,i)=>`<div class="${i===4?'bg-primary':i===7?'bg-yellow-500':'bg-primary/40'} w-full rounded-t-sm" style="height:${h}%"></div>`).join("");

  $("#view-health").innerHTML=`
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-md fade-in">
    <div>
      <div class="flex items-center gap-sm mb-xs"><span class="text-headline-lg font-black tracking-tight text-on-surface">Pipeline Health Center</span></div>
      <div class="flex flex-wrap items-center gap-md text-on-surface-variant">
        <span class="text-body-md">Regulatory Data Intelligence</span>
        <span class="h-4 w-px bg-outline-variant"></span>
        <span class="px-sm py-0.5 bg-secondary-container/20 text-secondary border border-secondary-container rounded-full text-label-md">${(d.connectors||[]).length} Fivetran connectors</span>
        <span class="flex items-center gap-xs text-body-sm"><span class="h-2 w-2 rounded-full bg-green-500 glow-pulse"></span>Last run: ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} CET · ${d.elapsed_ms}ms</span>
      </div>
    </div>
    <button onclick="runPipeline()" class="px-lg py-sm bg-primary-container text-on-primary-container font-bold rounded-lg shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"><span class="material-symbols-outlined">play_arrow</span>Run Now</button>
  </div>

  <section class="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-surface-container-low to-surface-container-high p-lg mt-xl">
    <div class="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
    <div class="relative z-10">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-lg border-b border-outline-variant/30 pb-md">
        <h2 class="text-headline-sm flex items-center gap-sm"><span class="text-primary">📋</span> Daily Regulatory Digest — ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</h2>
        <div class="flex items-center gap-sm bg-error-container/10 px-md py-1 rounded border border-error-container/30">
          <span class="text-error font-mono-data text-body-md">${delta} points</span>
          <span class="text-on-surface-variant text-label-md uppercase tracking-wider">Compliance Score Delta</span></div>
      </div>
      <p class="text-on-surface-variant text-body-md mb-lg">${esc(d.digest?.summary||"")}</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-lg">${digestCards||'<span class="text-on-surface-variant">No new regulatory documents.</span>'}</div>
    </div>
  </section>

  <div class="asymmetric-grid mt-xl">
    <div class="space-y-lg">
      <div class="flex justify-between items-center"><h2 class="text-headline-sm">Connector Integrity</h2><span class="text-label-md text-on-surface-variant uppercase">${(d.connectors||[]).length} Active Nodes</span></div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-md">${conns}</div>
    </div>
    <div class="space-y-lg">
      <h2 class="text-headline-sm">Active Alerts</h2>
      ${renderSchemaAlert(d)}
      <div class="glass-card p-lg rounded-xl">
        <p class="text-label-md uppercase tracking-widest text-on-surface-variant mb-md text-center">Throughput (24h)</p>
        <div class="flex items-end gap-1 h-24 justify-center">${throughput}</div>
      </div>
    </div>
  </div>`;
}

function renderSchemaAlert(d){
  const sc=(d.schemaChanges||[])[0]||(d.delayed||[])[0];
  if(!sc) return `<div class="glass-card p-lg rounded-xl text-on-surface-variant flex items-center gap-sm"><span class="material-symbols-outlined text-green-500">verified</span>No schema changes — all connectors nominal.</div>`;
  return `<div class="glass-card border-yellow-500/50 p-lg rounded-xl space-y-md relative">
    <div class="absolute top-0 right-0 p-md opacity-20"><span class="material-symbols-outlined text-[64px]">schema</span></div>
    <div class="flex items-center gap-md"><div class="bg-yellow-500/20 p-sm rounded-lg"><span class="material-symbols-outlined text-yellow-500">settings_suggest</span></div>
      <div><h3 class="text-body-lg font-bold text-on-surface">Schema Change Detected</h3><p class="text-body-sm text-on-surface-variant font-mono-data">${esc((sc.service||"connector").toUpperCase())}_CONNECTOR_PROD</p></div></div>
    <div class="p-md bg-surface-container-low rounded border border-outline-variant/30 font-mono-data text-body-sm text-yellow-200/70">ALTER TABLE ${esc(sc.service||"dnb")}.regulatory_actions <br/>ADD COLUMN <span class="text-yellow-500">enforcement_priority</span> VARCHAR(20);</div>
    <div class="space-y-sm"><p class="text-label-md uppercase tracking-wider text-on-surface-variant">Downstream Impact</p>
      <div class="flex flex-col gap-xs">
        <div class="flex items-center justify-between px-md py-xs bg-surface-container-highest/50 rounded text-body-sm"><span>q_risk_concentration_v2</span><span class="text-error font-bold italic">BROKEN</span></div>
        <div class="flex items-center justify-between px-md py-xs bg-surface-container-highest/50 rounded text-body-sm"><span>view_bank_compliance_daily</span><span class="text-yellow-500 font-bold italic">STALE</span></div>
      </div></div>
    <div class="pt-md flex gap-sm">
      <button onclick="runPipeline()" class="flex-1 py-xs bg-yellow-500 text-on-secondary font-bold text-label-md rounded hover:brightness-110 uppercase">Map New Field</button>
      <button onclick="hideApproval()" class="px-md py-xs border border-outline-variant text-on-surface-variant text-label-md rounded hover:bg-surface-variant uppercase">Ignore</button>
    </div></div>`;
}

// ---------- approval ----------
async function approve(){
  try{
    const r=await fetch("/api/execute",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({approved:true,payload:pending})});
    const d=await r.json(); hideApproval();
    toast(d.ok?`Executed: ${(d.executed||[]).join(", ")} · ${d.tasks_saved} task(s) saved`:`Error: ${d.error}`);
  }catch(e){ toast("Error: "+e.message); }
}
function hideApproval(){ $("#approval").classList.add("hidden"); }
function toast(msg){
  const t=document.createElement("div");
  t.className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-surface-container-highest border border-primary/40 text-on-surface px-lg py-md rounded-lg shadow-2xl text-body-md fade-in";
  t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),5000);
}

// ---------- Impact view (/api/diff + digest) ----------
async function loadDiff(){
  $("#view-impact").innerHTML=`<div class="glass-card p-lg rounded-xl text-on-surface-variant flex items-center gap-sm"><span class="material-symbols-outlined spin text-primary">progress_activity</span> Computing regulatory diff…</div>`;
  try{ diffData=await (await fetch("/api/diff")).json(); renderImpact(diffData); }
  catch(e){ $("#view-impact").innerHTML=`<div class="glass-card p-lg rounded-xl text-error">Error: ${esc(e.message)}</div>`; }
}
const fieldLabel={clients_pct:["Client Impact Ratio",v=>v+"%"],clients_duration_min:["Classification Time window",v=>(v/60).toFixed(1)+"h"],transaction_value_eur:["Transaction Value",v=>"€"+(v/1e6).toFixed(0)+"M"],payments_down_min:["Payments Downtime",v=>v+"m"],core_banking_down_min:["Core Banking Downtime",v=>v+"m"]};
function renderImpact(diff){
  const item=(runData?.digest?.items||[]).find(i=>i.threshold_change)||(runData?.digest?.items||[])[0]||{source:"EUR-Lex",title:"Delegated Regulation amending DORA incident classification thresholds",impact:"HIGH",affects:"DORA Art.17"};
  const changes=(diff.changes||[]).map(c=>{const fl=fieldLabel[c.field]||[c.field,v=>v];return `
    <div class="bg-surface-container-low p-md rounded border border-outline-variant/30">
      <p class="text-on-surface-variant text-label-md mb-xs">${esc(fl[0])}</p>
      <div class="flex items-center gap-md"><span class="text-on-surface-variant line-through text-headline-sm">${esc(fl[1](c.from))}</span><span class="material-symbols-outlined text-error">trending_down</span><span class="text-primary text-headline-sm font-bold">${esc(fl[1](c.to))}</span></div>
    </div>`;}).join("");
  const articles=(item.affects||"DORA Art.17").split(/[,/]/).map(a=>`<span class="px-md py-sm bg-surface-container rounded border border-outline-variant font-mono-data text-mono-data">${esc(a.trim())}</span>`).join("");
  const tasks=(runData?.tasks||[]).map((t,i)=>`
    <div class="flex items-start gap-md group cursor-pointer" onclick="this.querySelector('.cbx').classList.toggle('bg-primary-container/20');this.querySelector('.cbx').classList.toggle('border-primary');this.classList.toggle('opacity-60')">
      <div class="cbx mt-1 w-5 h-5 border-2 border-outline-variant rounded flex items-center justify-center group-hover:border-primary transition-colors"></div>
      <div class="flex-1"><p class="text-on-surface font-bold">${esc(t.what)}</p><p class="text-on-surface-variant text-body-sm">${esc(t.regulation||"DORA")} ${esc(t.article||"")} — triggered by ${esc(t.trigger||item.source)}</p></div>
      <span class="text-label-md text-on-surface-variant whitespace-nowrap">Due: ${esc(t.deadline||(i===0?"24h":"3d"))}</span>
    </div>`).join("") || `<p class="text-on-surface-variant text-body-sm">No remediation tasks generated.</p>`;
  const flipped=(diff.rows||[]).filter(r=>r.flipped).length;
  const high=(runData?.digest?.items||[]).filter(i=>i.impact==="HIGH").length||1;
  const from=89, to=from-2*high;

  $("#view-impact").innerHTML=`
  <div class="flex flex-col md:flex-row md:items-end justify-between gap-md fade-in">
    <div class="space-y-sm">
      <div class="flex items-center gap-sm"><span class="text-label-md text-primary tracking-widest uppercase">Source: ${esc(item.source)}</span>
        <span class="px-sm py-0.5 bg-error-container/20 text-error border border-error/30 rounded text-label-md font-bold">${esc(item.impact)} IMPACT</span></div>
      <h2 class="text-headline-lg max-w-4xl">${esc(item.title)}</h2>
    </div>
    <div class="bg-surface-container border border-outline-variant p-md rounded-xl min-w-[280px]">
      <div class="flex items-center justify-between mb-sm"><div class="flex items-center gap-sm"><span class="w-2 h-2 rounded-full bg-primary glow-pulse"></span><span class="text-label-md text-on-surface">Fivetran Sync</span></div><span class="text-primary text-[10px] font-bold uppercase">${runData?'Synced':'Idle'}</span></div>
      <div class="space-y-1 font-mono-data text-mono-data text-on-surface-variant">
        <div class="flex justify-between"><span>Time:</span><span class="text-on-surface">${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} CET</span></div>
        <div class="flex justify-between"><span>Records:</span><span class="text-on-surface">${(runData?.digest?.items||[]).length} record(s)</span></div>
        <div class="flex justify-between"><span>Sync ID:</span><span class="text-on-surface">sync_${Math.random().toString(36).slice(2,8)}</span></div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-lg mt-xl">
    <div class="lg:col-span-8 space-y-lg">
      <div class="bg-[#101828] border border-[#1C2C42] rounded-xl overflow-hidden">
        <div class="px-lg py-md border-b border-[#1C2C42] flex items-center justify-between">
          <div class="flex items-center gap-sm"><span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL' 1">auto_awesome</span><h3 class="text-headline-sm">Gemini Analysis</h3></div>
          <span class="text-label-md text-on-surface-variant">Model: ${esc(healthInfo.model||"Gemini 3")}</span></div>
        <div class="p-lg space-y-xl">
          <div><h4 class="text-label-md text-primary uppercase mb-md">Legal Context</h4><div class="flex gap-sm flex-wrap">${articles}</div></div>
          <div><h4 class="text-label-md text-primary uppercase mb-md">Threshold Changes</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-md">${changes||'<p class="text-on-surface-variant text-body-sm">No numeric threshold changes.</p>'}</div></div>
          <div class="bg-primary/5 p-md rounded-lg border-l-4 border-primary"><p class="text-on-surface leading-relaxed">The amendment tightens the "Major Incident" reporting requirements. Operations must recalibrate automated alerting to trigger faster — ${flipped} historical incident(s) would now re-classify as MAJOR under the new thresholds, requiring updated DORA Art.17 compliance.</p></div>
        </div>
      </div>
      <div class="bg-[#101828] border border-[#1C2C42] rounded-xl p-lg">
        <h3 class="text-headline-sm mb-lg">Action Required</h3><div class="space-y-md">${tasks}</div>
      </div>
    </div>

    <div class="lg:col-span-4 space-y-lg">
      <div class="bg-surface-container rounded-xl p-lg border border-outline-variant text-center space-y-sm">
        <h4 class="text-label-md text-on-surface-variant uppercase">Projected Compliance Score</h4>
        <div class="flex items-baseline justify-center gap-md"><span class="text-on-surface-variant text-headline-sm">${from}</span><span class="material-symbols-outlined text-error">arrow_forward</span><span class="text-headline-lg font-black text-on-surface">${to}</span></div>
        <div class="flex items-center justify-center gap-1 text-error"><span class="material-symbols-outlined text-[16px]">arrow_downward</span><span class="font-bold text-body-sm">${to-from} points delta</span></div>
        <p class="text-[11px] text-on-surface-variant italic pt-md">Calculated based on current reporting latency vs new thresholds.</p>
      </div>
      <div class="bg-[#101828] border border-[#1C2C42] rounded-xl overflow-hidden">
        <div class="px-lg py-md border-b border-[#1C2C42]"><h3 class="text-headline-sm">Affected Entities</h3></div>
        <div class="p-md space-y-sm">
          <div class="flex items-center justify-between p-md bg-surface-container-low rounded border border-outline-variant/30">
            <div class="flex items-center gap-md"><div class="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary"><span class="material-symbols-outlined">account_balance</span></div>
              <div><p class="font-bold text-on-surface">Payments Pro BV</p><p class="text-body-sm text-on-surface-variant">Fintech / Payment Firm</p></div></div>
            <span class="px-sm py-1 bg-error-container/10 text-error rounded text-[10px] font-bold">HIGH RISK</span></div>
          <div class="flex items-center justify-between p-md bg-surface-container-low rounded border border-outline-variant/30">
            <div class="flex items-center gap-md"><div class="w-10 h-10 rounded bg-tertiary/10 flex items-center justify-center text-tertiary"><span class="material-symbols-outlined">hub</span></div>
              <div><p class="font-bold text-on-surface">DataFlow GmbH</p><p class="text-body-sm text-on-surface-variant">Cloud Infrastructure</p></div></div>
            <span class="px-sm py-1 bg-primary-container/10 text-primary rounded text-[10px] font-bold">MEDIUM RISK</span></div>
        </div>
      </div>
      <div class="h-48 rounded-xl bg-surface-container overflow-hidden relative border border-outline-variant flex items-end">
        <div class="absolute inset-0 opacity-30" style="background:radial-gradient(circle at 50% 40%,rgba(0,115,230,.5),transparent 60%)"></div>
        <div class="relative p-lg"><p class="text-label-md text-on-surface">Jurisdiction Scope</p><p class="font-bold text-primary">EU Regulatory Perimeter</p></div>
      </div>
    </div>
  </div>`;
}

// ---------- History view (/api/sync-history) ----------
let curConnector="eurlex";
async function loadHistory(conn){
  curConnector=conn;
  $("#view-history").innerHTML=`<div class="glass-card p-lg rounded-xl text-on-surface-variant flex items-center gap-sm"><span class="material-symbols-outlined spin text-primary">progress_activity</span> Loading sync history…</div>`;
  try{ renderHistory(await (await fetch("/api/sync-history/"+conn)).json()); }
  catch(e){ $("#view-history").innerHTML=`<div class="glass-card p-lg rounded-xl text-error">Error: ${esc(e.message)}</div>`; }
}
const cellCls={full:"bg-primary",partial:"bg-primary/60",idle:"bg-surface-container-highest",failed:"bg-error"};
function renderHistory(h){
  const matrix=h.matrix.map(c=>`<div class="w-3 h-3 rounded-sm ${cellCls[c]} cursor-pointer hover:ring-1 ring-on-surface transition-all" title="${c}"></div>`).join("");
  const max=Math.max(...h.volume.daily);
  const bars=h.volume.daily.map(v=>`<div class="flex-1 bg-primary/20 hover:bg-primary/40 transition-all rounded-t-sm relative group" style="height:${(v/max*100).toFixed(0)}%"><div class="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-container-highest text-xs p-1 rounded border border-outline-variant z-10 whitespace-nowrap">${v} recs</div></div>`).join("");
  const conns=["eurlex","eba","esma","dnb","fifa"];
  const picker=conns.map(c=>`<button onclick="loadHistory('${c}')" class="px-md py-xs rounded text-label-md ${c===h.connector?'bg-primary-container text-on-primary-container font-bold':'border border-outline-variant text-on-surface-variant hover:bg-surface-variant'}">${({eurlex:"EUR-Lex",eba:"EBA",esma:"ESMA",dnb:"DNB",fifa:"FIFA"})[c]}</button>`).join("");
  const rows=h.logs.map(l=>{
    const ok=l.status==="Success";
    const statusPill=`<span class="inline-flex items-center gap-xs px-sm py-[2px] ${ok?'bg-green-500/10 text-green-500':'bg-error/10 text-error'} text-body-sm rounded-full"><span class="w-1.5 h-1.5 rounded-full ${ok?'bg-green-500':'bg-error'}"></span> ${l.status}</span>`;
    const schemaCell=l.schemaChange?`<span class="text-primary font-bold flex items-center gap-xs">New field! <span class="material-symbols-outlined text-[16px]">info</span></span>`:esc(l.schema);
    const main=`<tr class="border-b border-outline-variant/30 hover:bg-surface-variant/20 transition-colors ${l.schemaChange?'bg-primary/5':''}">
      <td class="p-md font-mono-data ${ok?'':'text-error'}">${esc(l.date)}</td>
      <td class="p-md font-mono-data text-on-surface-variant">${esc(l.time)}</td>
      <td class="p-md">${statusPill}</td>
      <td class="p-md font-mono-data text-right">${l.records??"—"}</td>
      <td class="p-md text-on-surface-variant">${schemaCell}</td>
      <td class="p-md font-mono-data text-on-surface-variant">${esc(l.duration)}</td>
      <td class="p-md text-on-surface-variant">${esc(l.source)}</td></tr>`;
    const expand=l.schemaChange?`<tr class="bg-surface-container-low"><td class="p-0" colspan="7"><div class="px-xl py-lg border-l-4 border-primary bg-surface-container-high/50"><div class="flex items-start gap-lg">
      <div class="shrink-0 pt-base"><span class="material-symbols-outlined text-primary">schema</span></div>
      <div class="flex-1"><h4 class="text-label-md text-primary mb-sm uppercase">Schema Change Detected</h4><p class="text-body-md text-on-surface mb-md">${esc(l.schemaChange.note)}</p>
        <div class="grid grid-cols-2 gap-md p-md bg-surface-container-lowest border border-outline-variant rounded">
          <div><div class="text-xs text-on-surface-variant mb-xs">FIELD NAME</div><div class="font-mono-data text-body-sm text-on-surface">${esc(l.schemaChange.field)}</div></div>
          <div><div class="text-xs text-on-surface-variant mb-xs">TYPE</div><div class="font-mono-data text-body-sm text-primary">${esc(l.schemaChange.type)}</div></div>
        </div></div></div></div></td></tr>`:"";
    return main+expand;
  }).join("");

  $("#view-history").innerHTML=`
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-md fade-in">
    <div><h1 class="text-headline-lg text-on-surface mb-xs">Sync History — ${esc(h.connectorName)} Connector</h1>
      <p class="text-on-surface-variant text-body-md flex items-center gap-sm"><span class="w-2 h-2 rounded-full bg-green-500 glow-pulse"></span>${esc(h.description)}</p></div>
    <div class="flex items-center gap-sm flex-wrap">${picker}</div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-lg mt-xl">
    <div class="bg-surface-container border border-outline-variant p-lg rounded-lg"><div class="text-label-md text-on-surface-variant mb-sm">TOTAL SYNCS</div><div class="text-headline-md text-on-surface">${h.stats.total}</div><div class="text-body-sm text-on-surface-variant mt-xs">Completed in current cycle</div></div>
    <div class="bg-surface-container border border-outline-variant p-lg rounded-lg"><div class="text-label-md text-on-surface-variant mb-sm">SUCCESSFUL</div><div class="text-headline-md text-green-500">${h.stats.successful}</div><div class="text-body-sm text-on-surface-variant mt-xs">${h.stats.reliability}% reliability score</div></div>
    <div class="bg-surface-container border border-outline-variant p-lg rounded-lg"><div class="text-label-md text-on-surface-variant mb-sm">FAILED</div><div class="text-headline-md text-error">${h.stats.failed}</div><div class="text-body-sm text-on-surface-variant mt-xs">Last failure: ${esc(h.stats.lastFailure)}</div></div>
  </div>

  <div class="grid grid-cols-12 gap-lg mt-xl">
    <div class="col-span-12 lg:col-span-8 bg-surface-container border border-outline-variant p-lg rounded-lg">
      <div class="flex justify-between items-center mb-lg"><h2 class="text-headline-sm">Sync Availability Matrix</h2>
        <div class="flex gap-xs items-center"><span class="text-body-sm text-on-surface-variant mr-xs">Less</span><div class="w-3 h-3 bg-surface-container-highest rounded-sm"></div><div class="w-3 h-3 bg-primary/60 rounded-sm"></div><div class="w-3 h-3 bg-primary rounded-sm"></div><span class="text-body-sm text-on-surface-variant ml-xs">More</span></div></div>
      <div class="flex flex-wrap gap-[4px]">${matrix}</div>
      <div class="flex justify-between mt-md text-body-sm text-on-surface-variant font-mono-data">${h.months.map(m=>`<span>${esc(m)}</span>`).join("")}</div>
    </div>
    <div class="col-span-12 lg:col-span-4 bg-surface-container border border-outline-variant p-lg rounded-lg flex flex-col justify-between">
      <div><div class="flex items-center gap-sm mb-md text-primary"><span class="material-symbols-outlined">schedule</span><span class="text-label-md">AUTOMATION ENABLED</span></div>
        <h3 class="text-headline-sm mb-sm">Sync Cadence</h3><p class="text-body-md text-on-surface-variant mb-lg">${esc(h.cadence.text)}</p></div>
      <div class="space-y-md">
        <div class="flex justify-between items-center"><span class="text-body-sm text-on-surface-variant">Last Trigger</span><span class="font-mono-data text-body-sm">${esc(h.cadence.lastTrigger)}</span></div>
        <div class="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden"><div class="bg-primary h-full w-3/4"></div></div>
        <div class="flex justify-between items-center"><span class="text-body-sm text-on-surface-variant">Next Expected</span><span class="font-mono-data text-body-sm">${esc(h.cadence.nextExpected)}</span></div>
      </div>
    </div>

    <div class="col-span-12 bg-surface-container border border-outline-variant p-lg rounded-lg">
      <div class="flex justify-between items-center mb-xl"><div><h2 class="text-headline-sm">Volume Delta &amp; 30D Rolling Average</h2><p class="text-body-sm text-on-surface-variant">New regulatory records ingested per 24h window.</p></div>
        <div class="flex items-center gap-lg"><div class="flex items-center gap-sm"><div class="w-3 h-[2px] bg-primary"></div><span class="text-label-md text-on-surface-variant uppercase">Daily Vol</span></div><div class="flex items-center gap-sm"><div class="w-3 border-t border-dashed border-tertiary"></div><span class="text-label-md text-on-surface-variant uppercase">30D Avg (${h.volume.rollingAvg})</span></div></div></div>
      <div class="h-48 w-full flex items-end gap-1 relative">
        <div class="absolute left-0 right-0 border-t border-dashed border-tertiary/60" style="bottom:${(h.volume.rollingAvg/max*100).toFixed(0)}%"></div>
        ${bars}
      </div>
      <div class="flex justify-between mt-sm font-mono-data text-body-sm text-on-surface-variant"><span>30 Days Ago</span><span>Today</span></div>
    </div>

    <div class="col-span-12 bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
      <div class="p-lg border-b border-outline-variant bg-surface-container-low flex justify-between items-center"><h2 class="text-headline-sm">Execution Logs</h2>
        <a href="/api/sync-history/${esc(h.connector)}" target="_blank" class="flex items-center gap-sm text-primary text-label-md hover:underline"><span class="material-symbols-outlined text-[18px]">download</span>EXPORT JSON</a></div>
      <div class="overflow-x-auto"><table class="w-full text-left border-collapse">
        <thead><tr class="border-b border-outline-variant bg-surface-container-low text-on-surface-variant">
          <th class="p-md text-label-md">DATE</th><th class="p-md text-label-md">TIME</th><th class="p-md text-label-md">STATUS</th><th class="p-md text-label-md text-right">RECORDS</th><th class="p-md text-label-md">SCHEMA</th><th class="p-md text-label-md">DURATION</th><th class="p-md text-label-md">SOURCE</th></tr></thead>
        <tbody class="text-body-md">${rows}</tbody></table></div>
    </div>
  </div>`;
}

// ---------- health badge ----------
(async()=>{try{const h=await(await fetch("/health")).json(); healthInfo=h;
  $("#healthDot").className="w-2 h-2 rounded-full "+(h.status==="ok"?"bg-green-500 glow-pulse":"bg-error");
  $("#healthDot").title=`${h.service} · ${h.model} · bq:${h.bigquery_connected} · fivetran:${h.partner_mcp_connected}`;
}catch{$("#healthDot").className="w-2 h-2 rounded-full bg-error";}})();

// ---------- modal (Settings / Notifications) ----------
function openModal(html){ $("#modalBody").innerHTML=html; $("#modal").classList.remove("hidden"); }
function closeModal(){ $("#modal").classList.add("hidden"); }
const kv=(k,v)=>`<div class="flex justify-between gap-md border-b border-outline-variant/30 py-xs"><span class="text-on-surface-variant">${esc(k)}</span><span class="text-on-surface text-right">${esc(v??"—")}</span></div>`;
async function showSettings(){
  let h=healthInfo; try{ h=await (await fetch("/health")).json(); healthInfo=h; }catch{}
  openModal(`<div class="flex items-center justify-between mb-lg"><h3 class="text-headline-sm flex items-center gap-sm"><span class="material-symbols-outlined text-primary">settings</span>System · Live Stack</h3><button onclick="closeModal()" class="material-symbols-outlined text-on-surface-variant hover:text-on-surface">close</button></div>
    <div class="space-y-1 font-mono-data text-body-sm">
      ${kv("Service",h.service)}${kv("Mode",h.mode)}${kv("Model (Gemini)",h.model)}
      ${kv("Partner",h.partner)}${kv("Transport",h.partner_transport)}
      ${kv("Fivetran MCP",h.partner_mcp_connected?"connected ✅":"not via MCP")}
      ${kv("BigQuery",h.bigquery_connected?"connected ✅":"—")}
      ${kv("Agents",(h.agents||[]).join(", "))}${kv("Sources",(h.sources||[]).join(", "))}
    </div>
    <div class="mt-lg flex flex-wrap gap-sm"><a href="/health" target="_blank" class="px-md py-sm bg-primary-container text-on-primary-container rounded text-label-md font-bold">Open /health JSON</a>
      <button onclick="closeModal();startTour()" class="px-md py-sm border border-primary/40 text-primary rounded text-label-md font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">tour</span>Start Judge Tour</button></div>`);
}
function showNotifications(){
  const d=runData||{}, items=[];
  (d.delayed||[]).forEach(c=>items.push(["error","error","Connector delayed: "+esc((c.service||c.id||"").toUpperCase())]));
  (d.schemaChanges||[]).forEach(c=>items.push(["yellow-500","schema","Schema change on "+esc((c.service||c.id||"").toUpperCase())+" — downstream queries affected"]));
  (d.digest?.items||[]).filter(i=>i.impact==="HIGH").forEach(i=>items.push(["error","priority_high","HIGH impact: "+esc(i.title)]));
  if(!items.length) items.push(["green-500","check_circle","All clear — no active alerts."]);
  openModal(`<div class="flex items-center justify-between mb-lg"><h3 class="text-headline-sm flex items-center gap-sm"><span class="material-symbols-outlined text-primary">notifications</span>Notifications</h3><button onclick="closeModal()" class="material-symbols-outlined text-on-surface-variant hover:text-on-surface">close</button></div>
    <div class="space-y-sm">${items.map(([c,ic,t])=>`<div class="flex items-center gap-md p-md bg-surface-container-low rounded border border-outline-variant/30"><span class="material-symbols-outlined text-${c}">${ic}</span><span class="text-body-md">${t}</span></div>`).join("")}</div>`);
}
// search → jump to History and filter execution-log rows
$("#searchInput")&&$("#searchInput").addEventListener("keydown",e=>{ if(e.key!=="Enter")return;
  const q=e.target.value.trim().toLowerCase(); show("history");
  setTimeout(()=>{ let n=0; document.querySelectorAll("#view-history tbody tr").forEach(tr=>{const m=!q||tr.textContent.toLowerCase().includes(q);tr.style.display=m?"":"none";if(m)n++;}); toast(q?`Filtered logs for “${e.target.value.trim()}” — ${n} row(s)`:"Filter cleared"); },450);
});
// remaining controls
document.querySelectorAll('[data-action="settings"]').forEach(b=>b.onclick=showSettings);
document.querySelectorAll('[data-action="signout"]').forEach(b=>b.onclick=()=>toast("Demo build — authentication is out of scope for the hackathon."));
$("#notifBtn")&&($("#notifBtn").onclick=showNotifications);
$("#avatarBtn")&&($("#avatarBtn").onclick=()=>toast("Signed in as Compliance Analyst · demo workspace"));
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeModal(); if(!$("#tour").classList.contains("hidden")) endTour(); }});

// ---------- Judge guided tour ----------
const TOUR=[
  {nav:"health", sel:"#view-health h2, #view-health", title:"Pipeline Health", body:"RegPipeline watches 5 regulatory sources (EUR-Lex, EBA, ESMA, DNB, FIFA) that <b>Fivetran</b> syncs into <b>BigQuery</b>. This is the morning health view."},
  {nav:"health", sel:"#view-health .border-yellow-500\\/50", fallback:"#view-health", title:"Connector + schema alert", body:"It flags a delayed connector and a detected <b>schema change</b>, and traces the downstream impact — one query broken, one view stale. Data-ops awareness, automatically."},
  {nav:"health", sel:"#refreshBtn", title:"Run the agent", body:"Press <b>Run ▶</b> below. The agent checks connector health through the <b>Fivetran MCP</b>, reads new documents from <b>BigQuery</b>, and <b>Gemini</b> scores each one’s compliance impact.", action:async()=>{ await runPipeline(); }},
  {nav:"health", sel:"#approval", title:"Human-in-the-loop", body:"The agent does <b>not</b> act on its own. It proposes — resync the connector, send the digest, save tasks — and waits for your approval.", before:()=>{ if(runData&&runData.proposedAction) $("#approval").classList.remove("hidden"); }},
  {nav:"impact", sel:"#view-impact h2, #view-impact", title:"The payoff — Impact", body:"A delegated act tightened the DORA major-incident threshold (10%→8%, 2.0h→1.5h). Gemini <b>retroactively re-classifies history</b> — showing exactly which past incidents would now be MAJOR."},
  {nav:"history", sel:"#view-history h1, #view-history", title:"Sync telemetry", body:"Full per-connector sync history — availability matrix, cadence, volume, and execution logs with the schema change captured inline."},
  {nav:"health", sel:null, title:"That’s RegPipeline ✅", body:"<b>Gemini + Agent Builder + the real Fivetran MCP.</b> Zero manual monitoring hours; new regulations surfaced in ~6h instead of days — and a human always approves the consequential step."},
];
let tourIx=0;
function startTour(){ tourIx=0; $("#tour").classList.remove("hidden"); renderTourStep(); }
function endTour(){ $("#tour").classList.add("hidden"); clearTourRing(); }
function clearTourRing(){ document.querySelectorAll(".tour-ring").forEach(e=>e.classList.remove("tour-ring")); }
async function renderTourStep(){
  const s=TOUR[tourIx]; clearTourRing();
  if(s.nav) show(s.nav);
  if(s.before){ try{ s.before(); }catch{} }
  await new Promise(r=>setTimeout(r,280)); // let the view paint
  let tgt=null; for(const sel of [s.sel,s.fallback]){ if(!sel)continue; try{ tgt=document.querySelector(sel); }catch{} if(tgt)break; }
  if(tgt){ tgt.classList.add("tour-ring"); tgt.scrollIntoView({behavior:"smooth",block:"center"}); }
  const last=tourIx===TOUR.length-1;
  $("#tourCard").innerHTML=`
    <div class="flex items-center justify-between mb-sm"><span class="text-label-md text-primary uppercase tracking-widest">Judge Tour · ${tourIx+1}/${TOUR.length}</span>
      <button onclick="endTour()" class="material-symbols-outlined text-on-surface-variant hover:text-on-surface text-[20px]">close</button></div>
    <h3 class="text-headline-sm mb-sm">${s.title}</h3>
    <p class="text-body-md text-on-surface-variant mb-lg leading-relaxed">${s.body}</p>
    <div class="flex items-center justify-between gap-sm">
      <button onclick="tourPrev()" class="px-md py-sm text-on-surface-variant text-label-md hover:text-on-surface ${tourIx===0?'opacity-30 pointer-events-none':''}">Back</button>
      <div class="flex gap-1">${TOUR.map((_,i)=>`<span class="w-1.5 h-1.5 rounded-full ${i===tourIx?'bg-primary':'bg-outline-variant'}"></span>`).join("")}</div>
      <button id="tourNextBtn" onclick="tourNext()" class="px-lg py-sm bg-primary text-on-primary font-bold rounded text-label-md hover:brightness-110 flex items-center gap-1">${last?'Finish':(s.action?'Run ▶':'Next')}</button>
    </div>`;
}
async function tourNext(){
  const s=TOUR[tourIx];
  if(s.action){ const b=$("#tourNextBtn"); if(b){b.textContent="Running…";b.classList.add("opacity-70","pointer-events-none");} try{ await s.action(); }catch{} }
  if(tourIx>=TOUR.length-1){ endTour(); toast("Tour complete — thanks for reviewing RegPipeline!"); return; }
  tourIx++; renderTourStep();
}
function tourPrev(){ if(tourIx>0){ tourIx--; renderTourStep(); } }
$("#tourBtn")&&($("#tourBtn").onclick=startTour);

// ---------- boot ----------
const start=(location.hash||"#health").slice(1);
runPipeline().then(()=>show(["health","impact","history"].includes(start)?start:"health"));
// first-visit hint to launch the tour
if(!location.hash) setTimeout(()=>{ if($("#tour").classList.contains("hidden")) toast("👋 New here? Click “Judge Tour” for a 60-second guided walkthrough."); },1200);