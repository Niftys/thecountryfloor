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
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getClientAuth } from "@/lib/firebase/client";

type Props = {
  title: string;
  role: string;
  displayName: string;
  links?: { href: string; label: string }[];
  /** Slimmer header for scoring tablets — less chrome above the heat. */
  scoringFocus?: boolean;
  children: React.ReactNode;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  JUDGE: "Judge",
  SCRUTINEER: "Scrutineer",
};

export function AppShell({
  title,
  role,
  displayName,
  links = [],
  scoringFocus = false,
  children,
}: Props) {
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
    <Box
      sx={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
        pt: "env(safe-area-inset-top)",
        pb: "env(safe-area-inset-bottom)",
        pl: "env(safe-area-inset-left)",
        pr: "env(safe-area-inset-right)",
      }}
    >
      <AppBar position="static" elevation={2} color="primary" sx={{ flexShrink: 0 }}>
        <Toolbar
          sx={{
            gap: { xs: 0.75, md: scoringFocus ? 1 : 2 },
            minHeight: scoringFocus ? { xs: 48, sm: 52 } : { xs: 56, sm: 64 },
            flexWrap: scoringFocus ? "nowrap" : "wrap",
            py: scoringFocus ? 0.5 : { xs: 0.75, md: 1 },
            px: { xs: 1.25, sm: 2 },
          }}
        >
          <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
            <Typography
              variant="h5"
              component="h1"
              noWrap
              sx={{
                fontSize: scoringFocus
                  ? { xs: "1.05rem", sm: "1.2rem" }
                  : { xs: "1.15rem", sm: "1.35rem", md: "1.55rem" },
              }}
            >
              {title}
            </Typography>
            {!scoringFocus ? (
              <Typography
                variant="body2"
                noWrap
                sx={{
                  opacity: 0.95,
                  fontSize: { xs: "0.8rem", md: "1rem" },
                  display: { xs: denseChrome ? "none" : "block", sm: "block" },
                }}
              >
                {displayName}
                {ROLE_LABEL[role] &&
                title !== ROLE_LABEL[role] &&
                displayName !== ROLE_LABEL[role]
                  ? ` · ${ROLE_LABEL[role]}`
                  : ""}
              </Typography>
            ) : null}
          </Box>
          <Stack
            direction="row"
            spacing={{ xs: 0.5, sm: 1 }}
            alignItems="center"
            useFlexGap
            sx={{ flexShrink: 0 }}
          >
            {links.map((link) => (
              <Button
                key={link.href}
                color="inherit"
                variant="outlined"
                component={Link}
                href={link.href}
                size="small"
                sx={{
                  borderColor: "rgba(255,255,255,0.55)",
                  minHeight: scoringFocus ? 36 : { xs: 40, md: 48 },
                  px: { xs: 1, md: scoringFocus ? 1.25 : 2 },
                  fontSize: { xs: "0.8rem", md: "0.95rem" },
                }}
              >
                {link.label}
              </Button>
            ))}
            <Button
              color="inherit"
              variant="contained"
              size="small"
              onClick={logout}
              sx={{
                bgcolor: "rgba(0,0,0,0.28)",
                minHeight: scoringFocus ? 36 : { xs: 40, md: 48 },
                px: { xs: 1.25, md: 2 },
                fontSize: { xs: "0.8rem", md: "0.95rem" },
                "&:hover": { bgcolor: "rgba(0,0,0,0.4)" },
              }}
            >
              {isPhone || scoringFocus ? "Out" : "Sign out"}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          p: scoringFocus ? { xs: 1, sm: 1.25, md: 1.5 } : { xs: 1.25, sm: 2, md: 3 },
          maxWidth: 1400,
          mx: "auto",
          width: "100%",
        }}
      >
        <ClientAuthGate>{children}</ClientAuthGate>
      </Box>
    </Box>
  );
}
