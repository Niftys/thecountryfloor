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

type Competitor = { id: string; bib: number; name: string };
type Division = { id: string; name: string; competitors: Competitor[] };
type Heat = {
  id: string;
  number: number;
  styleName: string;
  styleAbbrev: string;
  entries: Array<{ bib: number; divisionName: string }>;
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

  const styles = useMemo(
    () =>
      [...new Set(heats.map((h) => h.styleAbbrev))].sort((a, b) => a.localeCompare(b)),
    [heats],
  );

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
      const couples = [...new Set(heat.entries.map((e) => String(e.bib)))].join(" ");
      return (
        String(heat.number).includes(q) ||
        heat.styleName.toLowerCase().includes(q) ||
        heat.styleAbbrev.toLowerCase().includes(q) ||
        divisionsLabel.toLowerCase().includes(q) ||
        couples.includes(q)
      );
    });
  }, [heatQuery, heatStyle, heats]);

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
          <Box sx={{ maxHeight: 320, overflow: "auto", border: "1px solid", borderColor: "divider" }}>
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
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="all">All dances</MenuItem>
              {styles.map((abbrev) => (
                <MenuItem key={abbrev} value={abbrev}>
                  {abbrev}
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
            Showing {heatRows.length} of {heats.length} heats
          </Typography>
          <Box sx={{ maxHeight: 360, overflow: "auto", border: "1px solid", borderColor: "divider" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Heat</TableCell>
                  <TableCell>Style</TableCell>
                  <TableCell>Divisions</TableCell>
                  <TableCell>Couples</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {heatRows.map((heat) => {
                  const divisionsLabel = [
                    ...new Set(heat.entries.map((entry) => entry.divisionName)),
                  ].join(" + ");
                  const couples = [...new Set(heat.entries.map((entry) => String(entry.bib)))].join(
                    ", ",
                  );
                  return (
                    <TableRow key={heat.id}>
                      <TableCell>{heat.number}</TableCell>
                      <TableCell>{heat.styleName}</TableCell>
                      <TableCell>{divisionsLabel || "—"}</TableCell>
                      <TableCell>{couples}</TableCell>
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
        </CardContent>
      </Card>
    </Stack>
  );
}
