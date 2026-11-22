import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCompetition, setCompetitionActive } from "@/lib/store/competitions";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json()) as { active?: boolean };
  const existing = await getCompetition(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (typeof body.active === "boolean") {
    await setCompetitionActive(id, body.active);
  }
  const updated = await getCompetition(id);
  return NextResponse.json({ ok: true, competition: updated });
}
