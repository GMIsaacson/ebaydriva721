'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {chromium}=require('playwright');
const PORT=Number(process.env.PORT||8791),ROOT='/artifacts';
const VIEWPORTS={mobile:{width:390,height:844},tablet:{width:768,height:1024},desktop:{width:1440,height:1000}};
function safeId(v){const s=String(v||'');if(!/^[A-Za-z0-9._-]{8,120}$/.test(s))throw new Error('INVALID_COMMAND_ID');return s;}
function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
function allowed(target,id){const u=new URL(target);if(u.protocol==='https:'&&['capablehandscare.com','www.capablehandscare.com'].includes(u.hostname))return target;if(u.protocol==='file:'&&path.normalize(u.pathname)===`/artifacts/${safeId(id)}/index.html`)return target;throw new Error('TARGET_NOT_ALLOWED');}
async function body(req){let b='';for await(const c of req){b+=c;if(b.length>32768)throw new Error('BODY_TOO_LARGE');}return b?JSON.parse(b):{};}
async function render(id,target,prefix,fullPage=false){id=safeId(id);if(!/^(before|after(?:-r[1-5])?|full-after(?:-r[1-5])?)$/.test(prefix))throw new Error('INVALID_PREFIX');target=allowed(target,id);const out=path.join(ROOT,id,'screenshots');fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});const results={};try{for(const[name,vp]of Object.entries(VIEWPORTS)){const page=await browser.newPage({viewport:vp,deviceScaleFactor:1});await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});try{await page.waitForLoadState('networkidle',{timeout:8000});}catch{}await page.evaluate(()=>scrollTo(0,0));const p=path.join(out,`${prefix}-${name}.png`);await page.screenshot({path:p,fullPage:fullPage===true});results[name]={path:p,sha256:sha(p),bytes:fs.statSync(p).size,url:page.url(),title:await page.title()};await page.close();}}finally{await browser.close();}return results;}
async function audit(id,target){id=safeId(id);target=allowed(target,id);const browser=await chromium.launch({headless:true});const checks=[];const add=(id,ok,detail)=>checks.push({id,status:ok?'PASS':'FAIL',detail});let data={};try{const context=await browser.newContext({viewport:VIEWPORTS.mobile,reducedMotion:'reduce'});const page=await context.newPage();await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
 data=await page.evaluate(()=>({
  title:document.title,
  headings:[...document.querySelectorAll('h1,h2,h3')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,40),
  links:[...document.querySelectorAll('a[href]')].map(x=>({text:x.textContent.trim().replace(/\s+/g,' ').slice(0,100),href:x.href})).filter(x=>x.text).slice(0,80),
  buttons:[...document.querySelectorAll('button')].map(x=>({text:x.textContent.trim().replace(/\s+/g,' ').slice(0,80),ariaExpanded:x.getAttribute('aria-expanded'),ariaControls:x.getAttribute('aria-controls')})),
  landmarks:{nav:document.querySelectorAll('nav').length,main:document.querySelectorAll('main').length,footer:document.querySelectorAll('footer').length},
  forms:[...document.forms].map(f=>({action:f.getAttribute('action'),method:f.getAttribute('method')})),
  overflow:{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth},
  reducedMotionMatches:matchMedia('(prefers-reduced-motion: reduce)').matches
 }));
 add('no-horizontal-overflow',data.overflow.scrollWidth<=data.overflow.clientWidth+1,JSON.stringify(data.overflow));
 add('semantic-landmarks',data.landmarks.nav>0&&data.landmarks.main>0&&data.landmarks.footer>0,JSON.stringify(data.landmarks));
 add('reduced-motion-context',data.reducedMotionMatches===true,'prefers-reduced-motion matches');
 add('no-live-form-action',data.forms.every(f=>!f.action||f.action===''),JSON.stringify(data.forms));
 const focus=[];for(let i=0;i<8;i++){await page.keyboard.press('Tab');focus.push(await page.evaluate(()=>{const e=document.activeElement;if(!e)return null;const s=getComputedStyle(e);return{tag:e.tagName,text:(e.textContent||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,80),outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth};}));}
 data.focusSequence=focus;add('keyboard-focusable',focus.some(x=>x&&['A','BUTTON','INPUT','SELECT','TEXTAREA'].includes(x.tag)),JSON.stringify(focus.slice(0,4)));add('visible-focus-style',focus.some(x=>x&&x.outlineStyle!=='none'&&parseFloat(x.outlineWidth||'0')>0),JSON.stringify(focus.slice(0,4)));
 const menu=page.getByRole('button',{name:/menu/i}).first();let menuAudit={present:false};if(await menu.count()){menuAudit.present=true;menuAudit.initialLabel=await menu.getAttribute('aria-label')||await menu.textContent();menuAudit.initialExpanded=await menu.getAttribute('aria-expanded');await menu.click();await page.waitForTimeout(100);menuAudit.openExpanded=await menu.getAttribute('aria-expanded');menuAudit.activeAfterOpen=await page.evaluate(()=>({tag:document.activeElement?.tagName,text:(document.activeElement?.textContent||document.activeElement?.getAttribute?.('aria-label')||'').trim().slice(0,80)}));await page.keyboard.press('Escape');await page.waitForTimeout(100);menuAudit.afterEscapeExpanded=await menu.getAttribute('aria-expanded');menuAudit.activeAfterEscape=await page.evaluate(()=>({tag:document.activeElement?.tagName,text:(document.activeElement?.textContent||document.activeElement?.getAttribute?.('aria-label')||'').trim().slice(0,80)}));add('menu-action-label',/open menu|close menu/i.test(menuAudit.initialLabel||''),String(menuAudit.initialLabel));add('menu-aria-expanded',menuAudit.initialExpanded==='false'&&menuAudit.openExpanded==='true',JSON.stringify(menuAudit));add('menu-escape-close',menuAudit.afterEscapeExpanded==='false',JSON.stringify(menuAudit));}else add('menu-semantics-not-applicable',true,'No mobile menu button present');data.menuAudit=menuAudit;
 await context.close();
 const p2=await browser.newPage({viewport:VIEWPORTS.tablet});await p2.goto(target,{waitUntil:'domcontentloaded',timeout:30000});const ov=await p2.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));data.tabletOverflow=ov;add('tablet-no-horizontal-overflow',ov.scrollWidth<=ov.clientWidth+1,JSON.stringify(ov));await p2.close();
 }finally{await browser.close();}
 return{status:checks.every(x=>x.status==='PASS')?'PASS':'REVISE',checks,data};}
const server=http.createServer(async(req,res)=>{try{if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({status:'ok',renderer:'playwright-1.55.0',audit:'v1'}));}if(req.method==='POST'&&req.url==='/render'){const x=await body(req);const results=await render(x.commandId,x.target,x.prefix,x.fullPage===true);res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({status:'PASS',results}));}if(req.method==='POST'&&req.url==='/audit'){const x=await body(req);const result=await audit(x.commandId,x.target);res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(result));}res.writeHead(404);res.end('not found');}catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({status:'BLOCKED',error:String(e.message||e)}));}});
server.listen(PORT,'0.0.0.0',()=>console.log(JSON.stringify({status:'READY',port:PORT})));
