'use strict';
const REPOS = Object.freeze([
  { name: 'GMIsaacson/Eb-Al', label: 'Research / operations', main: 'main' },
  { name: 'GMIsaacson/sourcemargin1.0', label: 'Customer application', main: 'main' },
  { name: 'GMIsaacson/ebaydriva721', label: 'Factory Control', main: 'master' },
]);
const MS_DAY = 86400000;
const elapsedDays = (date, now) => Number.isFinite(Date.parse(date)) ? Math.max(0, Math.floor((now - Date.parse(date)) / MS_DAY)) : null;
function isLegacy(repo, pr) {
  // The Sep 26 inventory protects 34 old customer PRs (#8–#53).
  // The Factory is developed on a frozen-main stacked branch.
  return (repo === 'GMIsaacson/sourcemargin1.0' && Number(pr.number) <= 53)
    || (repo === 'GMIsaacson/ebaydriva721' && pr.base?.ref !== 'master');
}
function reviewState(reviews, pr) {
  if (!Array.isArray(reviews)) return 'UNVERIFIED';
  const latestByReviewer = new Map();
  for (const r of reviews) if (r.user?.login && r.user.login !== pr.user?.login && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) latestByReviewer.set(r.user.login, r.state);
  if ([...latestByReviewer.values()].includes('CHANGES_REQUESTED')) return 'CHANGES_REQUESTED';
  if ([...latestByReviewer.values()].includes('APPROVED')) return 'APPROVED';
  return (pr.requested_reviewers || []).length ? 'REQUESTED' : 'UNREVIEWED';
}
function checkState(runs) {
  if (!Array.isArray(runs) || !runs.length) return 'UNVERIFIED';
  if (runs.some(x => ['failure', 'timed_out', 'action_required'].includes(x.conclusion))) return 'FAILED';
  if (runs.some(x => x.status !== 'completed')) return 'RUNNING';
  if (runs.some(x => !x.conclusion || x.conclusion === 'cancelled')) return 'UNVERIFIED';
  return runs.every(x => ['success','neutral','skipped'].includes(x.conclusion)) ? 'PASSED' : 'UNVERIFIED';
}
function normalizePR(repo, pr, now, evidence = {}) {
  const legacy = isLegacy(repo, pr);
  const ageDays = elapsedDays(pr.created_at, now);
  const idleDays = elapsedDays(pr.updated_at, now);
  return {
    number: pr.number, title: pr.title, url: pr.html_url,
    base: pr.base?.ref || null, branch: pr.head?.ref || null, draft: Boolean(pr.draft),
    legacy, ageDays, idleDays, updatedAt: pr.updated_at || null,
    review: reviewState(evidence.reviews, pr), checks: checkState(evidence.checkRuns),
    reviewEvidence: Array.isArray(evidence.reviews), checkEvidence: Array.isArray(evidence.checkRuns),
    attention: !legacy && !pr.draft ? (ageDays >= 5 ? 'RECONCILE_5D' : ageDays >= 3 ? 'ESCALATE_3D' : 'NORMAL') : null
  };
}
function normalizeIssue(issue) {
  const labels = (issue.labels || []).map(x => typeof x === 'string' ? x.toLowerCase() : String(x.name || '').toLowerCase());
  return { number: issue.number, title: issue.title, url: issue.html_url, updatedAt: issue.updated_at,
    regression: labels.some(x => /regression|bug/.test(x)), debt: labels.some(x => /tech.?debt|maintenance/.test(x)) };
}
function summarize(repo, prs, issues, now, evidence = {}) {
  const result = prs.map(p => normalizePR(repo.name, p, now, evidence[p.number]));
  const active = result.filter(p => !p.legacy);
  const normalizedIssues = issues.filter(x => !x.pull_request).map(normalizeIssue);
  return {
    repo: repo.name, label: repo.label, branch: repo.main, status: 'connected',
    totals: {openPRs: result.length, activePRs: active.length, legacyPRs: result.length-active.length,
      openIssues: normalizedIssues.length, taggedRegressions: normalizedIssues.filter(i=>i.regression).length,
      taggedDebt: normalizedIssues.filter(i=>i.debt).length,
      unreviewedActive: active.filter(p=>p.review === 'UNREVIEWED' || p.review === 'REQUESTED').length,
      failedChecksActive: active.filter(p=>p.checks === 'FAILED').length,
      checkUnknownActive: active.filter(p=>p.checks === 'UNVERIFIED').length,
      aging3d: active.filter(p=>p.attention === 'ESCALATE_3D').length,
      aging5d: active.filter(p=>p.attention === 'RECONCILE_5D').length},
    prs: result.sort((a,b)=>b.number-a.number),
    issues: normalizedIssues.sort((a,b)=>Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0)).slice(0,25)
  };
}
module.exports = { REPOS, elapsedDays, isLegacy, reviewState, checkState, normalizePR, summarize };
