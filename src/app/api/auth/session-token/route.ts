import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase/admin";

/** Mint a custom token for the current __session user so client Firestore listeners work. */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const claims = {
    role: session.role,
    username: session.username,
    displayName: session.displayName,
  };
  await adminAuth.setCustomUserClaims(session.id, claims);
  const customToken = await adminAuth.createCustomToken(session.id, claims);
  return NextResponse.json({ customToken });
}
