"use client";

import { useState } from "react";
import { Sparkles, BarChart3, Code, TrendingUp, Zap } from "lucide-react";

interface StarterOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  suggestedPrompts: string[];
}

const STARTERS: StarterOption[] = [
  {
    id: "pm",
    name: "Product Manager",
    description: "Usage trends, top accounts, feature adoption",
    icon: <TrendingUp className="w-6 h-6" />,
    suggestedPrompts: [
      "Show me DAU trend for the last 7 days",
      "Which accounts have the most requests?",
      "Show top tools by usage count",
    ],
  },
  {
    id: "engineer",
    name: "Data Engineer",
    description: "Pipeline health, query volumes, data freshness",
    icon: <Code className="w-6 h-6" />,
    suggestedPrompts: [
      "Show pipeline health for all tables",
      "Graph daily request volume over 2 weeks",
      "What's the distribution of request types?",
    ],
  },
  {
    id: "executive",
    name: "Executive",
    description: "High-level KPIs, growth metrics, credits",
    icon: <BarChart3 className="w-6 h-6" />,
    suggestedPrompts: [
      "Show me total DAU as a big number",
      "Weekly credits consumption",
      "30-day growth trend",
    ],
  },
  {
    id: "blank",
    name: "Start Fresh",
    description: "Empty canvas - build exactly what you need",
    icon: <Zap className="w-6 h-6" />,
    suggestedPrompts: [
      "Show me a table of top 10 accounts",
      "Create a trend chart of daily users",
      "Add a metric card for total requests",
    ],
  },
];

interface OnboardingProps {
  onComplete: (starterId: string) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-400 text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            AI-Powered Dashboard
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Welcome to Snowmi
          </h1>
          <p className="text-slate-400 text-lg">
            Pick a starting point, then chat to build your perfect dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {STARTERS.map((starter) => (
            <button
              key={starter.id}
              onClick={() => setSelected(starter.id)}
              className={`p-5 rounded-xl border text-left transition-all ${
                selected === starter.id
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-2.5 rounded-lg ${
                    selected === starter.id
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {starter.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">
                    {starter.name}
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    {starter.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {starter.suggestedPrompts.slice(0, 2).map((prompt, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-500"
                      >
                        "{prompt.slice(0, 25)}..."
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => selected && onComplete(selected)}
            disabled={!selected}
            className={`px-8 py-3 rounded-xl font-medium transition-all ${
              selected
                ? "bg-cyan-500 text-slate-900 hover:bg-cyan-400"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            Get Started
          </button>
          <p className="text-slate-500 text-sm mt-4">
            You can always change your mind - just chat to add or remove cards.
          </p>
        </div>
      </div>
    </div>
  );
}
