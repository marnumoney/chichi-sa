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
