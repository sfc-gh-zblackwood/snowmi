"use client";

import { usePreferences } from "@/lib/preferences";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Check } from "lucide-react";

export function SettingsDialog() {
  const { preferences, toggleWidget, availableWidgets } = usePreferences();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-neutral-900">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          <p className="text-sm text-neutral-500">Select which widgets to display:</p>
          {availableWidgets.map((widget) => {
            const isActive = preferences.widgets.includes(widget.id);
            return (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                  isActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center ${
                    isActive ? "bg-blue-500 text-white" : "bg-neutral-100"
                  }`}
                >
                  {isActive && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{widget.label}</p>
                  <p className="text-xs text-neutral-500">{widget.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
