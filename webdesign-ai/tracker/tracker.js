(function(){
'use strict';
// document.currentScript is null for async scripts — query by data attribute instead
const _s=document.querySelector('script[data-site-id][src*="tracker"]');
const SITE_ID=_s?.getAttribute('data-site-id')||'unknown';
const AGENT=_s?.getAttribute('data-agent')||'https://webdesign-ai.onrender.com';
const SID=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2);
// Read role from localStorage — set by chichi auth on login ('admin'|'seller'|'buyer'|null)
const USER_ROLE=(function(){try{return localStorage.getItem('role')||'public';}catch{return 'public';}})();
const s={siteId:SITE_ID,sessionId:SID,start:Date.now(),url:location.href,errors:[],lastActivity:Date.now(),scrollDepth:0,rageClicks:{}};
function send(payload){
  const body=JSON.stringify({...payload,siteId:SITE_ID,sessionId:SID,userRole:USER_ROLE});
  if(navigator.sendBeacon)navigator.sendBeacon(AGENT+'/api/agent/ingest',body);
  else fetch(AGENT+'/api/agent/ingest',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
}
function emit(type,data){send({kind:'event',event:{type,data,ts:Date.now(),url:location.href},session:{siteId:SITE_ID,sessionId:SID,url:s.url,scrollDepth:s.scrollDepth,duration:Date.now()-s.start,userRole:USER_ROLE}});}
document.addEventListener('click',e=>{
  const t=e.target.closest('button,a,input,[role="button"]')||e.target;
  const k=Math.round(e.clientX/20)+'-'+Math.round(e.clientY/20);
  s.rageClicks[k]=(s.rageClicks[k]||0)+1;
  setTimeout(()=>{delete s.rageClicks[k];},600);
  const rage=s.rageClicks[k]>=3;
  emit('click',{tag:t.tagName,text:(t.innerText||'').slice(0,80),id:t.id||null,rage});
  if(rage)send({kind:'rage_click',session:{siteId:SITE_ID,sessionId:SID,url:location.href},event:{tag:t.tagName,text:(t.innerText||'').slice(0,60)}});
  s.lastActivity=Date.now();
},{passive:true});
document.addEventListener('scroll',()=>{
  const d=Math.round(((window.scrollY+window.innerHeight)/document.body.scrollHeight)*100);
  if(d>s.scrollDepth){s.scrollDepth=d;if(d%25===0)emit('scroll_milestone',{depth:d});}
  s.lastActivity=Date.now();
},{passive:true});
const origPush=history.pushState.bind(history);
history.pushState=function(...a){origPush(...a);emit('navigate',{from:s.url,to:location.href});s.url=location.href;};
window.addEventListener('popstate',()=>{emit('navigate',{from:s.url,to:location.href});s.url=location.href;});
document.addEventListener('submit',e=>{
  const f=e.target;
  emit('form_submit',{id:f.id||null,action:f.action||null,fields:Array.from(f.elements).map(el=>({name:el.name,type:el.type,empty:!el.value}))});
  s.lastActivity=Date.now();
});
document.addEventListener('focusout',e=>{
  if(e.target.matches('input,textarea')&&!e.target.value)emit('field_abandoned',{name:e.target.name||e.target.id,type:e.target.type});
});
window.addEventListener('error',e=>{
  const err={message:e.message,source:e.filename,line:e.lineno,col:e.colno,url:location.href,ts:Date.now()};
  s.errors.push(err);
  send({kind:'error',session:{siteId:SITE_ID,sessionId:SID,url:location.href,duration:Date.now()-s.start},error:err,priority:'high'});
});
window.addEventListener('unhandledrejection',e=>{
  const err={message:e.reason?.message||String(e.reason),type:'unhandled_promise',url:location.href,ts:Date.now()};
  s.errors.push(err);
  send({kind:'error',session:{siteId:SITE_ID,sessionId:SID,url:location.href},error:err,priority:'high'});
});
const oFetch=window.fetch;
window.fetch=async function(...a){
  try{const r=await oFetch(...a);if(!r.ok)emit('network_error',{url:a[0],status:r.status});return r;}
  catch(err){emit('network_error',{url:a[0],error:err.message});throw err;}
};
setInterval(()=>{
  const idle=Date.now()-s.lastActivity;
  if(idle>45000)send({kind:'user_stuck',session:{siteId:SITE_ID,sessionId:SID,url:location.href,scrollDepth:s.scrollDepth},event:{idleMs:idle}});
},15000);
window.addEventListener('load',()=>{
  setTimeout(()=>{
    const nav=performance.getEntriesByType('navigation')[0];
    const lcp=performance.getEntriesByType('largest-contentful-paint').slice(-1)[0];
    const perf={loadTime:Math.round(nav?.loadEventEnd-nav?.startTime),lcp:lcp?Math.round(lcp.startTime):null};
    emit('performance',perf);
    if(perf.lcp>2500)send({kind:'performance_issue',session:{siteId:SITE_ID,sessionId:SID,url:location.href},perf,priority:'medium'});
  },3000);
});
window.addEventListener('beforeunload',()=>{
  send({kind:'session_end',session:{siteId:SITE_ID,sessionId:SID,url:s.url,scrollDepth:s.scrollDepth,duration:Date.now()-s.start,errorCount:s.errors.length}});
});
window._aiErrors=s.errors;
console.log('[AI Monitor] Active — session',SID);
})();
