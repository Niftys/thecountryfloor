"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Preview = {
  preview: true;
  competitionName: string;
  existing: boolean;
  divisions: string[];
  sessions: { name: string; heats: number }[];
  heatCount: number;
  heatingWarnings: string[];
};

export function CompetitionOps() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [heatWarns, setHeatWarns] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function downloadBackup() {
    const response = await fetch("/api/admin/backup");
    if (!response.ok) {
      setError("Backup failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `countryfloor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Backup downloaded.");
  }

  async function previewCdd(file: File) {
    setBusy(true);
    setMessage("");
    setHeatWarns([]);
    setError("");
    setPreview(null);
    setPending(null);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const response = await fetch("/api/cdd/import?preview=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(raw),
      });
      const body = (await response.json()) as Preview & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Import preview failed.");
        return;
      }
      setPending(raw);
      setPreview(body);
    } catch {
      setError("Could not read JSON file.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/cdd/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      const body = (await response.json()) as {
        error?: string;
        competitionId?: string;
        heatingWarnings?: string[];
      };
      if (!response.ok) {
        setError(body.error ?? "Import failed.");
        return;
      }
      setMessage("CDD structure imported (scores preserved).");
      setHeatWarns(body.heatingWarnings ?? []);
      setPreview(null);
      setPending(null);
      if (body.competitionId) router.push(`/admin?competitionId=${body.competitionId}`);
      router.refresh();
    } catch {
      setError("Could not import that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Operations</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
        <Button variant="outlined" disabled={busy} onClick={downloadBackup}>
          Download backup
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => fileRef.current?.click()}>
          Import CDD JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void previewCdd(file);
            event.target.value = "";
          }}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Import updates structure only — confirmed scores are kept. You will see a summary before
        anything is written.
      </Typography>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {heatWarns.length > 0 ? <Alert severity="warning">{heatWarns.join(" ")}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Dialog open={Boolean(preview)} onClose={() => !busy && setPreview(null)} fullWidth maxWidth="sm">
        <DialogTitle>Import {preview?.competitionName}?</DialogTitle>
        <DialogContent>
          {preview ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography>
                {preview.existing
                  ? "This updates the competition already stored under the same name or id."
                  : "This creates a new competition."}
              </Typography>
              <Typography>
                {preview.divisions.length} divisions · {preview.sessions.length} sessions ·{" "}
                {preview.heatCount} heats
              </Typography>
              <Typography color="text.secondary">
                {preview.sessions.map((session) => `${session.name} (${session.heats})`).join(" · ")}
              </Typography>
              <Typography color="text.secondary">{preview.divisions.join(" · ")}</Typography>
              {preview.heatingWarnings.length > 0 ? (
                <Alert severity="warning">{preview.heatingWarnings.join(" ")}</Alert>
              ) : null}
              <Typography variant="body2">
                Confirmed judge sheets are kept. Structure (heats, divisions, panel names) is what
                changes.
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPreview(null);
              setPending(null);
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void confirmImport()} disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
