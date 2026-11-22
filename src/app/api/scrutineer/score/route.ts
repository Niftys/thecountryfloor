import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishLive } from "@/lib/live";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (session.role !== "SCRUTINEER" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    scoreId?: string;
    medal?: string | null;
    placement?: number | null;
    notes?: string;
    scratched?: boolean;
  };
  if (!body.scoreId) return NextResponse.json({ error: "Missing score" }, { status: 400 });

  const existing = await prisma.score.findUnique({
    where: { id: body.scoreId },
    include: {
      heatEntry: {
        include: { heat: { include: { session: { include: { competition: true } } } } },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: "Score not found" }, { status: 404 });
  if (!existing.heatEntry.heat.session.competition.active) {
    return NextResponse.json({ error: "This competition is inactive." }, { status: 403 });
  }

  const before = {
    medal: existing.medal,
    placement: existing.placement,
    notes: existing.notes,
    scratched: existing.scratched,
  };
  const after = {
    medal: body.scratched ? null : body.medal ?? null,
    placement: body.scratched ? null : body.placement ?? null,
    notes: body.notes ?? "",
    scratched: Boolean(body.scratched),
  };

  await prisma.score.update({
    where: { id: body.scoreId },
    data: {
      ...after,
      overridden: true,
    },
  });

  await prisma.scoreAudit.create({
    data: {
      scoreId: body.scoreId,
      actorId: session.id,
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(after),
    },
  });

  publishLive({
    type: "scores",
    competitionId: existing.heatEntry.heat.session.competitionId,
    sessionId: existing.heatEntry.heat.sessionId,
    heatId: existing.heatEntry.heatId,
  });

  return NextResponse.json({ ok: true });
}
