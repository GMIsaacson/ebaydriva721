import "./ui-hub-live-work-control.css";

const TERMINAL = new Set(["DONE", "KILLED"]);
const ACTIVE_ORDER = ["IN_PROGRESS", "QA", "WAITING_APPROVAL", "READY", "BLOCKED", "BACKLOG"];
const DEFAULT_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "object" && Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(values) {
  const dates = values.map(timestampToDate).filter(Boolean);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function sortWorkOrders(rows) {
  return [...rows].sort((a, b) => {
    const aIndex = ACTIVE_ORDER.indexOf(a.status || "BACKLOG");
    const bIndex = ACTIVE_ORDER.indexOf(b.status || "BACKLOG");
    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a.sequence || "").localeCompare(String(b.sequence || ""), undefined, { numeric: true });
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function deriveProjectOperations(direction, workControl = {}, now = Date.now()) {
  const binding = direction?.execution?.workControlBinding;
  if (!binding?.milestoneId) {
    return {
      bound: false,
      connectionState: "UNBOUND",
      sourceLabel: "No Work Control binding",
      freshnessStatus: direction?.freshness?.status || "FRESH",
    };
  }

  const connectionState = workControl.state || "CONNECTING";
  const items = Array.isArray(workControl.items) ? workControl.items : [];
  const milestone = items.find((item) => item.id === binding.milestoneId) || null;
  const workOrders = milestone
    ? sortWorkOrders(items.filter((item) => item.level === "work_order" && item.parentId === milestone.id))
    : [];

  const activeWork = workOrders.filter((item) => !TERMINAL.has(item.status || "BACKLOG"));
  const blockedWork = activeWork.filter((item) => item.status === "BLOCKED");
  const approvalWork = activeWork.filter((item) => item.status === "WAITING_APPROVAL");
  const lastActivity = latestDate([
    milestone?.updatedAt,
    ...workOrders.map((item) => item.updatedAt),
    ...workOrders.map((item) => item.executionCompletedAt),
    ...workOrders.map((item) => item.executionDispatchedAt),
  ]);

  let freshnessStatus = direction?.freshness?.status || "FRESH";
  if (connectionState === "CONNECTED") {
    if (milestone?.status === "BLOCKED" || blockedWork.length) freshnessStatus = "BLOCKED";
    else if (milestone?.status === "WAITING_APPROVAL" || approvalWork.length) freshnessStatus = "NEEDS_OWNER";
    else if (lastActivity && now - lastActivity.getTime() > DEFAULT_STALE_AFTER_MS) freshnessStatus = "STALE";
  }

  const blockers = unique([
    milestone?.status === "BLOCKED" ? `${milestone.id} · ${milestone.title}` : null,
    ...blockedWork.map((item) => `${item.id} · ${item.title}`),
  ]);
  const ownerApprovals = unique([
    milestone?.status === "WAITING_APPROVAL" ? `${milestone.id} · ${milestone.title}` : null,
    ...approvalWork.map((item) => `${item.id} · ${item.title}`),
  ]);
  const currentWork = activeWork.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status || "BACKLOG",
    owner: item.owner || null,
    executor: item.executor || null,
    nextAction: item.nextAction || null,
  }));
  const dependencies = unique([
    milestone?.dependency,
    ...activeWork.map((item) => item.dependency),
  ]);

  const sourceLabel = connectionState === "CONNECTED"
    ? milestone
      ? `LIVE · ${binding.milestoneId}`
      : `LIVE · ${binding.milestoneId} missing`
    : connectionState === "SIGNED_OUT"
      ? "Sign in to sync Work Control"
      : connectionState === "ERROR"
        ? "Work Control sync error"
        : "Connecting to Work Control";

  return {
    bound: true,
    binding,
    connectionState,
    sourceLabel,
    milestoneFound: Boolean(milestone),
    milestoneStatus: milestone?.status || null,
    milestoneTitle: milestone?.title || binding.label || null,
    currentWork,
    blockers,
    ownerApprovals,
    dependencies,
    lastActivity,
    freshnessStatus,
  };
}

export function formatOperationalTime(value) {
  const date = timestampToDate(value);
  if (!date) return "No live activity recorded";
  return date.toLocaleString();
}
