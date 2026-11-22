import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishLive } from "@/lib/live";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { active?: boolean };
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active must be true or false" }, { status: 400 });
  }

  const existing = await prisma.competition.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  const updated = await prisma.competition.update({
    where: { id },
    data: { active: body.active },
  });

  publishLive({ type: "competition", competitionId: updated.id });

  return NextResponse.json({ ok: true, active: updated.active });
}
