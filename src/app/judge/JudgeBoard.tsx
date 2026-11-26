"use client";

import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
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
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUnsavedWork } from "@/components/UnsavedWork";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import {
  enqueueOfflineSubmit,
  flushOfflineQueue,
  loadOfflineQueue,
  newClientRequestId,
} from "@/lib/offlineQueue";
import { medalColor } from "@/lib/medals";
import {
  COUPLES_SCALE,
  PROAM_SCALE,
  medalBandPlacements,
  medalPlacementConflict,
  requiresPlacement,
  type Scale,
} from "@/lib/scoring";

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
  /** Competition / session pickers rendered inside Session settings. */
  scopeSlot?: ReactNode;
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

function BibBox({ bib }: { bib: number }) {
  return (
    <Box
      sx={{
        bgcolor: "#000",
        color: "#fff",
        px: { xs: 1.5, md: 2 },
        py: { xs: 0.75, md: 1 },
        minWidth: { xs: 56, sm: 64, md: 72 },
        textAlign: "center",
        borderRadius: 1,
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: "1.45rem", sm: "1.75rem", md: "2rem" },
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {bib}
      </Typography>
    </Box>
  );
}

function CoupleName({ name, compact = false }: { name: string; compact?: boolean }) {
  const partners = name.split(/\s+&\s+/);
  return (
    <Box sx={{ minWidth: 0, flex: 1 }}>
      {partners.map((partner, index) => {
        const words = partner.trim().split(/\s+/).filter(Boolean);
        const last = words.pop() ?? partner;
        const rest = words.join(" ");
        return (
          <Typography
            key={`${partner}-${index}`}
            sx={{
              fontWeight: 700,
              lineHeight: 1.15,
              fontSize: compact
                ? { xs: "0.85rem", sm: "0.95rem" }
                : { xs: "1.05rem", md: "1.2rem" },
            }}
          >
            {rest ? `${rest} ` : null}
            <Box component="span" sx={{ fontWeight: 900 }}>
              {last}
            </Box>
          </Typography>
        );
      })}
    </Box>
  );
}

function pulseSubmit() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(20);
    }
  } catch {
    /* ignore */
  }
}

function MedalBadge({ medal }: { medal: string }) {
  const colors = medalColor(medal);
  return (
    <Box
      sx={{
        bgcolor: colors.bg,
        color: colors.fg,
        px: { xs: 1.5, md: 2 },
        py: { xs: 0.75, md: 1 },
        minWidth: { xs: 56, sm: 64, md: 80 },
        textAlign: "center",
        borderRadius: 1,
        border: "3px solid #000",
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: "1.45rem", sm: "1.75rem", md: "2rem" },
          fontWeight: 900,
          lineHeight: 1.1,
        }}
      >
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
  scopeSlot,
}: Props) {
  const router = useRouter();
  const { setDirty: setUnsaved } = useUnsavedWork();
  const { isPhone } = useResponsiveLayout();
  const [heats, setHeats] = useState(initial);
  const [heatNumber, setHeatNumber] = useState(initial[0]?.number ?? 1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scratchTarget, setScratchTarget] = useState<{
    heatId: string;
    entryId: string;
    scratched: boolean;
  } | null>(null);
  const [notesTarget, setNotesTarget] = useState<{
    heatId: string;
    entryId: string;
    name: string;
    bib: number;
    notes: string;
  } | null>(null);
  const [pendingHeatNumber, setPendingHeatNumber] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [queueCount, setQueueCount] = useState(0);
  const [density, setDensity] = useState<JudgeDensity>("comfortable");
  const [undo, setUndo] = useState<{
    heatId: string;
    entryId: string;
    bib: number;
    medal: string | null;
  } | null>(null);
  const [moreTarget, setMoreTarget] = useState<{
    anchor: HTMLElement;
    heatId: string;
    entryId: string;
    name: string;
    bib: number;
    notes: string;
    scratched: boolean;
  } | null>(null);
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

  useEffect(() => {
    setUnsaved(dirty);
    return () => setUnsaved(false);
  }, [dirty, setUnsaved]);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    async function requestLock() {
      try {
        if (!("wakeLock" in navigator)) return;
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await next.release();
          return;
        }
        lock = next;
      } catch {
        /* ignore — browsers deny the lock without a gesture or in some iframes */
      }
    }
    void requestLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (document.querySelector(".MuiPopover-root, .MuiModal-root")) return;
      if (event.key === "ArrowLeft" && prevHeat) {
        event.preventDefault();
        requestHeatChange(prevHeat.number);
      }
      if (event.key === "ArrowRight" && nextHeat) {
        event.preventDefault();
        requestHeatChange(nextHeat.number);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHeat, nextHeat, heat, dirty]);

  function chooseMedal(entry: EntryState, value: string | null) {
    if (!heat || entry.scratched || !value || value === entry.medal) return;
    setUndo({
      heatId: heat.id,
      entryId: entry.heatEntryId,
      bib: entry.bib,
      medal: entry.medal,
    });
    updateEntry(heat.id, entry.heatEntryId, { medal: value });
  }

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
        pulseSubmit();
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
      pulseSubmit();
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

  const submittedCount = heats.filter((item) => item.submitted).length;
  const unmarkedAfter = heats.find((item) => item.number > heat.number && !item.submitted);
  const unmarkedWrap = heats.find((item) => item.number < heat.number && !item.submitted);
  const nextUnmarked = unmarkedAfter ?? unmarkedWrap ?? null;

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

  const settingsControls = (
    <Stack spacing={1.5}>
      {scopeSlot ? <Box key="scope">{scopeSlot}</Box> : null}
      {!compact ? (
        <Box key="titles">
          <Typography variant="h5">{competitionName}</Typography>
          <Typography color="text.secondary">{sessionName}</Typography>
        </Box>
      ) : (
        <Typography key="titles-compact" variant="body2" color="text.secondary">
          {competitionName} · {sessionName}
        </Typography>
      )}
      <Stack
        key="controls"
        direction="row"
        spacing={1}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
      >
        <FormControlLabel
          key="density"
          control={
            <Switch
              checked={compact}
              size={isPhone ? "small" : "medium"}
              onChange={(event) =>
                setDensityAndPersist(event.target.checked ? "compact" : "comfortable")
              }
              inputProps={{ "aria-label": "Compact fit-screen layout" }}
            />
          }
          label={compact ? "Compact layout" : "Comfortable layout"}
          sx={{
            mr: 1,
            "& .MuiFormControlLabel-label": {
              fontWeight: 700,
              fontSize: { xs: "0.85rem", md: "0.95rem" },
            },
          }}
        />
        <Button
          variant="outlined"
          size={compact || isPhone ? "small" : "medium"}
          onClick={() => {
            const root = document.documentElement;
            if (document.fullscreenElement) {
              void document.exitFullscreen().catch(() => {});
              return;
            }
            void root.requestFullscreen().catch(() => {});
          }}
        >
          Fill screen
        </Button>
        <Chip
          key="sync"
          label={syncChip.label}
          color={syncChip.color}
          variant="outlined"
          size={compact || isPhone ? "small" : "medium"}
        />
        {queueCount > 0 ? (
          <Button
            key="retry"
            variant="outlined"
            size={compact || isPhone ? "small" : "medium"}
            onClick={() => void tryFlush()}
          >
            Retry sync
          </Button>
        ) : null}
        {panelJudges.length > 0 && asJudgeId ? (
          <FormControl
            key="as-judge"
            sx={{
              minWidth: { xs: 120, sm: 160 },
              flex: { xs: "1 1 140px", sm: "0 0 auto" },
            }}
            size={compact || isPhone ? "small" : "medium"}
          >
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
        <FormControl
          key="heat-jump"
          sx={{
            minWidth: { xs: 140, sm: 220 },
            flex: { xs: "1 1 160px", sm: "0 0 auto" },
          }}
          size={compact || isPhone ? "small" : "medium"}
        >
          <InputLabel id="heat-select">Jump to heat</InputLabel>
          <Select
            labelId="heat-select"
            label="Jump to heat"
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
  );

  return (
    <Stack
      spacing={compact ? 0.75 : 2}
      sx={
        compact
          ? {
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }
          : undefined
      }
    >
      <Accordion
        disableGutters
        elevation={0}
        expanded={settingsOpen}
        onChange={(_, open) => setSettingsOpen(open)}
        sx={{
          flexShrink: 0,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "10px !important",
          bgcolor: "background.paper",
          "&:before": { display: "none" },
          ...(compact && settingsOpen
            ? {
                "& .MuiCollapse-entered": {
                  maxHeight: "min(220px, 30vh)",
                  overflow: "auto",
                  overscrollBehavior: "contain",
                },
              }
            : null),
        }}
      >
        <AccordionSummary
          expandIcon={
            <Typography component="span" fontWeight={800} sx={{ px: 0.5 }}>
              {settingsOpen ? "▴" : "▾"}
            </Typography>
          }
          sx={{
            minHeight: { xs: 44, sm: 48 },
            px: 1.5,
            "& .MuiAccordionSummary-content": {
              my: 0.75,
              alignItems: "center",
              gap: 1,
              overflow: "hidden",
              minWidth: 0,
            },
          }}
        >
          <Typography fontWeight={800} sx={{ fontSize: { xs: "0.95rem", sm: "1.05rem" } }}>
            Session settings
          </Typography>
          {!settingsOpen ? (
            <Typography
              color="text.secondary"
              noWrap
              sx={{ fontSize: "0.85rem", flex: 1, minWidth: 0 }}
            >
              {sessionName}
              {asJudgeId
                ? ` · ${panelJudges.find((j) => j.id === asJudgeId)?.label ?? "judge"}`
                : ""}
              {` · Heat ${heat.number}`}
              {heat.submitted ? " · done" : ""}
            </Typography>
          ) : null}
          {!settingsOpen ? (
            <Chip
              label={syncChip.label}
              color={syncChip.color}
              size="small"
              variant="outlined"
              sx={{
                ml: "auto",
                flexShrink: 1,
                minWidth: 0,
                maxWidth: { xs: 132, sm: 240 },
                "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
              }}
            />
          ) : null}
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>{settingsControls}</AccordionDetails>
      </Accordion>

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
                minWidth: compact ? { xs: 44, sm: 56 } : { xs: 56, sm: 88, md: 120 },
                minHeight: compact ? { xs: 40, sm: 48 } : { xs: 56, sm: 72, md: 88 },
                fontSize: compact ? "0.9rem" : { xs: "1rem", sm: "1.15rem", md: "1.25rem" },
                lineHeight: 1.15,
                px: compact ? 0.75 : { xs: 1, md: 2 },
                flexDirection: "column",
              }}
            >
              <Box
                component="span"
                sx={{ fontSize: compact ? "1.1rem" : { xs: "1.4rem", md: "2rem" }, lineHeight: 1 }}
              >
                ‹
              </Box>
              {compact || isPhone ? null : "Prev"}
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
              <Typography variant="caption" color="text.secondary" display="block">
                {submittedCount}/{heats.length} submitted
                {compact ? ` · #${heat.number}${divisionSubtitle}` : null}
              </Typography>
              {!compact ? (
                <Typography variant="h6" color="text.secondary">
                  Heat #{heat.number}
                  {divisionSubtitle}
                </Typography>
              ) : null}
              <Button
                size="small"
                variant="text"
                disabled={!nextUnmarked}
                onClick={() => {
                  if (nextUnmarked) requestHeatChange(nextUnmarked.number);
                }}
                sx={{ minHeight: 36, fontWeight: 800 }}
              >
                Next unmarked
              </Button>
            </Box>
            <Button
              variant="contained"
              disabled={!nextHeat}
              onClick={() => nextHeat && requestHeatChange(nextHeat.number)}
              aria-label="Next heat"
              sx={{
                minWidth: compact ? { xs: 44, sm: 56 } : { xs: 56, sm: 88, md: 120 },
                minHeight: compact ? { xs: 40, sm: 48 } : { xs: 56, sm: 72, md: 88 },
                fontSize: compact ? "0.9rem" : { xs: "1rem", sm: "1.15rem", md: "1.25rem" },
                lineHeight: 1.15,
                px: compact ? 0.75 : { xs: 1, md: 2 },
                flexDirection: "column",
              }}
            >
              <Box
                component="span"
                sx={{ fontSize: compact ? "1.1rem" : { xs: "1.4rem", md: "2rem" }, lineHeight: 1 }}
              >
                ›
              </Box>
              {compact || isPhone ? null : "Next"}
            </Button>
          </Stack>

          <Box
            sx={
              compact
                ? {
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    overflowY: "auto",
                    overscrollBehavior: "contain",
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
                          flex: "0 0 auto",
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.35,
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
                      const selectedLook = entry.medal ? medalColor(entry.medal) : null;

                      if (compact) {
                        const unmarked = !entry.scratched && !entry.medal;
                        return (
                          <Box
                            key={entry.heatEntryId}
                            sx={{
                              flex: "0 0 auto",
                              display: "flex",
                              flexDirection: "column",
                              gap: 0.5,
                              px: 0.85,
                              py: 0.6,
                              border: "2px solid",
                              borderStyle: unmarked ? "dashed" : "solid",
                              borderColor: entry.scratched
                                ? "error.light"
                                : selectedLook?.bg ?? "divider",
                              borderRadius: 1.5,
                              bgcolor: entry.scratched
                                ? "#ffebee"
                                : selectedLook
                                  ? `${selectedLook.bg}14`
                                  : "background.paper",
                              boxShadow: selectedLook ? `inset 3px 0 0 ${selectedLook.bg}` : "none",
                            }}
                          >
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box
                                sx={{
                                  width: { xs: 52, sm: 64 },
                                  height: 44,
                                  flexShrink: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  bgcolor: "#0a0a0a",
                                  color: "#fff",
                                  borderRadius: 1.25,
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontWeight: 900,
                                    fontSize: { xs: "1.35rem", sm: "1.55rem" },
                                    lineHeight: 1,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {entry.bib}
                                </Typography>
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <CoupleName name={entry.name} compact />
                              </Box>
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
                                    width: 64,
                                    flexShrink: 0,
                                    fontWeight: 800,
                                    bgcolor: placeTied ? "#fff8e1" : "#fff",
                                    "& .MuiSelect-select": { py: 1, px: 1, minHeight: 24 },
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
                                size="small"
                                variant={entry.notes.trim() ? "contained" : "outlined"}
                                disabled={heat.submitted}
                                onClick={(event) =>
                                  setMoreTarget({
                                    anchor: event.currentTarget,
                                    heatId: heat.id,
                                    entryId: entry.heatEntryId,
                                    name: entry.name,
                                    bib: entry.bib,
                                    notes: entry.notes,
                                    scratched: entry.scratched,
                                  })
                                }
                                sx={{ minWidth: 64, minHeight: 44, px: 1, flexShrink: 0 }}
                              >
                                More
                              </Button>
                            </Stack>
                            <ToggleButtonGroup
                              exclusive
                              size="small"
                              value={entry.scratched ? null : entry.medal}
                              onChange={(_, value: string | null) => chooseMedal(entry, value)}
                              disabled={heat.submitted || entry.scratched}
                              sx={{
                                display: "flex",
                                flexWrap: "nowrap",
                                gap: 0.35,
                                overflowX: "auto",
                                overscrollBehavior: "contain",
                                "& .MuiToggleButtonGroup-grouped": {
                                  border: "2px solid",
                                  margin: 0,
                                  borderRadius: "8px !important",
                                },
                              }}
                            >
                              {medals.map((medal) => {
                                const colors = medalColor(medal);
                                const selected = entry.medal === medal && !entry.scratched;
                                return (
                                  <ToggleButton
                                    key={medal}
                                    value={medal}
                                    sx={{
                                      flex: "1 1 0",
                                      minWidth: "0 !important",
                                      minHeight: "44px !important",
                                      height: "44px !important",
                                      p: "2px !important",
                                      fontSize: "0.95rem !important",
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
                              : selectedLook
                                ? `${selectedLook.bg}14`
                                : "background.paper",
                            borderWidth: 2,
                            borderStyle: !entry.scratched && !entry.medal ? "dashed" : "solid",
                            borderColor: selectedLook?.bg ?? "divider",
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
                                <CoupleName name={entry.name} />
                                {entry.medal && !entry.scratched ? (
                                  <Typography
                                    sx={{
                                      fontSize: "1.5rem",
                                      fontWeight: 900,
                                      color: selectedLook?.bg ?? "text.primary",
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
                                onChange={(_, value: string | null) => chooseMedal(entry, value)}
                                disabled={heat.submitted || entry.scratched}
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: { xs: 0.75, md: 1.5 },
                                  "& .MuiToggleButtonGroup-grouped": {
                                    border: "3px solid",
                                    margin: 0,
                                    borderRadius: "12px !important",
                                  },
                                }}
                              >
                                {medals.map((medal) => {
                                  const colors = medalColor(medal);
                                  const selected = entry.medal === medal && !entry.scratched;
                                  return (
                                    <ToggleButton
                                      key={medal}
                                      value={medal}
                                      sx={{
                                        flex: {
                                          xs: "1 1 56px",
                                          sm: "1 1 72px",
                                          md: "1 1 100px",
                                        },
                                        maxWidth: { xs: 88, md: 140 },
                                        fontWeight: 900,
                                        borderColor: `${colors.bg} !important`,
                                        color: selected ? colors.fg : colors.bg,
                                        bgcolor: selected ? colors.bg : "#fff",
                                        boxShadow: selected ? `0 0 0 4px ${colors.bg}55` : "none",
                                        transform: selected ? "scale(1.04)" : "none",
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
          {heat.submitted
            ? "Heat locked — already submitted"
            : `Submit heat · ${heat.groups.reduce(
                (count, group) =>
                  count + group.entries.filter((entry) => entry.scratched || Boolean(entry.medal)).length,
                0,
              )} of ${heat.groups.reduce((count, group) => count + group.entries.length, 0)} marked`}
        </Button>
      </Box>

      <Dialog
        open={Boolean(error)}
        fullScreen={isPhone}
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

      <Dialog
        open={Boolean(notesTarget)}
        onClose={() => setNotesTarget(null)}
        fullScreen={isPhone}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Notes · bib {notesTarget?.bib}
        </DialogTitle>
        <DialogContent>
          {notesTarget ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography color="text.secondary">{notesTarget.name}</Typography>
              <TextField
                autoFocus
                label="Notes"
                value={notesTarget.notes}
                multiline
                minRows={3}
                fullWidth
                onChange={(event) =>
                  setNotesTarget({ ...notesTarget, notes: event.target.value })
                }
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!notesTarget) return;
              updateEntry(notesTarget.heatId, notesTarget.entryId, {
                notes: notesTarget.notes,
              });
              setNotesTarget(null);
            }}
          >
            Save notes
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
            Marks on heat {heat.number} stay on this tablet until you refresh or sign out. Leave this
            heat?
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

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        fullScreen={isPhone}
        fullWidth
        maxWidth="md"
      >
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
                      <BibBox bib={entry.bib} />
                      {entry.medal && !entry.scratched ? <MedalBadge medal={entry.medal} /> : null}
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

      <Menu
        anchorEl={moreTarget?.anchor ?? null}
        open={Boolean(moreTarget)}
        onClose={() => setMoreTarget(null)}
      >
        <MenuItem
          onClick={() => {
            if (!moreTarget) return;
            setNotesTarget({
              heatId: moreTarget.heatId,
              entryId: moreTarget.entryId,
              name: moreTarget.name,
              bib: moreTarget.bib,
              notes: moreTarget.notes,
            });
            setMoreTarget(null);
          }}
        >
          {moreTarget?.notes.trim() ? "Notes *" : "Notes"}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!moreTarget) return;
            setScratchTarget({
              heatId: moreTarget.heatId,
              entryId: moreTarget.entryId,
              scratched: moreTarget.scratched,
            });
            setMoreTarget(null);
          }}
        >
          {moreTarget?.scratched ? "Unscratch" : "Scratch"}
        </MenuItem>
      </Menu>

      <Snackbar
        open={Boolean(undo)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === "clickaway") return;
          setUndo(null);
        }}
        message={undo ? `Undo medal for bib ${undo.bib}` : ""}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              if (!undo) return;
              updateEntry(undo.heatId, undo.entryId, { medal: undo.medal });
              setUndo(null);
            }}
          >
            Undo
          </Button>
        }
      />
    </Stack>
  );
}
