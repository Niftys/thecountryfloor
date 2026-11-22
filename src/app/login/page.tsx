"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { signInWithCustomToken } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getClientAuth } from "@/lib/firebase/client";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("scrutineer");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = (await response.json().catch(() => null)) as {
      customToken?: string;
      error?: string;
    } | null;
    if (!response.ok) {
      setBusy(false);
      setError("Username or password is wrong.");
      return;
    }
    try {
      if (body?.customToken) {
        await signInWithCustomToken(getClientAuth(), body.customToken);
      }
    } catch {
      // Session cookie still works for SSR; live listeners may need emulator/auth.
    }
    setBusy(false);
    router.push("/");
    router.refresh();
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 3,
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 520 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} component="form" onSubmit={onSubmit}>
            <Box>
              <Typography variant="h4">Countryfloor</Typography>
              <Typography color="text.secondary">
                ACDA judging for tablets. Sample logins use password <strong>demo</strong>.
              </Typography>
            </Box>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              fullWidth
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              fullWidth
              required
            />
            <Button type="submit" variant="contained" disabled={busy} fullWidth>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Try <code>admin</code>, <code>scrutineer</code>, or a judge login such as{" "}
              <code>d.appel</code>.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
