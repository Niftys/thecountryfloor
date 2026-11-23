"use client";

import { useMediaQuery, useTheme } from "@mui/material";

/**
 * Shared viewport flags for phone / iPad / laptop and orientation.
 * Breakpoints (MUI defaults): xs 0 · sm 600 · md 900 · lg 1200
 * - phone: <600
 * - tablet band: 600–1199 (covers iPad portrait + landscape)
 * - desktop: ≥1200
 */
export function useResponsiveLayout() {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "lg"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const isLandscape = useMediaQuery("(orientation: landscape)");
  const isNarrow = useMediaQuery("(max-width: 900px)");

  /**
   * Vertical space taken by app bar + page padding (not including JudgeBoard internals).
   * Compact mode collapses session controls into an accordion, so reserve less.
   */
  function judgeChromePx(options?: { compact?: boolean; settingsOpen?: boolean }) {
    const compact = Boolean(options?.compact);
    const settingsOpen = Boolean(options?.settingsOpen);
    if (compact) {
      if (settingsOpen) return isPhone ? (isLandscape ? 260 : 340) : isPortrait ? 300 : 260;
      return isPhone ? (isLandscape ? 96 : 108) : 100;
    }
    return isPhone ? (isLandscape ? 150 : 230) : isPortrait ? 210 : 170;
  }

  return {
    isPhone,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
    isNarrow,
    judgeChromePx,
    /** Prefer denser chrome on phones and portrait tablets. */
    denseChrome: isPhone || (isTablet && isPortrait),
  };
}
