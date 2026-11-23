"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { theme as baseTheme } from "@/theme";

type Prefs = { highContrast: boolean; largeType: boolean };

const PrefsContext = createContext<{
  prefs: Prefs;
  setPrefs: (prefs: Prefs) => void;
}>({
  prefs: { highContrast: false, largeType: false },
  setPrefs: () => {},
});

const STORAGE_KEY = "countryfloor.themePrefs";

export function ThemePrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>({ highContrast: false, largeType: false });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefsState(JSON.parse(raw) as Prefs);
    } catch {
      /* ignore */
    }
  }, []);

  function setPrefs(next: Prefs) {
    setPrefsState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const theme = useMemo(() => {
    return createTheme(baseTheme, {
      palette: prefs.highContrast
        ? {
            mode: "light",
            background: { default: "#ffffff", paper: "#ffffff" },
            text: { primary: "#000000", secondary: "#111111" },
            primary: { main: "#000000", contrastText: "#ffffff" },
            secondary: { main: "#b71c1c" },
            error: { main: "#b71c1c" },
            divider: "#000000",
          }
        : {},
      typography: {
        fontSize: prefs.largeType ? 22 : 18,
        h4: { fontWeight: 800, fontSize: prefs.largeType ? "2.4rem" : undefined },
        h5: { fontWeight: 800, fontSize: prefs.largeType ? "1.9rem" : undefined },
        h6: { fontWeight: 700, fontSize: prefs.largeType ? "1.5rem" : undefined },
        button: {
          textTransform: "none",
          fontWeight: 700,
          fontSize: prefs.largeType ? "1.2rem" : "1.05rem",
        },
      },
      components: {
        MuiToggleButton: {
          styleOverrides: {
            root: {
              minWidth: prefs.largeType ? 104 : 88,
              minHeight: prefs.largeType ? 104 : 88,
              padding: "12px 16px",
              fontSize: prefs.largeType ? "2rem" : "1.75rem",
              fontWeight: 800,
              lineHeight: 1,
              ...(prefs.highContrast
                ? {
                    borderWidth: 2,
                    borderColor: "#000",
                    "&.Mui-selected": { bgcolor: "#000", color: "#fff" },
                  }
                : {}),
            },
          },
        },
      },
    });
  }, [prefs]);

  return (
    <PrefsContext.Provider value={{ prefs, setPrefs }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </PrefsContext.Provider>
  );
}

export function useThemePrefs() {
  return useContext(PrefsContext);
}

export function ThemePrefsToggles() {
  const { prefs, setPrefs } = useThemePrefs();
  return (
    <>
      <FormControlLabel
        sx={{
          color: "inherit",
          mr: 0.5,
          "& .MuiFormControlLabel-label": { fontSize: "1.05rem", fontWeight: 700 },
        }}
        control={
          <Switch
            color="default"
            checked={prefs.largeType}
            onChange={(event) => setPrefs({ ...prefs, largeType: event.target.checked })}
            inputProps={{ "aria-label": "Larger text" }}
          />
        }
        label="Bigger text"
      />
      <FormControlLabel
        sx={{
          color: "inherit",
          mr: 1,
          "& .MuiFormControlLabel-label": { fontSize: "1.05rem", fontWeight: 700 },
        }}
        control={
          <Switch
            color="default"
            checked={prefs.highContrast}
            onChange={(event) => setPrefs({ ...prefs, highContrast: event.target.checked })}
            inputProps={{ "aria-label": "High contrast" }}
          />
        }
        label="High contrast"
      />
    </>
  );
}
