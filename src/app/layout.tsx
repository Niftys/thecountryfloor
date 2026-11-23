import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import type { Metadata, Viewport } from "next";
import { ThemePrefsProvider } from "@/components/ThemePrefs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Countryfloor",
  description: "ACDA country dance judging for tablets",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ThemePrefsProvider>
            <CssBaseline />
            {children}
          </ThemePrefsProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
