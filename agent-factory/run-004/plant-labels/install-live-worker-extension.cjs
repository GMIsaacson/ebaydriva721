#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

const targetDir=path.resolve(process.env.WORK_CONTROL_WORKER_APP_DIR || '/opt/sentinelx-cloud-core/agent-factory/work-control-worker-tools-20260825-v1');
const workerFile=path.join(targetDir,'worker.cjs');
const moduleTarget=path.join(targetDir,'amazon-leaf-worker-executor.cjs');
const moduleSource=path.resolve(__dirname,'../runtime/amazon-leaf-worker-executor.cjs');

if(!fs.existsSync(workerFile)) throw new Error('LIVE_WORKER_FILE_NOT_FOUND');
if(!fs.existsSync(moduleSource)) throw new Error('SOURCE_EXECUTOR_FILE_NOT_FOUND');

const stamp=new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
const backup=`${workerFile}.bak-amazon-leaf-${stamp}`;
fs.copyFileSync(workerFile,backup);
fs.copyFileSync(moduleSource,moduleTarget);
fs.chmodSync(moduleTarget,0o644);

let text=fs.readFileSync(workerFile,'utf8');
if(!text.includes("require('./amazon-leaf-worker-executor.cjs')")){
  const anchor="const FactoryDirector000 = require('./factory-director-000-executor.cjs');";
  if(!text.includes(anchor)) throw new Error('WORKER_REQUIRE_ANCHOR_NOT_FOUND');
  text=text.replace(anchor,`${anchor}\nconst AmazonLeaf = require('./amazon-leaf-worker-executor.cjs');`);
}
if(!text.includes('AmazonLeaf.processAmazonLeafStage')){
  const anchor='try{WorkerCore.getTeamProfile(profileSet,command.team.id); if(FactoryDirector000.shouldUse(command))';
  const inserted="try{WorkerCore.getTeamProfile(profileSet,command.team.id); if(AmazonLeaf.shouldUse(command)){return await AmazonLeaf.processAmazonLeafStage({apiKey,command,profileSet,deps:{callOpenAIRequest,WorkerCore,submitReceipt,controlRequest,model:MODEL}});} if(FactoryDirector000.shouldUse(command))";
  if(!text.includes(anchor)) throw new Error('WORKER_PROCESS_ANCHOR_NOT_FOUND');
  text=text.replace(anchor,inserted);
}
fs.writeFileSync(workerFile,text);
console.log(JSON.stringify({installed:true,targetDir,backup,moduleTarget}));
