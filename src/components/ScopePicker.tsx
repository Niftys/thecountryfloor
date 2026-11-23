"use client";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type ScopeOption = { id: string; label: string };

type Props = {
  competitions: ScopeOption[];
  sessions?: ScopeOption[];
  divisions?: ScopeOption[];
  competitionId: string;
  sessionId?: string;
  divisionId?: string;
};

export function ScopePicker({
  competitions,
  sessions = [],
  divisions = [],
  competitionId,
  sessionId,
  divisionId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
        Choose what you are working on
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <FormControl sx={{ minWidth: 280, flex: 1 }} size="medium">
          <InputLabel id="competition-select">Competition</InputLabel>
          <Select
            labelId="competition-select"
            label="Competition"
            value={competitionId}
            onChange={(event) =>
              go({
                competitionId: event.target.value,
                sessionId: undefined,
                divisionId: undefined,
              })
            }
          >
            {competitions.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {sessions.length > 0 && sessionId ? (
          <FormControl sx={{ minWidth: 220, flex: 1 }} size="medium">
            <InputLabel id="session-select">Session</InputLabel>
            <Select
              labelId="session-select"
              label="Session"
              value={sessionId}
              onChange={(event) => go({ sessionId: event.target.value })}
            >
              {sessions.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        {divisions.length > 0 && divisionId ? (
          <FormControl sx={{ minWidth: 220, flex: 1 }} size="medium">
            <InputLabel id="division-select">Division</InputLabel>
            <Select
              labelId="division-select"
              label="Division"
              value={divisionId}
              onChange={(event) => go({ divisionId: event.target.value })}
            >
              {divisions.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
      </Stack>
    </Stack>
  );
}
