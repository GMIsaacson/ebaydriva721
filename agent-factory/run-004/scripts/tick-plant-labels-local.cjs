#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {tick}=require('../runtime/amazon-leaf-controller.cjs');
const {makeLocalPorts}=require('../runtime/amazon-leaf-local-ports.cjs');

(async()=>{
  const bindingsFile=process.env.PLANT_LABELS_BINDINGS_FILE;
  if(!bindingsFile) throw new Error('PLANT_LABELS_BINDINGS_FILE_REQUIRED');
  const bindings=JSON.parse(fs.readFileSync(bindingsFile,'utf8'));
  const stateFile=process.env.PLANT_LABELS_STATE_FILE || '/opt/sentinelx-cloud-core/agent-factory/work-control-v1-data/artifacts/SM-AMZ-PLANT-LABELS-001.controller.json';
  const ports=makeLocalPorts({
    workControlBase:process.env.WORK_CONTROL_LOCAL_URL || 'http://127.0.0.1:8787',
    stateFile:path.resolve(stateFile),
  });
  const state=await tick({...ports,bindings});
  console.log(JSON.stringify({
    runId:state.runId,
    version:state.version,
    phase:state.phase,
    stage:state.stage,
    commandId:state.commandId,
    publicResearchCalls:state.publicResearchCalls,
    modelBudgetCommittedCents:state.modelBudgetCommittedCents,
    lastEvent:state.events.at(-1),
  }));
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
