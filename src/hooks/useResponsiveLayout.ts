"use client";

import { useMediaQuery, useTheme } from "@mui/material";

/**
 * Shared viewport flags.
 * Breakpoints: phone <600 · tablet 600–1199 · desktop ≥1200.
 * Scoring layout fills the shell with flex, so it does not estimate chrome height.
 */
export function useResponsiveLayout() {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "lg"));
  const isPortrait = useMediaQuery("(orientation: portrait)");

  return {
    isPhone,
    isTablet,
    isPortrait,
    /** Prefer denser chrome on phones and portrait tablets. */
    denseChrome: isPhone || (isTablet && isPortrait),
  };
}
