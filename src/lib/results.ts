import type { DivisionPacket } from "./cdd/adapter";
import { danceRowFromBreakdown, exportDivision } from "./cdd/adapter";
import {
  getCompetition,
  getDivision,
  getDivisionResults,
  getSession,
  getSessionLive,
  getUsersByIds,
  listAudits,
  listHeats,
  listJudgeSheetsForHeat,
  saveDivisionResults,
} from "@/lib/store/competitions";
import { scoreKey } from "@/lib/store/paths";
import type { HeatEntryEmbedded, MarkEmbedded, MarkOriginal } from "@/lib/store/types";

function originalLabel(original: MarkOriginal | null | undefined): string | null {
  if (!original) return null;
  if (original.scratched) return "SCR";
  const place = original.placement != null ? ` ${original.placement}` : "";
  return `${original.medal ?? "—"}${place}`;
}
import {
  OUTLIER_STEPS,
  medalPoints,
  median,
  rankDance,
  rankOverall,
  rule9Total,
  type CoupleInput,
  type Scale,
} from "./scoring";

export type HeatStatus = {
  id: string;
  number: number;
  label: string;
  confirmed: number;
  judges: number;
  complete: boolean;
};

export type AlertItem = { id: string; text: string };

export type SummaryRow = {
  bib: number;
  name: string;
  places: { abbrev: string; place: number; overridden: boolean }[];
  rule9Total: number;
  rule10Place: string | number;
  rule11Place: string | number;
  place: number;
  overridden: boolean;
};

export type AuditRow = {
  id: string;
  at: string;
  actor: string;
  bib: number;
  dance: string;
  judge: string;
  before: string;
  after: string;
};

export type DanceSheetCell = {
  scoreId: string;
  judge: string;
  medal: string;
  placement: number | null;
  notes: string;
  scratched: boolean;
  overridden: boolean;
  canRestore: boolean;
  originalLabel: string | null;
};

export type DanceSheet = {
  name: string;
  abbrev: string;
  judges: string[];
  rows: {
    bib: number;
    name: string;
    cells: DanceSheetCell[];
    ordered: string;
    mark: number;
    size: number;
    sum: number;
    lookAhead: string;
    lookBack: string;
    medal: string;
    place: number;
  }[];
};

export type ScoreChoice = {
  scoreId: string;
  heatId: string;
  entryId: string;
  judgeId: string;
  dance: string;
  bib: number;
  couple: string;
  judge: string;
  medal: string;
  placement: number | null;
  notes: string;
  scratched: boolean;
  scale: Scale;
  overridden: boolean;
  canRestore: boolean;
  originalLabel: string | null;
};

export type ScrutineerView = {
  competition: { id: string; name: string; dateLabel: string; location: string };
  competitionId: string;
  sessionId: string;
  divisionId: string;
  divisionName: string;
  sessionName: string;
  sessionComplete: boolean;
  /** True while any heat that touches this division still awaits a full panel. */
  provisional: boolean;
  heats: HeatStatus[];
  alerts: AlertItem[];
  summary: SummaryRow[];
  dances: DanceSheet[];
  scores: ScoreChoice[];
  audits: AuditRow[];
  packet?: DivisionPacket;
};

type EntryMarks = {
  entry: HeatEntryEmbedded;
  byJudge: Map<string, MarkEmbedded & { judgeId: string; judgeName: string }>;
};

function officialMarks(
  entryMarks: EntryMarks,
  judgeOrder: string[],
  scale: Scale,
) {
  const ordered = judgeOrder
    .map((id) => entryMarks.byJudge.get(id))
    .filter((score): score is MarkEmbedded & { judgeId: string; judgeName: string } => score != null);
  const scratchFlags = ordered.map((score) => score.scratched);
  const disagreed = scratchFlags.some(Boolean) && scratchFlags.some((flag) => !flag);
  const allScratched = ordered.length > 0 && scratchFlags.every(Boolean);
  const active = ordered.filter((score) => {
    if (score.scratched || !score.medal) return false;
    if (scale === "COUPLES" && score.placement == null) return false;
    return true;
  }) as Array<MarkEmbedded & { judgeId: string; judgeName: string; medal: string }>;
  return { ordered, disagreed, allScratched, active };
}

export async function buildAndCacheScrutineerView(input: {
  competitionId: string;
  sessionId: string;
  divisionId: string;
}): Promise<ScrutineerView | null> {
  const [competition, division, session, live, heats, audits] = await Promise.all([
    getCompetition(input.competitionId),
    getDivision(input.competitionId, input.divisionId),
    getSession(input.competitionId, input.sessionId),
    getSessionLive(input.competitionId, input.sessionId),
    listHeats(input.competitionId, input.sessionId),
    listAudits(input.competitionId, input.divisionId),
  ]);
  if (!competition || !division || !session) return null;

  const users = await getUsersByIds(session.judgeIds);
  const judgeIds = session.judgeIds.filter((id) => users.has(id));
  const judgeNames = judgeIds.map((id) => users.get(id)!.displayName);
  const scale = division.scale;

  const heatStatuses: HeatStatus[] =
    live?.heats ??
    heats.map((heat) => ({
      id: heat.id,
      number: heat.number,
      label: heat.styleAbbrev || heat.styleName,
      confirmed: heat.confirmCount,
      judges: judgeIds.length,
      complete: judgeIds.length > 0 && heat.confirmCount >= judgeIds.length,
    }));

  const sheetsByHeat = await Promise.all(
    heats.map(async (heat) => ({
      heat,
      sheets: await listJudgeSheetsForHeat(input.competitionId, input.sessionId, heat.id),
    })),
  );

  const alerts: AlertItem[] = [];
  const scores: ScoreChoice[] = [];
  const danceRows = new Map<string, DanceSheet["rows"]>();
  const placeByCouple = new Map<string, Map<string, number>>();
  const overriddenByCouple = new Map<string, Map<string, boolean>>();
  const judgePlacesByCouple = new Map<string, number[]>();

  for (const dance of division.dances) danceRows.set(dance.id, []);

  for (const { heat, sheets } of sheetsByHeat) {
    const entries = heat.entries.filter((entry) => entry.divisionId === division.id);
    const byDance = new Map<string, EntryMarks[]>();

    for (const entry of entries) {
      const byJudge = new Map<string, MarkEmbedded & { judgeId: string; judgeName: string }>();
      for (const sheet of sheets) {
        const mark = sheet.marks[entry.id];
        if (!mark) continue;
        const judge = users.get(sheet.judgeId);
        byJudge.set(sheet.judgeId, {
          ...mark,
          judgeId: sheet.judgeId,
          judgeName: judge?.displayName ?? sheet.judgeId,
        });
        scores.push({
          scoreId: scoreKey(heat.id, entry.id, sheet.judgeId),
          heatId: heat.id,
          entryId: entry.id,
          judgeId: sheet.judgeId,
          dance: entry.danceName,
          bib: entry.bib,
          couple: entry.name,
          judge: judge?.displayName ?? sheet.judgeId,
          medal: mark.medal ?? "",
          placement: mark.placement,
          notes: mark.notes,
          scratched: mark.scratched,
          scale,
          overridden: Boolean(mark.overridden),
          canRestore: Boolean(mark.overridden),
          originalLabel: originalLabel(mark.original),
        });
      }
      const list = byDance.get(entry.danceId) ?? [];
      list.push({ entry, byJudge });
      byDance.set(entry.danceId, list);
    }

    for (const [danceId, entryMarksList] of byDance) {
      const inputs: CoupleInput[] = [];
      const activeById = new Map<string, ReturnType<typeof officialMarks>["active"]>();

      for (const entryMarks of entryMarksList) {
        const marks = officialMarks(entryMarks, judgeIds, scale);
        if (marks.disagreed) {
          alerts.push({
            id: `scratch-${entryMarks.entry.id}`,
            text: `Bib ${entryMarks.entry.bib} scratch does not match across judges in ${entryMarks.entry.danceName}.`,
          });
        }
        const points = marks.active.map((score) => medalPoints(score.medal, scale));
        marks.active.forEach((score, index) => {
          const others = points.filter((_, other) => other !== index);
          if (others.length === 0) return;
          const gap = points[index] - median(others);
          if (gap >= OUTLIER_STEPS) {
            alerts.push({
              id: `low-${score.judgeId}-${entryMarks.entry.id}`,
              text: `${score.judgeName} marked ${score.medal} on bib ${entryMarks.entry.bib} in ${entryMarks.entry.danceName}, ${Math.round(gap)} steps below the others.`,
            });
          }
        });

        if (marks.allScratched || marks.active.length === 0) continue;
        activeById.set(entryMarks.entry.competitorId, marks.active);
        inputs.push({
          id: entryMarks.entry.competitorId,
          marks: marks.active.map((score) => ({
            judgeId: score.judgeId,
            medal: score.medal,
            placement: score.placement ?? medalPoints(score.medal, scale),
          })),
        });

        const list = judgePlacesByCouple.get(entryMarks.entry.competitorId) ?? [];
        for (const score of marks.active) {
          list.push(
            scale === "PROAM"
              ? medalPoints(score.medal, scale)
              : (score.placement ?? medalPoints(score.medal, scale)),
          );
        }
        judgePlacesByCouple.set(entryMarks.entry.competitorId, list);
      }

      const ranked = rankDance(inputs, scale);
      const sheet = danceRows.get(danceId) ?? [];
      for (const row of ranked) {
        const entryMarks = entryMarksList.find((item) => item.entry.competitorId === row.id);
        if (!entryMarks) continue;
        const active = activeById.get(row.id) ?? [];
        const cells: DanceSheetCell[] = judgeIds.flatMap((judgeId) => {
          const score = entryMarks.byJudge.get(judgeId);
          if (!score) return [];
          return [
            {
              scoreId: scoreKey(heat.id, entryMarks.entry.id, judgeId),
              judge: score.judgeName,
              medal: score.medal ?? "",
              placement: score.placement,
              notes: score.notes ?? "",
              scratched: score.scratched,
              overridden: score.overridden,
              canRestore: Boolean(score.overridden),
              originalLabel: originalLabel(score.original),
            },
          ];
        });

        const hasOverride = active.some((score) => score.overridden);
        sheet.push({
          bib: entryMarks.entry.bib,
          name: entryMarks.entry.name,
          cells,
          ordered: row.ordered.join("-"),
          mark: row.mark,
          size: row.size,
          sum: row.sum,
          lookAhead: row.lookAhead.join("-"),
          lookBack: row.lookBack.join("-"),
          medal: row.medal,
          place: row.place,
        });

        const places = placeByCouple.get(entryMarks.entry.competitorId) ?? new Map<string, number>();
        places.set(danceId, row.place);
        placeByCouple.set(entryMarks.entry.competitorId, places);

        const overrides =
          overriddenByCouple.get(entryMarks.entry.competitorId) ?? new Map<string, boolean>();
        overrides.set(danceId, hasOverride);
        overriddenByCouple.set(entryMarks.entry.competitorId, overrides);
      }
      danceRows.set(danceId, sheet);
    }
  }

  const summarySource = division.competitors.map((couple) => {
    const places = division.dances.map((dance) => placeByCouple.get(couple.id)?.get(dance.id) ?? null);
    return {
      id: couple.id,
      bib: couple.bib,
      name: couple.name,
      places,
      total: rule9Total(places, division.rule9Count),
      judgePlaces: judgePlacesByCouple.get(couple.id) ?? [],
    };
  });
  const rankedOverall = rankOverall(
    summarySource.map((row) => ({
      id: row.id,
      total: row.total,
      dancePlaces: row.places,
      judgePlaces: row.judgePlaces,
    })),
  );
  const overallOf = new Map(rankedOverall.map((row) => [row.id, row]));

  const summary: SummaryRow[] = summarySource
    .map((row) => {
      const places = division.dances.map((dance, index) => ({
        abbrev: dance.abbrev,
        place: row.places[index] ?? 0,
        overridden: overriddenByCouple.get(row.id)?.get(dance.id) ?? false,
      }));
      const overall = overallOf.get(row.id);
      return {
        bib: row.bib,
        name: row.name,
        places,
        rule9Total: row.total,
        rule10Place: overall?.rule10Place ?? "--",
        rule11Place: overall?.rule11Place ?? "--",
        place: overall?.place ?? 0,
        overridden: places.some((place) => place.overridden),
      };
    })
    .sort((a, b) => a.place - b.place || a.bib - b.bib);

  const dances: DanceSheet[] = division.dances
    .filter((dance) => (danceRows.get(dance.id) ?? []).length > 0)
    .map((dance) => ({
      name: dance.name,
      abbrev: dance.abbrev,
      judges: judgeNames,
      rows: (danceRows.get(dance.id) ?? []).sort((a, b) => a.place - b.place),
    }));

  const packet = exportDivision({
    competition: competition.name,
    competitionCddId: competition.cddId,
    division: division.name,
    divisionCddId: division.cddId,
    scale: division.scale,
    rule9Count: division.rule9Count,
    judges: judgeNames,
    summary: summary.map((row) => ({
      bib: row.bib,
      name: row.name,
      dances: row.places,
      rule9Total: row.rule9Total,
      rule10Place: row.rule10Place,
      rule11Place: row.rule11Place,
      place: row.place,
    })),
    dances: dances.map((dance) => ({
      name: dance.name,
      abbrev: dance.abbrev,
      rows: dance.rows.map((row) =>
        danceRowFromBreakdown(
          { bib: row.bib, name: row.name },
          row.cells.map((cell) => ({
            judge: cell.judge,
            medal: cell.medal,
            placement: cell.placement,
          })),
          {
            id: String(row.bib),
            ordered: row.ordered.split("-").map(Number),
            mark: row.mark,
            size: row.size,
            sum: row.sum,
            lookAhead: row.lookAhead ? row.lookAhead.split("-").map(Number) : [],
            lookBack: row.lookBack ? row.lookBack.split("-").map(Number) : [],
            place: row.place,
            medal: row.medal,
            medalPoints: 0,
          },
        ),
      ),
    })),
  });

  const divisionHeatIds = new Set(
    heats
      .filter((heat) => heat.entries.some((entry) => entry.divisionId === division.id))
      .map((heat) => heat.id),
  );
  const relevantStatuses = heatStatuses.filter((heat) => divisionHeatIds.has(heat.id));
  const provisional =
    relevantStatuses.length === 0 || relevantStatuses.some((heat) => !heat.complete);

  const view: ScrutineerView = {
    competition: {
      id: competition.id,
      name: competition.name,
      dateLabel: competition.dateLabel,
      location: competition.location,
    },
    competitionId: competition.id,
    sessionId: session.id,
    divisionId: division.id,
    divisionName: division.name,
    sessionName: session.name,
    sessionComplete: heatStatuses.length > 0 && heatStatuses.every((heat) => heat.complete),
    provisional,
    heats: heatStatuses,
    alerts,
    summary,
    dances,
    scores,
    audits: audits.map((audit) => ({
      id: audit.id,
      at: audit.at,
      actor: audit.actorName,
      bib: audit.bib,
      dance: audit.dance,
      judge: audit.judgeName,
      before: audit.before,
      after: audit.after,
    })),
    packet,
  };

  // Omit bulky export packet from the live cache listener payload.
  const { packet: _packet, ...cacheView } = view;
  await saveDivisionResults(input.competitionId, input.divisionId, {
    view: cacheView,
  });

  return view;
}

/** Prefer cached results doc when present; rebuild when missing. */
export async function loadScrutineerView(input: {
  competitionId: string;
  sessionId: string;
  divisionId: string;
  forceRebuild?: boolean;
}): Promise<ScrutineerView | null> {
  if (!input.forceRebuild) {
    const cached = await getDivisionResults(input.competitionId, input.divisionId);
    const view = cached?.view as ScrutineerView | undefined;
    if (view && view.sessionId === input.sessionId) {
      const live = await getSessionLive(input.competitionId, input.sessionId);
      if (live) {
        const sessionComplete =
          live.heats.length > 0 && live.heats.every((heat) => heat.complete);
        return {
          ...view,
          heats: live.heats,
          sessionComplete,
          provisional: view.provisional || !sessionComplete,
        };
      }
      return view;
    }
  }
  return buildAndCacheScrutineerView(input);
}
