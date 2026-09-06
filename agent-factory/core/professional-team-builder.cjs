#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { compileTeam } = require('./team-builder.cjs');
const { validatePCM, validateSpecialistRegistry, evaluateProfessionalReadiness } = require('./professional-capability.cjs');

function compileProfessionalTeam(request, options = {}) {
  if (!request || typeof request !== 'object') throw new Error('request is required');
  const base = compileTeam(request, options);
  if (base.manifest.governanceMode === 'RUN') {
    const professional = request.professionalCapability;
    if (!professional || typeof professional !== 'object') throw new Error('RUN mode requires request.professionalCapability');
    validateSpecialistRegistry(professional.registrySnapshot);
    validatePCM(professional.pcm, professional.registrySnapshot);
    const assessment = evaluateProfessionalReadiness(professional.pcm, professional.registrySnapshot);
    base.manifest.schemaVersion = '1.3';
    base.manifest.factoryCoreVersion = '1.3.0-g2.5';
    base.manifest.professionalCapability = {
      pcm: professional.pcm,
      registrySnapshot: professional.registrySnapshot,
      acceptedLimitations: professional.acceptedLimitations || [],
      buildAssessment: assessment,
    };
    base.manifest.readinessDimensions = {
      operational: 'TESTING',
      evidence: 'TESTING',
      professional: assessment.professionalReadiness,
    };
    base.contract.schemaVersion = '1.3';
    base.contract.outputs = [...new Set([...(base.contract.outputs || []), 'professional_review_v1', 'professional_attestation_v1'])];
    base.contract.successRule = 'DELIVERED requires Q1 operational PASS, Q2 evidence/compliance PASS, Q3 independent Professional Excellence PASS, complete PCM coverage, zero unresolved gating capability gaps, and zero authority violations.';
    base.receipt.schemaVersion = '1.3';
    base.receipt.professionalReadinessAtBuild = assessment.professionalReadiness;
  }
  return base;
}

function writePackageAtomic(request, outDir, options = {}) {
  const output = compileProfessionalTeam(request, options);
  const target = path.resolve(outDir);
  if (fs.existsSync(target)) throw new Error(`output already exists: ${target}`);
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.mkdirSync(path.join(temp, 'contracts'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(temp, 'team-manifest.json'), `${JSON.stringify(output.manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(temp, 'contracts', 'team-contract.json'), `${JSON.stringify(output.contract, null, 2)}\n`);
    fs.writeFileSync(path.join(temp, 'evidence', 'build-receipt.json'), `${JSON.stringify(output.receipt, null, 2)}\n`);
    fs.renameSync(temp, target);
    return output;
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const requestIndex = argv.indexOf('--request');
  const outIndex = argv.indexOf('--out');
  if (requestIndex < 0 || !argv[requestIndex + 1] || outIndex < 0 || !argv[outIndex + 1]) {
    console.error('Usage: node professional-team-builder.cjs --request <request.json> --out <directory>');
    process.exit(2);
  }
  try {
    const request = JSON.parse(fs.readFileSync(argv[requestIndex + 1], 'utf8'));
    const output = writePackageAtomic(request, argv[outIndex + 1]);
    console.log(JSON.stringify({ status:'PASS', runId:output.manifest.runId, teamId:output.manifest.teamId, professionalReadiness:output.manifest.readinessDimensions?.professional || null }));
  } catch (error) {
    console.error(JSON.stringify({ status:'BLOCKED', error:error.message }));
    process.exit(2);
  }
}

if (require.main === module) main();
module.exports = { compileProfessionalTeam, writePackageAtomic };
