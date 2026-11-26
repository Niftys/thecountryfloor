"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppearance } from "@/components/ThemePrefs";
import { getClientAuth } from "@/lib/firebase/client";
import { authEmailForUsername } from "@/lib/firebase/usernames";

const USERNAME_KEY = "countryfloor.lastUsername";

export default function LoginPage() {
  const router = useRouter();
  const { appearance, setAppearance } = useAppearance();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(USERNAME_KEY);
      if (saved) setUsername(saved);
    } catch {
      /* ignore */
    }
  }, []);

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
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Could not start your session. Try again.");
        setBusy(false);
        return;
      }
      try {
        localStorage.setItem(USERNAME_KEY, username.trim());
      } catch {
        /* ignore */
      }
      // Pull freshly written custom claims into the client ID token for live listeners.
      await credential.user.getIdToken(true);
      router.push("/");
      router.refresh();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("That username or password is not correct.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This website is not allowed to sign in yet. Ask an admin to authorize the domain.");
      } else if (code === "auth/api-key-not-valid" || code === "auth/invalid-api-key") {
        setError("Sign-in is misconfigured (API key). Ask an admin for help.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Wait a minute, then try again.");
      } else {
        setError(code ? `Sign-in failed (${code}).` : "Sign-in failed. Check your connection and try again.");
      }
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: { xs: 2, sm: 3 },
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 560, boxShadow: 4 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5, md: 4.5 } }}>
          <Stack spacing={{ xs: 2, sm: 3 }} component="form" onSubmit={onSubmit}>
            <Box>
              <Typography variant="h4" component="h1">
                Countryfloor
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ mt: 1, fontSize: { xs: "1rem", sm: "1.15rem" } }}
              >
                Sign in with the username and password your admin gave you.
              </Typography>
            </Box>
            <Button
              type="button"
              variant="outlined"
              onClick={() => setAppearance(appearance === "floor" ? "ballroom" : "floor")}
            >
              {appearance === "floor" ? "Ballroom" : "Floor"}
            </Button>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              fullWidth
              required
              inputProps={{
                style: { fontSize: "1.15rem", paddingTop: 14, paddingBottom: 14 },
              }}
            />
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              fullWidth
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button type="button" onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? "Hide" : "Show"}
                    </Button>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                style: { fontSize: "1.15rem", paddingTop: 14, paddingBottom: 14 },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={busy}
              fullWidth
              sx={{ minHeight: { xs: 52, md: 64 }, fontSize: { xs: "1.15rem", md: "1.35rem" } }}
            >
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
