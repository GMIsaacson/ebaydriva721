'use strict';
const {RUN,LEAF} = require('./amazon-leaf-controller.cjs');
function makePorts({gateway,token,supabaseUrl,supabaseKey,fetchImpl=fetch}) {
  for (const value of [gateway,supabaseUrl]) {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash) throw new Error('HTTPS_ENDPOINT_REQUIRED');
  }
  async function request(url,headers,body) {
    const response=await fetchImpl(url,{method:body===undefined?'GET':'POST',headers,
      ...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok){const e=new Error(`HTTP_${response.status}`);e.status=response.status;throw e;}
    return response.json();
  }
  const wcHeaders={authorization:`Bearer ${token}`,'content-type':'application/json'};
  const sbHeaders={apikey:supabaseKey,authorization:`Bearer ${supabaseKey}`,'content-type':'application/json'};
  const rpc=(name,body)=>request(`${supabaseUrl}/rest/v1/rpc/${name}`,sbHeaders,body);
  return {
    workControl:{
      dispatch:body=>request(`${gateway}/v1/commands`,wcHeaders,body),
      read:id=>request(`${gateway}/v1/commands/${encodeURIComponent(id)}`,wcHeaders),
    },
    store:{
      async read(){const r=await rpc('control_console_amazon_leaf_research',{p_category:LEAF});return r?.work_item?.state_details?.run004_controller||null;},
      compareAndSet:(expected,next)=>rpc('run004_plant_labels_checkpoint',{p_run_id:RUN,p_expected_version:expected,p_checkpoint:next}),
    }
  };
}
module.exports={makePorts};
