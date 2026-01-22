"use client";

import { useEffect, useState } from "react";
import { DashboardCard } from "@/lib/dashboard-state";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Clock,
  PartyPopper,
  X,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface CardRendererProps {
  card: DashboardCard;
  onRemove?: () => void;
  onUpdate?: (updates: Partial<DashboardCard>) => void;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CardWrapper({
  card,
  children,
  onRemove,
  showSql,
  onToggleSql,
}: {
  card: DashboardCard;
  children: React.ReactNode;
  onRemove?: () => void;
  showSql?: boolean;
  onToggleSql?: () => void;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5 group relative">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={onToggleSql}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
          title={showSql ? "Hide SQL" : "Show SQL"}
        >
          {showSql ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-red-400"
            title="Remove card"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
        <GripVertical className="w-4 h-4 text-slate-600" />
      </div>
      {children}
      {showSql && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <pre className="text-xs text-slate-500 font-mono overflow-x-auto whitespace-pre-wrap">
            {card.sql}
          </pre>
        </div>
      )}
    </div>
  );
}

function LoadingCard({ title }: { title: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-200 mb-4">{title}</h3>
      <div className="h-32 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

function ErrorCard({ title, error }: { title: string; error: string }) {
  return (
    <div className="bg-slate-900/50 border border-red-500/30 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-200 mb-2">{title}</h3>
      <p className="text-sm text-red-400">{error}</p>
    </div>
  );
}

function MetricCard({ card, onRemove }: CardRendererProps) {
  const [showSql, setShowSql] = useState(false);
  const data = card.data?.[0];
  const value = Number(data?.VALUE || 0);
  const prevValue = Number(data?.PREV_VALUE || value);
  const change = prevValue ? ((value - prevValue) / prevValue) * 100 : 0;

  return (
    <CardWrapper card={card} onRemove={onRemove} showSql={showSql} onToggleSql={() => setShowSql(!showSql)}>
      <h3 className="text-sm font-medium text-slate-400 mb-2">{card.title}</h3>
      <div className="flex items-end gap-3">
        <span className="text-4xl font-bold text-white">{formatNumber(value)}</span>
        {card.config.comparison && (
          <span className={`text-sm flex items-center gap-1 ${change >= 0 ? "text-cyan-400" : "text-red-400"}`}>
            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {change >= 0 ? "+" : ""}{change.toFixed(1)}% {card.config.comparison}
          </span>
        )}
      </div>
    </CardWrapper>
  );
}

function TrendCard({ card, onRemove }: CardRendererProps) {
  const [showSql, setShowSql] = useState(false);
  const data = card.data || [];
  const xKey = card.config.xAxis || "DS";
  const yKey = card.config.yAxis || "VALUE";
  const color = card.config.color || "#22d3ee";

  const chartData = data.map((row) => ({
    x: formatDate(String(row[xKey])),
    y: Number(row[yKey]),
  }));

  return (
    <CardWrapper card={card} onRemove={onRemove} showSql={showSql} onToggleSql={() => setShowSql(!showSql)}>
      <h3 className="text-sm font-medium text-slate-200 mb-4">{card.title}</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="x" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={40} tickFormatter={formatNumber} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color }}
            />
            <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardWrapper>
  );
}

function BarCard({ card, onRemove }: CardRendererProps) {
  const [showSql, setShowSql] = useState(false);
  const data = card.data || [];
  const xKey = card.config.xAxis || Object.keys(data[0] || {})[0] || "NAME";
  const yKey = card.config.yAxis || Object.keys(data[0] || {})[1] || "VALUE";
  const color = card.config.color || "#22d3ee";

  const chartData = data.slice(0, card.config.limit || 10).map((row) => ({
    x: String(row[xKey]).slice(0, 15),
    y: Number(row[yKey]),
  }));

  return (
    <CardWrapper card={card} onRemove={onRemove} showSql={showSql} onToggleSql={() => setShowSql(!showSql)}>
      <h3 className="text-sm font-medium text-slate-200 mb-4">{card.title}</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
            <YAxis type="category" dataKey="x" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Bar dataKey="y" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardWrapper>
  );
}

function TableCard({ card, onRemove }: CardRendererProps) {
  const [showSql, setShowSql] = useState(false);
  const data = card.data || [];
  const columns = Object.keys(data[0] || {});

  return (
    <CardWrapper card={card} onRemove={onRemove} showSql={showSql} onToggleSql={() => setShowSql(!showSql)}>
      <h3 className="text-sm font-medium text-slate-200 mb-4">{card.title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              {columns.map((col) => (
                <th key={col} className="text-left text-xs text-slate-500 uppercase tracking-wider py-2 px-2">
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, card.config.limit || 10).map((row, i) => (
              <tr key={i} className="border-b border-slate-800/50 last:border-0">
                {columns.map((col) => (
                  <td key={col} className="py-2 px-2 text-slate-300">
                    {typeof row[col] === "number" ? formatNumber(Number(row[col])) : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardWrapper>
  );
}

function DistributionCard({ card, onRemove }: CardRendererProps) {
  const [showSql, setShowSql] = useState(false);
  const data = card.data || [];
  const COLORS = ["#22d3ee", "#f97316", "#a855f7", "#22c55e", "#eab308"];

  const chartData = data.map((row, i) => ({
    name: String(Object.values(row)[0]),
    value: Number(Object.values(row)[1]),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <CardWrapper card={card} onRemove={onRemove} showSql={showSql} onToggleSql={() => setShowSql(!showSql)}>
      <h3 className="text-sm font-medium text-slate-200 mb-4">{card.title}</h3>
      <div className="h-40 flex items-center">
        <ResponsiveContainer width="50%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0" }}
              itemStyle={{ color: "#e2e8f0" }}
              labelStyle={{ color: "#94a3b8" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {chartData.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
              <span className="text-sm text-slate-300">{item.name}</span>
              <span className="text-sm text-slate-500 ml-auto">{formatNumber(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </CardWrapper>
  );
}

function StatusCard({ card, onRemove }: CardRendererProps) {
  const [showSql, setShowSql] = useState(false);
  const data = card.data || [];

  return (
    <CardWrapper card={card} onRemove={onRemove} showSql={showSql} onToggleSql={() => setShowSql(!showSql)}>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-medium text-slate-200">{card.title}</h3>
      </div>
      <div className="space-y-0">
        {data.map((row, i) => {
          const stale = Number(row.DAYS_STALE) > 1;
          const name = String(row.TABLE_NAME || row.NAME || Object.values(row)[0]);
          return (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-800/50 last:border-0">
              <span className="text-sm font-mono text-cyan-400">{name}</span>
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
    </CardWrapper>
  );
}

function MilestoneCard({ card, onRemove }: CardRendererProps) {
  const [showSql, setShowSql] = useState(false);
  const data = card.data || [];
  const achieved = data.filter((r) => Number(r.MAU_28D) >= 150);
  const approaching = data.filter((r) => Number(r.MAU_28D) >= 140 && Number(r.MAU_28D) < 150);

  return (
    <CardWrapper card={card} onRemove={onRemove} showSql={showSql} onToggleSql={() => setShowSql(!showSql)}>
      <div className="flex items-center gap-2 mb-4">
        <PartyPopper className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-medium text-slate-200">{card.title}</h3>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {achieved.slice(0, 4).map((row, i) => (
          <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-pink-500/20 text-pink-300 font-medium">
            {String(row.ACCOUNT_NAME)} <span className="text-pink-400">{String(row.MAU_28D)} MAU</span>
          </span>
        ))}
      </div>
      {approaching.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <p className="text-xs text-amber-300 font-medium mb-1">Approaching Milestone</p>
          <p className="text-xs text-slate-400">
            {approaching.slice(0, 2).map((r, i) => (
              <span key={i}>
                <span className="text-amber-400">{String(r.ACCOUNT_NAME)}</span> ({String(r.MAU_28D)} MAU){" "}
              </span>
            ))}
            are close to crossing 150.
          </p>
        </div>
      )}
    </CardWrapper>
  );
}

export function DynamicCardRenderer({ card, onRemove, onUpdate }: CardRendererProps) {
  if (card.loading) {
    return <LoadingCard title={card.title} />;
  }

  if (card.error) {
    return <ErrorCard title={card.title} error={card.error} />;
  }

  if (!card.visible) {
    return null;
  }

  switch (card.type) {
    case "metric":
      return <MetricCard card={card} onRemove={onRemove} onUpdate={onUpdate} />;
    case "trend":
      return <TrendCard card={card} onRemove={onRemove} onUpdate={onUpdate} />;
    case "bar":
      return <BarCard card={card} onRemove={onRemove} onUpdate={onUpdate} />;
    case "table":
      return <TableCard card={card} onRemove={onRemove} onUpdate={onUpdate} />;
    case "distribution":
      return <DistributionCard card={card} onRemove={onRemove} onUpdate={onUpdate} />;
    case "status":
      return <StatusCard card={card} onRemove={onRemove} onUpdate={onUpdate} />;
    case "milestone":
      return <MilestoneCard card={card} onRemove={onRemove} onUpdate={onUpdate} />;
    default:
      return <ErrorCard title={card.title} error={`Unknown card type: ${card.type}`} />;
  }
}
