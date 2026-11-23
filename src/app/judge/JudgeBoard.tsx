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
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enqueueOfflineSubmit,
  flushOfflineQueue,
  loadOfflineQueue,
  newClientRequestId,
} from "@/lib/offlineQueue";
import {
  COUPLES_SCALE,
  PROAM_SCALE,
  medalBandPlacements,
  medalPlacementConflict,
  requiresPlacement,
  type Scale,
} from "@/lib/scoring";

const MEDAL_COLORS: Record<string, { bg: string; fg: string }> = {
  M: { bg: "#546e7a", fg: "#fff" },
  B: { bg: "#6d4c41", fg: "#fff" },
  S: { bg: "#78909c", fg: "#fff" },
  "S+": { bg: "#607d8b", fg: "#fff" },
  G: { bg: "#2e7d32", fg: "#fff" },
  "G+": { bg: "#1b5e20", fg: "#fff" },
  H: { bg: "#1565c0", fg: "#fff" },
  "H+": { bg: "#0d47a1", fg: "#fff" },
  GG: { bg: "#e65100", fg: "#fff" },
};

type EntryState = {
  heatEntryId: string;
  bib: number;
  name: string;
  medal: string | null;
  placement: number | null;
  notes: string;
  scratched: boolean;
};

type HeatState = {
  id: string;
  number: number;
  submitted: boolean;
  groups: {
    divisionId: string;
    divisionName: string;
    scale: string;
    danceName: string;
    entries: EntryState[];
  }[];
};

type Props = {
  competitionId: string;
  sessionId: string;
  competitionName: string;
  sessionName: string;
  heats: HeatState[];
  asJudgeId?: string;
  panelJudges?: { id: string; label: string }[];
};

type SyncStatus = "idle" | "saved-local" | "syncing" | "confirmed";
type JudgeDensity = "comfortable" | "compact";

const DENSITY_KEY = "countryfloor.judgeDensity";

function medalsFor(scale: string) {
  return scale === "PROAM" ? [...PROAM_SCALE] : [...COUPLES_SCALE];
}

function snapshotHeat(heat: HeatState) {
  return JSON.stringify(
    heat.groups.map((group) =>
      group.entries.map((entry) => ({
        id: entry.heatEntryId,
        medal: entry.medal,
        placement: entry.placement,
        notes: entry.notes,
        scratched: entry.scratched,
      })),
    ),
  );
}

function BibBox({ bib, large }: { bib: number; large?: boolean }) {
  return (
    <Box
      sx={{
        bgcolor: "#000",
        color: "#fff",
        px: large ? 2.5 : 2,
        py: large ? 1.5 : 1,
        minWidth: large ? 96 : 72,
        textAlign: "center",
        borderRadius: 1,
      }}
    >
      <Typography sx={{ fontSize: large ? "2.4rem" : "2rem", fontWeight: 800, lineHeight: 1.1 }}>
        {bib}
      </Typography>
    </Box>
  );
}

function MedalBadge({ medal, large }: { medal: string; large?: boolean }) {
  const colors = MEDAL_COLORS[medal] ?? { bg: "#212121", fg: "#fff" };
  return (
    <Box
      sx={{
        bgcolor: colors.bg,
        color: colors.fg,
        px: large ? 2.5 : 2,
        py: large ? 1.5 : 1,
        minWidth: large ? 96 : 80,
        textAlign: "center",
        borderRadius: 1,
        border: "3px solid #000",
      }}
    >
      <Typography sx={{ fontSize: large ? "2.4rem" : "2rem", fontWeight: 900, lineHeight: 1.1 }}>
        {medal}
      </Typography>
    </Box>
  );
}

function applyMedalBandsToGroup(group: HeatState["groups"][number]) {
  if (!requiresPlacement(group.scale as Scale)) return group;
  const bands = medalBandPlacements(
    group.entries.map((entry) => ({
      id: entry.heatEntryId,
      medal: entry.medal ?? "",
      scratched: entry.scratched,
    })),
    group.scale as Scale,
  );
  return {
    ...group,
    entries: group.entries.map((entry) => {
      if (entry.scratched || !entry.medal) return { ...entry, placement: null };
      const band = bands.get(entry.heatEntryId);
      if (!band) return { ...entry, placement: null };
      if (band.tied) return { ...entry, placement: null };
      return { ...entry, placement: band.placement };
    }),
  };
}

export function JudgeBoard({
  competitionId,
  sessionId,
  competitionName,
  sessionName,
  heats: initial,
  asJudgeId,
  panelJudges = [],
}: Props) {
  const router = useRouter();
  const [heats, setHeats] = useState(initial);
  const [heatNumber, setHeatNumber] = useState(initial[0]?.number ?? 1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scratchTarget, setScratchTarget] = useState<{
    heatId: string;
    entryId: string;
    scratched: boolean;
  } | null>(null);
  const [pendingHeatNumber, setPendingHeatNumber] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [queueCount, setQueueCount] = useState(0);
  const [density, setDensity] = useState<JudgeDensity>("comfortable");
  const baselines = useRef<Map<string, string>>(new Map());
  const compact = density === "compact";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DENSITY_KEY);
      if (raw === "compact" || raw === "comfortable") setDensity(raw);
    } catch {
      /* ignore */
    }
  }, []);

  function setDensityAndPersist(next: JudgeDensity) {
    setDensity(next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const refreshQueueCount = useCallback(() => {
    setQueueCount(loadOfflineQueue().length);
  }, []);

  const tryFlush = useCallback(async () => {
    if (loadOfflineQueue().length === 0) return;
    setSyncStatus("syncing");
    const result = await flushOfflineQueue();
    refreshQueueCount();
    if (result.remaining === 0) {
      setSyncStatus("confirmed");
      router.refresh();
    } else if (result.error === "Still offline.") {
      setSyncStatus("saved-local");
    } else if (result.error) {
      setError(result.error);
      setSyncStatus("saved-local");
    }
  }, [refreshQueueCount, router]);

  useEffect(() => {
    let shapeChanged = false;
    setHeats((current) => {
      const sameShape =
        current.length === initial.length &&
        current.every((heat, index) => heat.id === initial[index]?.id);
      if (!sameShape) {
        shapeChanged = true;
        baselines.current = new Map(initial.map((heat) => [heat.id, snapshotHeat(heat)]));
        return initial;
      }
      return current.map((heat) => {
        const next = initial.find((item) => item.id === heat.id);
        return next ? { ...heat, submitted: next.submitted } : heat;
      });
    });
    if (baselines.current.size === 0) {
      baselines.current = new Map(initial.map((heat) => [heat.id, snapshotHeat(heat)]));
    }
    if (shapeChanged) {
      setHeatNumber(initial[0]?.number ?? 1);
      setConfirmOpen(false);
      setPendingHeatNumber(null);
      setScratchTarget(null);
    }
  }, [initial]);

  useEffect(() => {
    if (heats.length === 0) return;
    if (!heats.some((item) => item.number === heatNumber)) {
      setHeatNumber(heats[0]!.number);
    }
  }, [heats, heatNumber]);

  useEffect(() => {
    refreshQueueCount();
    void tryFlush();
    const onOnline = () => void tryFlush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refreshQueueCount, tryFlush]);

  const heat = heats.find((item) => item.number === heatNumber) ?? heats[0];
  const heatIndex = heats.findIndex((item) => item.id === heat?.id);
  const prevHeat = heatIndex > 0 ? heats[heatIndex - 1] : null;
  const nextHeat = heatIndex >= 0 && heatIndex < heats.length - 1 ? heats[heatIndex + 1] : null;
  const nextHeatAfterConfirm = useMemo(
    () => heats.find((item) => item.number === (heat?.number ?? 0) + 1),
    [heats, heat],
  );

  const dirty = heat ? snapshotHeat(heat) !== (baselines.current.get(heat.id) ?? "") : false;

  function updateEntry(
    heatId: string,
    entryId: string,
    patch: Partial<EntryState>,
    options: { reband?: boolean } = {},
  ) {
    const reband = options.reband ?? ("medal" in patch || "scratched" in patch);
    setHeats((current) =>
      current.map((item) => {
        if (item.id !== heatId) return item;
        return {
          ...item,
          groups: item.groups.map((group) => {
            if (!group.entries.some((entry) => entry.heatEntryId === entryId)) return group;
            const next = {
              ...group,
              entries: group.entries.map((entry) =>
                entry.heatEntryId === entryId ? { ...entry, ...patch } : entry,
              ),
            };
            return reband ? applyMedalBandsToGroup(next) : next;
          }),
        };
      }),
    );
  }

  function requestHeatChange(nextNumber: number) {
    if (!heat || nextNumber === heat.number) return;
    if (dirty) {
      setPendingHeatNumber(nextNumber);
      return;
    }
    setHeatNumber(nextNumber);
  }

  async function save(confirm: boolean) {
    if (!heat) return;
    setBusy(true);
    setError("");
    const scores = heat.groups.flatMap((group) => {
      const needsPlace = requiresPlacement(group.scale as Scale);
      const activeCount = group.entries.filter((entry) => !entry.scratched).length;
      return group.entries.map((entry) => ({
        heatEntryId: entry.heatEntryId,
        medal: entry.medal,
        placement: !needsPlace || entry.scratched
          ? null
          : entry.placement ?? (activeCount === 1 ? 1 : null),
        notes: entry.notes,
        scratched: entry.scratched,
      }));
    });
    const clientRequestId = newClientRequestId();
    const payload = {
      competitionId,
      sessionId,
      heatId: heat.id,
      confirm,
      scores,
      asJudgeId,
      clientRequestId,
    };

    try {
      const response = await fetch("/api/judge/heat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setBusy(false);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 401) {
          setError(body?.error ?? "Session expired. Sign in again.");
          router.push("/login");
          return;
        }
        setError(body?.error ?? "Could not save scores. Refresh the page after reseeding.");
        return;
      }
      if (confirm) {
        baselines.current.set(heat.id, snapshotHeat(heat));
        setHeats((current) =>
          current.map((item) => (item.id === heat.id ? { ...item, submitted: true } : item)),
        );
        setConfirmOpen(false);
        setSyncStatus("confirmed");
        if (nextHeatAfterConfirm) setHeatNumber(nextHeatAfterConfirm.number);
        router.refresh();
      }
    } catch {
      if (!confirm) {
        setBusy(false);
        setError("Network error while drafting. Try again when online.");
        return;
      }
      enqueueOfflineSubmit({
        id: clientRequestId,
        createdAt: new Date().toISOString(),
        payload,
      });
      baselines.current.set(heat.id, snapshotHeat(heat));
      setHeats((current) =>
        current.map((item) => (item.id === heat.id ? { ...item, submitted: true } : item)),
      );
      setConfirmOpen(false);
      setBusy(false);
      setSyncStatus("saved-local");
      refreshQueueCount();
      if (nextHeatAfterConfirm) setHeatNumber(nextHeatAfterConfirm.number);
    }
  }

  if (!heat) {
    return <Alert severity="warning">No heats in this session.</Alert>;
  }

  const syncChip =
    syncStatus === "saved-local" || queueCount > 0
      ? { label: queueCount > 0 ? `Saved locally · ${queueCount} queued` : "Saved locally", color: "warning" as const }
      : syncStatus === "syncing"
        ? { label: "Syncing…", color: "info" as const }
        : syncStatus === "confirmed"
          ? { label: "Confirmed", color: "success" as const }
          : dirty
            ? { label: "Unsaved changes", color: "warning" as const }
            : { label: "Ready", color: "default" as const };

  const divisionSubtitle = (() => {
    const names = [...new Set(heat.groups.map((group) => group.divisionName))];
    if (names.length === 0) return "";
    if (names.length === 1) return ` · ${names[0]}`;
    if (names.length === 2) return ` · ${names.join(" + ")}`;
    return ` · ${names.length} divisions`;
  })();

  function submitHeat() {
    if (heat.submitted) return;
    for (const group of heat.groups) {
      const needsPlace = requiresPlacement(group.scale as Scale);
      const active = group.entries.filter((entry) => !entry.scratched);
      const placeMax = active.length;
      for (const entry of active) {
        if (!entry.medal) {
          setError(`Pick a medal for bib ${entry.bib}.`);
          return;
        }
        if (needsPlace && placeMax > 1 && !entry.placement) {
          setError(
            `Same medal as another couple — pick place for bib ${entry.bib} (available slots only).`,
          );
          return;
        }
        if (needsPlace && placeMax === 1 && !entry.placement) {
          updateEntry(heat.id, entry.heatEntryId, { placement: 1 });
        }
      }
      if (needsPlace && placeMax > 1) {
        const places = active.map((entry) => entry.placement);
        if (places.some((place) => !place) || new Set(places).size !== places.length) {
          setError(
            `Each couple in ${group.divisionName} · ${group.danceName} needs a different place.`,
          );
          return;
        }
        const medalPlaceError = medalPlacementConflict(
          active.map((entry) => ({
            bib: entry.bib,
            medal: entry.medal!,
            placement: entry.placement!,
          })),
          group.scale as Scale,
        );
        if (medalPlaceError) {
          setError(medalPlaceError);
          return;
        }
      }
    }
    setError("");
    setConfirmOpen(true);
  }

  return (
    <Stack
      spacing={compact ? 1 : 2}
      sx={
        compact
          ? {
              // App bar + scope picker + page padding on portrait iPad
              height: "calc(100dvh - 200px)",
              maxHeight: "calc(100dvh - 200px)",
              overflow: "hidden",
            }
          : undefined
      }
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={compact ? 1 : 2}
        alignItems={{ md: "center" }}
        justifyContent="space-between"
        sx={compact ? { flexShrink: 0 } : undefined}
      >
        {compact ? (
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: 220 }}>
            {sessionName}
          </Typography>
        ) : (
          <Box>
            <Typography variant="h5">{competitionName}</Typography>
            <Typography color="text.secondary">{sessionName}</Typography>
          </Box>
        )}
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <FormControlLabel
            control={
              <Switch
                checked={compact}
                onChange={(event) =>
                  setDensityAndPersist(event.target.checked ? "compact" : "comfortable")
                }
                inputProps={{ "aria-label": "Compact fit-screen layout" }}
              />
            }
            label={compact ? "Compact (fit screen)" : "Comfortable"}
            sx={{ mr: 1, "& .MuiFormControlLabel-label": { fontWeight: 700, fontSize: "0.95rem" } }}
          />
          <Chip label={syncChip.label} color={syncChip.color} variant="outlined" size={compact ? "small" : "medium"} />
          {queueCount > 0 ? (
            <Button variant="outlined" size={compact ? "small" : "medium"} onClick={() => void tryFlush()}>
              Retry sync
            </Button>
          ) : null}
          {panelJudges.length > 0 && asJudgeId ? (
            <FormControl sx={{ minWidth: compact ? 140 : 200 }} size={compact ? "small" : "medium"}>
              <InputLabel id="as-judge-select">Score as</InputLabel>
              <Select
                labelId="as-judge-select"
                label="Score as"
                value={asJudgeId}
                onChange={(event) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("asJudgeId", event.target.value);
                  router.push(`${url.pathname}?${url.searchParams.toString()}`);
                }}
              >
                {panelJudges.map((judge) => (
                  <MenuItem key={judge.id} value={judge.id}>
                    {judge.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <FormControl sx={{ minWidth: compact ? 160 : 280 }} size={compact ? "small" : "medium"}>
            <InputLabel id="heat-select">Heat</InputLabel>
            <Select
              labelId="heat-select"
              label="Heat"
              value={heat.number}
              onChange={(event) => requestHeatChange(Number(event.target.value))}
              MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
            >
              {heats.map((item) => {
                const style = item.groups[0]?.danceName ?? "—";
                return (
                  <MenuItem key={item.id} value={item.number}>
                    Heat {item.number} · {style}
                    {item.submitted ? " · done" : ""}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      <Card
        sx={
          compact
            ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }
            : undefined
        }
      >
        <CardContent
          sx={
            compact
              ? {
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  py: 1,
                  "&:last-child": { pb: 1 },
                }
              : undefined
          }
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: compact ? 0.5 : 1, flexShrink: 0 }}
          >
            <Button
              variant="contained"
              disabled={!prevHeat}
              onClick={() => prevHeat && requestHeatChange(prevHeat.number)}
              aria-label="Previous heat"
              sx={{
                minWidth: compact ? 56 : { xs: 72, sm: 120 },
                minHeight: compact ? 48 : 88,
                fontSize: compact ? "0.95rem" : { xs: "1.1rem", sm: "1.25rem" },
                lineHeight: 1.15,
                px: compact ? 1 : 2,
                flexDirection: "column",
              }}
            >
              <Box component="span" sx={{ fontSize: compact ? "1.25rem" : "2rem", lineHeight: 1 }}>
                ‹
              </Box>
              {compact ? null : "Prev"}
            </Button>
            <Box sx={{ flex: 1, textAlign: "center", px: 0.5, minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ fontWeight: 800, letterSpacing: 1, fontSize: compact ? "0.7rem" : undefined }}
              >
                Heat {heatIndex + 1}/{heats.length}
                {heat.submitted ? " · DONE" : ""}
              </Typography>
              <Typography
                variant={compact ? "h6" : "h4"}
                component="h2"
                noWrap
                sx={{ fontWeight: 800 }}
              >
                {heat.groups[0]?.danceName ?? `Heat ${heat.number}`}
              </Typography>
              {!compact ? (
                <Typography variant="h6" color="text.secondary">
                  Heat #{heat.number}
                  {divisionSubtitle}
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  #{heat.number}
                  {divisionSubtitle}
                </Typography>
              )}
            </Box>
            <Button
              variant="contained"
              disabled={!nextHeat}
              onClick={() => nextHeat && requestHeatChange(nextHeat.number)}
              aria-label="Next heat"
              sx={{
                minWidth: compact ? 56 : { xs: 72, sm: 120 },
                minHeight: compact ? 48 : 88,
                fontSize: compact ? "0.95rem" : { xs: "1.1rem", sm: "1.25rem" },
                lineHeight: 1.15,
                px: compact ? 1 : 2,
                flexDirection: "column",
              }}
            >
              <Box component="span" sx={{ fontSize: compact ? "1.25rem" : "2rem", lineHeight: 1 }}>
                ›
              </Box>
              {compact ? null : "Next"}
            </Button>
          </Stack>

          {!compact && heat.submitted ? (
            <Alert severity="success" sx={{ mb: 1 }}>
              Locked — already submitted
            </Alert>
          ) : null}
          {!compact && !heat.submitted ? (
            <Alert severity="info" sx={{ mb: 1 }}>
              Tap a medal for each couple
              {heat.groups.some((group) => requiresPlacement(group.scale as Scale))
                ? ", then place if needed"
                : ""}
              . Submit at the bottom when done.
            </Alert>
          ) : null}
          {!compact && !heat.submitted && dirty ? (
            <Alert severity="warning">You have changes that are not submitted yet.</Alert>
          ) : null}
          {compact && heat.submitted ? (
            <Typography variant="caption" color="success.main" fontWeight={700} sx={{ mb: 0.5 }}>
              Locked — already submitted
            </Typography>
          ) : null}

          <Box
            sx={
              compact
                ? {
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    overflow: "hidden",
                  }
                : { mt: 2 }
            }
          >
            {heat.groups.map((group) => {
              const medals = medalsFor(group.scale);
              const placeMax = group.entries.filter((entry) => !entry.scratched).length;
              const needsPlace = requiresPlacement(group.scale as Scale);
              const bands = needsPlace
                ? medalBandPlacements(
                    group.entries.map((entry) => ({
                      id: entry.heatEntryId,
                      medal: entry.medal ?? "",
                      scratched: entry.scratched,
                    })),
                    group.scale as Scale,
                  )
                : null;
              return (
                <Box
                  key={`${group.divisionId}-${group.danceName}`}
                  sx={
                    compact
                      ? {
                          flex: group.entries.length,
                          minHeight: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.35,
                          overflow: "hidden",
                        }
                      : undefined
                  }
                >
                  <Typography
                    variant={compact ? "caption" : "h5"}
                    sx={{
                      mb: compact ? 0 : 1,
                      fontWeight: 800,
                      flexShrink: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    {group.divisionName}
                  </Typography>
                  <Box
                    sx={
                      compact
                        ? {
                            flex: 1,
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.35,
                          }
                        : { display: "flex", flexDirection: "column", gap: 2 }
                    }
                  >
                    {group.entries.map((entry) => {
                      const band = bands?.get(entry.heatEntryId);
                      const placeTied = Boolean(band?.tied);
                      const placeOptions =
                        placeTied && band
                          ? band.bandPlaces
                          : Array.from({ length: Math.max(placeMax, 1) }, (_, index) => index + 1);
                      const medalColor = entry.medal ? MEDAL_COLORS[entry.medal] : null;

                      if (compact) {
                        return (
                          <Box
                            key={entry.heatEntryId}
                            sx={{
                              flex: "1 1 0",
                              minHeight: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 0.75,
                              px: 0.75,
                              border: "1.5px solid",
                              borderColor: entry.scratched
                                ? "error.light"
                                : medalColor?.bg ?? "divider",
                              borderRadius: 1,
                              bgcolor: entry.scratched
                                ? "#ffebee"
                                : medalColor
                                  ? `${medalColor.bg}12`
                                  : "background.paper",
                            }}
                          >
                            <Typography
                              sx={{
                                width: 44,
                                flexShrink: 0,
                                fontWeight: 900,
                                fontSize: "1.15rem",
                                textAlign: "center",
                                bgcolor: "#000",
                                color: "#fff",
                                borderRadius: 0.5,
                                py: 0.25,
                              }}
                            >
                              {entry.bib}
                            </Typography>
                            <Typography
                              noWrap
                              sx={{
                                flex: "0 1 120px",
                                minWidth: 72,
                                fontWeight: 700,
                                fontSize: "0.8rem",
                                lineHeight: 1.15,
                              }}
                              title={entry.name}
                            >
                              {entry.name}
                            </Typography>
                            <ToggleButtonGroup
                              exclusive
                              size="small"
                              value={entry.scratched ? null : entry.medal}
                              onChange={(_, value) => {
                                if (entry.scratched || !value) return;
                                updateEntry(heat.id, entry.heatEntryId, { medal: value });
                              }}
                              disabled={heat.submitted || entry.scratched}
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexWrap: "nowrap",
                                gap: 0.35,
                                "& .MuiToggleButtonGroup-grouped": {
                                  border: "2px solid",
                                  margin: 0,
                                  borderRadius: "6px !important",
                                },
                              }}
                            >
                              {medals.map((medal) => {
                                const colors = MEDAL_COLORS[medal] ?? { bg: "#212121", fg: "#fff" };
                                const selected = entry.medal === medal && !entry.scratched;
                                return (
                                  <ToggleButton
                                    key={medal}
                                    value={medal}
                                    sx={{
                                      flex: "1 1 0",
                                      minWidth: "0 !important",
                                      width: "auto",
                                      minHeight: "36px !important",
                                      height: "36px !important",
                                      p: "2px !important",
                                      px: "2px !important",
                                      fontSize: "0.85rem !important",
                                      fontWeight: 900,
                                      lineHeight: 1,
                                      borderColor: `${colors.bg} !important`,
                                      color: selected ? colors.fg : colors.bg,
                                      bgcolor: selected ? colors.bg : "#fff",
                                      "&.Mui-selected": {
                                        bgcolor: `${colors.bg} !important`,
                                        color: `${colors.fg} !important`,
                                      },
                                    }}
                                  >
                                    {medal}
                                  </ToggleButton>
                                );
                              })}
                            </ToggleButtonGroup>
                            {needsPlace ? (
                              <Select
                                size="small"
                                displayEmpty
                                value={
                                  entry.scratched
                                    ? ""
                                    : entry.placement ?? (placeMax === 1 ? 1 : "")
                                }
                                disabled={
                                  heat.submitted ||
                                  entry.scratched ||
                                  placeMax <= 1 ||
                                  (!placeTied && Boolean(entry.medal))
                                }
                                onChange={(event) =>
                                  updateEntry(
                                    heat.id,
                                    entry.heatEntryId,
                                    { placement: Number(event.target.value) },
                                    { reband: false },
                                  )
                                }
                                sx={{
                                  width: 56,
                                  flexShrink: 0,
                                  fontWeight: 800,
                                  bgcolor: placeTied ? "#fff8e1" : undefined,
                                  "& .MuiSelect-select": { py: 0.5, px: 0.75 },
                                }}
                              >
                                <MenuItem value="" disabled>
                                  #
                                </MenuItem>
                                {placeOptions.map((place) => (
                                  <MenuItem key={place} value={place}>
                                    {place}
                                  </MenuItem>
                                ))}
                              </Select>
                            ) : null}
                            <Button
                              color={entry.scratched ? "success" : "error"}
                              variant="outlined"
                              disabled={heat.submitted}
                              sx={{
                                minWidth: 40,
                                px: 0.5,
                                minHeight: 36,
                                flexShrink: 0,
                                fontSize: "0.7rem",
                                fontWeight: 800,
                              }}
                              onClick={() =>
                                setScratchTarget({
                                  heatId: heat.id,
                                  entryId: entry.heatEntryId,
                                  scratched: entry.scratched,
                                })
                              }
                            >
                              {entry.scratched ? "IN" : "OUT"}
                            </Button>
                          </Box>
                        );
                      }

                      return (
                        <Card
                          key={entry.heatEntryId}
                          variant="outlined"
                          sx={{
                            bgcolor: entry.scratched
                              ? "#ffebee"
                              : medalColor
                                ? `${medalColor.bg}14`
                                : "background.paper",
                            borderWidth: 2,
                            borderColor: medalColor?.bg ?? "divider",
                          }}
                        >
                          <CardContent>
                            <Stack spacing={2}>
                              <Stack
                                direction="row"
                                spacing={2}
                                alignItems="center"
                                useFlexGap
                                flexWrap="wrap"
                              >
                                <BibBox bib={entry.bib} />
                                {entry.medal && !entry.scratched ? (
                                  <MedalBadge medal={entry.medal} />
                                ) : null}
                                <Typography variant="h6" sx={{ flex: 1, minWidth: 120 }}>
                                  {entry.name}
                                </Typography>
                                {entry.medal && !entry.scratched ? (
                                  <Typography
                                    sx={{
                                      fontSize: "1.5rem",
                                      fontWeight: 900,
                                      color: medalColor?.bg ?? "text.primary",
                                    }}
                                  >
                                    {entry.medal}
                                    {needsPlace && entry.placement != null
                                      ? ` · ${entry.placement}`
                                      : ""}
                                    {needsPlace && placeTied && entry.placement == null
                                      ? " · pick place"
                                      : ""}
                                  </Typography>
                                ) : null}
                              </Stack>

                              <ToggleButtonGroup
                                exclusive
                                value={entry.scratched ? null : entry.medal}
                                onChange={(_, value) => {
                                  if (entry.scratched || !value) return;
                                  updateEntry(heat.id, entry.heatEntryId, { medal: value });
                                }}
                                disabled={heat.submitted || entry.scratched}
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 1.5,
                                  "& .MuiToggleButtonGroup-grouped": {
                                    border: "3px solid",
                                    margin: 0,
                                    borderRadius: "12px !important",
                                  },
                                }}
                              >
                                {medals.map((medal) => {
                                  const colors = MEDAL_COLORS[medal] ?? { bg: "#212121", fg: "#fff" };
                                  const selected = entry.medal === medal && !entry.scratched;
                                  return (
                                    <ToggleButton
                                      key={medal}
                                      value={medal}
                                      sx={{
                                        minWidth: 100,
                                        minHeight: 100,
                                        flex: "1 1 100px",
                                        maxWidth: 140,
                                        fontSize: "2.1rem",
                                        fontWeight: 900,
                                        borderColor: `${colors.bg} !important`,
                                        color: selected ? colors.fg : colors.bg,
                                        bgcolor: selected ? colors.bg : "#fff",
                                        boxShadow: selected ? `0 0 0 4px ${colors.bg}55` : "none",
                                        transform: selected ? "scale(1.06)" : "none",
                                        "&.Mui-selected": {
                                          bgcolor: `${colors.bg} !important`,
                                          color: `${colors.fg} !important`,
                                        },
                                        "&.Mui-selected:hover": {
                                          bgcolor: `${colors.bg} !important`,
                                        },
                                      }}
                                    >
                                      {medal}
                                    </ToggleButton>
                                  );
                                })}
                              </ToggleButtonGroup>

                              <Stack
                                direction={{ xs: "column", md: "row" }}
                                spacing={2}
                                alignItems={{ md: "center" }}
                              >
                                {needsPlace ? (
                                  <FormControl
                                    sx={{
                                      minWidth: 180,
                                      ...(placeTied
                                        ? {
                                            "& .MuiOutlinedInput-root": {
                                              bgcolor: "#fff8e1",
                                              borderRadius: 1,
                                              "& fieldset": {
                                                borderColor: "#f9a825",
                                                borderWidth: 2,
                                              },
                                            },
                                            "& .MuiInputLabel-root": {
                                              color: "#f57f17",
                                              fontWeight: 700,
                                            },
                                          }
                                        : {}),
                                    }}
                                    disabled={
                                      heat.submitted ||
                                      entry.scratched ||
                                      placeMax <= 1 ||
                                      (!placeTied && Boolean(entry.medal))
                                    }
                                  >
                                    <InputLabel id={`place-${entry.heatEntryId}`}>
                                      {placeTied ? "Place (tie — pick)" : "Place"}
                                    </InputLabel>
                                    <Select
                                      labelId={`place-${entry.heatEntryId}`}
                                      label={placeTied ? "Place (tie — pick)" : "Place"}
                                      value={
                                        entry.scratched
                                          ? ""
                                          : entry.placement ?? (placeMax === 1 ? 1 : "")
                                      }
                                      onChange={(event) =>
                                        updateEntry(
                                          heat.id,
                                          entry.heatEntryId,
                                          { placement: Number(event.target.value) },
                                          { reband: false },
                                        )
                                      }
                                      sx={{ minHeight: 64, fontSize: "1.35rem", fontWeight: 700 }}
                                    >
                                      {placeOptions.map((place) => (
                                        <MenuItem
                                          key={place}
                                          value={place}
                                          sx={{ fontSize: "1.25rem", minHeight: 48 }}
                                        >
                                          {place}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                ) : null}

                                <TextField
                                  label="Notes"
                                  value={entry.notes}
                                  disabled={heat.submitted}
                                  onChange={(event) =>
                                    updateEntry(heat.id, entry.heatEntryId, {
                                      notes: event.target.value,
                                    })
                                  }
                                  sx={{
                                    minWidth: 180,
                                    flex: 1,
                                    "& .MuiInputBase-root": { minHeight: 64 },
                                  }}
                                />

                                <Button
                                  color={entry.scratched ? "success" : "error"}
                                  variant="contained"
                                  disabled={heat.submitted}
                                  sx={{ minWidth: 160, minHeight: 64 }}
                                  onClick={() =>
                                    setScratchTarget({
                                      heatId: heat.id,
                                      entryId: entry.heatEntryId,
                                      scratched: entry.scratched,
                                    })
                                  }
                                >
                                  {entry.scratched ? "Unscratch" : "Scratch"}
                                </Button>
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Box
        sx={{
          position: compact ? "relative" : "sticky",
          bottom: 0,
          zIndex: 8,
          mt: compact ? 0.5 : 1,
          py: compact ? 0.5 : 1.5,
          bgcolor: "background.default",
          borderTop: "2px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Button
          fullWidth
          variant="contained"
          color={heat.submitted ? "inherit" : "success"}
          size="large"
          disabled={heat.submitted || busy}
          sx={{ minHeight: compact ? 48 : 72, fontSize: compact ? "1.1rem" : "1.4rem" }}
          onClick={submitHeat}
        >
          {heat.submitted ? "Heat locked — already submitted" : "Submit heat"}
        </Button>
      </Box>

      <Dialog
        open={Boolean(error)}
        disableEscapeKeyDown
        onClose={(_, reason) => {
          if (reason === "backdropClick") return;
          setError("");
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ color: "error.main" }}>Cannot submit</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "1.25rem", pt: 1 }}>{error}</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="error" fullWidth onClick={() => setError("")}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(scratchTarget)} onClose={() => setScratchTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {scratchTarget?.scratched ? "Unscratch competitor?" : "Scratch competitor?"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {scratchTarget?.scratched
              ? "They will be marked as dancing again."
              : "They will be marked as not dancing in this heat."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScratchTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={scratchTarget?.scratched ? "success" : "error"}
            onClick={() => {
              if (!scratchTarget) return;
              updateEntry(scratchTarget.heatId, scratchTarget.entryId, {
                scratched: !scratchTarget.scratched,
                medal: null,
                placement: null,
              }, { reband: true });
              setScratchTarget(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={pendingHeatNumber != null}
        onClose={() => setPendingHeatNumber(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Leave without submitting?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "1.2rem", pt: 1 }}>
            You have unsubmitted changes on heat {heat.number}. Leave anyway?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingHeatNumber(null)}>Stay</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              if (pendingHeatNumber == null) return;
              setHeatNumber(pendingHeatNumber);
              setPendingHeatNumber(null);
            }}
          >
            Leave heat
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontSize: "1.75rem" }}>
          Submit heat {heat.number}?
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {heat.groups.map((group) => (
              <Box key={`${group.divisionId}-confirm`}>
                <Typography variant="h6" gutterBottom>
                  {group.divisionName} · {group.danceName}
                </Typography>
                <Stack spacing={1.5}>
                  {group.entries.map((entry) => (
                    <Stack
                      key={entry.heatEntryId}
                      direction="row"
                      spacing={2}
                      alignItems="center"
                      sx={{
                        p: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        bgcolor: entry.scratched ? "#ffebee" : "background.paper",
                      }}
                    >
                      <BibBox bib={entry.bib} large />
                      {entry.medal && !entry.scratched ? <MedalBadge medal={entry.medal} large /> : null}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6">{entry.name}</Typography>
                        <Typography sx={{ fontSize: "1.5rem", fontWeight: 800 }}>
                          {entry.scratched
                            ? "SCRATCHED"
                            : requiresPlacement(group.scale as Scale)
                              ? `${entry.medal ?? "—"} · place ${
                                  entry.placement ??
                                  (group.entries.filter((item) => !item.scratched).length === 1
                                    ? 1
                                    : "—")
                                }`
                              : `${entry.medal ?? "—"}`}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ minWidth: 140 }}>
            Go back
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={busy}
            onClick={() => save(true)}
            sx={{ minWidth: 220, minHeight: 64, fontSize: "1.2rem" }}
          >
            Yes, submit heat
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
