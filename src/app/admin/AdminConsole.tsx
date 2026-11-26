"use client";

import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useState, type ReactNode } from "react";

type Props = {
  competition: ReactNode;
  people: ReactNode;
  panel: ReactNode;
  schedule: ReactNode;
  data: ReactNode;
};

const TABS = ["Competition", "People", "Panel", "Schedule", "Data"] as const;

export function AdminConsole({ competition, people, panel, schedule, data }: Props) {
  const [tab, setTab] = useState(0);
  const panels = [competition, people, panel, schedule, data];
  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, value: number) => setTab(value)}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {TABS.map((label) => (
          <Tab key={label} label={label} />
        ))}
      </Tabs>
      <Box sx={{ mt: 2 }}>{panels[tab]}</Box>
    </Box>
  );
}
