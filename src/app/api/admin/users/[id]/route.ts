import { NextResponse } from "next/server";
import { getSession, type Role } from "@/lib/auth";
import { countAdmins, deleteUser, getUser, updateUser } from "@/lib/store/users";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json()) as {
    displayName?: string;
    role?: Role;
    password?: string;
    username?: string;
  };

  const existing = await getUser(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.role && body.role !== "ADMIN" && existing.role === "ADMIN") {
    const admins = await countAdmins();
    if (admins <= 1) {
      return NextResponse.json({ error: "Cannot demote the last admin." }, { status: 400 });
    }
  }

  try {
    const user = await updateUser(id, body);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (id === session.id) {
    return NextResponse.json({ error: "Cannot delete yourself." }, { status: 400 });
  }
  const existing = await getUser(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.role === "ADMIN") {
    const admins = await countAdmins();
    if (admins <= 1) {
      return NextResponse.json({ error: "Cannot delete the last admin." }, { status: 400 });
    }
  }
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
