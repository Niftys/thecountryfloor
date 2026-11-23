import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Ensure Auth custom claims match the server session, and mint a custom token
 * when the browser client is not already signed in as that user.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const claims = {
      role: session.role,
      username: session.username,
      displayName: session.displayName,
    };

    const user = await adminAuth.getUser(session.id);
    const existing = (user.customClaims ?? {}) as Record<string, unknown>;
    if (
      existing.role !== claims.role ||
      existing.username !== claims.username ||
      existing.displayName !== claims.displayName
    ) {
      await adminAuth.setCustomUserClaims(session.id, claims);
    }

    let customToken: string | null = null;
    let tokenError: string | null = null;
    try {
      customToken = await adminAuth.createCustomToken(session.id, claims);
    } catch (err) {
      // App Hosting / ADC without Token Creator can fail here; client may still
      // refresh an existing password session after claims were updated.
      tokenError = err instanceof Error ? err.message : "createCustomToken failed";
      console.error("session-token createCustomToken:", tokenError);
    }

    return NextResponse.json({
      uid: session.id,
      role: session.role,
      customToken,
      tokenError,
    });
  } catch (err) {
    console.error("session-token", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not restore Firebase session." },
      { status: 500 },
    );
  }
}
