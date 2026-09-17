import fs from "node:fs";

const directionPath = new URL("./project-direction-registry-v1.json", import.meta.url);
const uiPath = new URL("./ui-registry-v1.json", import.meta.url);
const directionRegistry = JSON.parse(fs.readFileSync(directionPath, "utf8"));
const uiRegistry = JSON.parse(fs.readFileSync(uiPath, "utf8"));

const errors = [];
const stages = new Set(directionRegistry.stages || []);
const freshnessStates = new Set(directionRegistry.freshnessStates || []);
const uiIds = new Set((uiRegistry.projects || []).map((project) => project.id));
const directionIds = new Set();

if (!directionRegistry.stewardship?.strategicAccountability) {
  errors.push("missing stewardship.strategicAccountability");
}
if (!Array.isArray(directionRegistry.projects) || directionRegistry.projects.length === 0) {
  errors.push("project-direction registry must contain at least one migrated project");
}

for (const [index, project] of (directionRegistry.projects || []).entries()) {
  const label = project.uiProjectId || `row-${index + 1}`;
  for (const key of ["uiProjectId", "canonicalProjectId", "name", "steward", "strategy", "decision", "execution", "evidence", "freshness", "history"]) {
    if (project[key] === undefined || project[key] === null || project[key] === "") {
      errors.push(`${label}: missing ${key}`);
    }
  }

  if (!uiIds.has(project.uiProjectId)) errors.push(`${label}: uiProjectId is not present in ui-registry-v1.json`);
  if (directionIds.has(project.uiProjectId)) errors.push(`${label}: duplicate uiProjectId`);
  directionIds.add(project.uiProjectId);

  if (!stages.has(project.decision?.phase)) errors.push(`${label}: invalid decision.phase ${project.decision?.phase}`);
  if (!freshnessStates.has(project.freshness?.status)) errors.push(`${label}: invalid freshness.status ${project.freshness?.status}`);

  for (const key of ["problem", "customer", "whyNow", "northStar", "businessModel", "longTermDestination"]) {
    if (!project.strategy?.[key]) errors.push(`${label}: missing strategy.${key}`);
  }
  for (const key of ["phaseLabel", "decisionBeingEarned", "currentHypothesis", "nextGate"]) {
    if (!project.decision?.[key]) errors.push(`${label}: missing decision.${key}`);
  }
  for (const key of ["successCriteria", "killCriteria"]) {
    if (!Array.isArray(project.decision?.[key]) || project.decision[key].length === 0) errors.push(`${label}: decision.${key} must be non-empty`);
  }
  if (!Array.isArray(project.execution?.nextActions) || project.execution.nextActions.length === 0) {
    errors.push(`${label}: execution.nextActions must be non-empty`);
  }
  const binding = project.execution?.workControlBinding;
  if (binding) {
    if (!binding.milestoneId || typeof binding.milestoneId !== "string") errors.push(`${label}: execution.workControlBinding.milestoneId is required`);
    if (!binding.scopeNote) errors.push(`${label}: execution.workControlBinding.scopeNote is required to prevent scope ambiguity`);
  }
  if (!project.evidence?.confidence) errors.push(`${label}: missing evidence.confidence`);
  if (!Array.isArray(project.evidence?.proven) || !Array.isArray(project.evidence?.unproven)) {
    errors.push(`${label}: evidence.proven and evidence.unproven must be arrays`);
  }
  if (!Array.isArray(project.history)) errors.push(`${label}: history must be an array`);
}

if (errors.length) {
  console.error(`Project Direction registry failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const total = (uiRegistry.projects || []).length;
const migrated = directionRegistry.projects.length;
const bound = directionRegistry.projects.filter((project) => project.execution?.workControlBinding).length;
console.log(`Project Direction registry OK: ${migrated}/${total} UI records normalized; ${bound} live Work Control binding(s); progressive migration remains enabled.`);
