"use client";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  competitionId: string;
  active: boolean;
};

export function CompetitionActiveToggle({ competitionId, active }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/competitions/${competitionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Could not update competition.");
      return;
    }
    router.refresh();
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
      <Chip
        label={active ? "Active" : "Inactive"}
        color={active ? "success" : "default"}
        sx={{ fontWeight: 700 }}
      />
      <Button variant="contained" color={active ? "inherit" : "success"} disabled={busy} onClick={toggle}>
        Mark {active ? "inactive" : "active"}
      </Button>
      <Typography variant="body2" color="text.secondary">
        Inactive competitions stay in admin and are hidden from judge and scrutineer tablets.
      </Typography>
      {error ? <Chip label={error} color="error" /> : null}
    </Stack>
  );
}
