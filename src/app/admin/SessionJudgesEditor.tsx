"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

type JudgeOption = { id: string; label: string };

type Props = {
  competitionId: string;
  sessionId: string;
  sessionName: string;
  allJudges: JudgeOption[];
  assignedIds: string[];
};

export function SessionJudgesEditor({
  competitionId,
  sessionId,
  sessionName,
  allJudges,
  assignedIds,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(assignedIds);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/sessions/${sessionId}/judges`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ judgeIds: selected, competitionId }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Could not update panel.");
      return;
    }
    setMessage("Session judges saved.");
    router.refresh();
  }

  return (
    <Stack spacing={1}>
      <Typography variant="h6">Judges · {sessionName}</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap">
        {allJudges.map((judge) => (
          <FormControlLabel
            key={judge.id}
            control={
              <Checkbox
                checked={selected.includes(judge.id)}
                onChange={(event) => {
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, judge.id]
                      : current.filter((id) => id !== judge.id),
                  );
                }}
              />
            }
            label={judge.label}
          />
        ))}
      </Stack>
      <Button variant="contained" disabled={busy} onClick={save} sx={{ alignSelf: "flex-start" }}>
        Save panel
      </Button>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
