import { NextResponse } from "next/server";
import { createSessionCookie, setSessionCookie, type Role } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  const body = (await request.json()) as { idToken?: string };
  const idToken = body.idToken ?? "";
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let decoded: { uid: string };
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  if (!profile.exists) {
    return NextResponse.json(
      { error: "User profile missing in Firestore. Re-run npm run seed." },
      { status: 401 },
    );
  }
  const data = profile.data() as { role: Role; username: string; displayName: string };

  await adminAuth.setCustomUserClaims(decoded.uid, {
    role: data.role,
    username: data.username,
    displayName: data.displayName,
  });

  const sessionCookie = await createSessionCookie(idToken);
  await setSessionCookie(sessionCookie);

  return NextResponse.json({ ok: true, role: data.role });
}
