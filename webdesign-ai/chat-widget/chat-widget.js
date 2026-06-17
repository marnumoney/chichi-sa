(function(){
'use strict';
// document.currentScript is null for async scripts — query by data attribute instead
const _s=document.querySelector('script[data-site-id][src*="chat-widget"]');
const SITE_ID=_s?.getAttribute('data-site-id')||'unknown';
const AGENT=_s?.getAttribute('data-agent')||'https://webdesign-ai.onrender.com';
const NAME=_s?.getAttribute('data-name')||'Website Support';
const USER_ROLE=(function(){try{return localStorage.getItem('role')||'public';}catch{return 'public';}})();

const style=document.createElement('style');
style.textContent=`
#_aicb{position:fixed;bottom:24px;right:24px;z-index:9999;width:52px;height:52px;border-radius:50%;background:#534AB7;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;border:none;box-shadow:0 4px 16px rgba(83,74,183,.35);transition:transform .2s;}
#_aicb:hover{transform:scale(1.08);}
#_aicb.has-err::after{content:'';width:12px;height:12px;background:#E24B4A;border-radius:50%;position:absolute;top:2px;right:2px;border:2px solid #fff;}
#_aicw{position:fixed;bottom:88px;right:24px;z-index:9998;width:340px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.14);display:flex;flex-direction:column;overflow:hidden;transition:opacity .2s,transform .2s;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-height:480px;}
#_aicw.h{opacity:0;transform:translateY(12px);pointer-events:none;}
#_aich{background:#534AB7;color:#EEEDFE;padding:11px 14px;display:flex;align-items:center;gap:9px;}
#_aich .av{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
#_aich .ti{font-size:12px;font-weight:500;}
#_aich .su{font-size:10px;opacity:.7;margin-top:1px;}
#_aich .cl{margin-left:auto;background:none;border:none;color:#EEEDFE;cursor:pointer;font-size:20px;opacity:.7;line-height:1;padding:0;}
#_aims{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px;background:#f8f8fc;min-height:180px;max-height:280px;}
.ai-m{max-width:85%;padding:7px 11px;border-radius:11px;font-size:12px;line-height:1.5;}
.ai-m.b{background:#fff;border:1px solid #e8e8ef;align-self:flex-start;border-bottom-left-radius:2px;color:#1a1a2e;}
.ai-m.u{background:#534AB7;color:#fff;align-self:flex-end;border-bottom-right-radius:2px;}
.ai-m.t{opacity:.6;font-style:italic;}
#_aiqr{display:flex;flex-wrap:wrap;gap:4px;padding:0 10px 7px;}
.ai-q{padding:3px 9px;font-size:10px;border:1px solid #AFA9EC;border-radius:20px;background:#EEEDFE;color:#534AB7;cursor:pointer;font-family:inherit;}
.ai-q:hover{background:#AFA9EC;}
#_aiir{display:flex;gap:6px;padding:9px 10px;border-top:1px solid #eee;background:#fff;}
#_aiin{flex:1;padding:7px 11px;font-size:12px;border:1px solid #ddd;border-radius:20px;outline:none;font-family:inherit;color:#1a1a2e;}
#_aiin:focus{border-color:#534AB7;}
#_aisb{background:#534AB7;color:#fff;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
`;
document.head.appendChild(style);

const b=document.createElement('button');
b.id='_aicb';b.textContent='🤖';b.setAttribute('aria-label','Open support chat');
document.body.appendChild(b);

const w=document.createElement('div');
w.id='_aicw';w.classList.add('h');

const header=document.createElement('div');header.id='_aich';
const av=document.createElement('div');av.className='av';av.textContent='🤖';
const titleWrap=document.createElement('div');
const ti=document.createElement('div');ti.className='ti';ti.textContent=NAME;
const su=document.createElement('div');su.className='su';su.textContent='AI fixes issues instantly';
titleWrap.append(ti,su);
const closeBtn=document.createElement('button');
closeBtn.className='cl';closeBtn.id='_aicc';closeBtn.setAttribute('aria-label','Close');closeBtn.textContent='×';
header.append(av,titleWrap,closeBtn);

const msgs=document.createElement('div');msgs.id='_aims';

const qr=document.createElement('div');qr.id='_aiqr';
['Form won\'t submit','Page is slow','Menu is broken','Images missing'].forEach(text=>{
  const btn=document.createElement('button');btn.className='ai-q';btn.textContent=text;
  qr.appendChild(btn);
});

const ir=document.createElement('div');ir.id='_aiir';
const inp=document.createElement('input');
inp.id='_aiin';inp.type='text';inp.placeholder='Describe your issue...';inp.autocomplete='off';
const sendBtn=document.createElement('button');
sendBtn.id='_aisb';sendBtn.setAttribute('aria-label','Send');sendBtn.textContent='➤';
ir.append(inp,sendBtn);

w.append(header,msgs,qr,ir);
document.body.appendChild(w);

const hist=[];

function addMsg(role,text,typing=false){
  hist.push({role,content:text});
  const d=document.createElement('div');
  d.className='ai-m '+(role==='assistant'?'b':'u')+(typing?' t':'');
  d.textContent=typing?'Checking…':text;
  msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;
}

async function sendMsg(text){
  if(!text.trim())return;
  inp.value='';inp.disabled=true;qr.style.display='none';b.classList.remove('has-err');
  addMsg('user',text);
  const t=addMsg('assistant','',true);
  try{
    const r=await fetch(AGENT+'/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({siteId:SITE_ID,messages:hist,currentPage:location.href,pageErrors:window._aiErrors||[],userRole:USER_ROLE}),
    });
    const d=await r.json();
    t.remove();addMsg('assistant',d.reply||"I'm on it — fixing that now.");
  }catch{
    t.remove();addMsg('assistant',"I'm diagnosing this right now. Give me a moment.");
  }
  inp.disabled=false;inp.focus();
}

b.addEventListener('click',()=>{
  w.classList.toggle('h');
  if(!w.classList.contains('h')&&!hist.length)
    addMsg('assistant','Hi! I can see everything on this page and fix issues instantly. What\'s wrong?');
  if(!w.classList.contains('h'))inp.focus();
});
closeBtn.addEventListener('click',()=>w.classList.add('h'));
sendBtn.addEventListener('click',()=>sendMsg(inp.value));
inp.addEventListener('keydown',e=>{if(e.key==='Enter')sendMsg(inp.value);});
w.querySelectorAll('.ai-q').forEach(btn=>btn.addEventListener('click',()=>sendMsg(btn.textContent)));
window.addEventListener('error',()=>b.classList.add('has-err'));

console.log('[AI Chat] Widget active — site:',SITE_ID);
})();
