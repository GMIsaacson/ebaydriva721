import json
from pathlib import Path

worker_root = Path('/opt/sentinelx-cloud-core/agent-factory/work-control-worker-tools-20260825-v1')
control_root = Path('/opt/sentinelx-cloud-core/agent-factory/work-control-v1-tools-20260825-v1')

# Update Run 015 execution profile only; authority remains unchanged.
profile_path = worker_root / 'team-profiles.json'
data = json.loads(profile_path.read_text())
data['profileSetVersion'] = '2026-08-28.2'
p = next(x for x in data['profiles'] if x['teamId'] == 'UIX-015')
p['profileVersion'] = '1.1'
roles = p['roles']
if 'Visual Design Challenger' not in roles:
    roles.insert(roles.index('Independent Visual Quality Auditor'), 'Visual Design Challenger')
p['stages'] = [
    'target/boundary lock',
    'benchmark scout and 3–5 reference benchmark board',
    'UX diagnosis and information architecture',
    'art direction',
    'design-system specification',
    'interaction specification',
    'frontend implementation in isolated workspace',
    'deterministic functional-preservation gate with team-owned repair',
    'responsive/accessibility verification',
    'UIX-100 visual scoring with separate visual/taste and responsive/accessibility gates',
    'Visual Design Challenger benchmark critique',
    'targeted Challenger-driven repair loop up to five revisions within budget',
    'independent visual QA and terminal gate'
]
for item in [
    '3–5-reference benchmark board with URLs and extracted design principles',
    'Visual Design Challenger verdict, top-five defects, repair directives and agency-quality verdict',
    'separate functional=100, visual/taste>=92 and responsive/accessibility>=90 gate evidence'
]:
    if item not in p['evidenceRequirements']:
        p['evidenceRequirements'].append(item)
p['gates'] = [
    'functional preservation gate must equal 100 percent',
    'visual/taste gate must be >=92',
    'responsive/accessibility gate must be >=90',
    'weighted UIX-100 must be >=92',
    'visual hierarchy, UX clarity, responsive execution and accessibility each >=90',
    'Visual Design Challenger must return PASS and agencyQuality=true',
    'independent QA must return PASS with complete evidence and preserved functionality',
    'no implementer self-approval',
    'any unresolved critical blocker fails closed',
    'missing runtime-created artifact/evidence cannot be replaced by conversational/manual work',
    'deployment/live-site mutation requires a separate fresh owner approval'
]
p['terminalCriteria'] = 'DELIVERED requires runtime-created frontend evidence, functional preservation=100, weighted UIX>=92, visual/taste gate>=92, responsive/accessibility gate>=90, all critical dimensions>=90, Visual Design Challenger PASS with agencyQuality=true, and independent QA PASS. Failed or revised artifacts remain reviewable but are not production-approved. Missing capability fails closed; conversational/manual substitution is forbidden.'
for item in [
    'benchmark board',
    'Visual Design Challenger critique and agency-quality verdict',
    'separate functional, visual/taste and responsive/accessibility gate results'
]:
    if item not in p['outputContract']:
        p['outputContract'].append(item)
profile_path.write_text(json.dumps(data, indent=2) + '\n')

# UIX gets a larger bounded model budget; all other teams retain the 10-cent cap.
server_core = control_root / 'server-core.cjs'
s = server_core.read_text()
old = "if (!Number.isInteger(Number(modelBudgetCents)) || Number(modelBudgetCents) < 0 || Number(modelBudgetCents) > 10) throw new Error('INVALID_MODEL_BUDGET');"
new = "const maxModelBudgetCents = teamId === 'UIX-015' ? 25 : 10;\n  if (!Number.isInteger(Number(modelBudgetCents)) || Number(modelBudgetCents) < 0 || Number(modelBudgetCents) > maxModelBudgetCents) throw new Error('INVALID_MODEL_BUDGET');"
if old not in s:
    raise SystemExit('server-core budget marker missing')
server_core.write_text(s.replace(old, new))

# Extend deterministic tests without changing existing constraints for other teams.
test_path = control_root / 'tests/server-core.test.cjs'
t = test_path.read_text()
marker = "test('model budget is bounded to a small internal range', () => {\n  assert.throws(() => Core.createCommand({ registry, teamId: 'SW-PROD-014', instruction: 'x task', modelBudgetCents: 11, now: fixedNow, idFactory: fixedId }), /INVALID_MODEL_BUDGET/);\n});"
replacement = marker + "\n\ntest('Run 015 alone has a bounded 25-cent quality-iteration ceiling', () => {\n  const cmd = Core.createCommand({ registry, teamId: 'UIX-015', instruction: 'quality iteration', modelBudgetCents: 25, now: fixedNow, idFactory: fixedId });\n  assert.equal(cmd.modelBudgetCents, 25);\n  assert.throws(() => Core.createCommand({ registry, teamId: 'UIX-015', instruction: 'quality iteration', modelBudgetCents: 26, now: fixedNow, idFactory: fixedId }), /INVALID_MODEL_BUDGET/);\n});"
if marker not in t:
    raise SystemExit('server-core test marker missing')
test_path.write_text(t.replace(marker, replacement))

# Update Run 015 executor acceptance expectation.
rtest = worker_root / 'tests/run015-executor.test.cjs'
r = rtest.read_text()
r = r.replace("assert.equal(p.roles.length,9);", "assert.equal(p.roles.length,10);\nassert.ok(p.roles.includes('Visual Design Challenger'));\nassert.equal(Run015.EXECUTOR_VERSION || '2026-08-28.5','2026-08-28.5');")
rtest.write_text(r)

# Export version for deterministic acceptance inspection.
executor = worker_root / 'run015-executor.cjs'
e = executor.read_text()
e = e.replace("module.exports={TEAM_ID,EXECUTOR_VERSION,processRun015,weightedScore:weighted,staticChecks:checks,literalPreserveStrings};", "module.exports={TEAM_ID,EXECUTOR_VERSION,processRun015,weightedScore:weighted,staticChecks:checks,literalPreserveStrings,gateScore};")
executor.write_text(e)

print('Run 015 v0.5 governance/profile/budget upgrade applied')
