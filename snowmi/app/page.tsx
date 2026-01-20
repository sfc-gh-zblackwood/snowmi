"use client";

import { useEffect, useState, useCallback } from "react";
import { ChatPanel, ChatToggleButton } from "@/components/chat-panel";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Clock,
  PartyPopper,
  Send,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";

interface DailyMetric {
  date: string;
  totalRequests: number;
  uiRequests: number;
  cliRequests: number;
  accountCount: number;
}

interface Summary {
  todayRequests: number;
  yesterdayRequests: number;
  weekAgoRequests: number;
  todayAccounts: number;
  requestsChange: number;
  accountsChange: number;
}

interface MetricsData {
  metrics: DailyMetric[];
  summary: Summary;
}

interface DynamicWidget {
  type: string;
  data: Record<string, unknown>[];
  addedAt: Date;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

function MiniBarChart({ data, color = "#22d3ee" }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ value: v, index: i }));
  return (
    <div className="h-10 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap={2}>
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {chartData.map((_, index) => (
              <Cell key={index} fill={color} fillOpacity={0.8 + (index / chartData.length) * 0.2} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>7 days ago</span>
        <span>Yesterday</span>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  metrics,
  sparklineData,
  accentColor = "#22d3ee",
  dotColor = "#22d3ee",
}: {
  title: string;
  metrics: { label: string; value: string; change?: string; changeColor?: string }[];
  sparklineData: number[];
  accentColor?: string;
  dotColor?: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      </div>
      <div className="space-y-3">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-slate-400">{m.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-white">{m.value}</span>
              {m.change && (
                <span className={`text-xs ${m.changeColor || "text-cyan-400"}`}>{m.change}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <MiniBarChart data={sparklineData} color={accentColor} />
    </div>
  );
}

function PipelineHealthCard({ data }: { data: Record<string, unknown>[] }) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-medium text-slate-200">Pipeline Health</h3>
      </div>
      <div className="space-y-0">
        <div className="flex items-center justify-between py-2 border-b border-slate-700/50 text-xs text-slate-500 uppercase tracking-wider">
          <span>Table</span>
          <span>Status</span>
        </div>
        {data.map((row, i) => {
          const stale = Number(row.DAYS_STALE) > 1;
          return (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-800/50 last:border-0">
              <span className="text-sm font-mono text-cyan-400">{String(row.TABLE_NAME)}</span>
              {stale ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Stale
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Fresh
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MAUMilestonesCard({ data }: { data: Record<string, unknown>[] }) {
  const achieved = data.filter((r) => Number(r.MAU_28D) >= 150);
  const approaching = data.filter((r) => Number(r.MAU_28D) >= 140 && Number(r.MAU_28D) < 150);

  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <PartyPopper className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-medium text-slate-200">New 150 MAU Milestones</h3>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {achieved.slice(0, 4).map((row, i) => (
          <span
            key={i}
            className="text-xs px-3 py-1.5 rounded-full bg-pink-500/20 text-pink-300 font-medium"
          >
            {String(row.ACCOUNT_NAME)} <span className="text-pink-400">{String(row.MAU_28D)} MAU</span>
          </span>
        ))}
      </div>
      {approaching.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-2">
          <p className="text-xs text-amber-300 font-medium mb-1">Approaching Milestone</p>
          <p className="text-xs text-slate-400">
            {approaching.slice(0, 2).map((r) => (
              <span key={String(r.ACCOUNT_NAME)}>
                <span className="text-amber-400">{String(r.ACCOUNT_NAME)}</span> ({String(r.MAU_28D)} MAU)
                {" "}
              </span>
            ))}
            are close to crossing 150.
          </p>
        </div>
      )}
    </div>
  );
}

function AnomalyCard({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return null;
  const topAnomaly = data[0];
  const accountName = String(topAnomaly?.ACCOUNT_NAME || "Unknown");
  const pctChange = Number(topAnomaly?.PCT_CHANGE || 0);

  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-medium text-slate-200">
          Anomaly Detected: {accountName} dropped {Math.abs(pctChange)}%
        </h3>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Requests went from{" "}
        <span className="text-white font-medium">{formatNumber(Number(data[0]?.REQUESTS_PREV_7D || 0))}</span>
        {" → "}
        <span className="text-white font-medium">{formatNumber(Number(data[0]?.REQUESTS_LAST_7D || 0))}</span>
        {" "}week-over-week. I investigated and found this is concentrated in{" "}
        <span className="text-cyan-400">{data.length} users</span> who went inactive:
      </p>
      <div className="space-y-0">
        <div className="grid grid-cols-4 py-2 border-b border-slate-700/50 text-xs text-slate-500 uppercase tracking-wider">
          <span>User</span>
          <span className="text-right">Last Week</span>
          <span className="text-right">This Week</span>
          <span className="text-right">Change</span>
        </div>
        {data.slice(0, 3).map((row, i) => {
          const change = Number(row.PCT_CHANGE) || 0;
          return (
            <div key={i} className="grid grid-cols-4 py-2.5 border-b border-slate-800/50 last:border-0 text-sm">
              <span className="text-slate-300">{String(row.USER_EMAIL || row.ACCOUNT_NAME || "—")}</span>
              <span className="text-right text-slate-400">{formatNumber(Number(row.REQUESTS_PREV_7D || 0))}</span>
              <span className="text-right text-slate-400">{formatNumber(Number(row.REQUESTS_LAST_7D || 0))}</span>
              <span className={`text-right font-medium ${change < 0 ? "text-red-400" : "text-emerald-400"}`}>
                {change > 0 ? "+" : ""}{change.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreditChangesWidget({ data }: { data: Record<string, unknown>[] }) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-medium text-slate-200">Top Credit Movers (WoW)</h3>
      </div>
      <div className="space-y-0">
        {data.slice(0, 8).map((row, i) => {
          const change = Number(row.CREDIT_CHANGE);
          const pct = Number(row.PCT_CHANGE);
          const isUp = change > 0;
          return (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
              <span className="text-sm text-slate-300 truncate flex-1">{String(row.ACCOUNT_NAME)}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{formatNumber(Number(row.CREDITS_LAST_7D))}</span>
                <div className={`flex items-center gap-1 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span className="text-xs font-medium">{pct > 0 ? "+" : ""}{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopAccountsWidget({ data }: { data: Record<string, unknown>[] }) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-medium text-slate-200">Top Accounts</h3>
      </div>
      <div className="space-y-0">
        {data.slice(0, 8).map((row, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 w-5">{i + 1}.</span>
              <span className="text-sm text-slate-300 truncate">{String(row.ACCOUNT_NAME)}</span>
            </div>
            <span className="text-xs font-medium text-slate-400">{formatNumber(Number(row.REQUESTS_LAST_7D))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DynamicWidgetRenderer({ widget }: { widget: DynamicWidget }) {
  switch (widget.type) {
    case "dataFreshness":
      return <PipelineHealthCard data={widget.data} />;
    case "creditChanges":
      return <CreditChangesWidget data={widget.data} />;
    case "mauMilestone":
      return <MAUMilestonesCard data={widget.data} />;
    case "anomalies":
      return <AnomalyCard data={widget.data} />;
    case "topAccounts":
      return <TopAccountsWidget data={widget.data} />;
    default:
      return null;
  }
}

const QUICK_ACTIONS = [
  "Why did Samsung drop?",
  "Show me the MAU trend",
  "Which agents is NewStartup using?",
  "Open all queries in Notebook",
];

export default function Home() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [dynamicWidgets, setDynamicWidgets] = useState<DynamicWidget[]>([]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    fetch("/api/metrics")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleWidgetAdd = useCallback((widgetType: string, widgetData: Record<string, unknown>[]) => {
    setDynamicWidgets((prev) => {
      const exists = prev.some((w) => w.type === widgetType);
      if (exists) {
        return prev.map((w) => (w.type === widgetType ? { ...w, data: widgetData, addedAt: new Date() } : w));
      }
      return [...prev, { type: widgetType, data: widgetData, addedAt: new Date() }];
    });
  }, []);

  const siSparkline = data?.metrics
    ? data.metrics.slice(0, 7).reverse().map((m) => m.totalRequests)
    : [0, 0, 0, 0, 0, 0, 0];

  const sisSparkline = data?.metrics
    ? data.metrics.slice(0, 7).reverse().map((m) => m.uiRequests)
    : [0, 0, 0, 0, 0, 0, 0];

  const siMetrics = data?.summary
    ? [
        { label: "Requests Yesterday", value: formatNumber(data.summary.yesterdayRequests), change: `${formatChange(data.summary.requestsChange)} WoW`, changeColor: data.summary.requestsChange >= 0 ? "text-cyan-400" : "text-red-400" },
        { label: "Credits", value: formatNumber(Math.round(data.summary.todayRequests * 0.1)), change: "+5.1% WoW", changeColor: "text-cyan-400" },
        { label: "Companies at 150+ MAU", value: String(data.summary.todayAccounts), change: "+3 this week", changeColor: "text-cyan-400" },
      ]
    : [];

  const sisMetrics = [
    { label: "Views Yesterday", value: "284,291", change: "+3.1% WoW", changeColor: "text-cyan-400" },
    { label: "vNext Adoption", value: "12.4%", change: "up from 8.7%", changeColor: "text-cyan-400" },
    { label: "Credits", value: "45,892", change: "-0.4% WoW", changeColor: "text-red-400" },
  ];

  const handleQuickAction = (action: string) => {
    setChatInput(action);
    setChatOpen(true);
  };

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {getGreeting()}, Tyler
              </h1>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> ~40 min saved
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Here&apos;s your daily health check for{" "}
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </header>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-sm font-medium text-slate-200">Daily Report</span>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3" /> All Systems Healthy
          </span>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5 h-48 animate-pulse" />
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5 h-48 animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <MetricCard
              title="Snowflake Intelligence"
              metrics={siMetrics}
              sparklineData={siSparkline}
              accentColor="#22d3ee"
              dotColor="#22d3ee"
            />
            <MetricCard
              title="Streamlit in Snowflake"
              metrics={sisMetrics}
              sparklineData={sisSparkline}
              accentColor="#22d3ee"
              dotColor="#f97316"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <PipelineHealthCard
            data={[
              { TABLE_NAME: "si_company_day_fact", DAYS_STALE: 0 },
              { TABLE_NAME: "si_user_day_fact", DAYS_STALE: 0 },
              { TABLE_NAME: "sis_company_fact", DAYS_STALE: 0 },
              { TABLE_NAME: "sis_user_fact", DAYS_STALE: 0 },
            ]}
          />
          <MAUMilestonesCard
            data={[
              { ACCOUNT_NAME: "Acme Corp", MAU_28D: 152 },
              { ACCOUNT_NAME: "GlobalTech", MAU_28D: 158 },
              { ACCOUNT_NAME: "DataFlow Inc", MAU_28D: 151 },
              { ACCOUNT_NAME: "TechStart", MAU_28D: 142 },
              { ACCOUNT_NAME: "AnalyticsCo", MAU_28D: 138 },
            ]}
          />
        </div>

        <div className="mb-6">
          <AnomalyCard
            data={[
              { USER_EMAIL: "kim.j@samsung.com", REQUESTS_PREV_7D: 847, REQUESTS_LAST_7D: 12, PCT_CHANGE: -98.6, ACCOUNT_NAME: "Samsung" },
              { USER_EMAIL: "park.s@samsung.com", REQUESTS_PREV_7D: 612, REQUESTS_LAST_7D: 0, PCT_CHANGE: -100 },
              { USER_EMAIL: "All other users", REQUESTS_PREV_7D: 1388, REQUESTS_LAST_7D: 1070, PCT_CHANGE: -22.9 },
            ]}
          />
        </div>

        {dynamicWidgets.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {dynamicWidgets.map((widget, i) => (
                <DynamicWidgetRenderer key={`${widget.type}-${i}`} widget={widget} />
              ))}
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-3 justify-center">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                >
                  {action}
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onFocus={() => setChatOpen(true)}
                placeholder="Ask a follow-up question..."
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 transition-colors">
                <Send className="w-4 h-4 text-slate-900" />
              </button>
            </div>
          </div>
        </div>

        <div className="h-32" />
      </div>

      {!chatOpen && <ChatToggleButton onClick={() => setChatOpen(true)} />}
      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} onWidgetAdd={handleWidgetAdd} initialMessage={chatInput} />
    </main>
  );
}
