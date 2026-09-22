#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {tick}=require('../runtime/amazon-leaf-controller.cjs');
const {makePorts}=require('../runtime/amazon-leaf-ports.cjs');
(async()=>{
  const required=['WORK_CONTROL_GATEWAY','WORK_CONTROL_ID_TOKEN','SOURCEMARGIN_URL','SOURCEMARGIN_SERVICE_KEY','PLANT_LABELS_BINDINGS_FILE'];
  const missing=required.filter(k=>!process.env[k]);
  if(missing.length)throw new Error(`DEPLOYMENT_BINDINGS_MISSING: ${missing.join(', ')}`);
  const bindings=JSON.parse(fs.readFileSync(process.env.PLANT_LABELS_BINDINGS_FILE,'utf8'));
  const ports=makePorts({gateway:process.env.WORK_CONTROL_GATEWAY,token:process.env.WORK_CONTROL_ID_TOKEN,
    supabaseUrl:process.env.SOURCEMARGIN_URL,supabaseKey:process.env.SOURCEMARGIN_SERVICE_KEY});
  const state=await tick({...ports,bindings});
  console.log(JSON.stringify({runId:state.runId,version:state.version,phase:state.phase,stage:state.stage,commandId:state.commandId,lastEvent:state.events.at(-1)}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
