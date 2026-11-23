"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
import type { DanceSheetCell, ScoreChoice, ScrutineerView } from "@/lib/results";
import { COUPLES_SCALE, PROAM_SCALE, formatDancePlace, requiresPlacement } from "@/lib/scoring";
import { divisionResultsPath, sessionLivePath } from "@/lib/store/paths";
import type { SessionLiveDoc } from "@/lib/store/types";

type Props = { initial: ScrutineerView };

type EditTarget = {
  score: ScoreChoice;
  danceAbbrev: string;
};

export function ScrutineerBoard({ initial }: Props) {
  const [view, setView] = useState(initial);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [medal, setMedal] = useState("");
  const [placement, setPlacement] = useState("");
  const [notes, setNotes] = useState("");
  const [scratched, setScratched] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveLabel, setLiveLabel] = useState("Live");

  const livePath = sessionLivePath(view.competitionId, view.sessionId);
  const resultsPath = divisionResultsPath(view.competitionId, view.divisionId);
  const { data: liveDoc, error: liveError } = useFirestoreDoc<SessionLiveDoc>(livePath);
  const { data: resultsDoc, error: resultsError } = useFirestoreDoc<{ view?: ScrutineerView }>(
    resultsPath,
  );

  useEffect(() => {
    setView(initial);
  }, [initial]);

  useEffect(() => {
    if (!liveDoc?.heats) return;
    setLiveLabel("Live");
    setView((current) => ({
      ...current,
      heats: liveDoc.heats,
      sessionComplete:
        liveDoc.heats.length > 0 && liveDoc.heats.every((heat) => heat.complete),
      provisional:
        liveDoc.heats.length === 0 || liveDoc.heats.some((heat) => !heat.complete),
    }));
  }, [liveDoc]);

  useEffect(() => {
    if (!resultsDoc?.view) return;
    setLiveLabel("Live");
    setView((current) => ({
      ...resultsDoc.view!,
      heats: current.heats,
      sessionComplete: current.sessionComplete,
      provisional: resultsDoc.view!.provisional ?? current.provisional,
    }));
  }, [resultsDoc]);

  function openCell(scoreId: string, danceAbbrev: string, cell: DanceSheetCell) {
    const fromList = view.scores.find((item) => item.scoreId === scoreId);
    const fallbackScale = view.scores[0]?.scale ?? "COUPLES";
    const score: ScoreChoice = fromList ?? {
      scoreId,
      heatId: "",
      entryId: "",
      judgeId: "",
      dance: danceAbbrev,
      bib: 0,
      couple: "",
      judge: cell.judge,
      medal: cell.medal,
      placement: cell.placement,
      notes: cell.notes,
      scratched: cell.scratched,
      scale: fallbackScale,
      overridden: cell.overridden,
      canRestore: cell.canRestore,
      originalLabel: cell.originalLabel,
    };
    setEdit({ score, danceAbbrev });
    setMedal(cell.medal);
    setPlacement(cell.placement == null ? "" : String(cell.placement));
    setNotes(cell.notes);
    setScratched(cell.scratched);
    setMessage("");
    setError("");
  }

  async function saveScore() {
    if (!edit) return;
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/scrutineer/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: view.competitionId,
        sessionId: view.sessionId,
        divisionId: view.divisionId,
        scoreId: edit.score.scoreId,
        medal: scratched ? null : medal,
        placement:
          scratched || !requiresPlacement(edit.score.scale) || placement === ""
            ? null
            : Number(placement),
        notes,
        scratched,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      view?: ScrutineerView;
    } | null;
    setBusy(false);
    if (!response.ok) {
      setError(body?.error ?? "Could not update score.");
      return;
    }
    setMessage("Score updated.");
    if (body?.view) setView(body.view);
    setEdit(null);
  }

  async function restoreScore() {
    if (!edit) return;
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/scrutineer/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: view.competitionId,
        sessionId: view.sessionId,
        divisionId: view.divisionId,
        scoreId: edit.score.scoreId,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      view?: ScrutineerView;
    } | null;
    setBusy(false);
    if (!response.ok) {
      setError(body?.error ?? "Could not restore judge mark.");
      return;
    }
    setMessage("Restored to the judge’s original mark.");
    if (body?.view) setView(body.view);
    setEdit(null);
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

  const medals = edit?.score.scale === "PROAM" ? PROAM_SCALE : COUPLES_SCALE;
  const listenerError = liveError || resultsError;

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
            label={view.provisional ? "Provisional results" : "Final panel"}
            color={view.provisional ? "warning" : "success"}
          />
          <Chip
            label={view.sessionComplete ? "Session complete" : "Session open"}
            color={view.sessionComplete ? "success" : "default"}
          />
          <Button variant="outlined" onClick={downloadPacket}>
            Export division JSON
          </Button>
        </Stack>
      </Stack>

      {listenerError ? (
        <Alert severity="error">
          Live listener error: {listenerError}. Sign out and back in, or check Firebase Auth
          authorized domains / API key.
        </Alert>
      ) : null}
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error && !edit ? <Alert severity="error">{error}</Alert> : null}

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
                color={heat.complete ? "success" : "warning"}
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
            {view.divisionName} summary
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Red cells mean a scrutineer changed at least one judge mark for that dance.
            {view.provisional ? " Rankings are provisional until every heat’s panel confirms." : ""}
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

      {view.dances.map((dance) => (
        <Card key={dance.abbrev}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              {dance.name} ({dance.abbrev})
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Tap a judge mark to edit it (medal, place, scratch, notes).
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Comp #</TableCell>
                    <TableCell>Couple</TableCell>
                    {dance.judges.map((judge) => (
                      <TableCell key={judge} align="center">
                        {judge}
                      </TableCell>
                    ))}
                    <TableCell>Ordered</TableCell>
                    <TableCell>Mark</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Sum</TableCell>
                    <TableCell>Look-ahead</TableCell>
                    <TableCell>Look-back</TableCell>
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
                        const cell = row.cells.find((item) => item.judge === judge) ?? null;
                        return (
                          <TableCell
                            key={judge}
                            align="center"
                            onClick={() => {
                              if (cell) openCell(cell.scoreId, dance.abbrev, cell);
                            }}
                            sx={{
                              cursor: cell ? "pointer" : "default",
                              ...(cell?.overridden
                                ? { color: "error.main", fontWeight: 800, bgcolor: "#ffebee" }
                                : cell
                                  ? { "&:hover": { bgcolor: "action.hover" } }
                                  : undefined),
                            }}
                          >
                            {cell ? (
                              <Box>
                                <Typography fontWeight={700} color="inherit">
                                  {cell.scratched ? "SCR" : cell.medal || "—"}
                                </Typography>
                                {!cell.scratched && cell.placement != null ? (
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

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Audit trail
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Who</TableCell>
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
                    <TableCell>{audit.before}</TableCell>
                    <TableCell>{audit.after}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          Edit mark
          {edit
            ? ` · ${edit.danceAbbrev} · bib ${edit.score.bib || "?"} · ${edit.score.judge}`
            : ""}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {edit?.score.couple ? (
              <Typography color="text.secondary">{edit.score.couple}</Typography>
            ) : null}
            {edit?.score.overridden ? (
              <Alert severity="info">
                Overridden by scrutineer
                {edit.score.originalLabel
                  ? ` · judge originally marked ${edit.score.originalLabel}`
                  : " · original judge mark will be restored from audit history if possible"}
              </Alert>
            ) : null}
            <TextField
              select
              label="Medal"
              value={medal}
              onChange={(event) => setMedal(event.target.value)}
              disabled={scratched}
              fullWidth
            >
              {medals.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            {edit && requiresPlacement(edit.score.scale) ? (
              <TextField
                label="Place"
                type="number"
                value={placement}
                onChange={(event) => setPlacement(event.target.value)}
                disabled={scratched}
                fullWidth
              />
            ) : null}
            <TextField
              label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              fullWidth
            />
            <Button
              variant={scratched ? "contained" : "outlined"}
              color="error"
              onClick={() => setScratched((value) => !value)}
            >
              {scratched ? "Scratched" : "Mark scratched"}
            </Button>
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <Button
            color="warning"
            disabled={busy || !edit?.score.canRestore}
            onClick={restoreScore}
          >
            Restore judge mark
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="contained" onClick={saveScore} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
