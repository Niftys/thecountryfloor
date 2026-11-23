import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadScrutineerView } from "@/lib/results";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "SCRUTINEER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId");
  const sessionId = url.searchParams.get("sessionId");
  const divisionId = url.searchParams.get("divisionId");
  if (!competitionId || !sessionId || !divisionId) {
    return NextResponse.json({ error: "Missing scope" }, { status: 400 });
  }

  const view = await loadScrutineerView({
    competitionId,
    sessionId,
    divisionId,
    forceRebuild: true,
  });
  if (!view?.packet) return NextResponse.json({ error: "No session" }, { status: 404 });
  return NextResponse.json(view.packet);
}
