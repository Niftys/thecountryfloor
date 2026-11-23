"use client";

import { signInWithCustomToken, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { getClientAuth } from "@/lib/firebase/client";

/**
 * Ensures the Firebase web client is signed in with role claims whenever a
 * server __session exists. Scrutineer live listeners need this; the cookie alone is not enough.
 */
export function ClientAuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncFromServerSession() {
      const auth = getClientAuth();
      try {
        const response = await fetch("/api/auth/session-token", { method: "POST" });
        if (response.status === 401) {
          if (auth.currentUser) await signOut(auth);
          if (!cancelled) {
            setReady(true);
            setError(null);
          }
          return;
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not restore Firebase session.");
        }
        const body = (await response.json()) as { customToken: string };
        const credential = await signInWithCustomToken(auth, body.customToken);
        // Force a fresh ID token so Firestore rules see role claims immediately.
        await credential.user.getIdToken(true);
        const token = await credential.user.getIdTokenResult(true);
        if (!token.claims.role) {
          throw new Error("Signed in, but role claim is missing for Firestore rules.");
        }
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setReady(true);
          setError(err instanceof Error ? err.message : "Firebase client auth failed.");
        }
      }
    }

    void syncFromServerSession();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return (
    <>
      {error ? (
        <div style={{ padding: 12, background: "#ffebee", color: "#b71c1c", fontSize: 14 }}>
          Live updates may be offline: {error}
        </div>
      ) : null}
      {children}
    </>
  );
}
