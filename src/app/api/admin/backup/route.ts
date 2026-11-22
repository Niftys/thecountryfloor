import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listCompetitions,
  listDivisions,
  listHeats,
  listJudgeSheetsForHeat,
  listSessions,
} from "@/lib/store/competitions";
import { listUsers } from "@/lib/store/users";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listUsers();
  const competitions = await listCompetitions();
  const payload = [];

  for (const competition of competitions) {
    const divisions = await listDivisions(competition.id);
    const sessions = await listSessions(competition.id);
    const sessionPayload = [];
    for (const sess of sessions) {
      const heats = await listHeats(competition.id, sess.id);
      const heatPayload = [];
      for (const heat of heats) {
        const sheets = await listJudgeSheetsForHeat(competition.id, sess.id, heat.id);
        heatPayload.push({ ...heat, judgeSheets: sheets });
      }
      sessionPayload.push({ ...sess, heats: heatPayload });
    }
    payload.push({ ...competition, divisions, sessions: sessionPayload });
  }

  return NextResponse.json({
    format: "countryfloor.backup.v1",
    exportedAt: new Date().toISOString(),
    users,
    competitions: payload,
  });
}
