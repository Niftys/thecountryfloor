"use client";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClientAuthGate } from "@/components/ClientAuthGate";
import { ThemePrefsToggles } from "@/components/ThemePrefs";
import { getClientAuth } from "@/lib/firebase/client";

type Props = {
  title: string;
  role: string;
  displayName: string;
  links?: { href: string; label: string }[];
  children: React.ReactNode;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  JUDGE: "Judge",
  SCRUTINEER: "Scrutineer",
};

export function AppShell({ title, role, displayName, links = [], children }: Props) {
  const router = useRouter();

  async function logout() {
    try {
      await signOut(getClientAuth());
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={2} color="primary">
        <Toolbar sx={{ gap: 2, minHeight: 80, flexWrap: "wrap", py: 1.25 }}>
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography variant="h5" component="h1">
              {title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.95 }}>
              {displayName} · {ROLE_LABEL[role] ?? role}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <ThemePrefsToggles />
            {links.map((link) => (
              <Button
                key={link.href}
                color="inherit"
                variant="outlined"
                component={Link}
                href={link.href}
                sx={{ borderColor: "rgba(255,255,255,0.55)", minHeight: 48 }}
              >
                {link.label}
              </Button>
            ))}
            <Button
              color="inherit"
              variant="contained"
              onClick={logout}
              sx={{ bgcolor: "rgba(0,0,0,0.28)", minHeight: 48, "&:hover": { bgcolor: "rgba(0,0,0,0.4)" } }}
            >
              Sign out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto", pb: { xs: 10, md: 4 } }}>
        <ClientAuthGate>{children}</ClientAuthGate>
      </Box>
    </Box>
  );
}
