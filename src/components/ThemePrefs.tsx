"use client";

import { ThemeProvider } from "@mui/material/styles";
import { theme } from "@/theme";

/** Wraps the app in the shared MUI theme (no user accessibility toggles). */
export function ThemePrefsProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
