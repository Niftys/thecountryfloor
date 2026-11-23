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
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
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
  const { denseChrome, isPhone } = useResponsiveLayout();

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
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={2} color="primary">
        <Toolbar
          sx={{
            gap: { xs: 1, md: 2 },
            minHeight: { xs: 56, sm: 64, md: 72 },
            flexWrap: "wrap",
            py: { xs: 0.75, md: 1.25 },
            px: { xs: 1.25, sm: 2 },
          }}
        >
          <Box sx={{ flex: 1, minWidth: { xs: 100, sm: 160 } }}>
            <Typography
              variant="h5"
              component="h1"
              sx={{ fontSize: { xs: "1.15rem", sm: "1.35rem", md: "1.55rem" } }}
            >
              {title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                opacity: 0.95,
                fontSize: { xs: "0.8rem", md: "1rem" },
                display: { xs: denseChrome ? "none" : "block", sm: "block" },
              }}
            >
              {displayName}
              {ROLE_LABEL[role] && title !== ROLE_LABEL[role]
                ? ` · ${ROLE_LABEL[role]}`
                : ""}
            </Typography>
          </Box>
          <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" useFlexGap flexWrap="wrap">
            <ThemePrefsToggles />
            {links.map((link) => (
              <Button
                key={link.href}
                color="inherit"
                variant="outlined"
                component={Link}
                href={link.href}
                size={isPhone ? "small" : "medium"}
                sx={{
                  borderColor: "rgba(255,255,255,0.55)",
                  minHeight: { xs: 40, md: 48 },
                  px: { xs: 1, md: 2 },
                  fontSize: { xs: "0.85rem", md: "1rem" },
                }}
              >
                {link.label}
              </Button>
            ))}
            <Button
              color="inherit"
              variant="contained"
              size={isPhone ? "small" : "medium"}
              onClick={logout}
              sx={{
                bgcolor: "rgba(0,0,0,0.28)",
                minHeight: { xs: 40, md: 48 },
                px: { xs: 1.25, md: 2 },
                fontSize: { xs: "0.85rem", md: "1rem" },
                "&:hover": { bgcolor: "rgba(0,0,0,0.4)" },
              }}
            >
              {isPhone ? "Out" : "Sign out"}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          p: { xs: 1.25, sm: 2, md: 3 },
          maxWidth: 1400,
          mx: "auto",
          pb: { xs: 8, md: 4 },
          width: "100%",
        }}
      >
        <ClientAuthGate>{children}</ClientAuthGate>
      </Box>
    </Box>
  );
}
