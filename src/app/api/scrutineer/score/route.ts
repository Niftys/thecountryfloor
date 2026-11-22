import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAndCacheScrutineerView } from "@/lib/results";
import { parseScoreKey } from "@/lib/store/paths";
import { getHeat, getUsersByIds, updateJudgeMark } from "@/lib/store/competitions";
import { requiresPlacement } from "@/lib/scoring";

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
    medal?: string | null;
    placement?: number | null;
    notes?: string;
    scratched?: boolean;
  };

  if (!body.competitionId || !body.sessionId || !body.divisionId || !body.scoreId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = parseScoreKey(body.scoreId);
  if (!parsed) return NextResponse.json({ error: "Invalid score id" }, { status: 400 });

  const heat = await getHeat(body.competitionId, body.sessionId, parsed.heatId);
  if (!heat) return NextResponse.json({ error: "Heat not found" }, { status: 404 });
  const entry = heat.entries.find((item) => item.id === parsed.entryId);
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const users = await getUsersByIds([parsed.judgeId]);
  const judge = users.get(parsed.judgeId);

  await updateJudgeMark({
    competitionId: body.competitionId,
    sessionId: body.sessionId,
    heatId: parsed.heatId,
    judgeId: parsed.judgeId,
    entryId: parsed.entryId,
    mark: {
      medal: body.scratched ? null : (body.medal ?? null),
      placement:
        body.scratched || !requiresPlacement(entry.scale) || body.placement == null
          ? null
          : body.placement,
      notes: body.notes ?? "",
      scratched: Boolean(body.scratched),
      overridden: true,
    },
    actorId: session.id,
    actorName: session.displayName,
    bib: entry.bib,
    dance: entry.danceName,
    judgeName: judge?.displayName ?? parsed.judgeId,
    divisionId: body.divisionId,
  });

  const view = await buildAndCacheScrutineerView({
    competitionId: body.competitionId,
    sessionId: body.sessionId,
    divisionId: body.divisionId,
  });

  return NextResponse.json({ ok: true, view });
}
