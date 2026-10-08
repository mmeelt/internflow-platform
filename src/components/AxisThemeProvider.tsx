"use client";

import { useEffect } from "react";
import { applySavedAxisTheme } from "@/lib/axis-theme";

/** Restores the visual Centre of Excellence preference before each workspace renders. */
export function AxisThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applySavedAxisTheme();
  }, []);

  return <>{children}</>;
}
