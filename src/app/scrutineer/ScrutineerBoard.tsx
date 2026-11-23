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
import { useEffect, useMemo, useState } from "react";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
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

function PenIcon() {
  return (
    <Box
      component="span"
      className="cell-pen"
      aria-hidden
      sx={{
        display: "inline-flex",
        ml: 0.5,
        opacity: 0.55,
        verticalAlign: "middle",
        transition: "opacity 0.15s ease",
        color: "primary.main",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
      </svg>
    </Box>
  );
}

export function ScrutineerBoard({ initial }: Props) {
  const { isPhone } = useResponsiveLayout();
  const [view, setView] = useState(initial);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [medal, setMedal] = useState("");
  const [placement, setPlacement] = useState("");
  const [notes, setNotes] = useState("");
  const [scratched, setScratched] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveLabel, setLiveLabel] = useState("Connecting");
  const [danceFilter, setDanceFilter] = useState(initial.dances[0]?.abbrev ?? "");
  const [auditQuery, setAuditQuery] = useState("");

  const livePath = sessionLivePath(view.competitionId, view.sessionId);
  const resultsPath = divisionResultsPath(view.competitionId, view.divisionId);
  const { data: liveDoc, error: liveError } = useFirestoreDoc<SessionLiveDoc>(livePath);
  const { data: resultsDoc, error: resultsError } = useFirestoreDoc<{ view?: ScrutineerView }>(
    resultsPath,
  );

  useEffect(() => {
    setView(initial);
    setDanceFilter((current) =>
      initial.dances.some((d) => d.abbrev === current)
        ? current
        : (initial.dances[0]?.abbrev ?? ""),
    );
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

  useEffect(() => {
    if (listenerError) setLiveLabel("Offline");
  }, [listenerError]);
  const activeDance = view.dances.find((d) => d.abbrev === danceFilter) ?? view.dances[0] ?? null;

  const filteredAudits = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    if (!q) return view.audits;
    return view.audits.filter(
      (audit) =>
        audit.actor.toLowerCase().includes(q) ||
        String(audit.bib).includes(q) ||
        audit.dance.toLowerCase().includes(q) ||
        audit.judge.toLowerCase().includes(q) ||
        audit.before.toLowerCase().includes(q) ||
        audit.after.toLowerCase().includes(q),
    );
  }, [auditQuery, view.audits]);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={{ xs: 1.5, md: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h2" sx={{ wordBreak: "break-word" }}>
            {view.competition.name}
          </Typography>
          <Typography
            color="text.secondary"
            variant="h6"
            sx={{ fontWeight: 600, fontSize: { xs: "1rem", md: "1.25rem" } }}
          >
            {view.sessionName} · {view.divisionName}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: { xs: "0.9rem", md: "1rem" } }}>
            Tap a mark to edit it. Swipe a sheet sideways to see every column.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
          <Chip
            label={liveLabel === "Live" ? "Updating live" : liveLabel}
            color={liveLabel === "Live" ? "success" : "default"}
            variant="outlined"
          />
          <Chip
            label={view.provisional ? "Not final yet" : "Panel complete"}
            color={view.provisional ? "warning" : "success"}
          />
          <Chip
            label={view.sessionComplete ? "All heats done" : "Heats still open"}
            color={view.sessionComplete ? "success" : "default"}
          />
          <Button variant="outlined" onClick={downloadPacket}>
            Download results file
          </Button>
        </Stack>
      </Stack>

      {listenerError ? (
        <Alert severity="error">
          Live updates are blocked: {listenerError}. Sign out and sign back in. If it continues,
          ask an admin to check Firebase authorized domains.
        </Alert>
      ) : null}
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error && !edit ? <Alert severity="error">{error}</Alert> : null}

      {view.provisional ? (
        <Alert severity="warning">
          Rankings below may still change until every judge has submitted every heat for this
          division.
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Judge progress
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            Green = submitted · Orange = waiting · Scroll for more
          </Typography>
          <Box
            sx={{
              maxHeight: { xs: 96, md: 112 },
              overflow: "auto",
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              pr: 0.5,
            }}
          >
            {view.heats.map((heat) => {
              const style = heat.label.includes(" · ")
                ? heat.label.slice(0, heat.label.indexOf(" · "))
                : heat.label;
              return (
                <Chip
                  key={heat.id}
                  label={`H${heat.number} · ${style} · ${heat.confirmed}/${heat.judges}`}
                  color={heat.complete ? "success" : "warning"}
                  sx={{ fontSize: "0.95rem", height: 40 }}
                />
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Things to check
          </Typography>
          {view.alerts.length === 0 ? (
            <Alert severity="success">Nothing unusual right now.</Alert>
          ) : (
            <Box sx={{ maxHeight: 200, overflow: "auto" }}>
              <Stack spacing={1}>
                {view.alerts.map((alert) => (
                  <Alert key={alert.id} severity="warning">
                    {alert.text}
                  </Alert>
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            {view.divisionName} — overall places
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            Pink / red highlight means a scrutineer changed at least one mark for that dance.
          </Typography>
          <Box
            sx={{
              maxHeight: 360,
              overflow: "auto",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Table size="small" stickyHeader sx={{ minWidth: 720 }}>
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
                      sx={
                        row.overridden
                          ? { color: "error.main", fontWeight: 800, bgcolor: "#ffebee" }
                          : undefined
                      }
                    >
                      {row.rule9Total.toFixed(1)}
                    </TableCell>
                    <TableCell align="right">{row.rule10Place}</TableCell>
                    <TableCell align="right">{row.rule11Place}</TableCell>
                    <TableCell
                      align="right"
                      sx={
                        row.overridden
                          ? { color: "error.main", fontWeight: 800, bgcolor: "#ffebee" }
                          : undefined
                      }
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
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="h5">Dance sheets</Typography>
              <Typography color="text.secondary">Tap a mark to edit.</Typography>
            </Box>
            <TextField
              select
              size="small"
              label="Dance"
              value={activeDance?.abbrev ?? ""}
              onChange={(e) => setDanceFilter(e.target.value)}
              sx={{ minWidth: 200 }}
              SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}
            >
              {view.dances.map((dance) => (
                <MenuItem key={dance.abbrev} value={dance.abbrev}>
                  {dance.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {activeDance ? (
            <Box
              sx={{
                maxHeight: 420,
                overflow: "auto",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Table size="medium" stickyHeader sx={{ minWidth: 980 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Comp #</TableCell>
                    <TableCell>Couple</TableCell>
                    {activeDance.judges.map((judge) => (
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
                  {activeDance.rows.map((row) => (
                    <TableRow key={`${activeDance.abbrev}-${row.bib}`}>
                      <TableCell>{row.bib}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      {activeDance.judges.map((judge) => {
                        const cell = row.cells.find((item) => item.judge === judge) ?? null;
                        return (
                          <TableCell
                            key={judge}
                            align="center"
                            onClick={() => {
                              if (cell) openCell(cell.scoreId, activeDance.abbrev, cell);
                            }}
                            sx={{
                              cursor: cell ? "pointer" : "default",
                              minWidth: { xs: 72, md: 96 },
                              width: { xs: 72, md: 96 },
                              verticalAlign: "middle",
                              py: { xs: 0.75, md: 1 },
                              px: 0.75,
                              ...(cell?.overridden
                                ? { color: "error.main", fontWeight: 800, bgcolor: "#ffebee" }
                                : cell
                                  ? {
                                      bgcolor: "#f7fafc",
                                      "&:hover": {
                                        bgcolor: "#e3f2fd",
                                        outline: "2px solid #1565c0",
                                        "& .cell-pen": { opacity: 1 },
                                      },
                                    }
                                  : undefined),
                            }}
                          >
                            {cell ? (
                              <Box
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 0.15,
                                  lineHeight: 1.15,
                                  minHeight: { xs: 44, md: 52 },
                                }}
                              >
                                <Typography
                                  fontWeight={800}
                                  fontSize={{ xs: "1.05rem", md: "1.2rem" }}
                                  color="inherit"
                                  component="span"
                                  sx={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" }}
                                >
                                  {cell.scratched ? "SCR" : cell.medal || "—"}
                                  {!cell.scratched ? <PenIcon /> : null}
                                </Typography>
                                {!cell.scratched && cell.placement != null ? (
                                  <Typography
                                    fontWeight={700}
                                    color="inherit"
                                    sx={{
                                      fontSize: { xs: "0.8rem", md: "0.9rem" },
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    #{cell.placement}
                                  </Typography>
                                ) : cell?.scratched ? (
                                  <Typography
                                    fontWeight={700}
                                    color="inherit"
                                    sx={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}
                                  >
                                    scratched
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
          ) : (
            <Typography color="text.secondary">No dance sheets for this division.</Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="h5">Change history</Typography>
              <Typography color="text.secondary">
                Every scrutineer edit, including restores.
              </Typography>
            </Box>
            <TextField
              size="small"
              label="Filter history"
              value={auditQuery}
              onChange={(e) => setAuditQuery(e.target.value)}
              sx={{ minWidth: 220 }}
            />
          </Stack>
          <Box
            sx={{
              maxHeight: 280,
              overflow: "auto",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Table size="small" stickyHeader sx={{ minWidth: 760 }}>
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
                {filteredAudits.map((audit) => (
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
                {filteredAudits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>No matching changes</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        fullScreen={isPhone}
        fullWidth
        maxWidth="sm"
      >
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
