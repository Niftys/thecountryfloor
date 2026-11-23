import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildAndCacheScrutineerView } from "@/lib/results";
import { parseScoreKey } from "@/lib/store/paths";
import {
  getCompetition,
  getHeat,
  getUsersByIds,
  listJudgeSheetsForHeat,
  updateJudgeMark,
} from "@/lib/store/competitions";
import { medalPlacementConflict, requiresPlacement } from "@/lib/scoring";

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

  const scratched = Boolean(body.scratched);
  const medal = scratched ? null : (body.medal ?? null);
  const placement =
    scratched || !requiresPlacement(entry.scale) || body.placement == null
      ? null
      : body.placement;

  if (!scratched && !medal) {
    return NextResponse.json({ error: "Medal is required unless scratched." }, { status: 400 });
  }
  if (!scratched && requiresPlacement(entry.scale) && placement == null) {
    return NextResponse.json({ error: "Place is required for Couples." }, { status: 400 });
  }

  if (!scratched && requiresPlacement(entry.scale) && placement != null && medal) {
    const sheets = await listJudgeSheetsForHeat(
      body.competitionId,
      body.sessionId,
      parsed.heatId,
    );
    const divisionEntries = heat.entries.filter((item) => item.divisionId === entry.divisionId);
    const thisJudgeRows = divisionEntries.flatMap((heatEntry) => {
      const mark =
        heatEntry.id === parsed.entryId
          ? { medal, placement, scratched: false }
          : sheets.find((sheet) => sheet.judgeId === parsed.judgeId)?.marks[heatEntry.id];
      if (!mark || mark.scratched || !mark.medal || mark.placement == null) return [];
      return [{ bib: heatEntry.bib, medal: mark.medal, placement: mark.placement }];
    });
    const conflict = medalPlacementConflict(thisJudgeRows, entry.scale);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 400 });
  }

  const users = await getUsersByIds([parsed.judgeId]);
  const judge = users.get(parsed.judgeId);

  await updateJudgeMark({
    competitionId: body.competitionId,
    sessionId: body.sessionId,
    heatId: parsed.heatId,
    judgeId: parsed.judgeId,
    entryId: parsed.entryId,
    mark: {
      medal,
      placement,
      notes: body.notes ?? "",
      scratched,
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
