import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishLive } from "@/lib/live";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = (await request.json()) as {
    username?: string;
    displayName?: string;
    password?: string;
    role?: string;
  };

  const username = body.username?.trim();
  const displayName = body.displayName?.trim();
  const role = body.role?.trim();
  const password = body.password;

  if (username !== undefined && !username) {
    return NextResponse.json({ error: "Username cannot be empty." }, { status: 400 });
  }
  if (displayName !== undefined && !displayName) {
    return NextResponse.json({ error: "Display name cannot be empty." }, { status: 400 });
  }
  if (role !== undefined && !["ADMIN", "JUDGE", "SCRUTINEER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (password !== undefined && password !== "" && password.length < 1) {
    return NextResponse.json({ error: "Password cannot be empty." }, { status: 400 });
  }

  // Keep at least one admin
  if (existing.role === "ADMIN" && role && role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Cannot demote the last admin." }, { status: 400 });
    }
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        ...(username !== undefined ? { username } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(password ? { passwordHash: bcrypt.hashSync(password, 10) } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  publishLive({ type: "users" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.id) {
    return NextResponse.json({ error: "You cannot delete your own account while signed in." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (existing.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Cannot delete the last admin." }, { status: 400 });
    }
  }

  await prisma.score.deleteMany({ where: { judgeId: id } });
  await prisma.heatSubmission.deleteMany({ where: { judgeId: id } });
  await prisma.sessionJudge.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });

  publishLive({ type: "users" });
  return NextResponse.json({ ok: true });
}
