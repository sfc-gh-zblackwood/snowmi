"use client";

import { PreferencesProvider } from "@/lib/preferences";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <PreferencesProvider>{children}</PreferencesProvider>;
}
