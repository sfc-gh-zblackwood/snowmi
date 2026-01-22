import { useState, useEffect, useCallback } from "react";

export type CardType = "metric" | "trend" | "bar" | "table" | "distribution" | "status" | "milestone";

export interface CardConfig {
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  format?: "number" | "currency" | "percent";
  comparison?: "wow" | "mom" | "yoy";
  color?: string;
  limit?: number;
}

export interface DashboardCard {
  id: string;
  title: string;
  type: CardType;
  sql: string;
  config: CardConfig;
  position: { x: number; y: number; w: number; h: number };
  visible: boolean;
  createdAt: string;
  source: "template" | "user" | "suggested";
  data?: Record<string, unknown>[];
  loading?: boolean;
  error?: string;
}

export interface DashboardState {
  cards: DashboardCard[];
  role: "pm" | "engineer" | "executive" | "general";
  userName: string;
  lastUpdated: string;
}

const STORAGE_KEY = "snowmi_dashboard_state";
const SYNC_DEBOUNCE_MS = 2000;

let syncTimeout: NodeJS.Timeout | null = null;

async function syncToSnowflake(state: DashboardState): Promise<void> {
  try {
    await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
  } catch (e) {
    console.error("Background sync failed:", e);
  }
}

function debouncedSync(state: DashboardState): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => syncToSnowflake(state), SYNC_DEBOUNCE_MS);
}

export function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const PM_TEMPLATE: DashboardCard[] = [
  {
    id: "pm_dau_trend",
    title: "Cortex Code DAU Trend (7 days)",
    type: "trend",
    sql: `SELECT DS, SUM(TOTAL_ACTIVE_USERS) as DAU FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 7 GROUP BY DS ORDER BY DS`,
    config: { xAxis: "DS", yAxis: "DAU", color: "#22d3ee" },
    position: { x: 0, y: 0, w: 2, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
  {
    id: "pm_top_accounts",
    title: "Top Accounts by Requests",
    type: "table",
    sql: `SELECT SALESFORCE_ACCOUNT_NAME as ACCOUNT_NAME, SUM(TOTAL_DAILY_REQUESTS) as REQUESTS FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 7 AND SALESFORCE_ACCOUNT_NAME IS NOT NULL GROUP BY SALESFORCE_ACCOUNT_NAME ORDER BY REQUESTS DESC LIMIT 10`,
    config: { limit: 10 },
    position: { x: 0, y: 1, w: 1, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
  {
    id: "pm_cli_vs_ui",
    title: "CLI vs UI Requests (7 days)",
    type: "bar",
    sql: `SELECT 'CLI' as SOURCE, SUM(CLI_DAILY_REQUESTS) as REQUESTS FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 7 UNION ALL SELECT 'UI (Snowsight)' as SOURCE, SUM(UI_DAILY_REQUESTS) as REQUESTS FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 7`,
    config: {},
    position: { x: 1, y: 1, w: 1, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
];

const ENGINEER_TEMPLATE: DashboardCard[] = [
  {
    id: "eng_pipeline_health",
    title: "Pipeline Health",
    type: "status",
    sql: `SELECT TABLE_NAME, DATEDIFF('day', MAX(DS), CURRENT_DATE) as DAYS_STALE FROM (
      SELECT 'cortex_code_account_day_fact' as TABLE_NAME, MAX(DS) as DS FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT
      UNION ALL
      SELECT 'cortex_code_user_day_fact', MAX(DS) FROM SNOWSCIENCE.LLM.CORTEX_CODE_USER_DAY_FACT
    ) GROUP BY TABLE_NAME`,
    config: {},
    position: { x: 0, y: 0, w: 1, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
  {
    id: "eng_daily_requests",
    title: "Daily Request Volume",
    type: "trend",
    sql: `SELECT DS, SUM(TOTAL_DAILY_REQUESTS) as REQUESTS FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 14 GROUP BY DS ORDER BY DS`,
    config: { xAxis: "DS", yAxis: "REQUESTS", color: "#22d3ee" },
    position: { x: 1, y: 0, w: 1, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
  {
    id: "eng_tool_usage",
    title: "Top Tools Used (7 days)",
    type: "table",
    sql: `SELECT TOOL_NAME, COUNT(*) as COUNT FROM SNOWSCIENCE.LLM.CORTEX_CODE_TOOL_USAGE WHERE DS >= CURRENT_DATE - 7 GROUP BY TOOL_NAME ORDER BY COUNT DESC LIMIT 10`,
    config: { limit: 10 },
    position: { x: 0, y: 1, w: 2, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
];

const EXECUTIVE_TEMPLATE: DashboardCard[] = [
  {
    id: "exec_total_dau",
    title: "Yesterday DAU",
    type: "metric",
    sql: `SELECT SUM(TOTAL_ACTIVE_USERS) as VALUE FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS = CURRENT_DATE - 1`,
    config: { format: "number", comparison: "wow" },
    position: { x: 0, y: 0, w: 1, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
  {
    id: "exec_total_requests",
    title: "Weekly Requests",
    type: "metric",
    sql: `SELECT SUM(TOTAL_DAILY_REQUESTS) as VALUE FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 7`,
    config: { format: "number" },
    position: { x: 1, y: 0, w: 1, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
  {
    id: "exec_growth_trend",
    title: "DAU Growth Trend (30 days)",
    type: "trend",
    sql: `SELECT DS, SUM(TOTAL_ACTIVE_USERS) as DAU FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS >= CURRENT_DATE - 30 GROUP BY DS ORDER BY DS`,
    config: { xAxis: "DS", yAxis: "DAU", color: "#22d3ee" },
    position: { x: 0, y: 1, w: 2, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
];

const GENERAL_TEMPLATE: DashboardCard[] = [
  {
    id: "gen_active_accounts",
    title: "Active Accounts (Yesterday)",
    type: "metric",
    sql: `SELECT COUNT(DISTINCT ACCOUNT_ID) as VALUE FROM SNOWSCIENCE.LLM.CORTEX_CODE_ACCOUNT_DAY_FACT WHERE DS = CURRENT_DATE - 1`,
    config: { format: "number" },
    position: { x: 0, y: 0, w: 2, h: 1 },
    visible: true,
    createdAt: new Date().toISOString(),
    source: "template",
  },
];

export const ROLE_TEMPLATES: Record<string, DashboardCard[]> = {
  pm: PM_TEMPLATE,
  engineer: ENGINEER_TEMPLATE,
  executive: EXECUTIVE_TEMPLATE,
  general: GENERAL_TEMPLATE,
};

function getDefaultState(role: string = "general"): DashboardState {
  return {
    cards: ROLE_TEMPLATES[role] || GENERAL_TEMPLATE,
    role: role as DashboardState["role"],
    userName: "User",
    lastUpdated: new Date().toISOString(),
  };
}

export function loadDashboardState(): DashboardState {
  if (typeof window === "undefined") return getDefaultState();
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load dashboard state:", e);
  }
  return getDefaultState();
}

export function saveDashboardState(state: DashboardState): void {
  if (typeof window === "undefined") return;
  
  const updated = { ...state, lastUpdated: new Date().toISOString() };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save dashboard state:", e);
  }
  
  debouncedSync(updated);
}

export function useDashboard() {
  const [state, setState] = useState<DashboardState>(() => getDefaultState());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const loaded = loadDashboardState();
    setState(loaded);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (initialized) {
      saveDashboardState(state);
    }
  }, [state, initialized]);

  const addCard = useCallback((card: Omit<DashboardCard, "id" | "createdAt" | "source">) => {
    const newCard: DashboardCard = {
      ...card,
      id: generateCardId(),
      createdAt: new Date().toISOString(),
      source: "user",
    };
    setState((prev) => ({
      ...prev,
      cards: [...prev.cards, newCard],
    }));
    return newCard.id;
  }, []);

  const removeCard = useCallback((cardId: string) => {
    setState((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== cardId),
    }));
  }, []);

  const updateCard = useCallback((cardId: string, updates: Partial<DashboardCard>) => {
    setState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === cardId ? { ...c, ...updates } : c
      ),
    }));
  }, []);

  const toggleCardVisibility = useCallback((cardId: string) => {
    setState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === cardId ? { ...c, visible: !c.visible } : c
      ),
    }));
  }, []);

  const reorderCards = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const cards = [...prev.cards];
      const [moved] = cards.splice(fromIndex, 1);
      cards.splice(toIndex, 0, moved);
      return { ...prev, cards };
    });
  }, []);

  const setRole = useCallback((role: DashboardState["role"]) => {
    setState((prev) => ({
      ...prev,
      role,
      cards: ROLE_TEMPLATES[role] || GENERAL_TEMPLATE,
    }));
  }, []);

  const resetToTemplate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cards: ROLE_TEMPLATES[prev.role] || GENERAL_TEMPLATE,
    }));
  }, []);

  const clearCards = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cards: [],
    }));
  }, []);

  return {
    state,
    initialized,
    addCard,
    removeCard,
    updateCard,
    toggleCardVisibility,
    reorderCards,
    setRole,
    resetToTemplate,
    clearCards,
  };
}
