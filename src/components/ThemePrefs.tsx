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
    const bump = prefs.largeType ? 1.12 : 1;
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
        fontSize: Math.round(16 * bump),
        h4: { fontWeight: 800 },
        h5: { fontWeight: 800 },
        h6: { fontWeight: 700 },
        button: { textTransform: "none", fontWeight: 800 },
      },
      components: {
        MuiToggleButton: {
          styleOverrides: {
            root: {
              minWidth: 52 * bump,
              minHeight: 52 * bump,
              padding: "8px 10px",
              fontSize: `${1.15 * bump}rem`,
              fontWeight: 800,
              lineHeight: 1,
              [baseTheme.breakpoints.up("sm")]: {
                minWidth: 72 * bump,
                minHeight: 72 * bump,
                padding: "10px 12px",
                fontSize: `${1.45 * bump}rem`,
              },
              [baseTheme.breakpoints.up("md")]: {
                minWidth: 88 * bump,
                minHeight: 88 * bump,
                padding: "12px 16px",
                fontSize: `${1.75 * bump}rem`,
              },
              [baseTheme.breakpoints.up("lg")]: {
                minWidth: 96 * bump,
                minHeight: 96 * bump,
                fontSize: `${1.85 * bump}rem`,
              },
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
        MuiButton: {
          styleOverrides: {
            root: {
              minHeight: 44 * bump,
              [baseTheme.breakpoints.up("sm")]: { minHeight: 52 * bump },
              [baseTheme.breakpoints.up("md")]: { minHeight: 56 * bump },
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
          mr: { xs: 0, sm: 0.5 },
          "& .MuiFormControlLabel-label": {
            fontSize: { xs: "0.8rem", sm: "0.95rem", md: "1.05rem" },
            fontWeight: 700,
            display: { xs: "none", sm: "block" },
          },
        }}
        control={
          <Switch
            color="default"
            size="small"
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
          mr: { xs: 0.5, sm: 1 },
          "& .MuiFormControlLabel-label": {
            fontSize: { xs: "0.8rem", sm: "0.95rem", md: "1.05rem" },
            fontWeight: 700,
            display: { xs: "none", sm: "block" },
          },
        }}
        control={
          <Switch
            color="default"
            size="small"
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
