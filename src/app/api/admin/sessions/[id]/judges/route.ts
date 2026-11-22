import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCompetitions, listSessions, setSessionJudges } from "@/lib/store/competitions";
import { getUser } from "@/lib/store/users";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;
  const body = (await request.json()) as { judgeIds?: string[]; competitionId?: string };
  const judgeIds = body.judgeIds ?? [];

  let competitionId = body.competitionId;
  if (!competitionId) {
    const competitions = await listCompetitions();
    for (const competition of competitions) {
      const sessions = await listSessions(competition.id);
      if (sessions.some((item) => item.id === sessionId)) {
        competitionId = competition.id;
        break;
      }
    }
  }
  if (!competitionId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  for (const judgeId of judgeIds) {
    const user = await getUser(judgeId);
    if (!user || (user.role !== "JUDGE" && user.role !== "ADMIN")) {
      return NextResponse.json({ error: "One or more judge ids are invalid." }, { status: 400 });
    }
  }

  await setSessionJudges(competitionId, sessionId, judgeIds);
  return NextResponse.json({ ok: true });
}
