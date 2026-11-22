import type { DivisionPacket } from "./cdd/adapter";
import { danceRowFromBreakdown, exportDivision } from "./cdd/adapter";
import { prisma } from "./db";
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

const competitionInclude = {
  divisions: {
    include: {
      dances: { orderBy: { sortOrder: "asc" as const } },
      competitors: { orderBy: { bib: "asc" as const } },
    },
  },
  sessions: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      judges: { include: { user: true }, orderBy: { sortOrder: "asc" as const } },
      heats: {
        orderBy: { number: "asc" as const },
        include: {
          submissions: true,
          entries: {
            include: {
              competitor: { include: { division: true } },
              dance: true,
              scores: { include: { judge: true } },
            },
          },
        },
      },
    },
  },
} as const;

export async function listCompetitions(options: { activeOnly?: boolean } = {}) {
  return prisma.competition.findMany({
    where: options.activeOnly ? { active: true } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, dateLabel: true, status: true, active: true },
  });
}

export async function loadCompetition(
  competitionId?: string | null,
  options: { activeOnly?: boolean } = {},
) {
  if (competitionId) {
    return prisma.competition.findUnique({
      where: { id: competitionId },
      include: competitionInclude,
    });
  }
  return prisma.competition.findFirst({
    where: options.activeOnly ? { active: true } : undefined,
    orderBy: { name: "asc" },
    include: competitionInclude,
  });
}

export type LoadedCompetition = NonNullable<Awaited<ReturnType<typeof loadCompetition>>>;

export function pickSession(competition: LoadedCompetition, sessionId?: string | null) {
  return competition.sessions.find((session) => session.id === sessionId) ?? competition.sessions[0] ?? null;
}

export function pickDivision(competition: LoadedCompetition, divisionId?: string | null) {
  return competition.divisions.find((division) => division.id === divisionId) ?? competition.divisions[0] ?? null;
}

export type HeatStatus = {
  id: string;
  number: number;
  label: string;
  confirmed: number;
  judges: number;
  complete: boolean;
};

export type AlertItem = {
  id: string;
  text: string;
};

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

export type DanceSheet = {
  name: string;
  abbrev: string;
  judges: string[];
  rows: {
    bib: number;
    name: string;
    cells: { judge: string; medal: string; placement: number | null; overridden: boolean }[];
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
  dance: string;
  bib: number;
  couple: string;
  judge: string;
  medal: string;
  placement: number | null;
  notes: string;
  scratched: boolean;
  scale: Scale;
};

export type ScrutineerView = {
  competition: { id: string; name: string; dateLabel: string; location: string };
  competitionId: string;
  sessionId: string;
  divisionId: string;
  divisionName: string;
  sessionName: string;
  sessionComplete: boolean;
  heats: HeatStatus[];
  alerts: AlertItem[];
  summary: SummaryRow[];
  dances: DanceSheet[];
  scores: ScoreChoice[];
  audits: AuditRow[];
  packet: DivisionPacket;
};

type HeatEntryLoaded = LoadedCompetition["sessions"][number]["heats"][number]["entries"][number];
type ScoreLoaded = HeatEntryLoaded["scores"][number];

function officialMarks(entry: HeatEntryLoaded, judgeOrder: string[], scale: Scale) {
  const byJudge = new Map(entry.scores.map((score) => [score.judgeId, score]));
  const ordered = judgeOrder
    .map((id) => byJudge.get(id))
    .filter((score): score is ScoreLoaded => score != null);
  const scratchFlags = ordered.map((score) => score.scratched);
  const disagreed = scratchFlags.some(Boolean) && scratchFlags.some((flag) => !flag);
  const allScratched = ordered.length > 0 && scratchFlags.every(Boolean);
  const active = ordered.filter((score): score is ScoreLoaded & { medal: string } => {
    if (score.scratched || !score.medal) return false;
    if (scale === "COUPLES" && score.placement == null) return false;
    return true;
  });
  return { ordered, disagreed, allScratched, active };
}

export function buildScrutineerView(
  competition: LoadedCompetition,
  options: { sessionId?: string | null; divisionId?: string | null } = {},
): ScrutineerView | null {
  const division = pickDivision(competition, options.divisionId);
  const session = pickSession(competition, options.sessionId);
  if (!division || !session) return null;

  const scale = division.scale as Scale;
  const judgeUsers = session.judges.map((judge) => judge.user);
  const judgeIds = judgeUsers.map((judge) => judge.id);
  const judgeNames = judgeUsers.map((judge) => judge.displayName);

  const heats: HeatStatus[] = session.heats.map((heat) => {
    const style = heat.entries[0]?.dance.name ?? `Heat ${heat.number}`;
    const divisions = [
      ...new Set(heat.entries.map((entry) => entry.competitor.division.name)),
    ];
    return {
      id: heat.id,
      number: heat.number,
      label: divisions.length > 1 ? `${style} · ${divisions.join(" + ")}` : style,
      confirmed: heat.submissions.length,
      judges: judgeUsers.length,
      complete: heat.submissions.length >= judgeUsers.length && judgeUsers.length > 0,
    };
  });

  const alerts: AlertItem[] = [];
  const scores: ScoreChoice[] = [];
  const danceRows = new Map<string, DanceSheet["rows"]>();
  const placeByCouple = new Map<string, Map<string, number>>();
  const overriddenByCouple = new Map<string, Map<string, boolean>>();

  for (const dance of division.dances) {
    danceRows.set(dance.id, []);
  }

  for (const heat of session.heats) {
    const byDance = new Map<string, typeof heat.entries>();
    for (const entry of heat.entries) {
      if (entry.competitor.divisionId !== division.id) continue;
      const list = byDance.get(entry.danceId) ?? [];
      list.push(entry);
      byDance.set(entry.danceId, list);
    }

    for (const [danceId, entries] of byDance) {
      const inputs: CoupleInput[] = [];
      const activeById = new Map<string, ReturnType<typeof officialMarks>["active"]>();

      for (const entry of entries) {
        const marks = officialMarks(entry, judgeIds, scale);
        if (marks.disagreed) {
          alerts.push({
            id: `scratch-${entry.id}`,
            text: `Bib ${entry.competitor.bib} scratch does not match across judges in ${entry.dance.name}.`,
          });
        }
        const points = marks.active.map((score) => medalPoints(score.medal, scale));
        marks.active.forEach((score, index) => {
          const others = points.filter((_, other) => other !== index);
          if (others.length === 0) return;
          const gap = points[index] - median(others);
          if (gap >= OUTLIER_STEPS) {
            alerts.push({
              id: `low-${score.id}`,
              text: `${score.judge.displayName} marked ${score.medal} on bib ${entry.competitor.bib} in ${entry.dance.name}, ${Math.round(gap)} steps below the others.`,
            });
          }
        });

        for (const score of entry.scores) {
          scores.push({
            scoreId: score.id,
            dance: entry.dance.name,
            bib: entry.competitor.bib,
            couple: entry.competitor.name,
            judge: score.judge.displayName,
            medal: score.medal ?? "",
            placement: score.placement,
            notes: score.notes,
            scratched: score.scratched,
            scale,
          });
        }

        if (marks.allScratched || marks.active.length === 0) continue;
        activeById.set(entry.competitorId, marks.active);
        inputs.push({
          id: entry.competitorId,
          marks: marks.active.map((score) => ({
            judgeId: score.judgeId,
            medal: score.medal,
            placement: score.placement ?? medalPoints(score.medal, scale),
          })),
        });
      }

      const ranked = rankDance(inputs, scale);
      const sheet = danceRows.get(danceId) ?? [];
      for (const row of ranked) {
        const entry = entries.find((item) => item.competitorId === row.id);
        if (!entry) continue;
        const active = activeById.get(row.id) ?? [];
        const cells = judgeIds
          .map((judgeId) => {
            const score = active.find((item) => item.judgeId === judgeId);
            return score
              ? {
                  judge: score.judge.displayName,
                  medal: score.medal,
                  placement: score.placement,
                  overridden: score.overridden,
                }
              : null;
          })
          .filter(
            (
              cell,
            ): cell is {
              judge: string;
              medal: string;
              placement: number | null;
              overridden: boolean;
            } => cell != null,
          );

        const hasOverride = active.some((score) => score.overridden) || cells.some((cell) => cell.overridden);

        sheet.push({
          bib: entry.competitor.bib,
          name: entry.competitor.name,
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

        const places = placeByCouple.get(entry.competitorId) ?? new Map<string, number>();
        places.set(danceId, row.place);
        placeByCouple.set(entry.competitorId, places);

        const overrides = overriddenByCouple.get(entry.competitorId) ?? new Map<string, boolean>();
        overrides.set(danceId, hasOverride);
        overriddenByCouple.set(entry.competitorId, overrides);
      }
      danceRows.set(danceId, sheet);
    }
  }

  const judgePlacesByCouple = new Map<string, number[]>();
  for (const heat of session.heats) {
    for (const entry of heat.entries) {
      if (entry.competitor.divisionId !== division.id) continue;
      const marks = officialMarks(entry, judgeIds, scale);
      const list = judgePlacesByCouple.get(entry.competitorId) ?? [];
      for (const score of marks.active) {
        list.push(
          scale === "PROAM"
            ? medalPoints(score.medal, scale)
            : (score.placement ?? medalPoints(score.medal, scale)),
        );
      }
      judgePlacesByCouple.set(entry.competitorId, list);
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
          row.cells.map((cell) => ({ judge: cell.judge, medal: cell.medal, placement: cell.placement })),
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

  return {
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
    sessionComplete: heats.length > 0 && heats.every((heat) => heat.complete),
    heats,
    alerts,
    summary,
    dances,
    scores,
    audits: [],
    packet,
  };
}

export async function loadAuditsForDivision(competitionId: string, divisionId: string): Promise<AuditRow[]> {
  const audits = await prisma.scoreAudit.findMany({
    where: {
      score: {
        heatEntry: {
          competitor: { divisionId },
          heat: { session: { competitionId } },
        },
      },
    },
    include: {
      actor: true,
      score: {
        include: {
          judge: true,
          heatEntry: { include: { competitor: true, dance: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return audits.map((audit) => ({
    id: audit.id,
    at: audit.createdAt.toISOString(),
    actor: audit.actor.displayName,
    bib: audit.score.heatEntry.competitor.bib,
    dance: audit.score.heatEntry.dance.name,
    judge: audit.score.judge.displayName,
    before: audit.beforeJson,
    after: audit.afterJson,
  }));
}
