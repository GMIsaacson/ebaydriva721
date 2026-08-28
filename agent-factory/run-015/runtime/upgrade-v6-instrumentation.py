from pathlib import Path

executor = Path('/opt/sentinelx-cloud-core/agent-factory/work-control-worker-tools-20260825-v1/run015-executor.cjs')
renderer = Path('/opt/sentinelx-cloud-core/agent-factory/uix-renderer-v1/server.cjs')
test = Path('/opt/sentinelx-cloud-core/agent-factory/work-control-worker-tools-20260825-v1/tests/run015-executor.test.cjs')

s = executor.read_text()
s = s.replace("EXECUTOR_VERSION='2026-08-28.5'", "EXECUTOR_VERSION='2026-08-28.6'")
needle = "function gateScore(scores,keys){let n=0,d=0;for(const k of keys){const w=Number(WEIGHTS[k]||1);n+=Number(scores[k]||0)*w;d+=w;}return Math.round((d?n/d:0)*10)/10;}"
normalizer = "function normalizeScores(scores){const vals=Object.values(scores||{}).map(Number);const from10=vals.length===Object.keys(WEIGHTS).length&&vals.every(v=>Number.isFinite(v)&&v>=0&&v<=10)&&vals.some(v=>v>0);if(from10)for(const k of Object.keys(scores))scores[k]=Math.round(Number(scores[k])*100)/10;return{scores,scaleNormalizedFrom10:from10};}"
if needle not in s:
    raise SystemExit('gateScore marker missing')
if 'function normalizeScores(scores)' not in s:
    s = s.replace(needle, needle + normalizer)
old = "score.weighted=weighted(score.scores);const visualGate=gateScore(score.scores,VISUAL_KEYS),responsiveAccessibilityGate=Math.min(...RESP_KEYS.map(k=>Number(score.scores[k]||0)));"
new = "const normalized=normalizeScores(score.scores);score.scores=normalized.scores;score.scaleNormalizedFrom10=normalized.scaleNormalizedFrom10;score.weighted=weighted(score.scores);const visualGate=gateScore(score.scores,VISUAL_KEYS),responsiveAccessibilityGate=Math.min(...RESP_KEYS.map(k=>Number(score.scores[k]||0)));"
if old not in s:
    raise SystemExit('score weighting marker missing')
s = s.replace(old, new)
old_export = "module.exports={TEAM_ID,EXECUTOR_VERSION,processRun015,weightedScore:weighted,staticChecks:checks,literalPreserveStrings,gateScore};"
new_export = "module.exports={TEAM_ID,EXECUTOR_VERSION,processRun015,weightedScore:weighted,staticChecks:checks,literalPreserveStrings,gateScore,normalizeScores};"
if old_export not in s:
    raise SystemExit('export marker missing')
s = s.replace(old_export, new_export)
executor.write_text(s)

r = renderer.read_text()
old_prefix = "/^(before|after(?:-r[12])?)$/"
new_prefix = "/^(before|after(?:-r[1-5])?)$/"
if old_prefix not in r:
    raise SystemExit('renderer prefix marker missing')
renderer.write_text(r.replace(old_prefix, new_prefix))

t = test.read_text()
marker = "assert.equal(Run015.EXECUTOR_VERSION || '2026-08-28.5','2026-08-28.5');"
replacement = "assert.equal(Run015.EXECUTOR_VERSION,'2026-08-28.6');\nconst normalized=Run015.normalizeScores({visualHierarchy:8.5,typography:8.6,layoutSpacing:8.3,componentQuality:8.5,uxClarity:8.2,interactionPolish:8,responsiveExecution:8.7,brandDistinction:8.7,accessibility:7.5,statesAndFeedback:7.8});\nassert.equal(normalized.scaleNormalizedFrom10,true);\nassert.equal(normalized.scores.visualHierarchy,85);\nassert.equal(Run015.weightedScore(normalized.scores),84);"
if marker not in t:
    raise SystemExit('executor version test marker missing')
test.write_text(t.replace(marker, replacement))

print('Run 015 v0.6 instrumentation upgrade applied')
