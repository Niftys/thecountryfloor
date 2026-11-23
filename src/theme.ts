"use client";

import { createTheme } from "@mui/material/styles";

/**
 * Responsive base theme:
 * - phone (xs): denser targets, readable type
 * - tablet (sm/md): roomy judging targets
 * - laptop (lg+): same as tablet with slightly larger headings
 */
export const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  palette: {
    mode: "light",
    primary: { main: "#0d47a1" },
    secondary: { main: "#c62828" },
    success: { main: "#2e7d32" },
    warning: { main: "#e65100" },
    error: { main: "#b71c1c" },
    background: { default: "#eceff1", paper: "#ffffff" },
    text: { primary: "#102027", secondary: "#37474f" },
  },
  typography: {
    fontSize: 16,
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h4: { fontWeight: 800, fontSize: "1.55rem", letterSpacing: 0 },
    h5: { fontWeight: 800, fontSize: "1.3rem" },
    h6: { fontWeight: 700, fontSize: "1.1rem" },
    body1: { fontSize: "1rem", lineHeight: 1.5 },
    body2: { fontSize: "0.95rem", lineHeight: 1.45 },
    button: { textTransform: "none", fontWeight: 800, fontSize: "1rem" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { size: "large" },
      styleOverrides: {
        root: ({ theme: t }) => ({
          minHeight: 44,
          paddingInline: 14,
          borderRadius: 12,
          [t.breakpoints.up("sm")]: { minHeight: 52, paddingInline: 18 },
          [t.breakpoints.up("md")]: { minHeight: 56, paddingInline: 22 },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          fontWeight: 700,
          fontSize: "0.9rem",
          minHeight: 32,
          [t.breakpoints.up("md")]: { fontSize: "1rem", minHeight: 40 },
        }),
        label: { px: 1.25 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          minWidth: 52,
          minHeight: 52,
          padding: "8px 10px",
          fontSize: "1.15rem",
          fontWeight: 800,
          lineHeight: 1,
          [t.breakpoints.up("sm")]: {
            minWidth: 72,
            minHeight: 72,
            padding: "10px 12px",
            fontSize: "1.45rem",
          },
          [t.breakpoints.up("md")]: {
            minWidth: 88,
            minHeight: 88,
            padding: "12px 16px",
            fontSize: "1.75rem",
          },
          [t.breakpoints.up("lg")]: {
            minWidth: 96,
            minHeight: 96,
            fontSize: "1.85rem",
          },
        }),
      },
    },
    MuiTextField: {
      defaultProps: { size: "medium", variant: "outlined" },
    },
    MuiFormControl: {
      defaultProps: { size: "medium" },
    },
    MuiSelect: {
      defaultProps: { size: "medium" },
      styleOverrides: {
        select: { minHeight: 28, display: "flex", alignItems: "center" },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          minHeight: 44,
          fontSize: "1rem",
          [t.breakpoints.up("md")]: { minHeight: 52, fontSize: "1.1rem" },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          fontSize: "0.95rem",
          py: 1,
          [t.breakpoints.up("md")]: { fontSize: "1.05rem", py: 1.25 },
        }),
        head: ({ theme: t }) => ({
          fontWeight: 800,
          fontSize: "0.9rem",
          bgcolor: "#f5f7f9",
          [t.breakpoints.up("md")]: { fontSize: "1rem" },
        }),
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          fontSize: "0.95rem",
          alignItems: "center",
          [t.breakpoints.up("md")]: { fontSize: "1.1rem" },
        }),
        message: { width: "100%" },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          fontSize: "1.25rem",
          fontWeight: 800,
          [t.breakpoints.up("md")]: { fontSize: "1.5rem" },
        }),
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          minHeight: 56,
          [t.breakpoints.up("sm")]: { minHeight: 64 },
          [t.breakpoints.up("md")]: { minHeight: 72 },
        }),
      },
    },
  },
});

// Responsive typography scale (must apply after createTheme for breakpoint helpers).
theme.typography.h4 = {
  ...theme.typography.h4,
  fontWeight: 800,
  fontSize: "1.55rem",
  [theme.breakpoints.up("sm")]: { fontSize: "1.75rem" },
  [theme.breakpoints.up("md")]: { fontSize: "2rem" },
};
theme.typography.h5 = {
  ...theme.typography.h5,
  fontWeight: 800,
  fontSize: "1.25rem",
  [theme.breakpoints.up("sm")]: { fontSize: "1.4rem" },
  [theme.breakpoints.up("md")]: { fontSize: "1.55rem" },
};
theme.typography.h6 = {
  ...theme.typography.h6,
  fontWeight: 700,
  fontSize: "1.05rem",
  [theme.breakpoints.up("md")]: { fontSize: "1.25rem" },
};
theme.typography.body1 = {
  ...theme.typography.body1,
  fontSize: "1rem",
  [theme.breakpoints.up("md")]: { fontSize: "1.125rem" },
};
theme.typography.button = {
  ...theme.typography.button,
  textTransform: "none",
  fontWeight: 800,
  fontSize: "1rem",
  [theme.breakpoints.up("md")]: { fontSize: "1.15rem" },
};
