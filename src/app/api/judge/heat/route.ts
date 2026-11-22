import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { heatStyleConflict } from "@/lib/dances";
import { buildAndCacheScrutineerView } from "@/lib/results";
import { medalPlacementConflict, requiresPlacement, type Scale } from "@/lib/scoring";
import {
  getCompetition,
  getHeat,
  getSession as getCompSession,
  submitJudgeHeat,
} from "@/lib/store/competitions";
import type { MarkEmbedded } from "@/lib/store/types";

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
    return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  }

  const body = (await request.json()) as {
    competitionId?: string;
    sessionId?: string;
    heatId?: string;
    confirm?: boolean;
    asJudgeId?: string;
    clientRequestId?: string;
    scores?: ScorePayload[];
  };

  if (!body.competitionId || !body.sessionId || !body.heatId || !Array.isArray(body.scores)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const competition = await getCompetition(body.competitionId);
  if (!competition?.active) {
    return NextResponse.json({ error: "Competition is inactive." }, { status: 403 });
  }

  const compSession = await getCompSession(body.competitionId, body.sessionId);
  if (!compSession) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  let judgeId = session.id;
  if (session.role === "ADMIN") {
    if (!body.asJudgeId || !compSession.judgeIds.includes(body.asJudgeId)) {
      return NextResponse.json({ error: "Admins must choose a panel judge to score as." }, { status: 400 });
    }
    judgeId = body.asJudgeId;
  } else if (!compSession.judgeIds.includes(session.id)) {
    return NextResponse.json({ error: "You are not assigned to this session." }, { status: 403 });
  }

  const heat = await getHeat(body.competitionId, body.sessionId, body.heatId);
  if (!heat) {
    return NextResponse.json({ error: "Heat not found." }, { status: 404 });
  }

  const styleError = heatStyleConflict(heat.entries.map((entry) => entry.danceAbbrev));
  if (styleError) {
    return NextResponse.json({ error: styleError }, { status: 400 });
  }

  const byDivision = new Map<string, ScorePayload[]>();
  for (const score of body.scores) {
    const entry = heat.entries.find((item) => item.id === score.heatEntryId);
    if (!entry) {
      return NextResponse.json({ error: "Unknown heat entry." }, { status: 400 });
    }
    const list = byDivision.get(entry.divisionId) ?? [];
    list.push(score);
    byDivision.set(entry.divisionId, list);
  }

  for (const [divisionId, scores] of byDivision) {
    const entry = heat.entries.find((item) => item.divisionId === divisionId);
    const scale = (entry?.scale ?? "COUPLES") as Scale;
    const active = scores.filter((score) => !score.scratched);
    if (requiresPlacement(scale) && active.length > 1) {
      for (const score of active) {
        if (!score.medal) {
          return NextResponse.json({ error: "Every dancing couple needs a medal." }, { status: 400 });
        }
        if (!score.placement) {
          return NextResponse.json({ error: "Every dancing couple needs a place." }, { status: 400 });
        }
      }
      const places = active.map((score) => score.placement);
      if (new Set(places).size !== places.length) {
        return NextResponse.json({ error: "Places must be unique within a division." }, { status: 400 });
      }
      const conflict = medalPlacementConflict(
        active.map((score) => {
          const heatEntry = heat.entries.find((item) => item.id === score.heatEntryId)!;
          return { bib: heatEntry.bib, medal: score.medal!, placement: score.placement! };
        }),
        scale,
      );
      if (conflict) return NextResponse.json({ error: conflict }, { status: 400 });
    }
  }

  const marks: Record<string, MarkEmbedded> = {};
  for (const score of body.scores) {
    marks[score.heatEntryId] = {
      medal: score.medal,
      placement: score.placement,
      notes: score.notes ?? "",
      scratched: score.scratched,
      overridden: false,
    };
  }

  try {
    const result = await submitJudgeHeat({
      competitionId: body.competitionId,
      sessionId: body.sessionId,
      heatId: body.heatId,
      judgeId,
      confirm: Boolean(body.confirm),
      clientRequestId: body.clientRequestId,
      marks,
    });

    if (body.confirm) {
      const touchedDivisions = [...new Set(heat.entries.map((entry) => entry.divisionId))];
      await Promise.all(
        touchedDivisions.map((divisionId) =>
          buildAndCacheScrutineerView({
            competitionId: body.competitionId!,
            sessionId: body.sessionId!,
            divisionId,
          }),
        ),
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save scores." },
      { status: 400 },
    );
  }
}
