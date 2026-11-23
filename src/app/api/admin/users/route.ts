import { NextResponse } from "next/server";
import { getSession, type Role } from "@/lib/auth";
import { createUser, listUsers } from "@/lib/store/users";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    username?: string;
    displayName?: string;
    role?: Role;
    password?: string;
  };

  if (!body.username || !body.displayName || !body.role || !body.password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (body.password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (!["ADMIN", "JUDGE", "SCRUTINEER"].includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    const user = await createUser({
      username: body.username,
      displayName: body.displayName,
      role: body.role,
      password: body.password,
    });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create user" },
      { status: 400 },
    );
  }
}
