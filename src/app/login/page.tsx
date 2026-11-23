"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getClientAuth } from "@/lib/firebase/client";
import { authEmailForUsername } from "@/lib/firebase/usernames";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("demo12");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const email = authEmailForUsername(username);
      const credential = await signInWithEmailAndPassword(getClientAuth(), email, password);
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Could not start session.");
        setBusy(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Username or password is wrong.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This site’s domain is not authorized in Firebase Auth.");
      } else if (code === "auth/api-key-not-valid" || code === "auth/invalid-api-key") {
        setError("Firebase API key is missing or invalid on this deploy.");
      } else {
        setError(code ? `Sign-in failed (${code}).` : "Sign-in failed.");
      }
      setBusy(false);
    }
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
                ACDA judging for tablets. Sample logins use password <strong>demo12</strong>.
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
