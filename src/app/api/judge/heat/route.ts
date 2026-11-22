import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { heatStyleConflict } from "@/lib/dances";
import { prisma } from "@/lib/db";
import { publishLive } from "@/lib/live";
import { medalPlacementConflict, requiresPlacement, type Scale } from "@/lib/scoring";

type ScorePayload = {
  heatEntryId: string;
  medal: string | null;
  placement: number | null;
  notes: string;
  scratched: boolean;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "JUDGE" && session.role !== "ADMIN")) {
    return NextResponse.json(
      { error: "Session expired. Sign out and sign in again (needed after a database reseed)." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    heatId?: string;
    confirm?: boolean;
    asJudgeId?: string;
    clientRequestId?: string;
    scores?: ScorePayload[];
  };

  if (!body.heatId || !Array.isArray(body.scores)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (body.clientRequestId) {
    const prior = await prisma.heatSubmission.findFirst({
      where: { clientRequestId: body.clientRequestId },
    });
    if (prior) return NextResponse.json({ ok: true, idempotent: true });
  }

  const heat = await prisma.heat.findUnique({
    where: { id: body.heatId },
    include: {
      session: { include: { judges: true, competition: true } },
      entries: { include: { competitor: { include: { division: true } }, dance: true } },
    },
  });
  if (!heat) {
    return NextResponse.json(
      { error: "Heat not found. Refresh the page after reseeding the database." },
      { status: 404 },
    );
  }
  if (!heat.session.competition.active) {
    return NextResponse.json(
      { error: "This competition is inactive. An admin must mark it active before scoring." },
      { status: 403 },
    );
  }

  const styleError = heatStyleConflict(heat.entries.map((entry) => entry.dance.abbrev));
  if (styleError) {
    return NextResponse.json({ error: styleError }, { status: 400 });
  }

  const panelIds = new Set(heat.session.judges.map((judge) => judge.userId));

  let judgeId = session.id;
  if (session.role === "ADMIN") {
    const requested = body.asJudgeId;
    if (!requested || !panelIds.has(requested)) {
      return NextResponse.json(
        { error: "Admins must choose a panel judge to score as." },
        { status: 400 },
      );
    }
    judgeId = requested;
  } else if (!panelIds.has(session.id)) {
    return NextResponse.json({ error: "Not assigned to this session" }, { status: 403 });
  }

  const judge = await prisma.user.findUnique({ where: { id: judgeId } });
  if (!judge) {
    return NextResponse.json(
      { error: "Judge account missing. Sign in again after reseeding." },
      { status: 401 },
    );
  }

  const entryById = new Map(heat.entries.map((entry) => [entry.id, entry]));
  const normalized: ScorePayload[] = [];

  for (const score of body.scores) {
    const entry = entryById.get(score.heatEntryId);
    if (!entry) {
      return NextResponse.json(
        { error: "Score does not belong to this heat. Refresh the page." },
        { status: 400 },
      );
    }
    const scale = entry.competitor.division.scale as Scale;
    const needsPlace = requiresPlacement(scale);
    normalized.push({
      ...score,
      placement: score.scratched || !needsPlace ? null : score.placement,
    });
  }

  if (body.confirm) {
    const byGroup = new Map<string, ScorePayload[]>();
    for (const score of normalized) {
      if (score.scratched) continue;
      const entry = entryById.get(score.heatEntryId)!;
      const scale = entry.competitor.division.scale as Scale;
      const key = `${entry.competitor.divisionId}:${entry.danceId}`;
      const list = byGroup.get(key) ?? [];
      list.push(score);
      byGroup.set(key, list);

      if (!score.medal) {
        return NextResponse.json(
          { error: `Pick a medal for bib ${entry.competitor.bib} in ${entry.dance.name}.` },
          { status: 400 },
        );
      }
      if (requiresPlacement(scale) && !score.placement) {
        return NextResponse.json(
          { error: `Pick a place for bib ${entry.competitor.bib} in ${entry.dance.name}.` },
          { status: 400 },
        );
      }
    }

    for (const scores of byGroup.values()) {
      const entry = entryById.get(scores[0].heatEntryId)!;
      const scale = entry.competitor.division.scale as Scale;
      if (!requiresPlacement(scale)) continue;

      const places = scores.map((score) => score.placement);
      if (new Set(places).size !== places.length) {
        return NextResponse.json(
          {
            error: `Each couple in ${entry.competitor.division.name} · ${entry.dance.name} needs a different place.`,
          },
          { status: 400 },
        );
      }

      const medalPlaceError = medalPlacementConflict(
        scores.map((score) => {
          const row = entryById.get(score.heatEntryId)!;
          return {
            bib: row.competitor.bib,
            medal: score.medal!,
            placement: score.placement!,
          };
        }),
        scale,
      );
      if (medalPlaceError) {
        return NextResponse.json({ error: medalPlaceError }, { status: 400 });
      }
    }
  }

  for (const score of normalized) {
    await prisma.score.upsert({
      where: {
        heatEntryId_judgeId: { heatEntryId: score.heatEntryId, judgeId },
      },
      create: {
        heatEntryId: score.heatEntryId,
        judgeId,
        medal: score.scratched ? null : score.medal,
        placement: score.scratched ? null : score.placement,
        notes: score.notes ?? "",
        scratched: Boolean(score.scratched),
      },
      update: {
        medal: score.scratched ? null : score.medal,
        placement: score.scratched ? null : score.placement,
        notes: score.notes ?? "",
        scratched: Boolean(score.scratched),
        overridden: false,
      },
    });
  }

  if (body.confirm) {
    await prisma.heatSubmission.upsert({
      where: { heatId_judgeId: { heatId: body.heatId, judgeId } },
      create: {
        heatId: body.heatId,
        judgeId,
        confirmedAt: new Date(),
        clientRequestId: body.clientRequestId || null,
      },
      update: {
        confirmedAt: new Date(),
        ...(body.clientRequestId ? { clientRequestId: body.clientRequestId } : {}),
      },
    });
  }

  publishLive({
    type: body.confirm ? "submissions" : "scores",
    competitionId: heat.session.competition.id,
    sessionId: heat.sessionId,
    heatId: heat.id,
  });

  return NextResponse.json({ ok: true });
}
