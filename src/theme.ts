"use client";

import { createTheme } from "@mui/material/styles";

/** Base theme tuned for tablet judging and older eyes: larger type, bigger targets, clear contrast. */
export const theme = createTheme({
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
    fontSize: 20,
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h4: { fontWeight: 800, fontSize: "2rem", letterSpacing: 0 },
    h5: { fontWeight: 800, fontSize: "1.55rem" },
    h6: { fontWeight: 700, fontSize: "1.25rem" },
    body1: { fontSize: "1.125rem", lineHeight: 1.5 },
    body2: { fontSize: "1.05rem", lineHeight: 1.45 },
    button: { textTransform: "none", fontWeight: 800, fontSize: "1.15rem" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      defaultProps: { size: "large" },
      styleOverrides: {
        root: { minHeight: 56, paddingInline: 22, borderRadius: 12 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, fontSize: "1rem", minHeight: 40 },
        label: { px: 1.25 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minWidth: 96,
          minHeight: 96,
          padding: "12px 16px",
          fontSize: "1.85rem",
          fontWeight: 800,
          lineHeight: 1,
        },
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
        root: { minHeight: 52, fontSize: "1.1rem" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: "1.05rem", py: 1.25 },
        head: { fontWeight: 800, fontSize: "1rem", bgcolor: "#f5f7f9" },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: "1.1rem", alignItems: "center" },
        message: { width: "100%" },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: "1.5rem", fontWeight: 800 },
      },
    },
  },
});
