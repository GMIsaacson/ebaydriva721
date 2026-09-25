const http=require('node:http');
const {chromium}=require('playwright');

const PORT=Number(process.env.PORT||8791);
const MAX_LIMIT=50;
let queue=Promise.resolve();

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const moneyToNumber=s=>{
  const m=String(s||'').replace(/,/g,'').match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  return m?Number(m[1]):null;
};

async function mapLimit(items,limit,fn){
  const out=new Array(items.length); let i=0;
  async function worker(){
    while(true){
      const idx=i++;
      if(idx>=items.length) return;
      out[idx]=await fn(items[idx],idx);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

async function gotoBestEffort(page,url){
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await page.goto(url,{waitUntil:'commit',timeout:30000});
      await page.waitForTimeout(1500);
      return;
    }catch(e){
      lastError=e;
      const hasBody=await page.locator('body').count().catch(()=>0);
      if(hasBody){
        await page.waitForTimeout(1200);
        return;
      }
      await page.waitForTimeout(750*attempt);
    }
  }
  throw lastError||new Error('Navigation failed.');
}

async function runCensus({leafId,limit=24,enrichSeller=true,targetAsins=[]}){
  if(!/^\d{5,20}$/.test(String(leafId||''))) throw new Error('VALID_LEAF_ID_REQUIRED');
  targetAsins=Array.isArray(targetAsins)?[...new Set(targetAsins.map(x=>String(x||'').trim().toUpperCase()))]:[];
  if(targetAsins.some(x=>!/^B[A-Z0-9]{9}$/.test(x))||targetAsins.length>MAX_LIMIT) throw new Error('TARGET_ASINS_INVALID');
  if(!Number.isSafeInteger(limit)||limit<1||limit>MAX_LIMIT) throw new Error('LIMIT_INVALID');
  if(targetAsins.length) limit=targetAsins.length;

  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({
      locale:'en-US',
      viewport:{width:1440,height:1400},
      userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'
    });
    const sourceUrl='https://www.amazon.com/b?node='+leafId;
    let cards=[];
    if(targetAsins.length){
      cards=targetAsins.map((asin,i)=>({
        rank:i+1, asin, title:'', cardUrl:'https://www.amazon.com/dp/'+asin,
        cardPriceText:'', ratingText:'', reviewCountText:'', sponsored:false
      }));
    }else{
      const page=await context.newPage();
      let leafReady=false;
      let leafLastError=null;
      for(let attempt=1;attempt<=3;attempt++){
        try{
          await page.goto(sourceUrl,{waitUntil:'domcontentloaded',timeout:30000});
          await page.locator('[data-component-type="s-search-result"][data-asin]').first().waitFor({state:'attached',timeout:10000}).catch(()=>{});
          const resultCount=await page.locator('[data-component-type="s-search-result"][data-asin]').count();
          if(resultCount>0){
            leafReady=true;
            break;
          }
          leafLastError=new Error('AMAZON_LEAF_RESULTS_EMPTY');
        }catch(e){
          leafLastError=e;
        }
        await page.waitForTimeout(750*attempt);
      }
      if(!leafReady) throw leafLastError||new Error('AMAZON_LEAF_RESULTS_EMPTY');
      await page.waitForTimeout(500);
      cards=await page.locator('[data-component-type="s-search-result"][data-asin]').evaluateAll((nodes,limit)=>
        nodes.slice(0,limit).map((n,i)=>{
          const asin=n.getAttribute('data-asin')||'';
          const a=n.querySelector('a[href*="/dp/"]');
          const h=n.querySelector('h2');
          const price=n.querySelector('.a-price .a-offscreen');
          const rating=n.querySelector('.a-icon-alt');
          const reviews=n.querySelector('a[href*="customerReviews"] span, span.a-size-base.s-underline-text');
          const sponsored=[...n.querySelectorAll('span')].some(x=>/Sponsored/i.test(x.textContent||''));
          return {
            rank:i+1,
            asin,
            title:(h?.textContent||a?.textContent||'').replace(/\s+/g,' ').trim(),
            cardUrl:a?.href||'',
            cardPriceText:(price?.textContent||'').trim(),
            ratingText:(rating?.textContent||'').trim(),
            reviewCountText:(reviews?.textContent||'').trim(),
            sponsored
          };
        }).filter(x=>x.asin),
        limit
      );
      await page.close();
    }

    const results=enrichSeller
      ? await mapLimit(cards,2,async card=>{
          const p=await context.newPage();
          try{
            await gotoBestEffort(p,'https://www.amazon.com/dp/'+card.asin);
            await p.waitForLoadState('domcontentloaded',{timeout:5000}).catch(()=>{});
            await p.locator('#sellerProfileTriggerId, #merchantInfoFeature_feature_div, #merchant-info').first().waitFor({state:'attached',timeout:5000}).catch(()=>{});
            await p.waitForTimeout(500);
            const d=await p.evaluate(()=>{
              const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
              const txt=sel=>clean(document.querySelector(sel)?.textContent||'');
              const seller=document.querySelector('#sellerProfileTriggerId');
              const merchant=txt('#merchantInfoFeature_feature_div')||txt('#merchant-info');
              const body=clean(document.body?.innerText||'');
              const demand=(body.match(/([0-9]+(?:\.[0-9]+)?\s*[KkMm]?\+?\s+bought in past month)/i)||[])[1]||'';
              const title=txt('#productTitle');
              const price=txt('#corePrice_feature_div .a-offscreen')||txt('.a-price .a-offscreen');
              const availRaw=txt('#availability');
              const availability=(availRaw.match(/^(In Stock|Only \d+ left in stock[^\n]*|Currently unavailable\.?)/i)||[])[1]||'';
              const byline=txt('#bylineInfo');
              return {
                title,
                price,
                byline,
                seller:clean(seller?.textContent||''),
                sellerHref:seller?.href||'',
                merchant,
                demand,
                availability
              };
            });
            let sellerName=d.seller||'';
            if(!sellerName&&/sold by\s+amazon\.com/i.test(d.merchant)) sellerName='Amazon.com';
            const brandName=String(d.byline||'').replace(/^Visit the\s+/i,'').replace(/\s+Store$/i,'').replace(/^Brand:\s*/i,'').trim();
            const sellerId=(String(d.sellerHref||'').match(/[?&]seller=([A-Z0-9]+)/i)||[])[1]||'';
            return {
              ...card,
              canonicalUrl:'https://www.amazon.com/dp/'+card.asin,
              title:d.title||card.title,
              detailPriceText:d.price||'',
              brandName,
              sellerName,
              sellerId,
              sellerUrl:d.sellerHref||'',
              boughtPastMonthText:d.demand||'',
              availability:d.availability||'',
              detailError:null
            };
          }catch(e){
            return {
              ...card,
              canonicalUrl:'https://www.amazon.com/dp/'+card.asin,
              brandName:'',
              sellerName:'',
              sellerId:'',
              sellerUrl:'',
              boughtPastMonthText:'',
              availability:'',
              detailError:String(e.message||e)
            };
          }finally{
            await p.close();
          }
        })
      : cards.map(card=>({...card,canonicalUrl:'https://www.amazon.com/dp/'+card.asin}));

    return {
      schemaVersion:'amazon-leaf-browser-census/1.0.0',
      leafId:String(leafId),
      sourceUrl,
      observedAt:new Date().toISOString(),
      count:results.length,
      results:results.map(row=>({
        ...row,
        observedPriceText:row.detailPriceText||row.cardPriceText||'',
        observedPrice:moneyToNumber(row.detailPriceText||row.cardPriceText)
      }))
    };
  }finally{
    await browser.close();
  }
}

function readJson(req){
  return new Promise((resolve,reject)=>{
    let body='';
    req.on('data',chunk=>{
      body+=chunk;
      if(body.length>100000) req.destroy();
    });
    req.on('end',()=>{
      try{resolve(body?JSON.parse(body):{});}catch(e){reject(e);}
    });
    req.on('error',reject);
  });
}

const server=http.createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.method==='GET'&&req.url==='/health'){
    res.end(JSON.stringify({ok:true,service:'amazon-census-browser-v1'}));
    return;
  }
  if(req.method!=='POST'||req.url!=='/census'){
    res.statusCode=404;
    res.end(JSON.stringify({ok:false,error:'NOT_FOUND'}));
    return;
  }
  try{
    const input=await readJson(req);
    const task=queue.then(()=>runCensus(input));
    queue=task.catch(()=>{});
    const result=await task;
    res.end(JSON.stringify({ok:true,...result}));
  }catch(e){
    res.statusCode=500;
    res.end(JSON.stringify({ok:false,error:String(e.message||e)}));
  }
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log(JSON.stringify({service:'amazon-census-browser-v1',port:PORT,status:'ready'}));
});
