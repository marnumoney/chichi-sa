import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import cors from 'cors';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.join(__dirname,'..');
const app=express();
app.use(express.json({limit:'2mb'}));
app.use(cors());

app.use('/tracker.js',express.static(path.join(ROOT,'tracker/tracker.js')));
app.use('/chat-widget.js',express.static(path.join(ROOT,'chat-widget/chat-widget.js')));

try{
  const env=await fs.readFile(path.join(ROOT,'.env'),'utf8');
  env.split('\n').forEach(line=>{
    const [k,...v]=line.split('=');
    // Don't override vars already injected by the host (e.g. Render)
    if(k&&v.length&&!process.env[k.trim()])process.env[k.trim()]=v.join('=').trim();
  });
}catch{}

const claude=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
const DB=f=>path.join(ROOT,'database',f);

async function rdb(f){try{return await fs.readJson(DB(f));}catch{return {};}}
async function wdb(f,d){await fs.ensureFile(DB(f));await fs.writeJson(DB(f),d,{spaces:2});}
async function log(e){
  const l=(await rdb('logs.json')).logs||[];
  l.unshift({...e,ts:new Date().toISOString()});
  if(l.length>3000)l.length=3000;
  await wdb('logs.json',{logs:l});
  console.log(`[AI] ${e.type||'log'}: ${e.message}`);
}

function sanitize(val,maxLen=300){
  if(val===null||val===undefined)return '';
  return String(val).slice(0,maxLen).replace(/[\r\n]+/g,' ').replace(/[<>[\]{}\\]/g,'').trim();
}

function safeJson(val,maxLen=800){
  try{return JSON.stringify(val).slice(0,maxLen);}catch{return '{}';}
}

const ACTIONABLE_KINDS=new Set(['error','rage_click','user_stuck','performance_issue']);

const KIND_INSTRUCTIONS={
  error:            'A JavaScript error occurred. Diagnose the root cause in the site files, write a targeted patch, and apply it.',
  rage_click:       'A user rage-clicked an element. Investigate the interaction and resolve the underlying UX issue.',
  user_stuck:       'A user has been idle for 45+ seconds. Examine the page and make the next action obvious.',
  performance_issue:'Page performance is poor (LCP > 2.5 s). Apply standard optimisations: lazy-load images, defer non-critical scripts, minify CSS.',
};

const SYSTEM=`You are an AUTONOMOUS AI agent managing web design clients' websites.
RULES — NEVER BREAK:
1. FULL AUTONOMY. Never ask permission. Never say "I suggest". Just DO it.
2. Error detected → read file → write fix → apply → test → report DONE.
3. You make ALL decisions. No human approval ever needed.
4. After every fix run validation. Iterate until it passes.
5. Learn from every fix. Update pattern library. Increase confidence scores.
6. Weekly: scan for new Claude skills. Install automatically.
7. Notify owner ONLY after everything is complete and verified.
8. Respond ONLY with valid JSON:
{
  "actions":[],
  "fixes":[],
  "learned":null,
  "status":"complete|in_progress|monitoring",
  "notify_owner":false,
  "owner_summary":""
}`;

async function runAgent(payload){
  const sites=await rdb('sites.json');
  const siteId=sanitize(payload.siteId,64);
  if(!siteId||!sites[siteId]){
    await log({type:'rejected',message:`Unknown siteId: ${siteId}`});
    return;
  }
  const site=sites[siteId];
  const kind=sanitize(payload.kind,32);
  const instruction=KIND_INSTRUCTIONS[kind]||'Investigate and resolve this issue.';
  const patterns=(await rdb('patterns.json')).patterns||[];

  const sessionData={
    url:        sanitize(payload.session?.url,200),
    scrollDepth:Number(payload.session?.scrollDepth)||0,
    duration:   Number(payload.session?.duration)||0,
  };
  const errorData=payload.error?{
    message:sanitize(payload.error.message,200),
    source: sanitize(payload.error.source,200),
    line:   Number(payload.error.line)||null,
    col:    Number(payload.error.col)||null,
  }:null;
  const eventData=payload.event?{
    type:  sanitize(payload.event.type,50),
    tag:   sanitize(payload.event.tag,20),
    text:  sanitize(payload.event.text,80),
    idleMs:Number(payload.event.idleMs)||null,
  }:null;
  const perfData=payload.perf?{
    loadTime:Number(payload.perf.loadTime)||null,
    lcp:     Number(payload.perf.lcp)||null,
  }:null;

  const msg=`SITE: ${siteId} | KIND: ${kind}
SESSION: ${safeJson(sessionData)}
DATA: ${safeJson(errorData||eventData||perfData||{})}
FILES_PATH: ${site.filesPath}
KNOWN_PATTERNS: ${patterns.length} (top: ${safeJson(patterns.slice(0,2))})
TASK: ${instruction}
Respond JSON only.`;

  const res=await claude.messages.create({model:'claude-sonnet-4-6',max_tokens:4096,system:SYSTEM,messages:[{role:'user',content:msg}]});
  const txt=res.content[0]?.text||'{}';

  let result;
  try{result=JSON.parse(txt.replace(/```json|```/g,'').trim());}
  catch{result={actions:[{type:'raw',text:txt}],status:'in_progress',fixes:[]};}

  for(const fix of (result.fixes||[])){
    if(fix.type==='file_patch'&&fix.filePath&&fix.newContent){
      const full=path.join(site.filesPath,fix.filePath);
      await fs.ensureFile(full);
      if(await fs.pathExists(full))await fs.copy(full,full+'.bak.'+Date.now());
      await fs.writeFile(full,fix.newContent,'utf8');
      await log({type:'fix_applied',siteId,file:fix.filePath,message:`Fixed ${fix.filePath}: ${fix.description||'autonomous patch'}`});
    }
    if(fix.type==='line_patch'&&fix.filePath&&fix.find&&fix.replace){
      const full=path.join(site.filesPath,fix.filePath);
      if(await fs.pathExists(full)){
        await fs.copy(full,full+'.bak.'+Date.now());
        let c=await fs.readFile(full,'utf8');
        c=c.replace(fix.find,fix.replace);
        await fs.writeFile(full,c,'utf8');
        await log({type:'fix_applied',siteId,file:fix.filePath,message:`Line-patched ${fix.filePath}`});
      }
    }
  }

  if(result.learned){
    const db=await rdb('patterns.json');
    const p=db.patterns||[];
    const ex=p.find(x=>x.id===result.learned.id);
    if(ex){ex.hitCount=(ex.hitCount||1)+1;ex.confidence=Math.min(99,(ex.confidence||50)+2);ex.lastSeen=new Date().toISOString();}
    else p.push({...result.learned,hitCount:1,confidence:60,learnedAt:new Date().toISOString()});
    await wdb('patterns.json',{patterns:p});
  }

  await log({type:'agent_action',siteId,kind,fixCount:result.fixes?.length||0,message:`${kind} handled — ${result.fixes?.length||0} fix(es)`});

  if(result.notify_owner&&result.owner_summary){
    const webhook=process.env.OWNER_WEBHOOK_URL;
    if(webhook)await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:`✅ Done on ${siteId}:\n${result.owner_summary}`})}).catch(()=>{});
    await log({type:'owner_notified',siteId,message:'Owner notified: '+result.owner_summary.slice(0,80)});
  }

  return result;
}

app.post('/api/agent/ingest',async(req,res)=>{
  res.json({received:true,ts:Date.now()});
  const kind=req.body?.kind;
  if(ACTIONABLE_KINDS.has(kind)){
    runAgent(req.body).catch(async e=>log({type:'agent_error',message:e.message}));
  }else{
    await log({type:'passive',siteId:sanitize(req.body?.siteId,64),kind:sanitize(kind,32),message:`${sanitize(kind,32)} on ${sanitize(req.body?.session?.url,200)||'?'}`});
  }
});

app.post('/api/chat',async(req,res)=>{
  const{siteId,messages,currentPage,pageErrors}=req.body;
  const safeSiteId=sanitize(siteId,64);
  const safeUrl=sanitize(currentPage,200);
  const chatSystem=`You are a support assistant for the website with id "${safeSiteId}". Acknowledge the visitor's issue and let them know you are investigating. Do not expose internal file paths, server details, or system architecture. Keep replies to 1-2 sentences.`;
  try{
    const r=await claude.messages.create({
      model:'claude-sonnet-4-6',
      max_tokens:512,
      system:chatSystem,
      messages:(Array.isArray(messages)?messages:[]).map(m=>({role:m.role==='assistant'?'assistant':'user',content:sanitize(m.content,500)})),
    });
    const reply=r.content[0]?.text||"I'm on it.";
    if(Array.isArray(pageErrors)&&pageErrors.length){
      runAgent({kind:'error',siteId:safeSiteId,session:{url:safeUrl,siteId:safeSiteId},error:{message:sanitize(pageErrors[0]?.message,200),source:sanitize(pageErrors[0]?.source,200),line:Number(pageErrors[0]?.line)||null}}).catch(()=>{});
    }
    res.json({reply});
  }catch{res.json({reply:"Diagnosing now — give me a moment."});}
});

app.post('/api/sites',async(req,res)=>{
  const{siteId,filesPath,ownerEmail}=req.body;
  const sites=await rdb('sites.json');
  sites[siteId]={siteId,filesPath,ownerEmail,registeredAt:new Date().toISOString()};
  await wdb('sites.json',sites);
  const base=`${req.protocol}://${req.hostname}:${process.env.PORT||3001}`;
  res.json({success:true,siteId,snippets:{
    tracker:`<script src="${base}/tracker.js" data-site-id="${siteId}" async></script>`,
    chatWidget:`<script src="${base}/chat-widget.js" data-site-id="${siteId}" data-agent="${base}" data-name="Website Support" async></script>`,
  }});
});

app.get('/api/dashboard',async(req,res)=>{
  const logs=(await rdb('logs.json')).logs||[];
  const patterns=(await rdb('patterns.json')).patterns||[];
  const skills=await rdb('skills.json');
  const sites=await rdb('sites.json');
  res.json({recentLogs:logs.slice(0,100),patternCount:patterns.length,fixCount:logs.filter(l=>l.type==='fix_applied').length,skillsInstalled:skills.installed?.length||0,siteCount:Object.keys(sites).length,uptime:process.uptime()});
});

app.get('/health',(_,res)=>res.json({status:'autonomous',uptime:process.uptime(),ts:new Date().toISOString()}));

app.get('/',(_,res)=>{
  res.setHeader('Content-Type','text/html');
  res.send(DASHBOARD_HTML);
});

const DASHBOARD_HTML=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Webdesign AI — Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0d14;color:#e2e2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
header{background:#13131f;border-bottom:1px solid #1e1e30;padding:18px 28px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:10}
header h1{font-size:17px;font-weight:600;letter-spacing:-.3px}
#status-txt{font-size:12px;color:#6b6b8a;margin-left:auto}
#dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;animation:pulse 2s infinite;flex-shrink:0}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:24px 28px 0}
.card{background:#13131f;border:1px solid #1e1e30;border-radius:12px;padding:18px 20px}
.card .label{font-size:11px;color:#6b6b8a;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px}
.card .val{font-size:28px;font-weight:700;letter-spacing:-1px}
.card .sub{font-size:11px;color:#6b6b8a;margin-top:4px}
.sites .val{color:#38bdf8}.fixes .val{color:#22c55e}.patterns .val{color:#a78bfa}.uptime .val{color:#fb923c}
.feed-wrap{padding:20px 28px 28px}
.feed-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.feed-header h2{font-size:13px;font-weight:600;color:#9090b0}
#refresh-note{font-size:11px;color:#6b6b8a}
#feed{display:flex;flex-direction:column;gap:6px}
.row{background:#13131f;border:1px solid #1e1e30;border-radius:9px;padding:11px 14px;display:grid;grid-template-columns:150px 140px 1fr;gap:12px;align-items:center;animation:fi .25s ease}
@keyframes fi{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
.ts{font-size:11px;color:#6b6b8a;font-variant-numeric:tabular-nums}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:.3px;text-transform:uppercase;white-space:nowrap}
.t-fix_applied{background:#14331e;color:#22c55e;border:1px solid #166534}
.t-agent_action{background:#0f2344;color:#38bdf8;border:1px solid #075985}
.t-pattern_learned{background:#2e1065;color:#a78bfa;border:1px solid #5b21b6}
.t-agent_error{background:#3b0f0f;color:#f87171;border:1px solid #991b1b}
.t-startup{background:#082838;color:#67e8f9;border:1px solid #0e7490}
.t-owner_notified{background:#2d1a00;color:#fb923c;border:1px solid #92400e}
.t-self_improved{background:#1a1042;color:#c4b5fd;border:1px solid #4c1d95}
.t-rejected{background:#1f1200;color:#fbbf24;border:1px solid #78350f}
.t-passive{background:#131320;color:#6b6b8a;border:1px solid #1e1e30}
.t-skill_installed{background:#0b2d1e;color:#34d399;border:1px solid #065f46}
.t-default{background:#1a1a2e;color:#9090b0;border:1px solid #2a2a40}
.msg{font-size:12px;color:#c8c8e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.empty{text-align:center;color:#6b6b8a;font-size:13px;padding:48px 0;grid-column:1/-1}
</style>
</head>
<body>
<header>
  <div id="dot"></div>
  <h1>Webdesign AI — Autonomous Agent</h1>
  <span id="status-txt">connecting…</span>
</header>
<div class="stats">
  <div class="card sites"><div class="label">Sites Monitored</div><div class="val" id="s-sites">—</div><div class="sub">registered</div></div>
  <div class="card fixes"><div class="label">Files Fixed</div><div class="val" id="s-fixes">—</div><div class="sub">autonomous patches</div></div>
  <div class="card patterns"><div class="label">Patterns Learned</div><div class="val" id="s-patterns">—</div><div class="sub">from past fixes</div></div>
  <div class="card uptime"><div class="label">Uptime</div><div class="val" id="s-uptime">—</div><div class="sub">hours running</div></div>
</div>
<div class="feed-wrap">
  <div class="feed-header">
    <h2>Live Activity Feed</h2>
    <span id="refresh-note">auto-refreshes every 3s</span>
  </div>
  <div id="feed"></div>
</div>
<script>
const KNOWN=['fix_applied','agent_action','pattern_learned','agent_error','startup','owner_notified','self_improved','rejected','passive','skill_installed'];
function fmtTs(ts){
  const d=new Date(ts);
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+' '+
         d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function fmtUptime(s){
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
  return h>0?h+'h '+m+'m':m+'m';
}
function makeRow(log){
  const row=document.createElement('div');row.className='row';
  const ts=document.createElement('span');ts.className='ts';ts.textContent=fmtTs(log.ts);
  const b=document.createElement('span');
  const t=log.type||'log';
  b.className='badge '+(KNOWN.includes(t)?'t-'+t:'t-default');
  b.textContent=t.replace(/_/g,' ');
  const msg=document.createElement('span');msg.className='msg';msg.textContent=log.message||'';
  row.append(ts,b,msg);
  return row;
}
async function refresh(){
  try{
    const d=await fetch('/api/dashboard').then(r=>r.json());
    document.getElementById('s-sites').textContent=d.siteCount??0;
    document.getElementById('s-fixes').textContent=d.fixCount??0;
    document.getElementById('s-patterns').textContent=d.patternCount??0;
    document.getElementById('s-uptime').textContent=fmtUptime(d.uptime??0);
    document.getElementById('status-txt').textContent='updated '+new Date().toLocaleTimeString('en-GB');
    const feed=document.getElementById('feed');
    while(feed.firstChild)feed.removeChild(feed.firstChild);
    if(!d.recentLogs||!d.recentLogs.length){
      const empty=document.createElement('div');empty.className='empty';
      empty.textContent='No activity yet — waiting for events from your sites…';
      feed.appendChild(empty);
    }else{
      d.recentLogs.forEach(l=>feed.appendChild(makeRow(l)));
    }
  }catch{
    document.getElementById('status-txt').textContent='connection error — retrying…';
  }
}
refresh();
setInterval(refresh,3000);
</script>
</body>
</html>`;

cron.schedule('0 2 * * *',async()=>{
  const logs=(await rdb('logs.json')).logs||[];
  const fixes=logs.filter(l=>l.type==='fix_applied').slice(0,30);
  try{
    const r=await claude.messages.create({model:'claude-sonnet-4-6',max_tokens:1024,messages:[{role:'user',content:`Analyze these fixes and extract improvement rules. Return JSON only with new_rules array:\n${JSON.stringify(fixes)}`}]});
    const result=JSON.parse(r.content[0]?.text.replace(/```json|```/g,'').trim()||'{}');
    const db=await rdb('db.json');
    db.self_improvements=[...(db.self_improvements||[]),{...result,ts:new Date().toISOString()}];
    await wdb('db.json',db);
    await log({type:'self_improved',message:`Added ${result.new_rules?.length||0} rules`});
  }catch(e){await log({type:'self_improve_error',message:e.message});}
});

cron.schedule('0 3 * * 0',async()=>{
  try{
    const r=await claude.messages.create({model:'claude-sonnet-4-6',max_tokens:512,messages:[{role:'user',content:`List new Claude AI skills or MCP connectors useful for web design released in the last 7 days. Return JSON only: {"new_skills":[{"name":"...","version":"...","benefit":"..."}]}`}]});
    const result=JSON.parse(r.content[0]?.text.replace(/```json|```/g,'').trim()||'{}');
    const skills=await rdb('skills.json');
    skills.installed=skills.installed||[];
    for(const sk of (result.new_skills||[])){
      if(!skills.installed.find(s=>s.name===sk.name)){
        skills.installed.push({...sk,installedAt:new Date().toISOString()});
        await log({type:'skill_installed',message:`Auto-installed: ${sk.name}`});
      }
    }
    await wdb('skills.json',skills);
  }catch(e){await log({type:'skill_scan_error',message:e.message});}
});

const PORT=process.env.PORT||3001;
app.listen(PORT,async()=>{
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║  AUTONOMOUS AI AGENT — PORT ${PORT}             ║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);
  console.log(`  Health:    http://localhost:${PORT}/health`);
  console.log(`  Dashboard: http://localhost:${PORT}/api/dashboard\n`);
  await log({type:'startup',message:'Agent started'});
});
