import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadScrutineerView } from "@/lib/results";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "SCRUTINEER" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const competitionId = searchParams.get("competitionId");
  const sessionId = searchParams.get("sessionId");
  const divisionId = searchParams.get("divisionId");
  const force = searchParams.get("rebuild") === "1";

  if (!competitionId || !sessionId || !divisionId) {
    return NextResponse.json({ error: "Missing scope" }, { status: 400 });
  }

  const view = await loadScrutineerView({
    competitionId,
    sessionId,
    divisionId,
    forceRebuild: force,
  });
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}
