import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase-config";

export const FIO_VERSION = "1.1";
export const FIO_SCOPE = "public";

export const fallbackFio = {
  meta: {
    version: FIO_VERSION,
    systemState: "FIREBASE_CONNECTING",
    autonomy: "RESEARCH_ONLY",
    tradeExecution: "DISABLED",
    lastDailyRun: null,
    lastMonitorRun: null,
    lastRadarRun: null,
    lastCommitteeRun: null,
  },
  agents: [
    { id: "INV-000", name: "Investment Director", role: "Synthesis, decision memo, sequencing", state: "READY" },
    { id: "INV-01", name: "Business Analyst", role: "Business quality, moat, unit economics", state: "READY" },
    { id: "INV-02", name: "Valuation Analyst", role: "DCF, multiples, SOTP, scenario valuation", state: "READY" },
    { id: "INV-03", name: "Bear / Red Team", role: "Attack thesis, expose failure modes", state: "READY" },
    { id: "INV-04", name: "Market & Catalyst", role: "Catalysts, timing, positioning, macro", state: "READY" },
    { id: "INV-05", name: "Portfolio & Risk", role: "Sizing, concentration, correlation, drawdown", state: "READY" },
    { id: "INV-06", name: "Long-Horizon Scout", role: "5–15 year asymmetric opportunity search", state: "READY" },
    { id: "INV-07", name: "Monitor", role: "Filings, news, prices, thesis-change detection", state: "READY" },
  ],
  assets: [
    { id: "SPCX", ticker: "SPCX", name: "SpaceX", rank: 1, score: 86, thesis: "Launch + connectivity + defense + Starship optionality", status: "ACCUMULATE", confidence: "HIGH", horizon: "10–15 years", targetWeight: "3–5% initial target", dca: "Valuation-aware DCA", marketFeed: "ADAPTER PENDING", memoId: "SPCX" },
    { id: "GOOGL", ticker: "GOOGL", name: "Alphabet", rank: 2, score: 82, thesis: "AI distribution + search cash engine + cloud", status: "WATCH", confidence: "HIGH" },
    { id: "AMZN", ticker: "AMZN", name: "Amazon", rank: 3, score: 80, thesis: "AWS + logistics + ads + AI infrastructure", status: "WATCH", confidence: "HIGH" },
    { id: "NVDA", ticker: "NVDA", name: "NVIDIA", rank: 4, score: 79, thesis: "AI compute platform with exceptional economics", status: "VALUATION CHECK", confidence: "HIGH" },
  ],
  queue: [
    { id: "IR-001", asset: "SpaceX", owner: "INV-000", stage: "COMMITTEE REVIEW", next: "Refresh valuation + red-team thesis", priority: "P0" },
    { id: "IR-002", asset: "Alphabet", owner: "INV-02", stage: "VALUATION", next: "Update long-horizon base/bull/bear", priority: "P1" },
    { id: "IR-003", asset: "Amazon", owner: "INV-01", stage: "BUSINESS QUALITY", next: "Normalize AWS + retail FCF", priority: "P1" },
    { id: "IR-004", asset: "Opportunity Radar", owner: "INV-06", stage: "SCOUTING", next: "Find score > current leader", priority: "P1" },
  ],
  opportunities: [],
  alerts: [],
  runs: [],
  memos: {
    SPCX: {
      id: "SPCX",
      ticker: "SPCX",
      decision: "ACCUMULATE",
      horizon: "10–15 years",
      score: 86,
      confidence: 78,
      targetWeight: "3–5% initial target",
      dca: "Valuation-aware DCA",
      marketFeed: "ADAPTER PENDING",
      thesis: "SpaceX combines launch infrastructure, Starlink recurring connectivity, government/defense relationships and Starship-driven cost optionality in one vertically integrated platform.",
      bull: "Starlink expands margins and ARPU while Starship achieves reliable rapid reuse, opening new orbital markets.",
      bear: "Current valuation outruns cash generation; Starship development, regulation, capex or execution delays compress future returns.",
      kill: [
        "Sustained deterioration in Starlink subscriber economics or churn",
        "Starship fails to reach economically useful reuse within the thesis window",
        "Governance/capital allocation materially impairs minority shareholder economics",
        "Valuation rises enough that expected 10-year return falls below portfolio hurdle rate",
      ],
    },
  },
};

const scopeDoc = () => doc(db, "factoryInvestmentOfficeV1", FIO_SCOPE);
const sub = (name) => collection(db, "factoryInvestmentOfficeV1", FIO_SCOPE, name);

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  return value;
}

function mapCollection(snapshot) {
  return snapshot.docs.map((record) => {
    const data = record.data();
    const row = { id: record.id, ...data };
    ["createdAt", "updatedAt", "startedAt", "completedAt", "publishedAt", "capturedAt"].forEach((key) => {
      if (row[key]) row[key] = normalizeTimestamp(row[key]);
    });
    return row;
  });
}

export function subscribeFio(onData, onStatus) {
  const state = {
    ...fallbackFio,
    meta: { ...fallbackFio.meta },
    agents: [...fallbackFio.agents],
    assets: [...fallbackFio.assets],
    queue: [...fallbackFio.queue],
    opportunities: [],
    alerts: [],
    runs: [],
    memos: { ...fallbackFio.memos },
  };
  const connected = new Set();
  let stopped = false;

  const emit = () => {
    if (stopped) return;
    onData({
      ...state,
      assets: [...state.assets].sort((a, b) => (a.rank || 999) - (b.rank || 999)),
      queue: [...state.queue].sort((a, b) => String(a.priority || "P9").localeCompare(String(b.priority || "P9"))),
      opportunities: [...state.opportunities].sort((a, b) => (b.score || 0) - (a.score || 0)),
      alerts: [...state.alerts].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
      runs: [...state.runs].sort((a, b) => String(b.startedAt || b.createdAt || "").localeCompare(String(a.startedAt || a.createdAt || ""))),
    });
  };

  const handleError = (name) => (error) => {
    console.warn(`FIO Firestore ${name} subscription unavailable`, error);
    if (!stopped) onStatus?.({ state: "FALLBACK", source: name, error: error?.message || String(error) });
  };

  const unsubs = [];
  unsubs.push(onSnapshot(scopeDoc(), (snapshot) => {
    connected.add("meta");
    if (snapshot.exists()) state.meta = { ...state.meta, ...snapshot.data(), systemState: "FIREBASE_CONNECTED" };
    emit();
    onStatus?.({ state: "CONNECTED", source: "meta" });
  }, handleError("meta")));

  const bindings = {
    agents: "agents",
    assets: "assets",
    queue: "queue",
    opportunities: "opportunities",
    alerts: "alerts",
    runs: "runs",
  };

  Object.entries(bindings).forEach(([collectionName, stateKey]) => {
    unsubs.push(onSnapshot(sub(collectionName), (snapshot) => {
      connected.add(collectionName);
      if (!snapshot.empty) state[stateKey] = mapCollection(snapshot);
      emit();
      onStatus?.({ state: "CONNECTED", source: collectionName });
    }, handleError(collectionName)));
  });

  unsubs.push(onSnapshot(sub("memos"), (snapshot) => {
    connected.add("memos");
    if (!snapshot.empty) {
      state.memos = Object.fromEntries(mapCollection(snapshot).map((memo) => [memo.id, memo]));
    }
    emit();
    onStatus?.({ state: "CONNECTED", source: "memos" });
  }, handleError("memos")));

  emit();

  return () => {
    stopped = true;
    unsubs.forEach((unsubscribe) => unsubscribe());
  };
}
