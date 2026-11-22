import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishLive } from "@/lib/live";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    username?: string;
    displayName?: string;
    password?: string;
    role?: string;
  };
  const username = body.username?.trim() ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const password = body.password ?? "";
  const role = body.role ?? "JUDGE";
  if (!username || !displayName || !password || !["ADMIN", "JUDGE", "SCRUTINEER"].includes(role)) {
    return NextResponse.json(
      { error: "Username, display name, password, and role are required." },
      { status: 400 },
    );
  }

  try {
    await prisma.user.create({
      data: {
        username,
        displayName,
        role,
        passwordHash: bcrypt.hashSync(password, 10),
      },
    });
  } catch {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  publishLive({ type: "users" });
  return NextResponse.json({ ok: true });
}
