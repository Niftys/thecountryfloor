import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishLive } from "@/lib/live";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { judgeIds?: string[] };
  const judgeIds = body.judgeIds ?? [];

  const sess = await prisma.session.findUnique({
    where: { id },
    include: { competition: true },
  });
  if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const users = await prisma.user.findMany({
    where: { id: { in: judgeIds }, role: { in: ["JUDGE", "ADMIN"] } },
  });
  if (users.length !== judgeIds.length) {
    return NextResponse.json({ error: "One or more judge ids are invalid." }, { status: 400 });
  }

  await prisma.sessionJudge.deleteMany({ where: { sessionId: id } });
  for (const [index, judgeId] of judgeIds.entries()) {
    await prisma.sessionJudge.create({
      data: { sessionId: id, userId: judgeId, sortOrder: index },
    });
  }

  publishLive({ type: "competition", competitionId: sess.competitionId, sessionId: id });
  return NextResponse.json({ ok: true });
}
