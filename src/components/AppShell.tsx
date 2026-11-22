"use client";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemePrefsToggles } from "@/components/ThemePrefs";

type Props = {
  title: string;
  role: string;
  displayName: string;
  links?: { href: string; label: string }[];
  children: React.ReactNode;
};

export function AppShell({ title, role, displayName, links = [], children }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={1} color="primary">
        <Toolbar sx={{ gap: 2, minHeight: 72, flexWrap: "wrap", py: 1 }}>
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography variant="h5">{title}</Typography>
            <Typography variant="body2">
              {displayName} · {role}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <ThemePrefsToggles />
            {links.map((link) => (
              <Button key={link.href} color="inherit" component={Link} href={link.href}>
                {link.label}
              </Button>
            ))}
            <Button color="inherit" variant="outlined" onClick={logout}>
              Sign out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>{children}</Box>
    </Box>
  );
}
