import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAndCacheScrutineerView } from "@/lib/results";
import { parseScoreKey } from "@/lib/store/paths";
import {
  getCompetition,
  getHeat,
  getUsersByIds,
  restoreJudgeMark,
} from "@/lib/store/competitions";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "SCRUTINEER" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    competitionId?: string;
    sessionId?: string;
    divisionId?: string;
    scoreId?: string;
  };

  if (!body.competitionId || !body.sessionId || !body.divisionId || !body.scoreId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const competition = await getCompetition(body.competitionId);
  if (!competition?.active) {
    return NextResponse.json({ error: "Competition is inactive." }, { status: 403 });
  }

  const parsed = parseScoreKey(body.scoreId);
  if (!parsed) return NextResponse.json({ error: "Invalid score id" }, { status: 400 });

  const heat = await getHeat(body.competitionId, body.sessionId, parsed.heatId);
  if (!heat) return NextResponse.json({ error: "Heat not found" }, { status: 404 });
  const entry = heat.entries.find((item) => item.id === parsed.entryId);
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (entry.divisionId !== body.divisionId) {
    return NextResponse.json({ error: "Score is not in this division." }, { status: 400 });
  }

  const users = await getUsersByIds([parsed.judgeId]);
  const judge = users.get(parsed.judgeId);

  try {
    await restoreJudgeMark({
      competitionId: body.competitionId,
      sessionId: body.sessionId,
      heatId: parsed.heatId,
      judgeId: parsed.judgeId,
      entryId: parsed.entryId,
      actorId: session.id,
      actorName: session.displayName,
      bib: entry.bib,
      dance: entry.danceName,
      judgeName: judge?.displayName ?? parsed.judgeId,
      divisionId: body.divisionId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restore failed" },
      { status: 400 },
    );
  }

  const view = await buildAndCacheScrutineerView({
    competitionId: body.competitionId,
    sessionId: body.sessionId,
    divisionId: body.divisionId,
  });

  return NextResponse.json({ ok: true, view });
}
