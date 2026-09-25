import fs from "node:fs";

const path = new URL("./ui-registry-v1.json", import.meta.url);
const registry = JSON.parse(fs.readFileSync(path, "utf8"));
const allowedLifecycle = new Set(["ACTIVE", "PROTOTYPE", "ARCHIVE"]);
const allowedHealth = new Set(["READY", "DISCOVERED", "ATTENTION"]);
const allowedConfidence = new Set(["VERIFIED", "VERIFIED_DEPLOYMENT", "INFERRED"]);
const ids = new Set();
const errors = [];

if (!Array.isArray(registry.projects) || registry.projects.length === 0) {
  errors.push("registry.projects must contain at least one UI record");
}

for (const [index, project] of (registry.projects || []).entries()) {
  const label = project.id || `row-${index + 1}`;
  for (const key of ["id", "name", "family", "description", "platform", "lifecycle", "health", "launchUrl", "owner", "vercelProjectName"]) {
    if (!project[key]) errors.push(`${label}: missing ${key}`);
  }
  if (ids.has(project.id)) errors.push(`${label}: duplicate permanent id`);
  ids.add(project.id);
  if (!allowedLifecycle.has(project.lifecycle)) errors.push(`${label}: invalid lifecycle ${project.lifecycle}`);
  if (!allowedHealth.has(project.health)) errors.push(`${label}: invalid health ${project.health}`);
  if (!allowedConfidence.has(project.urlConfidence)) errors.push(`${label}: invalid urlConfidence ${project.urlConfidence}`);
  if (project.launchUrl && !/^https:\/\//.test(project.launchUrl)) errors.push(`${label}: launchUrl must be https`);
  if (project.repo && !/^[^/]+\/[^/]+$/.test(project.repo)) errors.push(`${label}: repo must be owner/name`);
}

const pinned = (registry.projects || []).filter((project) => project.pinned);
const active = (registry.projects || []).filter((project) => project.lifecycle === "ACTIVE");
const attention = (registry.projects || []).filter((project) => project.health === "ATTENTION");
const inferred = (registry.projects || []).filter((project) => project.urlConfidence === "INFERRED");

if (errors.length) {
  console.error(`UI registry failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`UI registry OK: ${registry.projects.length} records; ${active.length} active; ${pinned.length} default pinned; ${attention.length} attention; ${inferred.length} launch aliases awaiting verification.`);
