"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useFirestoreDoc } from "@/hooks/useFirestoreDoc";
import type { ScrutineerView } from "@/lib/results";
import { COUPLES_SCALE, PROAM_SCALE, formatDancePlace, requiresPlacement } from "@/lib/scoring";
import { divisionResultsPath, sessionLivePath } from "@/lib/store/paths";
import type { SessionLiveDoc } from "@/lib/store/types";

type Props = { initial: ScrutineerView };

export function ScrutineerBoard({ initial }: Props) {
  const [view, setView] = useState(initial);
  const [selectedScoreId, setSelectedScoreId] = useState(initial.scores[0]?.scoreId ?? "");
  const selected = view.scores.find((score) => score.scoreId === selectedScoreId) ?? view.scores[0];
  const [medal, setMedal] = useState(selected?.medal ?? "");
  const [placement, setPlacement] = useState(String(selected?.placement ?? ""));
  const [notes, setNotes] = useState(selected?.notes ?? "");
  const [scratched, setScratched] = useState(selected?.scratched ?? false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [liveLabel, setLiveLabel] = useState("Live");

  const livePath = sessionLivePath(view.competitionId, view.sessionId);
  const resultsPath = divisionResultsPath(view.competitionId, view.divisionId);
  const { data: liveDoc } = useFirestoreDoc<SessionLiveDoc>(livePath);
  const { data: resultsDoc } = useFirestoreDoc<{ view?: ScrutineerView }>(resultsPath);

  useEffect(() => {
    setView(initial);
    setSelectedScoreId(initial.scores[0]?.scoreId ?? "");
  }, [initial]);

  useEffect(() => {
    if (!liveDoc?.heats) return;
    setLiveLabel("Live");
    setView((current) => ({
      ...current,
      heats: liveDoc.heats,
      sessionComplete:
        liveDoc.heats.length > 0 && liveDoc.heats.every((heat) => heat.complete),
    }));
  }, [liveDoc]);

  useEffect(() => {
    if (!resultsDoc?.view) return;
    setLiveLabel("Live");
    setView((current) => ({
      ...resultsDoc.view!,
      heats: current.heats,
      sessionComplete: current.sessionComplete,
    }));
  }, [resultsDoc]);

  useEffect(() => {
    if (!selected) return;
    setMedal(selected.medal);
    setPlacement(selected.placement == null ? "" : String(selected.placement));
    setNotes(selected.notes);
    setScratched(selected.scratched);
  }, [selectedScoreId, selected?.scoreId, selected?.medal, selected?.placement, selected?.notes, selected?.scratched]);

  async function saveScore() {
    if (!selected) return;
    setMessage("");
    setError("");
    const response = await fetch("/api/scrutineer/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: view.competitionId,
        sessionId: view.sessionId,
        divisionId: view.divisionId,
        scoreId: selected.scoreId,
        medal: scratched ? null : medal,
        placement:
          scratched || !requiresPlacement(selected.scale) || placement === ""
            ? null
            : Number(placement),
        notes,
        scratched,
      }),
    });
    if (!response.ok) {
      setError("Could not update score.");
      return;
    }
    const body = (await response.json()) as { view?: ScrutineerView };
    setMessage("Score updated.");
    if (body.view) setView(body.view);
  }

  async function downloadPacket() {
    const query = new URLSearchParams({
      competitionId: view.competitionId,
      sessionId: view.sessionId,
      divisionId: view.divisionId,
    });
    const response = await fetch(`/api/cdd/export?${query}`);
    if (!response.ok) {
      setError("Export failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${view.divisionName.replace(/\s+/g, "_")}_packet.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const medals = selected?.scale === "PROAM" ? PROAM_SCALE : COUPLES_SCALE;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5">{view.competition.name}</Typography>
          <Typography color="text.secondary">
            {view.sessionName} · {view.divisionName}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip label={liveLabel} color="success" variant="outlined" />
          <Chip
            label={view.sessionComplete ? "Session complete" : "Session open"}
            color={view.sessionComplete ? "success" : "error"}
          />
          <Button variant="outlined" onClick={downloadPacket}>
            Export division JSON
          </Button>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Polling board
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {view.heats.map((heat) => (
              <Chip
                key={heat.id}
                label={`Heat ${heat.number} · ${heat.label} · ${heat.confirmed}/${heat.judges}`}
                color={heat.complete ? "success" : "error"}
                sx={{ fontSize: "1rem", height: 40 }}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Alerts
          </Typography>
          {view.alerts.length === 0 ? (
            <Alert severity="success">No alerts.</Alert>
          ) : (
            <Stack spacing={1}>
              {view.alerts.map((alert) => (
                <Alert key={alert.id} severity="warning">
                  {alert.text}
                </Alert>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Change a score
          </Typography>
          <Stack spacing={2} direction={{ xs: "column", md: "row" }} alignItems="flex-start">
            <TextField
              select
              label="Score"
              value={selected?.scoreId ?? ""}
              onChange={(event) => setSelectedScoreId(event.target.value)}
              sx={{ minWidth: 360, flex: 1 }}
            >
              {view.scores.map((score) => (
                <MenuItem key={score.scoreId} value={score.scoreId}>
                  {score.dance} · bib {score.bib} · {score.judge}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Medal" value={medal} onChange={(event) => setMedal(event.target.value)} disabled={scratched} sx={{ minWidth: 120 }}>
              {medals.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            {selected && requiresPlacement(selected.scale) ? (
              <TextField
                label="Place"
                type="number"
                value={placement}
                onChange={(event) => setPlacement(event.target.value)}
                disabled={scratched}
                sx={{ width: 110 }}
              />
            ) : null}
            <TextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} sx={{ minWidth: 180, flex: 1 }} />
            <Button variant={scratched ? "contained" : "outlined"} color="error" onClick={() => setScratched((value) => !value)}>
              {scratched ? "Scratched" : "Scratch"}
            </Button>
            <Button variant="contained" onClick={saveScore}>
              Save
            </Button>
          </Stack>
          {message ? (
            <Alert sx={{ mt: 2 }} severity="success">
              {message}
            </Alert>
          ) : null}
          {error ? (
            <Alert sx={{ mt: 2 }} severity="error">
              {error}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            {view.divisionName} summary
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Red cells mean a scrutineer changed at least one judge mark for that dance.
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Comp #</TableCell>
                  <TableCell>Entry</TableCell>
                  {view.summary[0]?.places.map((place) => (
                    <TableCell key={place.abbrev} align="right">
                      {place.abbrev}
                    </TableCell>
                  ))}
                  <TableCell align="right">Rule 9</TableCell>
                  <TableCell align="right">Rule 10</TableCell>
                  <TableCell align="right">Rule 11</TableCell>
                  <TableCell align="right">Place</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {view.summary.map((row) => (
                  <TableRow key={row.bib}>
                    <TableCell>{row.bib}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    {row.places.map((place) => (
                      <TableCell
                        key={place.abbrev}
                        align="right"
                        sx={
                          place.overridden
                            ? { color: "error.main", fontWeight: 800, bgcolor: "#ffebee" }
                            : undefined
                        }
                      >
                        {formatDancePlace(place.place)}
                      </TableCell>
                    ))}
                    <TableCell
                      align="right"
                      sx={row.overridden ? { color: "error.main", fontWeight: 800, bgcolor: "#ffebee" } : undefined}
                    >
                      {row.rule9Total.toFixed(1)}
                    </TableCell>
                    <TableCell align="right">{row.rule10Place}</TableCell>
                    <TableCell align="right">{row.rule11Place}</TableCell>
                    <TableCell
                      align="right"
                      sx={row.overridden ? { color: "error.main", fontWeight: 800, bgcolor: "#ffebee" } : undefined}
                    >
                      {row.place}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Override audit log
          </Typography>
          {view.audits.length === 0 ? (
            <Alert severity="info">No scrutineer overrides yet.</Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Bib</TableCell>
                    <TableCell>Dance</TableCell>
                    <TableCell>Judge</TableCell>
                    <TableCell>Before</TableCell>
                    <TableCell>After</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.audits.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell>{new Date(audit.at).toLocaleString()}</TableCell>
                      <TableCell>{audit.actor}</TableCell>
                      <TableCell>{audit.bib}</TableCell>
                      <TableCell>{audit.dance}</TableCell>
                      <TableCell>{audit.judge}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem", maxWidth: 220 }}>
                        {audit.before}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem", maxWidth: 220 }}>
                        {audit.after}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {view.dances.map((dance) => (
        <Card key={dance.abbrev}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              {view.divisionName} · {dance.name}
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Comp #</TableCell>
                    <TableCell>Entry</TableCell>
                    {dance.judges.map((judge) => (
                      <TableCell key={judge} align="center">
                        {judge}
                      </TableCell>
                    ))}
                    <TableCell>Ordered</TableCell>
                    <TableCell>Mark</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Sum</TableCell>
                    <TableCell>Look Ahead</TableCell>
                    <TableCell>Look Back</TableCell>
                    <TableCell>Medal</TableCell>
                    <TableCell>Place</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dance.rows.map((row) => (
                    <TableRow key={`${dance.abbrev}-${row.bib}`}>
                      <TableCell>{row.bib}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      {dance.judges.map((judge) => {
                        const cell = row.cells.find((item) => item.judge === judge);
                        return (
                          <TableCell
                            key={judge}
                            align="center"
                            sx={
                              cell?.overridden
                                ? { color: "error.main", fontWeight: 800, bgcolor: "#ffebee" }
                                : undefined
                            }
                          >
                            {cell ? (
                              <Box>
                                <Typography fontWeight={700} color="inherit">
                                  {cell.medal}
                                </Typography>
                                {cell.placement != null ? (
                                  <Typography variant="body2" color="inherit">
                                    {cell.placement}
                                  </Typography>
                                ) : null}
                              </Box>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell>{row.ordered}</TableCell>
                      <TableCell>{row.mark}</TableCell>
                      <TableCell>{row.size}</TableCell>
                      <TableCell>{row.sum}</TableCell>
                      <TableCell>{row.lookAhead}</TableCell>
                      <TableCell>{row.lookBack}</TableCell>
                      <TableCell>{row.medal}</TableCell>
                      <TableCell>{formatDancePlace(row.place)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
