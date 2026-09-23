'use strict';
const fixture=require('../fixtures/g4-demo.json');const{processPacket}=require('../runtime/runtime.cjs');process.stdout.write(JSON.stringify(processPacket(fixture),null,2)+'\n');
