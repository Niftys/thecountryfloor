"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { danceName, danceOrder } from "@/lib/dances";

type Competitor = { id: string; bib: number; name: string };
type Division = { id: string; name: string; competitors: Competitor[] };
type HeatEntry = { bib: number; name: string; divisionName: string };
type Heat = {
  id: string;
  number: number;
  styleName: string;
  styleAbbrev: string;
  entries: HeatEntry[];
};

type Props = {
  divisions: Division[];
  heats: Heat[];
  sessionName: string | null;
  heatNotes: string[];
};

export function AdminBrowsePanels({ divisions, heats, sessionName, heatNotes }: Props) {
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [competitorQuery, setCompetitorQuery] = useState("");
  const [heatStyle, setHeatStyle] = useState("all");
  const [heatQuery, setHeatQuery] = useState("");
  const [breakdownHeatId, setBreakdownHeatId] = useState("");

  const styles = useMemo(() => {
    const abbrevs = [...new Set(heats.map((h) => h.styleAbbrev))];
    return abbrevs.sort((a, b) => danceOrder(a) - danceOrder(b) || a.localeCompare(b));
  }, [heats]);

  const competitorRows = useMemo(() => {
    const q = competitorQuery.trim().toLowerCase();
    const rows: Array<{ divisionName: string; bib: number; name: string; id: string }> = [];
    for (const division of divisions) {
      if (divisionFilter !== "all" && division.id !== divisionFilter) continue;
      for (const couple of division.competitors) {
        if (
          q &&
          !String(couple.bib).includes(q) &&
          !couple.name.toLowerCase().includes(q) &&
          !division.name.toLowerCase().includes(q)
        ) {
          continue;
        }
        rows.push({
          id: couple.id,
          divisionName: division.name,
          bib: couple.bib,
          name: couple.name,
        });
      }
    }
    return rows;
  }, [competitorQuery, divisionFilter, divisions]);

  const heatRows = useMemo(() => {
    const q = heatQuery.trim().toLowerCase();
    return heats.filter((heat) => {
      if (heatStyle !== "all" && heat.styleAbbrev !== heatStyle) return false;
      if (!q) return true;
      const divisionsLabel = [...new Set(heat.entries.map((e) => e.divisionName))].join(" ");
      const couples = heat.entries
        .map((e) => `${e.bib} ${e.name}`)
        .join(" ");
      return (
        String(heat.number).includes(q) ||
        heat.styleName.toLowerCase().includes(q) ||
        heat.styleAbbrev.toLowerCase().includes(q) ||
        divisionsLabel.toLowerCase().includes(q) ||
        couples.toLowerCase().includes(q)
      );
    });
  }, [heatQuery, heatStyle, heats]);

  const breakdownHeat = heats.find((h) => h.id === breakdownHeatId) ?? null;

  const breakdownGroups = useMemo(() => {
    if (!breakdownHeat) return [];
    const map = new Map<string, HeatEntry[]>();
    for (const entry of breakdownHeat.entries) {
      const list = map.get(entry.divisionName) ?? [];
      list.push(entry);
      map.set(entry.divisionName, list);
    }
    return [...map.entries()].map(([divisionName, entries]) => ({
      divisionName,
      entries: [...entries].sort((a, b) => a.bib - b.bib),
    }));
  }, [breakdownHeat]);

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Competitors
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField
              select
              size="small"
              label="Division"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              sx={{ minWidth: 220 }}
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 360 } } } }}
            >
              <MenuItem value="all">All divisions ({divisions.length})</MenuItem>
              {divisions.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name} ({d.competitors.length})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Filter bib or name"
              value={competitorQuery}
              onChange={(e) => setCompetitorQuery(e.target.value)}
              fullWidth
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Showing {competitorRows.length} of{" "}
            {divisions.reduce((n, d) => n + d.competitors.length, 0)}
          </Typography>
          <Box
            sx={{
              maxHeight: { xs: 240, sm: 300, md: 360 },
              overflow: "auto",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Bib</TableCell>
                  <TableCell>Couple</TableCell>
                  <TableCell>Division</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {competitorRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.bib}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.divisionName}</TableCell>
                  </TableRow>
                ))}
                {competitorRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>No matches</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Session · {sessionName ?? "—"}
          </Typography>
          {heatNotes.length > 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {heatNotes.join(" ")}
            </Alert>
          ) : null}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField
              select
              size="small"
              label="Dance"
              value={heatStyle}
              onChange={(e) => setHeatStyle(e.target.value)}
              sx={{ minWidth: 200 }}
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 360 } } } }}
            >
              <MenuItem value="all">All dances (floor order)</MenuItem>
              {styles.map((abbrev) => (
                <MenuItem key={abbrev} value={abbrev}>
                  {danceOrder(abbrev)}. {danceName(abbrev)} ({abbrev})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Filter heat #, division, bib"
              value={heatQuery}
              onChange={(e) => setHeatQuery(e.target.value)}
              fullWidth
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {heatRows.length} of {heats.length} heats
          </Typography>
          <Box
            sx={{
              maxHeight: { xs: 260, sm: 320, md: 400 },
              overflow: "auto",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Heat</TableCell>
                  <TableCell>Style</TableCell>
                  <TableCell>Divisions</TableCell>
                  <TableCell>#</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {heatRows.map((heat) => {
                  const divisionNames = [...new Set(heat.entries.map((entry) => entry.divisionName))];
                  const coupleCount = new Set(heat.entries.map((entry) => entry.bib)).size;
                  return (
                    <TableRow
                      key={heat.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => setBreakdownHeatId(heat.id)}
                      selected={breakdownHeatId === heat.id}
                    >
                      <TableCell>{heat.number}</TableCell>
                      <TableCell>{heat.styleAbbrev}</TableCell>
                      <TableCell>
                        {divisionNames.length <= 2
                          ? divisionNames.join(" + ") || "—"
                          : `${divisionNames.length} divisions`}
                      </TableCell>
                      <TableCell>{coupleCount}</TableCell>
                    </TableRow>
                  );
                })}
                {heatRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>No matches</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Heat breakdown
            </Typography>
            <TextField
              select
              size="small"
              label="Select heat"
              value={breakdownHeatId}
              onChange={(e) => setBreakdownHeatId(e.target.value)}
              fullWidth
              sx={{ mb: 1.5, maxWidth: 480 }}
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 360 } } } }}
            >
              <MenuItem value="">
                <em>Choose a heat…</em>
              </MenuItem>
              {heats.map((heat) => (
                <MenuItem key={heat.id} value={heat.id}>
                  Heat {heat.number} · {heat.styleName} ({heat.styleAbbrev}) ·{" "}
                  {heat.entries.length} couples
                </MenuItem>
              ))}
            </TextField>
            {breakdownHeat ? (
              <Box
                sx={{
                  maxHeight: { xs: 260, sm: 320, md: 400 },
                  overflow: "auto",
                  border: "1px solid",
                  borderColor: "divider",
                  p: { xs: 1, md: 1.5 },
                }}
              >
                <Typography sx={{ mb: 1.5 }} color="text.secondary">
                  Heat {breakdownHeat.number} · {breakdownHeat.styleName} ·{" "}
                  {breakdownHeat.entries.length} couples · {breakdownGroups.length} division
                  {breakdownGroups.length === 1 ? "" : "s"}
                </Typography>
                <Stack spacing={2}>
                  {breakdownGroups.map((group) => (
                    <Box key={group.divisionName}>
                      <Typography fontWeight={700} sx={{ mb: 0.5 }}>
                        {group.divisionName} ({group.entries.length})
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell width={80}>Bib</TableCell>
                            <TableCell>Competitor</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {group.entries.map((entry) => (
                            <TableRow key={`${group.divisionName}-${entry.bib}-${entry.name}`}>
                              <TableCell>{entry.bib}</TableCell>
                              <TableCell>{entry.name}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : (
              <Typography color="text.secondary">
                Select a heat above, or click a row in the table.
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
