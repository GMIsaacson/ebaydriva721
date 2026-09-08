import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase-config";

export const WORK_CONTROL_VERSION = "2.0";

export const defaultItems = [
  {
    id: "OBJ-001",
    parentId: null,
    level: "objective",
    title: "Build the reusable AI production machine",
    businessOutcome: "One dependable substrate that can run multiple commercial workloads without rebuilding core plumbing.",
    owner: "Agent 000",
    executor: "Factory portfolio",
    sequence: "1",
    priority: "P0",
    status: "IN_PROGRESS",
    nextAction: "Complete M-002: connect persistent state and real execution",
    dependency: "REF-AI-STACK-2026-09-07",
    definitionOfDone: "M-002 through M-007 complete and economics decision made",
    evidenceRequired: "Execution evidence + milestone results",
    qaRequired: ["Q1", "Q2", "Q3 as applicable"],
  },
  {
    id: "M-001",
    parentId: "OBJ-001",
    level: "milestone",
    title: "Formalize Work Control v2",
    businessOutcome: "Create durable when/what/who operating system",
    owner: "Agent 000",
    executor: "Work Control design",
    sequence: "1.1",
    priority: "P0",
    status: "DONE",
    nextAction: "Release M-002",
    dependency: "Work Control v1 + G2.5",
    definitionOfDone: "Operating standard, schema and live queue exist",
    evidenceRequired: "Reference records",
    qaRequired: ["Q1"],
  },
  {
    id: "M-002",
    parentId: "OBJ-001",
    level: "milestone",
    title: "Connect persistent state and real execution",
    businessOutcome: "Turn Work Control into the operating surface rather than a static preview",
    owner: "Agent 000",
    executor: "Run 014 + Operations Core",
    sequence: "1.2",
    priority: "P0",
    status: "IN_PROGRESS",
    nextAction: "Complete WO-002A persistent execution ledger",
    dependency: "M-001",
    definitionOfDone: "UI persists state, dispatches one governed request, receives truthful runtime state/result, and records evidence",
    evidenceRequired: "Persistent ledger + execution log + QA",
    qaRequired: ["Q1", "Q2 as applicable", "Q3 as applicable"],
  },
  {
    id: "M-003",
    parentId: "OBJ-001",
    level: "milestone",
    title: "Universal n8n → AI → data → status pipeline",
    businessOutcome: "Reusable machine plumbing",
    owner: "Agent 000",
    executor: "Automation / engineering team",
    sequence: "1.3",
    priority: "P0",
    status: "BACKLOG",
    nextAction: "Integrate SourceMargin",
    dependency: "M-002",
    definitionOfDone: "Scheduled/on-demand → collect → AI → verify → score → store → output → status works end-to-end",
    evidenceRequired: "Workflow export + executions + stored records",
    qaRequired: ["Q1", "Q2", "Q3 as applicable"],
  },
  {
    id: "M-004",
    parentId: "OBJ-001",
    level: "milestone",
    title: "Run SourceMargin on common engine",
    businessOutcome: "First money workload produces ranked profitable candidates",
    owner: "Agent 000",
    executor: "SourceMargin + required specialists",
    sequence: "2",
    priority: "P0",
    status: "BACKLOG",
    nextAction: "Integrate Acquisition Radar",
    dependency: "M-003",
    definitionOfDone: "Real products processed with supplier evidence, demand, landed economics, risk and ranked output",
    evidenceRequired: "Product evidence + calculations + QA",
    qaRequired: ["Q1", "Q2", "Q3"],
  },
  {
    id: "M-005",
    parentId: "OBJ-001",
    level: "milestone",
    title: "Run Acquisition Radar on common engine",
    businessOutcome: "Prove engine generalizes to digital-asset acquisition intelligence",
    owner: "Agent 000",
    executor: "Run 011 + required specialists",
    sequence: "3",
    priority: "P1",
    status: "BACKLOG",
    nextAction: "Integrate Run 016 / Nembra",
    dependency: "M-004",
    definitionOfDone: "Real listings processed with evidence, valuation, risk and ranked opportunity",
    evidenceRequired: "Listing evidence + valuation + QA",
    qaRequired: ["Q1", "Q2", "Q3"],
  },
  {
    id: "M-006",
    parentId: "OBJ-001",
    level: "milestone",
    title: "Run 016 / Nembra on common engine",
    businessOutcome: "Prove continuous intelligence + media transformation",
    owner: "Agent 000",
    executor: "Run 016 + media/domain specialists",
    sequence: "4",
    priority: "P1",
    status: "BACKLOG",
    nextAction: "Run economics comparison",
    dependency: "M-005",
    definitionOfDone: "Verified scored technology events produce intelligence and media-ready output",
    evidenceRequired: "Source evidence + scoring + output + QA",
    qaRequired: ["Q1", "Q2", "Q3"],
  },
  {
    id: "M-007",
    parentId: "OBJ-001",
    level: "milestone",
    title: "Economics decision gate",
    businessOutcome: "Allocate effort based on demonstrated economics",
    owner: "Owner",
    executor: "Agent 000 analysis + Factory evidence",
    sequence: "5",
    priority: "P0",
    status: "BACKLOG",
    nextAction: "Allocate ~80% of incremental effort to winner",
    dependency: "M-004 + M-005 + M-006",
    definitionOfDone: "Comparable revenue/profit, cost, reliability, human-time, automation and asset-value metrics exist",
    evidenceRequired: "Metric ledger + recommendation",
    qaRequired: ["Q2", "Q3"],
  },
  {
    id: "WO-002A",
    parentId: "M-002",
    level: "work_order",
    title: "Persistent execution ledger + UI state",
    businessOutcome: "Make Work Control state durable, authenticated and queryable",
    owner: "Run 014",
    executor: "Backend/data specialists",
    sequence: "1.2.1",
    priority: "P0",
    status: "READY",
    nextAction: "Verify state survives reload and record first transition event",
    dependency: "Work Control v2 preview + Firebase Auth/Firestore",
    definitionOfDone: "Objectives, milestones, work orders, status transitions and event history persist under the signed-in owner",
    evidenceRequired: "Firestore records + event history + reload test",
    qaRequired: ["Q1", "Q3"],
  },
  {
    id: "WO-002B",
    parentId: "M-002",
    level: "work_order",
    title: "Connect Dispatch to n8n / Factory adapter",
    businessOutcome: "Turn a READY work order into governed real execution",
    owner: "Run 014",
    executor: "Software engineering + Operations Core",
    sequence: "1.2.2",
    priority: "P0",
    status: "BACKLOG",
    nextAction: "Implement signed adapter request and runtime-state callback",
    dependency: "WO-002A",
    definitionOfDone: "One low-risk work order can dispatch, report runtime state, return result/evidence and update the ledger",
    evidenceRequired: "Adapter contract + execution log + ledger events",
    qaRequired: ["Q1", "Q2 as applicable", "Q3"],
  },
  {
    id: "WO-002C",
    parentId: "M-002",
    level: "work_order",
    title: "Prove one live governed work order",
    businessOutcome: "Demonstrate Work Control is operational, not a mock",
    owner: "Agent 000",
    executor: "Run 014 / Operations Core",
    sequence: "1.2.3",
    priority: "P0",
    status: "BACKLOG",
    nextAction: "Release M-003 after QA pass",
    dependency: "WO-002A + WO-002B",
    definitionOfDone: "READY → IN_PROGRESS → QA → DONE occurs with evidence and truthful state",
    evidenceRequired: "Run log + ledger history + QA result",
    qaRequired: ["Q1", "Q2", "Q3"],
  },
];

const userDoc = (uid) => doc(db, "factoryWorkControlV2", uid);
const itemsCollection = (uid) => collection(db, "factoryWorkControlV2", uid, "items");
const eventsCollection = (uid) => collection(db, "factoryWorkControlV2", uid, "events");

export async function ensureLedger(uid) {
  if (!uid) throw new Error("AUTH_REQUIRED");
  const existing = await getDocs(query(itemsCollection(uid), limit(1)));
  if (!existing.empty) return;

  const batch = writeBatch(db);
  defaultItems.forEach((item) => {
    batch.set(doc(db, "factoryWorkControlV2", uid, "items", item.id), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  batch.set(userDoc(uid), {
    version: WORK_CONTROL_VERSION,
    referenceId: "REF-FACTORY-EXEC-2026-09-07",
    initializedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(eventsCollection(uid)), {
    type: "LEDGER_INITIALIZED",
    itemId: "OBJ-001",
    detail: "Work Control v2 persistent ledger initialized.",
    actor: "system",
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export function subscribeItems(uid, onData, onError) {
  return onSnapshot(itemsCollection(uid), (snapshot) => {
    const rows = snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
    rows.sort((a, b) => String(a.sequence || "").localeCompare(String(b.sequence || ""), undefined, { numeric: true }));
    onData(rows);
  }, onError);
}

export function subscribeEvents(uid, onData, onError) {
  const eventQuery = query(eventsCollection(uid), orderBy("createdAt", "desc"), limit(25));
  return onSnapshot(eventQuery, (snapshot) => {
    onData(snapshot.docs.map((record) => ({ id: record.id, ...record.data() })));
  }, onError);
}

export async function transitionItem(uid, item, nextStatus, actor = "owner") {
  if (!uid) throw new Error("AUTH_REQUIRED");
  if (!item?.id) throw new Error("ITEM_REQUIRED");

  const allowed = {
    BACKLOG: ["READY", "BLOCKED", "KILLED"],
    READY: ["IN_PROGRESS", "BLOCKED", "KILLED"],
    IN_PROGRESS: ["QA", "BLOCKED", "KILLED"],
    QA: ["IN_PROGRESS", "WAITING_APPROVAL", "DONE", "BLOCKED"],
    WAITING_APPROVAL: ["IN_PROGRESS", "DONE", "KILLED"],
    BLOCKED: ["READY", "IN_PROGRESS", "KILLED"],
    DONE: [],
    KILLED: [],
  };
  const current = item.status || "BACKLOG";
  if (!allowed[current]?.includes(nextStatus)) {
    throw new Error(`INVALID_TRANSITION:${current}->${nextStatus}`);
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "factoryWorkControlV2", uid, "items", item.id), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(eventsCollection(uid)), {
    type: "STATUS_TRANSITION",
    itemId: item.id,
    fromStatus: current,
    toStatus: nextStatus,
    detail: `${item.id} moved ${current} → ${nextStatus}`,
    actor,
    createdAt: serverTimestamp(),
  });
  batch.update(userDoc(uid), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function updateItemFields(uid, itemId, patch, actor = "owner") {
  if (!uid) throw new Error("AUTH_REQUIRED");
  if (!itemId) throw new Error("ITEM_REQUIRED");
  await updateDoc(doc(db, "factoryWorkControlV2", uid, "items", itemId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(eventsCollection(uid)), {
    type: "ITEM_UPDATED",
    itemId,
    detail: `Updated ${Object.keys(patch).join(", ")}`,
    actor,
    createdAt: serverTimestamp(),
  });
}
