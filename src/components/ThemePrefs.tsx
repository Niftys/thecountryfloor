"use client";

import { ThemeProvider } from "@mui/material/styles";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { NavProgressProvider } from "@/components/NavProgress";
import { UnsavedWorkProvider } from "@/components/UnsavedWork";
import { createAppTheme, type Appearance } from "@/theme";

const STORAGE_KEY = "countryfloor.theme";

type AppearanceValue = {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
};

const AppearanceContext = createContext<AppearanceValue>({
  appearance: "floor",
  setAppearance: () => {},
});

export function useAppearance() {
  return useContext(AppearanceContext);
}

export function ThemePrefsProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>("floor");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "ballroom" || raw === "floor") setAppearanceState(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const theme = useMemo(() => createAppTheme(appearance), [appearance]);

  function setAppearance(next: Appearance) {
    setAppearanceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <AppearanceContext.Provider value={{ appearance, setAppearance }}>
      <ThemeProvider theme={theme}>
        <UnsavedWorkProvider>
          <NavProgressProvider>{children}</NavProgressProvider>
        </UnsavedWorkProvider>
      </ThemeProvider>
    </AppearanceContext.Provider>
  );
}
