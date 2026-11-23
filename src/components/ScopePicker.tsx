"use client";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

export type ScopeOption = { id: string; label: string };

type Props = {
  competitions: ScopeOption[];
  sessions?: ScopeOption[];
  divisions?: ScopeOption[];
  competitionId: string;
  sessionId?: string;
  divisionId?: string;
};

const MENU_PROPS = { PaperProps: { sx: { maxHeight: 360 } } };

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
  const { isPhone } = useResponsiveLayout();

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
    <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1.25, md: 2 }} sx={{ mb: 0 }}>
      <FormControl
        key="competition"
        sx={{ minWidth: { xs: "100%", sm: 200, md: 280 }, flex: 1 }}
        size={isPhone ? "small" : "medium"}
      >
        <InputLabel id="competition-select">Competition</InputLabel>
        <Select
          labelId="competition-select"
          label="Competition"
          value={competitionId}
          MenuProps={MENU_PROPS}
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
        <FormControl
          key="session"
          sx={{ minWidth: { xs: "100%", sm: 180, md: 220 }, flex: 1 }}
          size={isPhone ? "small" : "medium"}
        >
          <InputLabel id="session-select">Session</InputLabel>
          <Select
            labelId="session-select"
            label="Session"
            value={sessionId}
            MenuProps={MENU_PROPS}
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
        <FormControl
          key="division"
          sx={{ minWidth: { xs: "100%", sm: 180, md: 220 }, flex: 1 }}
          size={isPhone ? "small" : "medium"}
        >
          <InputLabel id="division-select">Division</InputLabel>
          <Select
            labelId="division-select"
            label="Division"
            value={divisionId}
            MenuProps={MENU_PROPS}
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
  );
}
