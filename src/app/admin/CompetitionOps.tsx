"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function CompetitionOps() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
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

  async function importCdd(file: File) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const raw = JSON.parse(await file.text());
      const response = await fetch("/api/cdd/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(raw),
      });
      const body = (await response.json()) as { error?: string; competitionId?: string };
      if (!response.ok) {
        setError(body.error ?? "Import failed.");
        return;
      }
      setMessage("CDD structure imported (scores preserved).");
      if (body.competitionId) router.push(`/admin?competitionId=${body.competitionId}`);
      router.refresh();
    } catch {
      setError("Could not read JSON file.");
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
            if (file) void importCdd(file);
            event.target.value = "";
          }}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        New competitions come from CDD import (<code>countryfloor.cdd.v1</code>, see{" "}
        <code>cdd-samples/</code>). Import updates structure only and never overwrites confirmed
        scores. Real vendor CDD files map in <code>src/lib/cdd/</code>.
      </Typography>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
