import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, competitions] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, username: true, displayName: true, role: true },
      orderBy: { username: "asc" },
    }),
    prisma.competition.findMany({
      include: {
        divisions: { include: { dances: true, competitors: true } },
        sessions: {
          include: {
            judges: { include: { user: { select: { username: true, displayName: true } } } },
            heats: {
              include: {
                entries: {
                  include: {
                    competitor: true,
                    dance: true,
                    scores: {
                      include: { judge: { select: { username: true, displayName: true } } },
                    },
                  },
                },
                submissions: {
                  include: { judge: { select: { username: true, displayName: true } } },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    format: "countryfloor.backup.v1",
    exportedAt: new Date().toISOString(),
    users,
    competitions,
  });
}
