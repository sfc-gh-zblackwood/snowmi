"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface DashboardPreferences {
  widgets: string[];
  theme: "light" | "dark" | "system";
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  widgets: ["metrics-overview", "trends-chart", "suggested-actions"],
  theme: "system",
};

const AVAILABLE_WIDGETS = [
  { id: "metrics-overview", label: "Metrics Overview", description: "Key numbers at a glance" },
  { id: "trends-chart", label: "Trends Chart", description: "14-day request trends" },
  { id: "suggested-actions", label: "Suggested Actions", description: "AI-powered recommendations" },
  { id: "top-accounts", label: "Top Accounts", description: "Most active accounts today" },
  { id: "cli-vs-ui", label: "CLI vs UI Split", description: "Usage breakdown by interface" },
  { id: "weekly-comparison", label: "Weekly Comparison", description: "This week vs last week" },
];

interface PreferencesContextType {
  preferences: DashboardPreferences;
  setPreferences: (prefs: DashboardPreferences) => void;
  toggleWidget: (widgetId: string) => void;
  availableWidgets: typeof AVAILABLE_WIDGETS;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<DashboardPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    const saved = localStorage.getItem("snowmi-preferences");
    if (saved) {
      try {
        setPreferencesState(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const setPreferences = (prefs: DashboardPreferences) => {
    setPreferencesState(prefs);
    localStorage.setItem("snowmi-preferences", JSON.stringify(prefs));
  };

  const toggleWidget = (widgetId: string) => {
    const widgets = preferences.widgets.includes(widgetId)
      ? preferences.widgets.filter((w) => w !== widgetId)
      : [...preferences.widgets, widgetId];
    setPreferences({ ...preferences, widgets });
  };

  return (
    <PreferencesContext.Provider
      value={{ preferences, setPreferences, toggleWidget, availableWidgets: AVAILABLE_WIDGETS }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
