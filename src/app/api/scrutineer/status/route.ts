import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildScrutineerView, loadAuditsForDivision, loadCompetition } from "@/lib/results";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "SCRUTINEER" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId");
  const sessionId = url.searchParams.get("sessionId");
  const divisionId = url.searchParams.get("divisionId");

  const competition = await loadCompetition(competitionId);
  if (!competition) return NextResponse.json({ error: "No competition" }, { status: 404 });
  if (!competition.active) {
    return NextResponse.json({ error: "This competition is inactive." }, { status: 403 });
  }
  const view = buildScrutineerView(competition, { sessionId, divisionId });
  if (!view) return NextResponse.json({ error: "No session" }, { status: 404 });
  const audits = await loadAuditsForDivision(view.competitionId, view.divisionId);
  return NextResponse.json({ ...view, audits });
}
