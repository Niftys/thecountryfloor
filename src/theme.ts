"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0d47a1" },
    secondary: { main: "#c62828" },
    success: { main: "#2e7d32" },
    error: { main: "#c62828" },
    background: { default: "#eceff1", paper: "#ffffff" },
  },
  typography: {
    fontSize: 18,
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700, fontSize: "1.05rem" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { size: "large" },
      styleOverrides: {
        root: { minHeight: 56, paddingInline: 20 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minWidth: 88,
          minHeight: 88,
          padding: "12px 16px",
          fontSize: "1.75rem",
          fontWeight: 800,
          lineHeight: 1,
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "medium" },
    },
  },
});
