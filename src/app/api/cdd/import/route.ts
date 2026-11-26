import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { importCddCompetition } from "@/lib/cdd/importCompetition";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const result = await importCddCompetition(raw, { preview });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
