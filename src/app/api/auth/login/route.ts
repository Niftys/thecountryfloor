import { NextResponse } from "next/server";
import { createSessionCookie, setSessionCookie, type Role } from "@/lib/auth";
import { adminAuth, adminDb, authEmailForUsername } from "@/lib/firebase/admin";

async function signInWithPassword(email: string, password: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set");
  }

  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const url = emulator
    ? `http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`
    : `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = (await response.json()) as {
    idToken?: string;
    localId?: string;
    error?: { message?: string };
  };
  if (!response.ok || !body.idToken || !body.localId) {
    return null;
  }
  return { idToken: body.idToken, uid: body.localId };
}

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const username = body.username?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const email = authEmailForUsername(username);
  const signedIn = await signInWithPassword(email, password);
  if (!signedIn) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const profile = await adminDb.collection("users").doc(signedIn.uid).get();
  if (!profile.exists) {
    return NextResponse.json({ error: "User profile missing" }, { status: 401 });
  }
  const data = profile.data() as { role: Role; username: string; displayName: string };

  // Keep claims in sync for session cookie decoding.
  await adminAuth.setCustomUserClaims(signedIn.uid, {
    role: data.role,
    username: data.username,
    displayName: data.displayName,
  });

  // Fresh token after claims update.
  const refreshed = await signInWithPassword(email, password);
  if (!refreshed) {
    return NextResponse.json({ error: "Could not refresh session" }, { status: 500 });
  }

  const sessionCookie = await createSessionCookie(refreshed.idToken);
  await setSessionCookie(sessionCookie);
  const customToken = await adminAuth.createCustomToken(refreshed.uid, {
    role: data.role,
    username: data.username,
    displayName: data.displayName,
  });
  return NextResponse.json({ ok: true, role: data.role, customToken });
}
